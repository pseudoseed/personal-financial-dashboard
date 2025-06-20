import { NextResponse } from "next/server";
import { plaidClient } from "@/lib/plaid";
import { prisma } from "@/lib/db";
import { CountryCode } from "plaid";
import { institutionLogos } from "@/lib/institutionLogos";

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
    const { public_token } = await request.json();
    console.log("Exchanging public token...");

    const exchangeResponse = await plaidClient.itemPublicTokenExchange({
      public_token,
    });

    const { access_token, item_id } = exchangeResponse.data;

    // Get item details
    const itemResponse = await plaidClient.itemGet({
      access_token,
    });

    const institutionId = itemResponse.data.item.institution_id;
    if (!institutionId) {
      throw new Error("Institution ID is missing");
    }

    // Get institution details
    const institutionResponse = await plaidClient.institutionsGetById({
      institution_id: institutionId,
      country_codes: [CountryCode.Us],
      options: {
        include_optional_metadata: true,
      },
    });

    const institution = institutionResponse.data.institution;

    // Check if we already have this institution
    const existingItem = await prisma.plaidItem.findFirst({
      where: { institutionId },
      include: { accounts: true },
    });

    // Get accounts from Plaid
    const accountsResponse = await plaidClient.accountsGet({
      access_token,
    });

    if (existingItem) {
      console.log("Found existing institution, updating records...");

      // Update the existing PlaidItem
      const updatedItem = await prisma.plaidItem.update({
        where: { id: existingItem.id },
        data: {
          itemId: item_id,
          accessToken: access_token,
          institutionName: institution.name,
          institutionLogo: formatLogoUrl(institution.logo, institutionId),
        },
      });

      // Keep track of processed accounts to identify deleted ones
      const processedAccountIds = new Set<string>();

      // Update existing accounts and create new ones
      for (const account of accountsResponse.data.accounts) {
        const existingAccount = findMatchingAccount(
          account,
          existingItem.accounts
        );

        if (existingAccount) {
          console.log(
            `Updating existing account: ${existingAccount.name} (${existingAccount.mask})`
          );
          processedAccountIds.add(existingAccount.id);

          // Update existing account
          await prisma.account.update({
            where: { id: existingAccount.id },
            data: {
              plaidId: account.account_id, // Update to new Plaid ID
              name: account.name,
              type: account.type,
              subtype: account.subtype || null,
              mask: account.mask || null,
            },
          });

          // Update balance
          await prisma.accountBalance.create({
            data: {
              accountId: existingAccount.id,
              current: account.balances.current || 0,
              available: account.balances.available || null,
              limit: account.balances.limit || null,
            },
          });
        } else {
          console.log(
            `Creating new account: ${account.name} (${account.mask})`
          );
          // Create new account if no match found
          const newAccount = await prisma.account.create({
            data: {
              plaidId: account.account_id,
              name: account.name,
              type: account.type,
              subtype: account.subtype || null,
              mask: account.mask || null,
              itemId: updatedItem.id,
              invertTransactions: account.type === 'depository',
            },
          });

          // Create initial balance
          await prisma.accountBalance.create({
            data: {
              accountId: newAccount.id,
              current: account.balances.current || 0,
              available: account.balances.available || null,
              limit: account.balances.limit || null,
            },
          });
        }
      }

      // Handle accounts that no longer exist at the institution
      const deletedAccounts = existingItem.accounts.filter(
        (account) => !processedAccountIds.has(account.id)
      );

      if (deletedAccounts.length > 0) {
        console.log(
          `Found ${deletedAccounts.length} accounts no longer available at institution`
        );
        // Optionally mark accounts as hidden instead of deleting them
        await prisma.account.updateMany({
          where: {
            id: {
              in: deletedAccounts.map((account) => account.id),
            },
          },
          data: {
            hidden: true,
          },
        });
      }

      return NextResponse.json({
        success: true,
        message: "Updated existing institution and accounts",
        institution: institution.name,
      });
    } else {
      console.log("Creating new institution and accounts...");

      // Create new PlaidItem
      const newItem = await prisma.plaidItem.create({
        data: {
          itemId: item_id,
          accessToken: access_token,
          institutionId,
          institutionName: institution.name,
          institutionLogo: formatLogoUrl(institution.logo, institutionId),
        },
      });

      // Create accounts and initial balances
      for (const account of accountsResponse.data.accounts) {
        console.log(`Creating new account: ${account.name} (${account.mask})`);
        const newAccount = await prisma.account.create({
          data: {
            plaidId: account.account_id,
            name: account.name,
            type: account.type,
            subtype: account.subtype || null,
            mask: account.mask || null,
            itemId: newItem.id,
            invertTransactions: account.type === 'depository',
          },
        });

        // Create initial balance
        await prisma.accountBalance.create({
          data: {
            accountId: newAccount.id,
            current: account.balances.current || 0,
            available: account.balances.available || null,
            limit: account.balances.limit || null,
          },
        });
      }

      return NextResponse.json({
        success: true,
        message: "Created new institution and accounts",
        institution: institution.name,
      });
    }
  } catch (error) {
    console.error("Error exchanging token:", error);
    return NextResponse.json(
      { error: "Failed to exchange token" },
      { status: 500 }
    );
  }
}
