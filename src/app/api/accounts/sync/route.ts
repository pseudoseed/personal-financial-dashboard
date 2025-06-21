import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { downloadTransactions } from "@/lib/transactions";

export async function POST() {
  try {
    console.log("Starting transaction sync for all accounts...");

    // Get all accounts that need transaction syncing
    const accounts = await prisma.account.findMany({
      where: {
        plaidItem: {
          accessToken: {
            not: "manual",
          },
        },
      },
      include: {
        plaidItem: true,
      },
    });

    let totalAccountsSynced = 0;
    let totalTransactionsDownloaded = 0;

    for (const account of accounts) {
      try {
        console.log(`Syncing transactions for account: ${account.name}`);
        
        const result = await downloadTransactions(prisma, account, true);
        totalAccountsSynced++;
        totalTransactionsDownloaded += result.downloadLog.numTransactions;
        
        console.log(`Downloaded ${result.downloadLog.numTransactions} transactions for ${account.name}`);
      } catch (error) {
        console.error(`Error syncing transactions for ${account.name}:`, error);
      }
    }

    console.log(`Sync completed: ${totalAccountsSynced} accounts synced, ${totalTransactionsDownloaded} total transactions downloaded`);

    return NextResponse.json({
      success: true,
      accountsSynced: totalAccountsSynced,
      totalTransactionsDownloaded,
    });
  } catch (error) {
    console.error("Error in transaction sync:", error);
    return NextResponse.json(
      { error: "Failed to sync transactions" },
      { status: 500 }
    );
  }
} 