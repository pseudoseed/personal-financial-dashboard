import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from '@/lib/userManagement';

async function getSpotPrice(currency: string): Promise<number | null> {
  try {
    const response = await fetch(
      `https://api.coinbase.com/v2/prices/${currency}-USD/spot`
    );
    const data = await response.json();
    return parseFloat(data.data.amount);
  } catch (error) {
    console.error(`Error getting spot price for ${currency}:`, error);
    return null;
  }
}

async function refreshCoinbaseAccounts(itemId: string, accessToken: string) {
  const response = await fetch(
    "https://api.coinbase.com/v2/accounts?limit=100",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "CB-VERSION": "2024-02-07",
      },
    }
  );

  const { data: accounts } = await response.json();

  for (const account of accounts) {
    const cryptoAmount = parseFloat(account.balance.amount);

    // Skip accounts with zero balance
    if (cryptoAmount <= 0) {
      console.log("Skipping account with zero balance:", account.name);
      continue;
    }

    // Get the spot price and calculate USD value
    const spotPrice = await getSpotPrice(account.balance.currency);

    // Skip if we can't get a USD value
    if (!spotPrice) {
      console.warn(
        `Skipping ${account.name} (${account.balance.currency}) - no USD spot price available`
      );
      continue;
    }

    const usdValue = cryptoAmount * spotPrice;

    const savedAccount = await prisma.account.create({
      data: {
        plaidId: `coinbase_${account.id}`,
        name: `${account.name} (${account.balance.currency})`,
        type: "investment",
        subtype: "crypto",
        itemId: itemId,
        userId: await getCurrentUserId(),
      },
    });

    // Create initial balance using USD value
    await prisma.accountBalance.create({
      data: {
        accountId: savedAccount.id,
        current: usdValue,
        available: usdValue,
      },
    });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");

    if (!code) {
      return NextResponse.json({ error: "No authorization code provided" }, { status: 400 });
    }

    // Exchange the authorization code for an access token
    const tokenResponse = await fetch("https://api.coinbase.com/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: process.env.COINBASE_CLIENT_ID!,
        client_secret: process.env.COINBASE_CLIENT_SECRET!,
        redirect_uri: process.env.COINBASE_REDIRECT_URI!,
      }),
    });

    if (!tokenResponse.ok) {
      console.error("Coinbase token exchange failed:", await tokenResponse.text());
      return NextResponse.json({ error: "Failed to exchange authorization code" }, { status: 500 });
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Create or update the Coinbase item
    const coinbaseItem = await prisma.plaidItem.upsert({
      where: { itemId: `coinbase_${Date.now()}` },
      update: {
        accessToken,
        institutionName: "Coinbase",
        provider: "coinbase",
      },
      create: {
        itemId: `coinbase_${Date.now()}`,
        accessToken,
        institutionId: "coinbase",
        institutionName: "Coinbase",
        provider: "coinbase",
      },
    });

    // Refresh Coinbase accounts
    await refreshCoinbaseAccounts(coinbaseItem.id, accessToken);

    return NextResponse.redirect(new URL("/dashboard", request.url));
  } catch (error) {
    console.error("Error in Coinbase OAuth callback:", error);
    return NextResponse.json({ error: "Failed to complete Coinbase connection" }, { status: 500 });
  }
}
