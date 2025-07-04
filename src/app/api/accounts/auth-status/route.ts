import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { plaidClient } from "@/lib/plaid";

export async function GET() {
  try {
    // Get all Plaid items (excluding disconnected ones to avoid unnecessary API calls)
    const items = await prisma.plaidItem.findMany({
      where: {
        accessToken: {
          not: "manual",
        },
        provider: "plaid",
        status: {
          not: "disconnected",
        },
      },
      include: {
        accounts: true,
      },
    });

    const authStatus = [];

    for (const item of items) {
      try {
        // Use itemGet to check basic token validity first
        const itemResponse = await plaidClient.itemGet({
          access_token: item.accessToken,
        });
        
        // Check if the item has an error status
        const plaidItem = itemResponse.data.item;
        if (plaidItem.error) {
          // Item has an error status - parse the error code
          let status = "error";
          let errorMessage = "Unknown error";
          let errorCode = "UNKNOWN";

          // Check if this is a token revocation error that should mark the item as disconnected
          const shouldMarkDisconnected = [
            "ITEM_NOT_FOUND",
            "INVALID_ACCESS_TOKEN",
            "ITEM_EXPIRED"
          ].includes(plaidItem.error.error_code);

          if (shouldMarkDisconnected && item.status !== 'disconnected') {
            console.log(`[AUTH STATUS] Marking PlaidItem ${item.id} as disconnected due to error: ${plaidItem.error.error_code}`);
            
            // Mark the PlaidItem as disconnected
            await prisma.plaidItem.update({
              where: { id: item.id },
              data: { status: 'disconnected' } as any
            });
          }

          switch (plaidItem.error.error_code) {
            case "ITEM_LOGIN_REQUIRED":
              status = "needs_reauth";
              errorMessage = "Login credentials have changed. Please reconnect your account.";
              errorCode = "ITEM_LOGIN_REQUIRED";
              break;
            case "INVALID_ACCESS_TOKEN":
              status = "needs_reauth";
              errorMessage = "Access token has been revoked. Please reconnect your account.";
              errorCode = "INVALID_ACCESS_TOKEN";
              break;
            case "ITEM_LOCKED":
              status = "needs_reauth";
              errorMessage = "Account is locked. Please reconnect your account.";
              errorCode = "ITEM_LOCKED";
              break;
            case "ITEM_NOT_FOUND":
              status = "needs_reauth";
              errorMessage = "Account access has been revoked. Please reconnect your account.";
              errorCode = "ITEM_NOT_FOUND";
              break;
            case "ITEM_EXPIRED":
              status = "needs_reauth";
              errorMessage = "Access has expired. Please reconnect your account.";
              errorCode = "ITEM_EXPIRED";
              break;
            case "INSTITUTION_DOWN":
              status = "institution_down";
              errorMessage = "Institution is temporarily unavailable.";
              errorCode = "INSTITUTION_DOWN";
              break;
            case "RATE_LIMIT_EXCEEDED":
              status = "error";
              errorMessage = "Rate limit exceeded. Please try again later.";
              errorCode = "RATE_LIMIT_EXCEEDED";
              break;
            default:
              status = "error";
              errorMessage = plaidItem.error.error_message || "Unknown error occurred";
              errorCode = plaidItem.error.error_code || "UNKNOWN";
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
        } else {
          // Item is valid
          authStatus.push({
            institutionId: item.institutionId,
            institutionName: item.institutionName || item.institutionId,
            status: "valid",
            accounts: item.accounts.length,
            lastChecked: new Date().toISOString(),
          });
        }
      } catch (error: any) {
        // Parse Plaid error codes to provide specific status
        let status = "error";
        let errorMessage = "Unknown error";
        let errorCode = "UNKNOWN";

        if (error?.response?.data?.error_code) {
          errorCode = error.response.data.error_code;
          
          // Check if this is a token revocation error that should mark the item as disconnected
          const shouldMarkDisconnected = [
            "ITEM_NOT_FOUND",
            "INVALID_ACCESS_TOKEN",
            "ITEM_EXPIRED"
          ].includes(errorCode);

          if (shouldMarkDisconnected && item.status !== 'disconnected') {
            console.log(`[AUTH STATUS] Marking PlaidItem ${item.id} as disconnected due to error: ${errorCode}`);
            
            // Mark the PlaidItem as disconnected
            await prisma.plaidItem.update({
              where: { id: item.id },
              data: { status: 'disconnected' } as any
            });
          }
          
          switch (errorCode) {
            case "ITEM_LOGIN_REQUIRED":
              status = "needs_reauth";
              errorMessage = "Login credentials have changed. Please reconnect your account.";
              break;
            case "INVALID_ACCESS_TOKEN":
              status = "needs_reauth";
              errorMessage = "Access token has been revoked. Please reconnect your account.";
              break;
            case "ITEM_LOCKED":
              status = "needs_reauth";
              errorMessage = "Account is locked. Please reconnect your account.";
              break;
            case "ITEM_NOT_FOUND":
              status = "needs_reauth";
              errorMessage = "Account access has been revoked. Please reconnect your account.";
              break;
            case "ITEM_EXPIRED":
              status = "needs_reauth";
              errorMessage = "Access has expired. Please reconnect your account.";
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