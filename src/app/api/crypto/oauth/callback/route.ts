import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

async function getSpotPrice(currency: string): Promise<number | null> {
  try {
    const response = await fetch(
      `https://api.coinbase.com/v2/prices/${currency}-USD/spot`,
      {
        headers: {
          "CB-VERSION": "2024-02-07",
        },
      }
    );

    if (!response.ok) {
      console.warn(`No USD spot price available for ${currency}`);
      return null;
    }

    const { data } = await response.json();
    return parseFloat(data.amount);
  } catch (error) {
    console.warn(`Error fetching spot price for ${currency}:`, error);
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
        userId: "default",
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

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");

    if (!code) {
      return NextResponse.json({ error: "No code provided" }, { status: 400 });
    }

    // Exchange code for tokens
    const tokenResponse = await fetch("https://api.coinbase.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code,
        client_id: process.env.COINBASE_CLIENT_ID,
        client_secret: process.env.COINBASE_CLIENT_SECRET,
        redirect_uri: process.env.COINBASE_REDIRECT_URI,
      }),
    });

    const { access_token, refresh_token } = await tokenResponse.json();

    // Get user's Coinbase info
    const userResponse = await fetch("https://api.coinbase.com/v2/user", {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const { data: user } = await userResponse.json();

    // Create PlaidItem for Coinbase
    const plaidItem = await prisma.plaidItem.create({
      data: {
        itemId: `coinbase_${user.id}`,
        accessToken: access_token,
        refreshToken: refresh_token,
        provider: "coinbase",
        institutionId: "coinbase",
        institutionName: "Coinbase",
        institutionLogo: "/coinbase.webp",
      },
    });

    // Get initial accounts and balances
    await refreshCoinbaseAccounts(plaidItem.id, access_token);

    return NextResponse.redirect(new URL("/", request.url));
  } catch (error) {
    console.error("Error in Coinbase callback:", error);
    return NextResponse.json(
      { error: "Failed to connect Coinbase" },
      { status: 500 }
    );
  }
}
