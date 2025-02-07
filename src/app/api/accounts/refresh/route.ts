import { NextResponse } from "next/server";
import { plaidClient } from "@/lib/plaid";
import { prisma } from "@/lib/db";

export async function POST() {
  try {
    // Get all Plaid items
    const plaidItems = await prisma.plaidItem.findMany({
      where: {
        accessToken: {
          not: "manual",
        },
      },
    });

    for (const item of plaidItems) {
      try {
        // Get updated account balances from Plaid
        const accountsResponse = await plaidClient.accountsGet({
          access_token: item.accessToken,
        });

        // Update balances for each account
        for (const plaidAccount of accountsResponse.data.accounts) {
          const account = await prisma.account.findUnique({
            where: { plaidId: plaidAccount.account_id },
          });

          if (account) {
            // Create new balance record
            await prisma.accountBalance.create({
              data: {
                accountId: account.id,
                current: plaidAccount.balances.current || 0,
                available: plaidAccount.balances.available || null,
                limit: plaidAccount.balances.limit || null,
              },
            });
          }
        }
      } catch (error) {
        console.error(`Error refreshing item ${item.id}:`, error);
        // Continue with other items even if one fails
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error refreshing balances:", error);
    return NextResponse.json(
      { error: "Failed to refresh balances" },
      { status: 500 }
    );
  }
}
