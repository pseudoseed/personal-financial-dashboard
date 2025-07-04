import { NextResponse } from "next/server";
import { plaidClient } from "@/lib/plaid";
import { prisma } from "@/lib/db";
import { Products, CountryCode } from "plaid";
import { trackPlaidApiCall, getCurrentUserId, getAppInstanceId } from "@/lib/plaidTracking";

export async function POST(request: Request) {
  try {
    const { institutionId } = await request.json();

    if (!institutionId) {
      return NextResponse.json(
        { error: "Institution ID is required" },
        { status: 400 }
      );
    }

    // Find the PlaidItem for this institution
    const plaidItem = await prisma.plaidItem.findFirst({
      where: {
        institutionId,
        provider: "plaid",
      },
    });

    if (!plaidItem) {
      return NextResponse.json(
        { error: "Institution not found" },
        { status: 404 }
      );
    }

    // Check if this is a manual account (which doesn't need Plaid link tokens)
    if (plaidItem.accessToken === "manual") {
      return NextResponse.json(
        { error: "Manual accounts do not require Plaid re-authentication" },
        { status: 400 }
      );
    }

    const userId = await getCurrentUserId();
    const appInstanceId = getAppInstanceId();

    // Create a link token for updating the existing item
    const response = await trackPlaidApiCall(
      () => plaidClient.linkTokenCreate({
        user: { client_user_id: "default" },
        client_name: "Personal Financial Dashboard",
        products: [Products.Auth, Products.Transactions, Products.Liabilities],
        country_codes: [CountryCode.Us],
        language: "en",
        access_token: plaidItem.accessToken, // This enables update mode
      }),
      {
        endpoint: '/link_token/create',
        institutionId,
        userId,
        appInstanceId,
        requestData: {
          isUpdateMode: true,
          products: [Products.Auth, Products.Transactions, Products.Liabilities].map(p => p.toString()),
          accessToken: '***' // Don't log the actual token
        }
      }
    );

    return NextResponse.json({
      link_token: response.data.link_token,
      institutionId,
      institutionName: plaidItem.institutionName,
    });
  } catch (error) {
    console.error("Error creating update link token:", error);
    return NextResponse.json(
      { error: "Failed to create update link token" },
      { status: 500 }
    );
  }
} 