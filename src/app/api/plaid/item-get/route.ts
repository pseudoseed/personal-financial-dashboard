import { NextResponse } from "next/server";
import { plaidClient } from "@/lib/plaid";
import { trackPlaidApiCall, getCurrentUserId, getAppInstanceId } from "@/lib/plaidTracking";

export async function POST(request: Request) {
  try {
    const { access_token } = await request.json();
    if (!access_token) {
      return NextResponse.json({ error: "access_token is required" }, { status: 400 });
    }

    const userId = await getCurrentUserId();
    const appInstanceId = getAppInstanceId();

    const response = await trackPlaidApiCall(
      () => plaidClient.itemGet({ access_token }),
      {
        endpoint: '/item/get',
        userId,
        appInstanceId,
        requestData: { accessToken: '***' } // Don't log the actual token
      }
    );
    return NextResponse.json(response.data);
  } catch (error) {
    console.error("Error fetching Plaid item:", error);
    return NextResponse.json(
      { error: "Failed to fetch Plaid item" },
      { status: 500 }
    );
  }
} 