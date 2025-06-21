import { NextResponse } from "next/server";
import { plaidClient } from "@/lib/plaid";
import { prisma } from "@/lib/db";
import { Account, PlaidItem } from "@prisma/client";

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
      throw new Error(`Failed to get spot price for ${currency}`);
    }

    const { data } = await response.json();
    return parseFloat(data.amount);
  } catch (error) {
    console.error(`Error getting spot price for ${currency}:`, error);
    return 0;
  }
}

async function refreshCoinbaseAccount(accessToken: string, accountId: string) {
  const response = await fetch(
    "https://api.coinbase.com/v2/accounts?limit=100",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "CB-VERSION": "2024-02-07",
      },
    }
  );

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

async function refreshPlaidLiabilities(account: Account & { plaidItem: PlaidItem }) {
  try {
    console.log(`Fetching liability data for account: ${account.name}`);
    
    const response = await plaidClient.liabilitiesGet({
      access_token: account.plaidItem.accessToken,
      options: {
        account_ids: [account.plaidId],
      },
    });

    console.log("Plaid liability response:", JSON.stringify(response.data, null, 2));

    const liabilities = response.data.liabilities;
    if (!liabilities) {
      console.log("No liability data available");
      return null;
    }

    // Handle credit card liabilities
    const credit = liabilities.credit?.find(c => c.account_id === account.plaidId);
    if (credit) {
      console.log("Found credit liability data:", credit);
      
      const liabilityData = {
        lastStatementBalance: credit.last_statement_balance || null,
        minimumPaymentAmount: credit.minimum_payment_amount || null,
        nextPaymentDueDate: credit.next_payment_due_date ? new Date(credit.next_payment_due_date) : null,
        lastPaymentDate: credit.last_payment_date ? new Date(credit.last_payment_date) : null,
        lastPaymentAmount: credit.last_payment_amount || null,
      };

      // Update the account with liability data
      await prisma.account.update({
        where: { id: account.id },
        data: liabilityData,
      });

      return liabilityData;
    }

    // Handle mortgage liabilities
    const mortgage = liabilities.mortgage?.find(m => m.account_id === account.plaidId);
    if (mortgage) {
      console.log("Found mortgage liability data:", mortgage);
      
      const liabilityData = {
        lastStatementBalance: mortgage.last_payment_amount || null,
        minimumPaymentAmount: mortgage.next_monthly_payment || null,
        nextPaymentDueDate: mortgage.next_payment_due_date ? new Date(mortgage.next_payment_due_date) : null,
        lastPaymentDate: mortgage.last_payment_date ? new Date(mortgage.last_payment_date) : null,
        lastPaymentAmount: mortgage.last_payment_amount || null,
        nextMonthlyPayment: mortgage.next_monthly_payment || null,
        originationDate: mortgage.origination_date ? new Date(mortgage.origination_date) : null,
        originationPrincipalAmount: mortgage.origination_principal_amount || null,
      };

      // Update the account with liability data
      await prisma.account.update({
        where: { id: account.id },
        data: liabilityData,
      });

      return liabilityData;
    }

    // Handle student loan liabilities
    const student = liabilities.student?.find(s => s.account_id === account.plaidId);
    if (student) {
      console.log("Found student loan liability data:", student);
      
      const liabilityData = {
        lastStatementBalance: student.last_payment_amount || null,
        minimumPaymentAmount: student.minimum_payment_amount || null,
        nextPaymentDueDate: student.next_payment_due_date ? new Date(student.next_payment_due_date) : null,
        lastPaymentDate: student.last_payment_date ? new Date(student.last_payment_date) : null,
        lastPaymentAmount: student.last_payment_amount || null,
        originationDate: student.origination_date ? new Date(student.origination_date) : null,
        originationPrincipalAmount: student.origination_principal_amount || null,
      };

      // Update the account with liability data
      await prisma.account.update({
        where: { id: account.id },
        data: liabilityData,
      });

      return liabilityData;
    }

    console.log("No matching liability type found for account");
    return null;

  } catch (error) {
    console.error(`Error fetching liability data for account ${account.name}:`, error);
    return null;
  }
}

export async function POST(
  request: Request,
  { params }: { params: { accountId: string } }
) {
  try {
    const account = await prisma.account.findUnique({
      where: { id: params.accountId },
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
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 }
      );
    }

    const previousBalance = account.balances[0]?.current || 0;

    // Handle Coinbase accounts
    if (account.plaidItem.provider === "coinbase") {
      const balance = await refreshCoinbaseAccount(
        account.plaidItem.accessToken,
        account.id
      );

      const newBalance = await prisma.accountBalance.create({
        data: {
          accountId: account.id,
          current: balance.current,
          available: balance.available,
          limit: balance.limit,
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

    // Handle Plaid accounts
    if (account.plaidItem.provider === "plaid") {
      // First, try to fetch liability data for credit/loan accounts
      if (account.type === "credit" || account.type === "loan") {
        const liabilityData = await refreshPlaidLiabilities(account);
        if (liabilityData) {
          console.log("Successfully updated liability data:", liabilityData);
        }
      }

      // Get updated account balances from Plaid
      try {
        const response = await plaidClient.accountsBalanceGet({
          access_token: account.plaidItem.accessToken,
          options: {
            min_last_updated_datetime: new Date(
              Date.now() - 24 * 60 * 60 * 1000
            ).toISOString(),
          },
        });

        const plaidAccount = response.data.accounts.find(
          (acc) => acc.account_id === account.plaidId
        );
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
        // Check for Plaid specific error codes
        if ((error as any).response?.data) {
          const plaidError = (error as any).response.data;
          console.error("Plaid API Error:", {
            error_code: plaidError.error_code,
            error_message: plaidError.error_message,
            display_message: plaidError.display_message,
          });

          // Handle specific error cases
          switch (plaidError.error_code) {
            case "ITEM_LOGIN_REQUIRED":
              return new Response(
                JSON.stringify({
                  error: "Please re-authenticate with Capital One",
                  error_code: plaidError.error_code,
                }),
                { status: 400 }
              );
            case "INVALID_ACCESS_TOKEN":
              return new Response(
                JSON.stringify({
                  error: "Access token is no longer valid",
                  error_code: plaidError.error_code,
                }),
                { status: 400 }
              );
            case "INVALID_CREDENTIALS":
              return new Response(
                JSON.stringify({
                  error: "Please update your Capital One credentials",
                  error_code: plaidError.error_code,
                }),
                { status: 400 }
              );
            case "INSTITUTION_DOWN":
              return new Response(
                JSON.stringify({
                  error: "Capital One is temporarily unavailable",
                  error_code: plaidError.error_code,
                }),
                { status: 503 }
              );
            default:
              throw error;
          }
        }
        throw error;
      }
    }

    return NextResponse.json(
      { error: "Unsupported account provider" },
      { status: 400 }
    );
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
