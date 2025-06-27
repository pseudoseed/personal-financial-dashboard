import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { plaidClient } from "@/lib/plaid";

export async function GET() {
  try {
    // Get all Plaid items
    const items = await prisma.plaidItem.findMany({
      where: {
        accessToken: {
          not: "manual",
        },
        provider: "plaid",
      },
      include: {
        accounts: true,
      },
    });

    const authStatus = [];

    for (const item of items) {
      try {
        // Use itemGet instead of accountsBalanceGet to validate token without fetching balance data
        // This is free and only validates the access token
        await plaidClient.itemGet({
          access_token: item.accessToken,
        });

        // If we get here, the token is valid
        authStatus.push({
          institutionId: item.institutionId,
          institutionName: item.institutionName || item.institutionId,
          status: "valid",
          accounts: item.accounts.length,
          lastChecked: new Date().toISOString(),
        });
      } catch (error) {
        // If itemGet fails, the token is invalid
        authStatus.push({
          institutionId: item.institutionId,
          institutionName: item.institutionName || item.institutionId,
          status: "invalid",
          accounts: item.accounts.length,
          lastChecked: new Date().toISOString(),
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return NextResponse.json(authStatus);
  } catch (error) {
    console.error("Error checking auth status:", error);
    return NextResponse.json(
      { error: "Failed to check auth status" },
      { status: 500 }
    );
  }
} 