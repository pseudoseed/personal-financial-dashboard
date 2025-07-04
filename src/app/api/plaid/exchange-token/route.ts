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
      console.log(`[PLAID] Re-authentication detected for institutionId=${institutionId}. Found ${existingInstitutions.length} existing PlaidItems`);
      
      // Check if any of the existing items are disconnected (indicating external token revocation)
      const disconnectedItems = existingInstitutions.filter(item => item.status === 'disconnected');
      const activeItems = existingInstitutions.filter(item => item.status === 'active' && item.accounts.length > 0);
      
      if (disconnectedItems.length > 0) {
        console.log(`[PLAID] Found ${disconnectedItems.length} disconnected PlaidItems - this appears to be a reconnection after external token revocation`);
        
        // If we have disconnected items, prefer the one with the most accounts
        const bestDisconnectedItem = disconnectedItems.sort((a, b) => b.accounts.length - a.accounts.length)[0];
        existingInstitution = bestDisconnectedItem;
        console.log(`[PLAID] Selected disconnected PlaidItem ${existingInstitution.id} with ${existingInstitution.accounts.length} accounts for reconnection`);
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

      // Update existing accounts and create new ones
      for (const plaidAccount of plaidAccounts) {
        const existingAccount = existingAccounts.find(
          (acc) => acc.plaidId === plaidAccount.account_id
        );

        if (existingAccount) {
          // Update existing account
          await prisma.account.update({
            where: { id: existingAccount.id },
            data: {
              name: plaidAccount.name,
              type: plaidAccount.type,
              subtype: plaidAccount.subtype || null,
              mask: plaidAccount.mask || null,
            },
          });
        } else {
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
        
        // After merge, synchronize plaidId values for remaining accounts
        console.log(`[PLAID] Synchronizing plaidId values for remaining accounts after merge`);
        const remainingAccounts = await prisma.account.findMany({
          where: { 
            itemId: existingInstitution.id,
            archived: false
          },
        });
        
        for (const plaidAccount of plaidAccounts) {
          // Find matching account by name, type, and subtype (not plaidId since it might be outdated)
          const matchingAccount = remainingAccounts.find(
            (acc) => acc.name === plaidAccount.name && 
                     acc.type === plaidAccount.type && 
                     acc.subtype === plaidAccount.subtype &&
                     (acc.mask === plaidAccount.mask || (!acc.mask && !plaidAccount.mask))
          );
          
          if (matchingAccount && matchingAccount.plaidId !== plaidAccount.account_id) {
            console.log(`[PLAID] Updating plaidId for account ${matchingAccount.id} from ${matchingAccount.plaidId} to ${plaidAccount.account_id}`);
            await prisma.account.update({
              where: { id: matchingAccount.id },
              data: { plaidId: plaidAccount.account_id },
            });
          }
        }
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
        
        // After merge, synchronize plaidId values for remaining accounts
        console.log(`[PLAID] Synchronizing plaidId values for remaining accounts after merge`);
        const remainingAccounts = await prisma.account.findMany({
          where: { 
            itemId: newInstitution.id,
            archived: false
          },
        });
        
        for (const plaidAccount of plaidAccounts) {
          // Find matching account by name, type, and subtype (not plaidId since it might be outdated)
          const matchingAccount = remainingAccounts.find(
            (acc) => acc.name === plaidAccount.name && 
                     acc.type === plaidAccount.type && 
                     acc.subtype === plaidAccount.subtype &&
                     (acc.mask === plaidAccount.mask || (!acc.mask && !plaidAccount.mask))
          );
          
          if (matchingAccount && matchingAccount.plaidId !== plaidAccount.account_id) {
            console.log(`[PLAID] Updating plaidId for account ${matchingAccount.id} from ${matchingAccount.plaidId} to ${plaidAccount.account_id}`);
            await prisma.account.update({
              where: { id: matchingAccount.id },
              data: { plaidId: plaidAccount.account_id },
            });
          }
        }
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
