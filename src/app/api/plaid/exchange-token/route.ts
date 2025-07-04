import { NextResponse } from "next/server";
import { plaidClient } from "@/lib/plaid";
import { prisma } from "@/lib/db";
import { CountryCode } from "plaid";
import { institutionLogos } from "@/lib/institutionLogos";
import { detectDuplicates, mergeDuplicateAccounts, getMergeMessage } from "@/lib/duplicateDetection";
import { getCurrentUserId } from "@/lib/userManagement";
import { ensureDefaultUser } from '@/lib/startupValidation';
import { disconnectPlaidTokens } from "@/lib/plaid";
import { trackPlaidApiCall, getCurrentUserId as getTrackingUserId, getAppInstanceId } from "@/lib/plaidTracking";
import { backupPlaidItem } from "@/lib/accessTokenBackup";

function formatLogoUrl(
  logo: string | null | undefined,
  institutionId: string
): string | null {
  // First try the Plaid-provided logo
  if (logo) {
    // Check if it's already a data URL or regular URL
    if (logo.startsWith("data:") || logo.startsWith("http")) {
      return logo;
    }
    // Otherwise, assume it's a base64 string and format it as a data URL
    return `data:image/png;base64,${logo}`;
  }

  // If no Plaid logo, try the fallback logo
  return institutionLogos[institutionId] || null;
}

// Helper function to match accounts based on their characteristics
function findMatchingAccount(account: any, existingAccounts: any[]) {
  return existingAccounts.find(
    (existing) =>
      // Match by mask (last 4 digits) if available
      account.mask &&
      existing.mask === account.mask &&
      // Match by account type
      existing.type === account.type &&
      // Match by subtype if available
      ((!account.subtype && !existing.subtype) ||
        existing.subtype === account.subtype)
  );
}

/**
 * Safely synchronize plaidId values for accounts after merge operations
 * This function prevents unique constraint violations by checking for conflicts
 * and handles re-authentication scenarios where old accounts need to be replaced
 * Also includes cleanup for orphaned accounts after re-authentication
 */
