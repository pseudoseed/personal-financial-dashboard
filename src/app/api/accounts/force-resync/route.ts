import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { downloadTransactions } from "@/lib/transactions";

export async function POST(request: NextRequest) {
  try {
    const allAccounts = await prisma.account.findMany({
      where: {
        // Find accounts that have an associated PlaidItem
        plaidItem: {
          id: {
            not: undefined,
          },
        },
      },
      include: {
        plaidItem: true,
      },
    });

    if (!allAccounts || allAccounts.length === 0) {
      return NextResponse.json({ message: "No Plaid-linked accounts found to sync." });
    }

    const results = [];
    for (const account of allAccounts) {
      if (!account.plaidItem) continue; // Skip if plaidItem is missing for some reason

      try {
        // Pass force = true to ignore the sync cursor and get full history
        const result = await downloadTransactions(prisma, account, true);
        results.push({
          accountId: account.id,
          accountName: account.name,
          status: "success",
          ...result,
        });
      } catch (error) {
        console.error(`Failed to force re-sync for account ${account.id}:`, error);
        results.push({
          accountId: account.id,
          accountName: account.name,
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({
      message: "Force re-sync complete.",
      results,
    });
  } catch (error) {
    console.error("Error during force re-sync:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred during the force re-sync." },
      { status: 500 }
    );
  }
} 