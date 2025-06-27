import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { updates } = body; // Array of { accountId, newBalance }

    if (!Array.isArray(updates)) {
      return NextResponse.json(
        { error: "Updates must be an array" },
        { status: 400 }
      );
    }

    // Validate that all updates have required fields
    for (const update of updates) {
      if (!update.accountId || update.newBalance === undefined) {
        return NextResponse.json(
          { error: "Each update must have accountId and newBalance" },
          { status: 400 }
        );
      }
    }

    const results = [];

    // Process each update
    for (const update of updates) {
      try {
        // Get the account to verify it exists and is a manual account
        const account = await prisma.account.findUnique({
          where: { id: update.accountId },
          include: {
            plaidItem: true,
          },
        });

        if (!account) {
          results.push({
            accountId: update.accountId,
            success: false,
            error: "Account not found",
          });
          continue;
        }

        if (account.plaidItem.accessToken !== "manual") {
          results.push({
            accountId: update.accountId,
            success: false,
            error: "Only manual accounts can be updated directly",
          });
          continue;
        }

        // Create new balance record (preserving history)
        const newBalance = await prisma.accountBalance.create({
          data: {
            accountId: update.accountId,
            current: parseFloat(update.newBalance),
            available: parseFloat(update.newBalance),
            limit: null,
          },
        });

        results.push({
          accountId: update.accountId,
          success: true,
          balance: newBalance,
        });
      } catch (error) {
        console.error(`Error updating balance for account ${update.accountId}:`, error);
        results.push({
          accountId: update.accountId,
          success: false,
          error: "Failed to update balance",
        });
      }
    }

    // Check if any updates succeeded
    const successfulUpdates = results.filter(r => r.success);
    const failedUpdates = results.filter(r => !r.success);

    return NextResponse.json({
      success: successfulUpdates.length > 0,
      results,
      summary: {
        total: updates.length,
        successful: successfulUpdates.length,
        failed: failedUpdates.length,
      },
    });
  } catch (error) {
    console.error("Error in batch update balances:", error);
    return NextResponse.json(
      { error: "Failed to update balances" },
      { status: 500 }
    );
  }
} 