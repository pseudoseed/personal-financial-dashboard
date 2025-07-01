import { NextResponse } from "next/server";
import { plaidClient } from "@/lib/plaid";
import { prisma } from "@/lib/db";
import { CountryCode } from "plaid";
import { institutionLogos } from "@/lib/institutionLogos";
import { detectDuplicates, mergeDuplicateAccounts, getMergeMessage } from "@/lib/duplicateDetection";
import { getCurrentUserId } from "@/lib/userManagement";
import { ensureDefaultUser } from '@/lib/startupValidation';

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
    // Ensure default user exists before processing request
    const userExists = await ensureDefaultUser();
    if (!userExists) {
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

    // Exchange public token for access token
    const response = await plaidClient.itemPublicTokenExchange({
      public_token: publicToken,
    });

    const accessToken = response.data.access_token;
    const plaidItemId = response.data.item_id;

    // Get item information
    const itemResponse = await plaidClient.itemGet({
      access_token: accessToken,
    });

    const institutionId = itemResponse.data.item.institution_id;

    if (!institutionId) {
      return NextResponse.json(
        { error: "Invalid institution ID from Plaid" },
        { status: 400 }
      );
    }

    // Get institution information
    const institutionResponse = await plaidClient.institutionsGetById({
      institution_id: institutionId,
      country_codes: [CountryCode.Us],
    });

    const institution = institutionResponse.data.institution;

    // Check if institution already exists
    const existingInstitution = await prisma.plaidItem.findFirst({
      where: { itemId: plaidItemId },
    });

    if (existingInstitution) {
      // Update existing institution
      await prisma.plaidItem.update({
        where: { id: existingInstitution.id },
        data: {
          accessToken,
          institutionName: institution.name ?? null,
          institutionLogo: institution.logo ?? null,
        },
      });

      console.log(`[PLAID] Updated PlaidItem: id=${existingInstitution.id}, institutionId=${institutionId}, plaidItemId=${plaidItemId}`);

      // Get existing accounts for this institution
      const existingAccounts = await prisma.account.findMany({
        where: { itemId: existingInstitution.id },
      });

      // Get accounts from Plaid
      const accountsResponse = await plaidClient.accountsGet({
        access_token: accessToken,
      });

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

      // Check for and merge duplicates
      const duplicateGroup = institutionId ? await detectDuplicates(institutionId) : null;
      let mergeMessage = null;
      
      if (duplicateGroup && duplicateGroup.shouldMerge) {
        const mergeResult = await mergeDuplicateAccounts(duplicateGroup);
        mergeMessage = getMergeMessage(duplicateGroup, mergeResult);
        console.log(`[PLAID] Auto-merged duplicates for institutionId=${institutionId}:`, mergeMessage);
      }

      return NextResponse.json({
        message: "Institution updated successfully",
        institutionId: existingInstitution.id,
        mergeMessage,
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
        },
      });

      console.log(`[PLAID] Created PlaidItem: id=${newInstitution.id}, institutionId=${institutionId}, plaidItemId=${plaidItemId}`);

      // Get accounts from Plaid
      const accountsResponse = await plaidClient.accountsGet({
        access_token: accessToken,
      });

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
