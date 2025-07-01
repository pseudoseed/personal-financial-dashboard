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
      } catch (error: any) {
        // Parse Plaid error codes to provide specific status
        let status = "error";
        let errorMessage = "Unknown error";
        let errorCode = "UNKNOWN";

        if (error?.response?.data?.error_code) {
          errorCode = error.response.data.error_code;
          
          switch (errorCode) {
            case "ITEM_LOGIN_REQUIRED":
              status = "needs_reauth";
              errorMessage = "Login credentials have changed. Please reconnect your account.";
              break;
            case "INVALID_ACCESS_TOKEN":
              status = "needs_reauth";
              errorMessage = "Access token is invalid. Please reconnect your account.";
              break;
            case "ITEM_LOCKED":
              status = "needs_reauth";
              errorMessage = "Account is locked. Please reconnect your account.";
              break;
            case "ITEM_NOT_FOUND":
              status = "error";
              errorMessage = "Account not found. Please reconnect your account.";
              break;
            case "INSTITUTION_DOWN":
              status = "institution_down";
              errorMessage = "Institution is temporarily unavailable.";
              break;
            case "RATE_LIMIT_EXCEEDED":
              status = "error";
              errorMessage = "Rate limit exceeded. Please try again later.";
              break;
            default:
              status = "error";
              errorMessage = error.response.data.error_message || "Unknown error occurred";
          }
        } else if (error?.message) {
          errorMessage = error.message;
        }

        authStatus.push({
          institutionId: item.institutionId,
          institutionName: item.institutionName || item.institutionId,
          status,
          accounts: item.accounts.length,
          lastChecked: new Date().toISOString(),
          errorMessage,
          errorCode,
        });
      }
    }

    // Calculate summary
    const summary = {
      total: authStatus.length,
      valid: authStatus.filter(s => s.status === "valid").length,
      needsReauth: authStatus.filter(s => s.status === "needs_reauth").length,
      institutionDown: authStatus.filter(s => s.status === "institution_down").length,
      errors: authStatus.filter(s => s.status === "error").length,
    };

    return NextResponse.json({
      authStatus,
      summary,
    });
  } catch (error) {
    console.error("Error checking auth status:", error);
    return NextResponse.json(
      { error: "Failed to check auth status" },
      { status: 500 }
    );
  }
} 