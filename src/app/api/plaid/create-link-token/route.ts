import { NextResponse } from "next/server";
import { plaidClient } from "@/lib/plaid";
import { CountryCode, Products } from "plaid";

export async function POST() {
  try {
    const request = {
      user: { client_user_id: "user-id" },
      client_name: "Personal Finance Dashboard",
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: "en",
      transactions: {
        days_requested: 730, // Request 2 years of data
      },
      optional_products: [Products.Investments, Products.Liabilities], // Make investments optional
    };

    const response = await plaidClient.linkTokenCreate(request);
    return NextResponse.json(response.data);
  } catch (error) {
    console.error("Error creating link token:", error);
    return NextResponse.json(
      { error: "Failed to create link token" },
      { status: 500 }
    );
  }
}
