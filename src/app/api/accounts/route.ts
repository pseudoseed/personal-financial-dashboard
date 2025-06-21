import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { downloadTransactions } from '@/lib/transactions';

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const accounts = await prisma.account.findMany({
      include: {
        plaidItem: {
          select: {
            institutionId: true,
            institutionName: true,
            institutionLogo: true,
          },
        },
        balances: {
          orderBy: {
            date: "desc",
          },
          take: 1,
        },
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
      institution:
        account.plaidItem.institutionName || account.plaidItem.institutionId,
      institutionLogo: account.plaidItem.institutionLogo,
      balance: account.balances[0],
      lastUpdated: account.balances[0]?.date.toISOString() || null,
      url: account.url,
      metadata: account.metadata,
      plaidSyncCursor: account.plaidSyncCursor,
      lastSyncTime: account.lastSyncTime,
      plaidItem: {
        institutionId: account.plaidItem.institutionId,
      },
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
