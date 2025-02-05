import { NextResponse } from "next/server";
import { plaidClient } from "@/lib/plaid";
import { prisma } from "@/lib/db";

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

    const institutionResponse = await plaidClient.institutionsGetById({
      institution_id: itemResponse.data.item.institution_id,
      country_codes: ["US"],
    });

    // Save the item in the database
    const plaidItem = await prisma.plaidItem.create({
      data: {
        itemId: item_id,
        accessToken: access_token,
        institutionId: itemResponse.data.item.institution_id,
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
      institution: institutionResponse.data.institution.name,
    });
  } catch (error) {
    console.error("Error exchanging token:", error);
    return NextResponse.json(
      { error: "Failed to exchange token" },
      { status: 500 }
    );
  }
}
