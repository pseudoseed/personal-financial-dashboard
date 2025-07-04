import { NextResponse } from "next/server";
import { plaidClient } from "@/lib/plaid";
import { CountryCode, Products } from "plaid";
import { trackPlaidApiCall, getCurrentUserId, getAppInstanceId } from "@/lib/plaidTracking";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { enableLiabilities = true, enableInvestments = false } = body;

    // Base products - Transactions is always required
    const products = [Products.Transactions];
    
    // Optional products based on parameters
    const optionalProducts = [];
    if (enableLiabilities) {
      optionalProducts.push(Products.Liabilities);
    }
    if (enableInvestments) {
      optionalProducts.push(Products.Investments);
    }

    const requestConfig = {
      user: { client_user_id: "user-id" },
      client_name: "pseudofi",
      products,
      country_codes: [CountryCode.Us],
      language: "en",
      transactions: {
        days_requested: 730, // Request 2 years of data
      },
      ...(optionalProducts.length > 0 && { optional_products: optionalProducts }),
    };

    const userId = await getCurrentUserId();
    const appInstanceId = getAppInstanceId();

    const response = await trackPlaidApiCall(
      () => plaidClient.linkTokenCreate(requestConfig),
      {
        endpoint: '/link_token/create',
        userId,
        appInstanceId,
        requestData: {
          enableLiabilities,
          enableInvestments,
          products: products.map(p => p.toString()),
          optionalProducts: optionalProducts.map(p => p.toString())
        }
      }
    );

    return NextResponse.json(response.data);
  } catch (error) {
    console.error("Error creating link token:", error);
    return NextResponse.json(
      { error: "Failed to create link token" },
      { status: 500 }
    );
  }
}
