import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  try {
    const { accountId } = await params;

    // Get the account to check its type
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      select: { id: true, type: true, name: true }
    });

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    // Only fix amounts for credit card accounts
    if (account.type !== 'credit') {
      return NextResponse.json({ 
        message: "No action needed - this account is not a credit card",
        accountType: account.type,
        updatedCount: 0
      });
    }

    // Get count of transactions before update
    const transactionCount = await prisma.transaction.count({
      where: { accountId }
    });

    if (transactionCount === 0) {
      return NextResponse.json({ 
        message: "No transactions found for this account",
        updatedCount: 0
      });
    }

    // Use raw SQL to update all transaction amounts for this credit card account
    // Multiply by -1 to make spending negative
    const result = await prisma.$executeRaw`
      UPDATE "Transaction" 
      SET amount = amount * -1 
      WHERE "accountId" = ${accountId}
    `;

    console.log(`[FIX AMOUNTS] Updated transactions for account ${account.name} (${account.type})`);

    return NextResponse.json({
      message: `Successfully fixed amounts for transactions`,
      accountName: account.name,
      accountType: account.type,
      updatedCount: transactionCount
    });

  } catch (error) {
    console.error("Error fixing transaction amounts:", error);
    return NextResponse.json(
      { error: "Failed to fix transaction amounts" },
      { status: 500 }
    );
  }
} 