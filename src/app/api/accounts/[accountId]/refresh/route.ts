import { NextResponse } from "next/server";
import { plaidClient } from "@/lib/plaid";
import { prisma } from "@/lib/db";
import { Account, PlaidItem } from "@prisma/client";
import { trackPlaidApiCall, getCurrentUserId, getAppInstanceId } from "@/lib/plaidTracking";
import { isAccountEligibleForPlaidCalls, getAccountIneligibilityReason } from "@/lib/accountEligibility";

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
    const userId = await getCurrentUserId();
    const appInstanceId = getAppInstanceId();

    const response = await trackPlaidApiCall(
      () => plaidClient.liabilitiesGet({
        access_token: account.plaidItem.accessToken,
        options: {
          account_ids: [account.plaidId],
        },
      }),
      {
        endpoint: '/liabilities/get',
        institutionId: account.plaidItem.institutionId,
        accountId: account.id,
        userId,
        appInstanceId,
        requestData: {
          accessToken: '***', // Don't log the actual token
          accountIds: [account.plaidId]
        }
      }
    );

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
    const { accountId } = params;

    // Get the account with its PlaidItem
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      include: {
        plaidItem: true,
        balances: {
          orderBy: { date: "desc" },
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

    // Check if account is eligible for Plaid API calls
    if (!isAccountEligibleForPlaidCalls(account)) {
      const reason = getAccountIneligibilityReason(account);
      console.log(`[ACCOUNT REFRESH] Skipping Plaid API calls for account ${accountId}: ${reason}`);
      
      return NextResponse.json({
        success: false,
        message: `Account is not eligible for Plaid API calls: ${reason}`,
        reason,
      });
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
        const userId = await getCurrentUserId();
        const appInstanceId = getAppInstanceId();

        const response = await trackPlaidApiCall(
          () => plaidClient.accountsBalanceGet({
            access_token: account.plaidItem.accessToken,
          }),
          {
            endpoint: '/accounts/balance/get',
            institutionId: account.plaidItem.institutionId,
            accountId: account.id,
            userId,
            appInstanceId,
            requestData: { accessToken: '***' } // Don't log the actual token
          }
        );

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
        console.error("Error refreshing account balance:", error);
        return NextResponse.json(
          { error: "Failed to refresh account balance" },
          { status: 500 }
        );
      }
    }

    // Handle manual accounts (should not reach here due to eligibility check, but keeping for safety)
    return NextResponse.json({
      success: false,
      message: "Manual accounts cannot be refreshed via Plaid API",
    });
  } catch (error) {
    console.error("Error refreshing account:", error);
    return NextResponse.json(
      { error: "Failed to refresh account" },
      { status: 500 }
    );
  }
}
