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

export async function POST(request: Request) {
  try {
    const { public_token } = await request.json();

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

    // Save the item in the database with institution details
    const plaidItem = await prisma.plaidItem.create({
      data: {
        itemId: item_id,
        accessToken: access_token,
        institutionId,
        institutionName: institution.name,
        institutionLogo: formatLogoUrl(institution.logo, institutionId),
      },
    });

    // Get accounts
    const accountsResponse = await plaidClient.accountsGet({
      access_token,
    });

    // Save accounts and their initial balances
    for (const account of accountsResponse.data.accounts) {
      const savedAccount = await prisma.account.create({
        data: {
          plaidId: account.account_id,
          name: account.name,
          type: account.type,
          subtype: account.subtype || null,
          mask: account.mask || null,
          itemId: plaidItem.id,
        },
      });

      // Save initial balance
      await prisma.accountBalance.create({
        data: {
          accountId: savedAccount.id,
          current: account.balances.current || 0,
          available: account.balances.available || null,
          limit: account.balances.limit || null,
        },
      });
    }

    return NextResponse.json({
      success: true,
      institution: institution.name,
    });
  } catch (error) {
    console.error("Error exchanging token:", error);
    return NextResponse.json(
      { error: "Failed to exchange token" },
      { status: 500 }
    );
  }
}
