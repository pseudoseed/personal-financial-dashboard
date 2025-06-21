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
        // Test the access token by making the same API call as the refresh endpoint
        await plaidClient.accountsBalanceGet({
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
        // Check if it's an authentication error
        let status = "unknown";
        let errorMessage = "Unknown error";
        let errorCode: string | undefined;

        if ((error as any).response?.data) {
          const plaidError = (error as any).response.data;
          errorCode = plaidError.error_code;

          switch (plaidError.error_code) {
            case "ITEM_LOGIN_REQUIRED":
              status = "needs_reauth";
              errorMessage = "Authentication expired - please re-authenticate";
              break;
            case "INVALID_ACCESS_TOKEN":
              status = "needs_reauth";
              errorMessage = "Access token is no longer valid";
              break;
            case "INVALID_CREDENTIALS":
              status = "needs_reauth";
              errorMessage = "Please update your credentials";
              break;
            case "INSTITUTION_DOWN":
              status = "institution_down";
              errorMessage = "Institution is temporarily unavailable";
              break;
            default:
              status = "error";
              errorMessage = plaidError.error_message || "Plaid API error";
          }
        } else {
          errorMessage = error instanceof Error ? error.message : "Unknown error";
        }

        authStatus.push({
          institutionId: item.institutionId,
          institutionName: item.institutionName || item.institutionId,
          status,
          errorMessage,
          errorCode,
          accounts: item.accounts.length,
          lastChecked: new Date().toISOString(),
        });
      }
    }

    return NextResponse.json({
      success: true,
      authStatus,
      summary: {
        total: authStatus.length,
        valid: authStatus.filter(s => s.status === "valid").length,
        needsReauth: authStatus.filter(s => s.status === "needs_reauth").length,
        institutionDown: authStatus.filter(s => s.status === "institution_down").length,
        errors: authStatus.filter(s => s.status === "error").length,
      },
    });
  } catch (error) {
    console.error("Error checking authentication status:", error);
    return NextResponse.json(
      { error: "Failed to check authentication status" },
      { status: 500 }
    );
  }
} 