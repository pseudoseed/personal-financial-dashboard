import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  request: Request,
  { params }: { params: { userId: string } }
) {
  try {
    const { userId } = params;

    // Get user's accounts
    const accounts = await prisma.account.findMany({
      where: { userId },
      include: {
        balances: {
          orderBy: { date: 'desc' },
          take: 1,
        },
        transactions: {
          select: { id: true },
        },
        plaidItem: {
          select: {
            institutionName: true,
            institutionId: true,
          },
        },
      },
    });

    // Transform account data
    const transformedAccounts = accounts.map(account => ({
      id: account.id,
      name: account.name,
      nickname: account.nickname,
      type: account.type,
      institution: account.plaidItem?.institutionName || account.plaidItem?.institutionId || 'Unknown',
      currentBalance: account.balances[0]?.current || 0,
      lastSyncTime: account.lastSyncTime?.toISOString() || 'Never',
      status: account.hidden ? 'hidden' : 'active',
      transactionCount: account.transactions.length,
    }));

    return NextResponse.json({
      accounts: transformedAccounts,
    });
  } catch (error) {
    console.error("Error fetching user accounts:", error || "Unknown error");
    return NextResponse.json(
      { error: "Failed to fetch user accounts" },
      { status: 500 }
    );
  }
} 