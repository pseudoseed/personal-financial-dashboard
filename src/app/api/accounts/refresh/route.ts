import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { plaidClient } from "@/lib/plaid";
import type { PlaidItem } from "@prisma/client";

interface InstitutionChange {
  name: string;
  accounts: Array<{
    name: string;
    nickname: string | null;
    previousBalance: number;
    currentBalance: number;
    change: number;
    isPositive: boolean;
  }>;
}

async function getSpotPrice(currency: string): Promise<number | null> {
  console.log("Getting spot price for:", currency);
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

async function refreshCoinbaseToken(item: PlaidItem): Promise<string> {
  if (!item.refreshToken) {
    throw new Error("No refresh token available");
  }

  const response = await fetch("https://api.coinbase.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "refresh_token",
      refresh_token: item.refreshToken,
      client_id: process.env.COINBASE_CLIENT_ID,
      client_secret: process.env.COINBASE_CLIENT_SECRET,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to refresh token: ${response.status}`);
  }

  const { access_token, refresh_token } = await response.json();

  // Update tokens in database
  await prisma.plaidItem.update({
    where: { id: item.id },
    data: {
      accessToken: access_token,
      refreshToken: refresh_token,
    },
  });

  return access_token;
}

async function refreshCoinbaseAccounts(
  item: PlaidItem,
  institutionChanges: InstitutionChange
): Promise<number> {
  console.log("Refreshing Coinbase accounts for:", item.institutionName);
  try {
    let accessToken = item.accessToken;
    let response = await fetch(
      "https://api.coinbase.com/v2/accounts?limit=100",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "CB-VERSION": "2024-02-07",
        },
      }
    );

    // If token expired, try refreshing it
    if (response.status === 401) {
      console.log("Access token expired, refreshing...");
      accessToken = await refreshCoinbaseToken(item);
      response = await fetch("https://api.coinbase.com/v2/accounts?limit=100", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "CB-VERSION": "2024-02-07",
        },
      });
    }

    if (!response.ok) {
      throw new Error(`Coinbase API error: ${response.status}`);
    }

    const { data: accounts } = await response.json();
    let totalChange = 0;

    for (const account of accounts) {
      console.log("Processing Coinbase account:", account.name);
      const cryptoAmount = parseFloat(account.balance.amount);

      // Skip accounts with zero balance
      if (cryptoAmount <= 0) {
        console.log("Skipping account with zero balance:", account.name);
        continue;
      }

      // Get the spot price and calculate USD value
      const spotPrice = await getSpotPrice(account.balance.currency);

      // Log account details for debugging
      console.log("Processing Coinbase account:", {
        name: account.name,
        currency: account.balance.currency,
        amount: account.balance.amount,
        spotPrice: spotPrice || "Not available",
      });

      // Skip if we can't get a USD value
      if (!spotPrice) {
        console.warn(
          `Skipping ${account.name} (${account.balance.currency}) - no USD spot price available`
        );
        continue;
      }

      const usdValue = cryptoAmount * spotPrice;

      const existingAccount = await prisma.account.findFirst({
        where: { plaidId: `coinbase_${account.id}` },
        include: {
          balances: {
            orderBy: {
              date: "desc",
            },
            take: 1,
          },
        },
      });

      if (existingAccount) {
        const previousBalance = existingAccount.balances[0]?.current || 0;
        const change = usdValue - previousBalance;

        // Create new balance record
        await prisma.accountBalance.create({
          data: {
            accountId: existingAccount.id,
            current: usdValue,
            available: usdValue,
          },
        });

        // Add to institution changes if there's a significant change
        if (Math.abs(change) > 0.01) {
          if (!institutionChanges.accounts) {
            institutionChanges.accounts = [];
          }
          institutionChanges.accounts.push({
            name: existingAccount.name,
            nickname: existingAccount.nickname,
            previousBalance,
            currentBalance: usdValue,
            change,
            isPositive: change > 0,
          });
          totalChange += change;
        }
      } else {
        // Create new account if it doesn't exist
        const newAccount = await prisma.account.create({
          data: {
            plaidId: `coinbase_${account.id}`,
            name: `${account.name} (${account.balance.currency})`,
            type: "investment",
            subtype: "crypto",
            itemId: item.id,
            userId: "default",
          },
        });

        // Create initial balance
        await prisma.accountBalance.create({
          data: {
            accountId: newAccount.id,
            current: usdValue,
            available: usdValue,
          },
        });
      }
    }

    return totalChange;
  } catch (error) {
    console.error(
      `Error refreshing Coinbase accounts for item ${item.id}:`,
      error
    );
    throw error;
  }
}

export async function POST(request: Request) {
  try {
    // Check if we're refreshing a specific institution
    const { institutionId } = await request.json().catch(() => ({}));

    // Get items to refresh
    const where = {
      accessToken: { not: "manual" },
      ...(institutionId ? { institutionId } : {}),
    };

    const items = await prisma.plaidItem.findMany({ where });

    const changes: InstitutionChange[] = [];
    let totalChange = 0;

    // Refresh Plaid accounts
    const plaidItems = items.filter(
      (item: PlaidItem) => item.provider === "plaid"
    );
    for (const item of plaidItems) {
      try {
        console.log("Refreshing Plaid account:", item.institutionName);
        const response = await plaidClient.accountsBalanceGet({
          access_token: item.accessToken,
        });

        for (const account of response.data.accounts) {
          const existingAccount = await prisma.account.findFirst({
            where: { plaidId: account.account_id },
            include: {
              balances: {
                orderBy: {
                  date: "desc",
                },
                take: 1,
              },
            },
          });

          if (existingAccount) {
            const previousBalance = existingAccount.balances[0]?.current || 0;
            const currentBalance = account.balances.current || 0;
            const change = currentBalance - previousBalance;

            await prisma.accountBalance.create({
              data: {
                accountId: existingAccount.id,
                current: currentBalance,
                available: account.balances.available || null,
                limit: account.balances.limit || null,
              },
            });

            if (Math.abs(change) > 0.01) {
              const institutionName = item.institutionName || "Unknown Bank";
              let institutionChange = changes.find(
                (ic) => ic.name === institutionName
              );

              if (!institutionChange) {
                institutionChange = {
                  name: institutionName,
                  accounts: [],
                };
                changes.push(institutionChange);
              }

              institutionChange.accounts.push({
                name: existingAccount.name,
                nickname: existingAccount.nickname,
                previousBalance,
                currentBalance,
                change,
                isPositive: change > 0,
              });

              totalChange += change;
            }
          }
        }
      } catch (error) {
        console.error(
          `Error refreshing Plaid item ${item.id} ${item.institutionName}:`,
          error
        );
      }
    }

    // Refresh Coinbase accounts
    const coinbaseItems = items.filter(
      (item: PlaidItem) => item.provider === "coinbase"
    );
    for (const item of coinbaseItems) {
      try {
        const institutionChange: InstitutionChange = {
          name: item.institutionName || "Coinbase",
          accounts: [],
        };
        const change = await refreshCoinbaseAccounts(item, institutionChange);
        if (institutionChange.accounts.length > 0) {
          changes.push(institutionChange);
          totalChange += change;
        }
      } catch (error) {
        console.error(
          `Error refreshing Coinbase item ${item.id} / ${item.institutionName}:`,
          error
        );
      }
    }

    return NextResponse.json({
      success: true,
      changes,
      totalChange,
    });
  } catch (error) {
    console.error("Error refreshing accounts:", error);
    return NextResponse.json(
      { error: "Failed to refresh accounts" },
      { status: 500 }
    );
  }
}
