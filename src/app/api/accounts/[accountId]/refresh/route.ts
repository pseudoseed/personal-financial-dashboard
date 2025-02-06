import { NextResponse } from "next/server";
import { plaidClient } from "@/lib/plaid";
import { prisma } from "@/lib/db";

export async function POST(
  request: Request,
  context: { params: { accountId: string } }
) {
  try {
    // Ensure params are properly awaited
    const { accountId } = await Promise.resolve(context.params);

    // Get the account and its associated Plaid item
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      include: {
        plaidItem: true,
      },
    });

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    // Set min_last_updated_datetime to 24 hours ago
    const minLastUpdated = new Date();
    minLastUpdated.setHours(minLastUpdated.getHours() - 24);

    // Get updated account balances from Plaid
    const response = await plaidClient.accountsBalanceGet({
      access_token: account.plaidItem.accessToken,
      options: {
        account_ids: [account.plaidId],
        min_last_updated_datetime: minLastUpdated.toISOString(),
      },
    });

    const plaidAccount = response.data.accounts[0];
    if (!plaidAccount) {
      return NextResponse.json(
        { error: "Account not found in Plaid response" },
        { status: 404 }
      );
    }

    // Create new balance record
    const newBalance = await prisma.accountBalance.create({
      data: {
        accountId: account.id,
        current: plaidAccount.balances.current || 0,
        available: plaidAccount.balances.available || null,
        limit: plaidAccount.balances.limit || null,
      },
    });

    // Get previous balance for comparison
    const previousBalance = await prisma.accountBalance.findFirst({
      where: {
        accountId: account.id,
        date: {
          lt: newBalance.date,
        },
      },
      orderBy: {
        date: "desc",
      },
    });

    return NextResponse.json({
      success: true,
      balance: newBalance,
      previousBalance,
      change: previousBalance
        ? newBalance.current - previousBalance.current
        : 0,
    });
  } catch (error) {
    console.error("Error refreshing account balance:", error);
    return NextResponse.json(
      { error: "Failed to refresh account balance" },
      { status: 500 }
    );
  }
}
