import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const accounts = await prisma.account.findMany({
      where: {
        archived: false, // Only non-archived accounts
        plaidItem: {
          status: "disconnected"
        }
      },
      include: {
        plaidItem: {
          select: {
            institutionId: true,
            institutionName: true,
            institutionLogo: true,
            accessToken: true,
            status: true,
          },
        },
        balances: {
          orderBy: {
            date: "desc",
          },
          take: 1,
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    const formattedAccounts = accounts.map((account) => ({
      id: account.id,
      name: account.name,
      nickname: account.nickname,
      type: account.type,
      subtype: account.subtype,
      mask: account.mask,
      hidden: account.hidden,
      archived: account.archived,
      metadata: account.metadata,
      url: account.url,
      invertTransactions: account.invertTransactions,
      plaidId: account.plaidId,
      plaidSyncCursor: account.plaidSyncCursor,
      lastSyncTime: account.lastSyncTime,
      lastStatementBalance: account.lastStatementBalance,
      minimumPaymentAmount: account.minimumPaymentAmount,
      nextPaymentDueDate: account.nextPaymentDueDate,
      lastPaymentDate: account.lastPaymentDate,
      lastPaymentAmount: account.lastPaymentAmount,
      nextMonthlyPayment: account.nextMonthlyPayment,
      originationDate: account.originationDate,
      originationPrincipalAmount: account.originationPrincipalAmount,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
      plaidItem: account.plaidItem,
      balance: {
        current: account.balances[0]?.current || 0,
        available: account.balances[0]?.available || null,
        limit: account.balances[0]?.limit || null,
      },
      balances: account.balances,
      currentBalance: account.balances[0]?.current || 0,
      availableBalance: account.balances[0]?.available || 0,
      limit: account.balances[0]?.limit || 0,
    }));

    return NextResponse.json(formattedAccounts);
  } catch (error) {
    console.error("Error fetching disconnected accounts:", error);
    return NextResponse.json(
      { error: "Failed to fetch disconnected accounts" },
      { status: 500 }
    );
  }
} 