async function synchronizePlaidIdsSafely(itemId: string, plaidAccounts: any[]) {
  try {
    // Get all remaining accounts for this PlaidItem
    const remainingAccounts = await prisma.account.findMany({
      where: { 
        itemId: itemId,
        archived: false
      },
    });

    // Create a map of target plaidId to account for conflict detection
    const targetPlaidIdMap = new Map<string, any>();
    const updatesNeeded: Array<{ accountId: string, oldPlaidId: string, newPlaidId: string }> = [];
    const replacementsNeeded: Array<{ oldAccountId: string, newAccountId: string, plaidId: string }> = [];

    // First pass: identify all needed updates and check for conflicts
    for (const plaidAccount of plaidAccounts) {
      // Find matching account by name, type, and subtype (not plaidId since it might be outdated)
      const matchingAccount = remainingAccounts.find(
        (acc) => acc.name === plaidAccount.name && 
                 acc.type === plaidAccount.type && 
                 acc.subtype === plaidAccount.subtype &&
                 (acc.mask === plaidAccount.mask || (!acc.mask && !plaidAccount.mask))
      );
      
      if (matchingAccount && matchingAccount.plaidId !== plaidAccount.account_id) {
        // Check if the target plaidId is already assigned to another account
        const existingAccountWithTargetPlaidId = remainingAccounts.find(
          acc => acc.id !== matchingAccount.id && acc.plaidId === plaidAccount.account_id
        );

        if (existingAccountWithTargetPlaidId) {
          console.log(`[PLAID] RE-AUTH CONFLICT: Target plaidId ${plaidAccount.account_id} already assigned to account ${existingAccountWithTargetPlaidId.id} (${existingAccountWithTargetPlaidId.name})`);
          console.log(`[PLAID] RE-AUTH RESOLUTION: Will replace old account ${matchingAccount.id} (${matchingAccount.name}) with new account ${existingAccountWithTargetPlaidId.id}`);
          
          // This is a re-authentication scenario - we need to replace the old account with the new one
          replacementsNeeded.push({
            oldAccountId: matchingAccount.id,
            newAccountId: existingAccountWithTargetPlaidId.id,
            plaidId: plaidAccount.account_id
          });
          continue;
        }

        // Check if this target plaidId is already queued for another update
        if (targetPlaidIdMap.has(plaidAccount.account_id)) {
          console.log(`[PLAID] CONFLICT: Target plaidId ${plaidAccount.account_id} already queued for update to account ${targetPlaidIdMap.get(plaidAccount.account_id).accountId}`);
          console.log(`[PLAID] Skipping update for account ${matchingAccount.id} (${matchingAccount.name}) to avoid constraint violation`);
          continue;
        }

        // This update is safe to proceed
        targetPlaidIdMap.set(plaidAccount.account_id, matchingAccount);
        updatesNeeded.push({
          accountId: matchingAccount.id,
          oldPlaidId: matchingAccount.plaidId,
          newPlaidId: plaidAccount.account_id
        });
      }
    }

    // Second pass: identify orphaned accounts (accounts that exist in DB but not in Plaid response)
    const orphanedAccounts = remainingAccounts.filter(account => {
      // Check if this account exists in the Plaid response by matching characteristics
      const accountInPlaidResponse = plaidAccounts.find(
        plaidAcc => plaidAcc.name === account.name && 
                   plaidAcc.type === account.type && 
                   plaidAcc.subtype === account.subtype &&
                   (plaidAcc.mask === account.mask || (!plaidAcc.mask && !account.mask))
      );
      
      // If no matching account found in Plaid response, it's orphaned
      return !accountInPlaidResponse;
    });

    if (orphanedAccounts.length > 0) {
      console.log(`[PLAID] CLEANUP: Found ${orphanedAccounts.length} orphaned accounts that no longer exist in Plaid response`);
      orphanedAccounts.forEach(account => {
        console.log(`[PLAID] CLEANUP: Orphaned account: ${account.name} (${account.id}) with plaidId ${account.plaidId}`);
      });
    }

    if (updatesNeeded.length === 0 && replacementsNeeded.length === 0 && orphanedAccounts.length === 0) {
      console.log(`[PLAID] No plaidId updates or cleanup needed for item ${itemId}`);
      return;
    }

    console.log(`[PLAID] Found ${updatesNeeded.length} safe plaidId updates, ${replacementsNeeded.length} account replacements, and ${orphanedAccounts.length} orphaned accounts for item ${itemId}`);

    // Third pass: execute updates, replacements, and cleanup within a transaction for consistency
    await prisma.$transaction(async (tx) => {
      // First, handle simple updates
      for (const update of updatesNeeded) {
        console.log(`[PLAID] Updating plaidId for account ${update.accountId} from ${update.oldPlaidId} to ${update.newPlaidId}`);
        
        // Double-check that the target plaidId is still available
        const conflictingAccount = await tx.account.findFirst({
          where: {
            plaidId: update.newPlaidId,
            id: { not: update.accountId }
          }
        });

        if (conflictingAccount) {
          console.log(`[PLAID] CONFLICT DETECTED: plaidId ${update.newPlaidId} now assigned to account ${conflictingAccount.id} - skipping update`);
          continue;
        }

        // Perform the update
        await tx.account.update({
          where: { id: update.accountId },
          data: { plaidId: update.newPlaidId },
        });
      }

      // Then, handle account replacements for re-authentication scenarios
      for (const replacement of replacementsNeeded) {
        console.log(`[PLAID] RE-AUTH REPLACEMENT: Transferring data from old account ${replacement.oldAccountId} to new account ${replacement.newAccountId}`);
        
        // Transfer balances from old account to new account
        const oldAccountBalances = await tx.accountBalance.findMany({
          where: { accountId: replacement.oldAccountId }
        });
        
        if (oldAccountBalances.length > 0) {
          await tx.accountBalance.updateMany({
            where: { accountId: replacement.oldAccountId },
            data: { accountId: replacement.newAccountId }
          });
          console.log(`[PLAID] RE-AUTH: Transferred ${oldAccountBalances.length} balance records`);
        }

        // Transfer transactions from old account to new account
        const oldAccountTransactions = await tx.transaction.findMany({
          where: { accountId: replacement.oldAccountId }
        });
        
        if (oldAccountTransactions.length > 0) {
          await tx.transaction.updateMany({
            where: { accountId: replacement.oldAccountId },
            data: { accountId: replacement.newAccountId }
          });
          console.log(`[PLAID] RE-AUTH: Transferred ${oldAccountTransactions.length} transaction records`);
        }

        // Transfer emergency fund references
        const emergencyFundRefs = await tx.emergencyFundAccount.findMany({
          where: { accountId: replacement.oldAccountId }
        });
        
        if (emergencyFundRefs.length > 0) {
          await tx.emergencyFundAccount.updateMany({
            where: { accountId: replacement.oldAccountId },
            data: { accountId: replacement.newAccountId }
          });
          console.log(`[PLAID] RE-AUTH: Transferred ${emergencyFundRefs.length} emergency fund references`);
        }

        // Transfer loan details
        const loanDetails = await tx.loanDetails.findUnique({
          where: { accountId: replacement.oldAccountId }
        });
        
        if (loanDetails) {
          await tx.loanDetails.update({
            where: { accountId: replacement.oldAccountId },
            data: { accountId: replacement.newAccountId }
          });
          console.log(`[PLAID] RE-AUTH: Transferred loan details`);
        }

        // Transfer recurring payments
        const recurringPayments = await tx.recurringPayment.findMany({
          where: { targetAccountId: replacement.oldAccountId }
        });
        
        if (recurringPayments.length > 0) {
          await tx.recurringPayment.updateMany({
            where: { targetAccountId: replacement.oldAccountId },
            data: { targetAccountId: replacement.newAccountId }
          });
          console.log(`[PLAID] RE-AUTH: Transferred ${recurringPayments.length} recurring payment records`);
        }

        // Archive the old account
        await tx.account.update({
          where: { id: replacement.oldAccountId },
          data: { 
            archived: true,
            updatedAt: new Date()
          }
        });
        console.log(`[PLAID] RE-AUTH: Archived old account ${replacement.oldAccountId}`);
      }

      // Finally, handle orphaned accounts cleanup
      for (const orphanedAccount of orphanedAccounts) {
        console.log(`[PLAID] CLEANUP: Archiving orphaned account ${orphanedAccount.name} (${orphanedAccount.id})`);
        
        // Archive the orphaned account
        await tx.account.update({
          where: { id: orphanedAccount.id },
          data: { 
            archived: true,
            updatedAt: new Date()
          }
        });
        console.log(`[PLAID] CLEANUP: Successfully archived orphaned account ${orphanedAccount.name}`);
      }
    });

    console.log(`[PLAID] Successfully synchronized plaidId values and cleaned up orphaned accounts for item ${itemId}`);
  } catch (error) {
    console.error(`[PLAID] Error synchronizing plaidId values for item ${itemId}:`, error);
    // Don't throw the error - this is a non-critical operation
    // The main token exchange should still succeed even if plaidId sync fails
  }
}

