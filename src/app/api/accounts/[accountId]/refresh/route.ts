import { plaidClient } from "@/lib/plaid";
import { prisma } from "@/lib/db";

interface CoinbaseAccount {
  id: string;
  name: string;
  balance: {
    amount: string;
    currency: string;
  };
  native_balance?: {
    amount: string;
    currency: string;
  };
}


async function getSpotPrice(currency: string): Promise<number> {
  const response = await fetch(
    `https://api.coinbase.com/v2/prices/${currency}-USD/spot`,
    {
      headers: {
        "CB-VERSION": "2024-02-07",
      },
    }
  );

  if (!response.ok) {
    throw new Error(
      `Failed to fetch spot price for ${currency}: ${response.status}`
    );
  }

  const { data } = await response.json();
  return parseFloat(data.amount);
}

async function refreshCoinbaseAccount(accessToken: string, accountId: string) {
  const response = await fetch("https://api.coinbase.com/v2/accounts?limit=100", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "CB-VERSION": "2024-02-07",
    },
  });

  if (!response.ok) {
    throw new Error(`Coinbase API error: ${response.status}`);
  }

  const { data: accounts } = await response.json();
  const plaidId = accountId.startsWith("coinbase_")
    ? accountId
    : `coinbase_${accountId}`;

  const coinbaseAccount = accounts.find(
    (acc: CoinbaseAccount) => `coinbase_${acc.id}` === plaidId
  );

  if (!coinbaseAccount) {
    throw new Error("Account not found in Coinbase response");
  }

  // Log the account details for debugging
  console.log("Found Coinbase account:", {
    id: coinbaseAccount.id,
    balance: coinbaseAccount.balance,
  });

  // Get the spot price and calculate USD value
  const spotPrice = await getSpotPrice(coinbaseAccount.balance.currency);
  const usdValue = parseFloat(coinbaseAccount.balance.amount) * spotPrice;

  console.log("Calculated USD value:", {
    currency: coinbaseAccount.balance.currency,
    spotPrice,
    cryptoAmount: coinbaseAccount.balance.amount,
    usdValue,
  });

  return {
    current: usdValue,
    available: usdValue,
    limit: null,
  };
}

export async function POST(
  request: Request,
  { params }: { params: { accountId: string } }
) {
  try {
    const { accountId } = await Promise.resolve(params);

    const account = await prisma.account.findUnique({
      where: { id: accountId },
      include: {
        plaidItem: true,
        balances: {
          orderBy: {
            date: "desc",
          },
          take: 1,
        },
      },
    });

    if (!account) {
      return new Response("Account not found", { status: 404 });
    }

    const previousBalance = account.balances[0]?.current || 0;

    if (account.plaidItem.provider === "coinbase") {
      console.log("Refreshing Coinbase account:", account.plaidId);
      const balances = await refreshCoinbaseAccount(
        account.plaidItem.accessToken,
        account.plaidId
      );

      const newBalance = await prisma.accountBalance.create({
        data: {
          accountId: account.id,
          ...balances,
        },
      });

      const change = newBalance.current - previousBalance;

      return Response.json({
        success: true,
        balance: newBalance,
        previousBalance,
        change,
      });
    }

    // Get updated account balances from Plaid
    const response = await plaidClient.accountsBalanceGet({
      access_token: account.plaidItem.accessToken,
      options: {
        account_ids: [account.plaidId],
      },
    });

    const plaidAccount = response.data.accounts[0];
    if (!plaidAccount) {
      throw new Error("Account not found in Plaid response");
    }

    const newBalance = await prisma.accountBalance.create({
      data: {
        accountId: account.id,
        current: plaidAccount.balances.current || 0,
        available: plaidAccount.balances.available || null,
        limit: plaidAccount.balances.limit || null,
      },
    });

    const change = newBalance.current - previousBalance;

    return Response.json({
      success: true,
      balance: newBalance,
      previousBalance,
      change,
    });
  } catch (error) {
    console.error("Error refreshing account balance:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500 }
    );
  }
}
