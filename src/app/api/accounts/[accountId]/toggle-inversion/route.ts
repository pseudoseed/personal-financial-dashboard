import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  try {
    const { accountId } = await params;

    const account = await prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    // This will perform both updates in a single, atomic transaction
    const [, updatedAccount] = await prisma.$transaction([
      // 1. Invert the amount for all existing transactions for this account
      prisma.$executeRaw`
        UPDATE "Transaction"
        SET amount = amount * -1
        WHERE "accountId" = ${accountId}
      `,
      // 2. Flip the inversion flag on the account itself
      prisma.account.update({
        where: { id: accountId },
        data: { invertTransactions: !account.invertTransactions },
      }),
    ]);

    return NextResponse.json({
      message: `Successfully updated ${account.name}. Sign inversion is now ${updatedAccount.invertTransactions ? 'ON' : 'OFF'}.`,
      account: updatedAccount,
    });
    
  } catch (error) {
    console.error("Error toggling transaction inversion:", error);
    return NextResponse.json(
      { error: "Failed to toggle transaction inversion." },
      { status: 500 }
    );
  }
} 