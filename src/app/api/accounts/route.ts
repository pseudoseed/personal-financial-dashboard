import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { downloadTransactions } from '@/lib/transactions';
import { ensureDefaultUser } from '@/lib/startupValidation';

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeArchived = searchParams.get("includeArchived") === "true";
    const includeDisconnected = searchParams.get("includeDisconnected") === "true";

    const accounts = await prisma.account.findMany({
      where: {
        // Only show non-archived accounts by default
        ...(includeArchived ? {} : { archived: false }),
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

    // Filter out disconnected accounts in JavaScript if not explicitly requested
    const filteredAccounts = includeDisconnected 
      ? accounts 
      : accounts.filter(account => {
          // Include manual accounts
          if (account.plaidItem?.accessToken === "manual") return true;
          // Include accounts with active or null status
          if (!account.plaidItem?.status || account.plaidItem.status !== "disconnected") return true;
          // Exclude disconnected accounts
          return false;
        });

    const formattedAccounts = filteredAccounts.map((account) => ({
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
    console.error("Error fetching accounts:", error);
    return NextResponse.json(
      { error: "Failed to fetch accounts" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const { firstTime } = await request.json().catch(() => ({ firstTime: false }));
  try {
    // Ensure default user exists before processing request
    const userExists = await ensureDefaultUser();
    if (!userExists) {
      console.error('[ACCOUNTS] Default user not found and could not be created');
      return NextResponse.json({ error: 'System not properly initialized' }, { status: 503 });
    }

    // Get all accounts with Plaid items
    const accounts = await prisma.account.findMany({
      where: {
        plaidItem: { accessToken: { not: 'manual' } },
        ...(firstTime ? { plaidSyncCursor: null } : {}),
      },
      include: { plaidItem: true },
    });
    if (!accounts.length) {
      return NextResponse.json({ message: 'No eligible accounts to sync', synced: 0 });
    }
    const results = [];
    for (const account of accounts) {
      try {
        const result = await downloadTransactions(prisma, account);
        results.push({ accountId: account.id, status: 'success', ...result });
      } catch (error) {
        results.push({ accountId: account.id, status: 'error', error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
    return NextResponse.json({ message: 'Batch sync complete', synced: results.length, results });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to sync all accounts', details: error instanceof Error ? error.message : error }, { status: 500 });
  }
}