export async function POST(request: Request) {
  try {
    // Ensure default user exists
    const defaultUser = await ensureDefaultUser();
    if (!defaultUser) {
      console.error('[PLAID] Default user not found and could not be created');
      return NextResponse.json({ error: 'System not properly initialized' }, { status: 503 });
    }

    const body = await request.json();
    
    // Accept both public_token and publicToken field names
    const publicToken = body.publicToken || body.public_token;

    if (!publicToken) {
      return NextResponse.json(
        { error: "Public token is required" },
        { status: 400 }
      );
    }

    // Get the current user ID
    const userId = await getCurrentUserId();
    const trackingUserId = await getTrackingUserId();
    const appInstanceId = getAppInstanceId();

    // Exchange public token for access token
    const response = await trackPlaidApiCall(
      () => plaidClient.itemPublicTokenExchange({
        public_token: publicToken,
      }),
      {
        endpoint: '/item/public_token/exchange',
        userId: trackingUserId,
        appInstanceId,
        requestData: { publicToken: '***' } // Don't log the actual token
      }
    );

    const accessToken = response.data.access_token;
    const plaidItemId = response.data.item_id;

    // Get item information
    const itemResponse = await trackPlaidApiCall(
      () => plaidClient.itemGet({
        access_token: accessToken,
      }),
      {
        endpoint: '/item/get',
        userId: trackingUserId,
        appInstanceId,
        requestData: { accessToken: '***' } // Don't log the actual token
      }
    );

    const institutionId = itemResponse.data.item.institution_id;

    if (!institutionId) {
      return NextResponse.json(
        { error: "Invalid institution ID from Plaid" },
        { status: 400 }
      );
    }

    // Get institution information
    const institutionResponse = await trackPlaidApiCall(
      () => plaidClient.institutionsGetById({
        institution_id: institutionId,
        country_codes: [CountryCode.Us],
      }),
      {
        endpoint: '/institutions/get_by_id',
        institutionId,
        userId: trackingUserId,
        appInstanceId,
        requestData: { institutionId, countryCodes: [CountryCode.Us] }
      }
    );

    const institution = institutionResponse.data.institution;

    // Check if institution already exists by institutionId (not just itemId)
    // This handles the case where a user is re-authenticating an existing institution
    const existingInstitutions = await prisma.plaidItem.findMany({
      where: { 
        institutionId,
        provider: "plaid"
      },
      include: {
        accounts: true
      }
    });

    let existingInstitution = existingInstitutions.find(item => item.itemId === plaidItemId);
    let isReauthentication = false;

    // If no exact itemId match, but institution exists, this is a re-authentication
    if (!existingInstitution && existingInstitutions.length > 0) {
      isReauthentication = true;
      console.log(`[PLAID] Re-authentication detected for ${institutionId} (${existingInstitutions.length} existing items)`);
      
      // Check if any of the existing items are disconnected (indicating external token revocation)
      const disconnectedItems = existingInstitutions.filter(item => item.status === 'disconnected');
      const activeItems = existingInstitutions.filter(item => item.status === 'active' && item.accounts.length > 0);
      
      if (disconnectedItems.length > 0) {
        console.log(`[PLAID] Found ${disconnectedItems.length} disconnected items - reconnection after token revocation`);
        
        // If we have disconnected items, prefer the one with the most accounts
        const bestDisconnectedItem = disconnectedItems.sort((a, b) => b.accounts.length - a.accounts.length)[0];
        existingInstitution = bestDisconnectedItem;
        console.log(`[PLAID] Selected disconnected item ${existingInstitution.id} with ${existingInstitution.accounts.length} accounts for reconnection`);
      } else if (activeItems.length > 0) {
        // Sort by number of accounts and keep the one with most accounts
        activeItems.sort((a, b) => b.accounts.length - a.accounts.length);
        existingInstitution = activeItems[0];
        console.log(`[PLAID] Selected existing PlaidItem ${existingInstitution.id} with ${existingInstitution.accounts.length} accounts for update`);
      } else {
        // If no active items, use the first one
        existingInstitution = existingInstitutions[0];
        console.log(`[PLAID] No active PlaidItems found, using ${existingInstitution.id} for update`);
      }
    }

    if (existingInstitution) {
      console.log(`[PLAID] Updating existing PlaidItem: id=${existingInstitution.id}, institutionId=${institutionId}, plaidItemId=${plaidItemId}, isReauthentication=${isReauthentication}`);

      // If this is a re-authentication, disconnect old PlaidItems first
      if (isReauthentication) {
        const itemsToDisconnect = existingInstitutions.filter(item => item.id !== existingInstitution!.id);
        if (itemsToDisconnect.length > 0) {
          console.log(`[PLAID] Disconnecting ${itemsToDisconnect.length} old PlaidItems during re-authentication`);
          
          const disconnectResult = await disconnectPlaidTokens(
            itemsToDisconnect.map(item => ({
              id: item.id,
              accessToken: item.accessToken,
              institutionId: item.institutionId,
              institutionName: item.institutionName
            }))
          );
          
          console.log(`[PLAID] Disconnected ${disconnectResult.success.length} old tokens, ${disconnectResult.failed.length} failed`);
        }
      }

      // Update existing institution with new access token
      const updatedInstitution = await prisma.plaidItem.update({
        where: { id: existingInstitution.id },
        data: {
          itemId: plaidItemId, // Update to new itemId
          accessToken,
          institutionName: institution.name ?? null,
          institutionLogo: institution.logo ?? null,
          status: 'active', // Ensure it's marked as active
        },
      });

      // Backup the updated access token
      const backupResult = await backupPlaidItem(updatedInstitution);
      if (backupResult.success) {
        console.log(`[PLAID] Access token backed up: ${backupResult.message}`);
      } else {
        console.warn(`[PLAID] Failed to backup access token: ${backupResult.message}`);
      }

      // Get existing accounts for this institution
      const existingAccounts = await prisma.account.findMany({
        where: { itemId: existingInstitution.id },
      });

      // Get accounts from Plaid using new access token
      const accountsResponse = await trackPlaidApiCall(
        () => plaidClient.accountsGet({
          access_token: accessToken,
        }),
        {
          endpoint: '/accounts/get',
          institutionId,
          userId: trackingUserId,
          appInstanceId,
          requestData: { accessToken: '***' } // Don't log the actual token
        }
      );

      const plaidAccounts = accountsResponse.data.accounts;

      // Enhanced re-authentication logic: Update existing accounts and create new ones
      for (const plaidAccount of plaidAccounts) {
        // First, try to find by exact plaidId match (for non-re-authentication cases)
        let existingAccount = existingAccounts.find(
          (acc) => acc.plaidId === plaidAccount.account_id
        );

        // If no exact plaidId match and this is re-authentication, try matching by account characteristics
        if (!existingAccount && isReauthentication) {
          console.log(`[PLAID] RE-AUTH: No exact plaidId match for ${plaidAccount.name}, trying characteristic matching`);
          
          existingAccount = existingAccounts.find(
            (acc) => acc.name === plaidAccount.name && 
                     acc.type === plaidAccount.type && 
                     acc.subtype === plaidAccount.subtype &&
                     (acc.mask === plaidAccount.mask || (!acc.mask && !plaidAccount.mask))
          );

          if (existingAccount) {
            console.log(`[PLAID] RE-AUTH: Found matching account by characteristics: ${existingAccount.name} (${existingAccount.id})`);
            console.log(`[PLAID] RE-AUTH: Updating plaidId from ${existingAccount.plaidId} to ${plaidAccount.account_id}`);
          }
        }

        if (existingAccount) {
          // Update existing account (including plaidId if it changed during re-authentication)
          await prisma.account.update({
            where: { id: existingAccount.id },
            data: {
              plaidId: plaidAccount.account_id, // Always update plaidId during re-authentication
              name: plaidAccount.name,
              type: plaidAccount.type,
              subtype: plaidAccount.subtype || null,
              mask: plaidAccount.mask || null,
            },
          });
          
          if (isReauthentication && existingAccount.plaidId !== plaidAccount.account_id) {
            console.log(`[PLAID] RE-AUTH: Successfully updated plaidId for ${existingAccount.name}`);
          }
        } else {
          // Check if this plaidId already exists in the database (from another institution)
          const existingAccountWithPlaidId = await prisma.account.findUnique({
            where: { plaidId: plaidAccount.account_id }
          });

          if (existingAccountWithPlaidId) {
            console.log(`[PLAID] WARNING: plaidId ${plaidAccount.account_id} already exists for account ${existingAccountWithPlaidId.id} (${existingAccountWithPlaidId.name})`);
            console.log(`[PLAID] Skipping creation of duplicate account to avoid constraint violation`);
            continue;
          }

          // Create new account
          await prisma.account.create({
            data: {
              plaidId: plaidAccount.account_id,
              name: plaidAccount.name,
              type: plaidAccount.type,
              subtype: plaidAccount.subtype || null,
              mask: plaidAccount.mask || null,
              itemId: existingInstitution.id,
              userId: userId,
            },
          });
          
          console.log(`[PLAID] Created new account: ${plaidAccount.name} (${plaidAccount.account_id})`);
        }
      }

      // Check for and merge duplicates (this should now be minimal since we cleaned up old connections)
      const duplicateGroup = institutionId ? await detectDuplicates(institutionId) : null;
      let mergeMessage = null;
      
      if (duplicateGroup && duplicateGroup.shouldMerge) {
        const mergeResult = await mergeDuplicateAccounts(duplicateGroup);
        mergeMessage = getMergeMessage(duplicateGroup, mergeResult);
        console.log(`[PLAID] Auto-merged duplicates for institutionId=${institutionId}:`, mergeMessage);
        console.log(`[PLAID] Disconnected ${mergeResult.disconnectedTokens.length} Plaid tokens during merge`);
        
        // After merge, safely synchronize plaidId values for remaining accounts
        console.log(`[PLAID] Synchronizing plaidId values for remaining accounts after merge`);
        await synchronizePlaidIdsSafely(existingInstitution.id, plaidAccounts);
      }

      const message = isReauthentication 
        ? "Institution re-authenticated successfully" 
        : "Institution updated successfully";

      return NextResponse.json({
        message,
        institutionId: existingInstitution.id,
        mergeMessage,
        isReauthentication,
      });
    } else {
      // Create new institution
      const newInstitution = await prisma.plaidItem.create({
        data: {
          itemId: plaidItemId,
          accessToken,
          institutionId,
          institutionName: institution.name ?? null,
          institutionLogo: institution.logo ?? null,
          status: 'active',
        },
      });

      // Backup the new access token
      const backupResult = await backupPlaidItem(newInstitution);
      if (backupResult.success) {
        console.log(`[PLAID] New access token backed up: ${backupResult.message}`);
      } else {
        console.warn(`[PLAID] Failed to backup new access token: ${backupResult.message}`);
      }

      console.log(`[PLAID] Created new PlaidItem: id=${newInstitution.id}, institutionId=${institutionId}, plaidItemId=${plaidItemId}`);

      // Get accounts from Plaid
      const accountsResponse = await trackPlaidApiCall(
        () => plaidClient.accountsGet({
          access_token: accessToken,
        }),
        {
          endpoint: '/accounts/get',
          institutionId,
          userId: trackingUserId,
          appInstanceId,
          requestData: { accessToken: '***' } // Don't log the actual token
        }
      );

      const plaidAccounts = accountsResponse.data.accounts;

      // Create accounts
      for (const plaidAccount of plaidAccounts) {
        // Check if this plaidId already exists in the database (from another institution)
        const existingAccountWithPlaidId = await prisma.account.findUnique({
          where: { plaidId: plaidAccount.account_id }
        });

        if (existingAccountWithPlaidId) {
          console.log(`[PLAID] WARNING: plaidId ${plaidAccount.account_id} already exists for account ${existingAccountWithPlaidId.id} (${existingAccountWithPlaidId.name})`);
          console.log(`[PLAID] Skipping creation of duplicate account to avoid constraint violation`);
          continue;
        }

        await prisma.account.create({
          data: {
            plaidId: plaidAccount.account_id,
            name: plaidAccount.name,
            type: plaidAccount.type,
            subtype: plaidAccount.subtype || null,
            mask: plaidAccount.mask || null,
            itemId: newInstitution.id,
            userId: userId,
          },
        });
      }

      // Check for and merge duplicates
      const duplicateGroup = institutionId ? await detectDuplicates(institutionId) : null;
      let mergeMessage = null;
      
      if (duplicateGroup && duplicateGroup.shouldMerge) {
        const mergeResult = await mergeDuplicateAccounts(duplicateGroup);
        mergeMessage = getMergeMessage(duplicateGroup, mergeResult);
        console.log(`[PLAID] Auto-merged duplicates for institutionId=${institutionId}:`, mergeMessage);
        console.log(`[PLAID] Disconnected ${mergeResult.disconnectedTokens.length} Plaid tokens during merge`);
        
        // After merge, safely synchronize plaidId values for remaining accounts
        console.log(`[PLAID] Synchronizing plaidId values for remaining accounts after merge`);
        await synchronizePlaidIdsSafely(newInstitution.id, plaidAccounts);
      }

      return NextResponse.json({
        message: "Institution connected successfully",
        institutionId: newInstitution.id,
        mergeMessage,
      });
    }
  } catch (error) {
    // Safely handle null/undefined error values
    const errorMessage = error instanceof Error ? error.message : String(error || 'Unknown error');
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    // Log error safely without passing potentially null error object
    console.error("Error exchanging token:", {
      message: errorMessage,
      stack: errorStack,
      timestamp: new Date().toISOString()
    });
    
    return NextResponse.json(
      { error: "Failed to exchange token" },
      { status: 500 }
    );
  }
}
