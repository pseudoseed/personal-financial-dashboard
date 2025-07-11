import { NextResponse } from "next/server";
import {
  Configuration,
  PlaidApi,
  PlaidEnvironments,
  Transaction as PlaidTransaction,
  InvestmentTransaction,
  Security,
} from "plaid";
import { prisma } from "@/lib/db";
import { Account, PlaidItem } from "@prisma/client";
import { downloadTransactions } from "@/lib/transactions";
import { trackPlaidApiCall, getCurrentUserId, getAppInstanceId } from "@/lib/plaidTracking";
import { isAccountEligibleForPlaidCalls, getAccountIneligibilityReason } from "@/lib/accountEligibility";

const plaidClient = new PlaidApi(
  new Configuration({
    basePath: PlaidEnvironments[process.env.PLAID_ENV || "sandbox"],
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
        "PLAID-SECRET": process.env.PLAID_SECRET,
      },
    },
  })
);

async function handleRegularTransactions(
  account: Account & {
    plaidItem: PlaidItem;
  }
) {
  // Check if account is eligible for Plaid API calls
  if (!isAccountEligibleForPlaidCalls(account)) {
    const reason = getAccountIneligibilityReason(account);
    console.log(`[TRANSACTIONS] Skipping Plaid API calls for account ${account.id}: ${reason}`);
    throw new Error(`Account is not eligible for Plaid API calls: ${reason}`);
  }

  let allTransactions: PlaidTransaction[] = [];
  let hasMore = true;
  let cursor: string | undefined = undefined;

  console.log("Starting transaction sync for account:", account.id);

  const userId = await getCurrentUserId();
  const appInstanceId = getAppInstanceId();

  while (hasMore) {
    const response: any = await trackPlaidApiCall(
      () => plaidClient.transactionsSync({
        access_token: account.plaidItem.accessToken,
        cursor,
        count: 500,
        options: {
          include_original_description: true,
          account_id: account.plaidId,
        },
      }),
      {
        endpoint: '/transactions/sync',
        institutionId: account.plaidItem.institutionId,
        accountId: account.id,
        userId,
        appInstanceId,
        requestData: {
          accessToken: '***', // Don't log the actual token
          cursor: cursor || 'initial',
          count: 500,
          accountId: account.plaidId
        }
      }
    );

    console.log("Plaid API Response:", {
      added: response.data.added.length,
      modified: response.data.modified.length,
      removed: response.data.removed.length,
      has_more: response.data.has_more,
    });

    // Filter transactions for this account
    const addedTransactions = response.data.added.filter(
      (tx) => tx.account_id === account.plaidId
    );
    const modifiedTransactions = response.data.modified.filter(
      (tx) => tx.account_id === account.plaidId
    );
    const removedTransactions = response.data.removed.filter(
      (tx) => tx.account_id === account.plaidId
    );

    // Process added transactions
    allTransactions = [...allTransactions, ...addedTransactions];

    // Process modified transactions (update existing ones)
    for (const modifiedTx of modifiedTransactions) {
      if (typeof modifiedTx.amount !== 'number' || isNaN(modifiedTx.amount)) {
        console.warn('[PLAID SYNC] Skipping modified transaction with invalid amount:', { transaction_id: modifiedTx.transaction_id, name: modifiedTx.name, amount: modifiedTx.amount });
        continue;
      }
      
      await prisma.transaction.update({
        where: {
          accountId_plaidId: {
            accountId: account.id,
            plaidId: modifiedTx.transaction_id,
          },
        },
        data: {
          date: new Date(modifiedTx.date),
          name: modifiedTx.name,
          amount: modifiedTx.amount,
          category: modifiedTx.category ? modifiedTx.category[0] : null,
          merchantName: modifiedTx.merchant_name,
          pending: modifiedTx.pending,
        },
      });
    }

    // Process removed transactions
    if (removedTransactions.length > 0) {
      console.log(
        `Deleting ${removedTransactions.length} removed transactions`
      );
      await prisma.transaction.deleteMany({
        where: {
          accountId: account.id,
          plaidId: {
            in: removedTransactions.map((tx) => tx.transaction_id),
          },
        },
      });
    }

    // Log the date range of received transactions
    if (addedTransactions.length > 0) {
      const dates = addedTransactions.map((t) => new Date(t.date));
      const oldestDate = new Date(Math.min(...dates.map((d) => d.getTime())));
      const newestDate = new Date(Math.max(...dates.map((d) => d.getTime())));
      console.log("Received transactions date range:", {
        oldest: oldestDate.toISOString().split("T")[0],
        newest: newestDate.toISOString().split("T")[0],
        count: addedTransactions.length,
      });
    }

    hasMore = response.data.has_more;
    cursor = response.data.next_cursor;
  }

  // Calculate actual date range from fetched transactions
  const transactionDates = allTransactions.map((t) => new Date(t.date));
  const oldestDate =
    allTransactions.length > 0
      ? new Date(Math.min(...transactionDates.map((d) => d.getTime())))
      : new Date();
  const newestDate =
    allTransactions.length > 0
      ? new Date(Math.max(...transactionDates.map((d) => d.getTime())))
      : new Date();

  // Create download log entry
  const downloadLog = await prisma.transactionDownloadLog.create({
    data: {
      accountId: account.id,
      startDate: oldestDate,
      endDate: newestDate,
      numTransactions: allTransactions.length,
      status: "success",
    },
  });

  // Insert new transactions, skipping any that already exist
  if (allTransactions.length > 0) {
    await prisma.$transaction(
      allTransactions.map((transaction) => {
        return prisma.transaction.upsert({
          where: {
            accountId_plaidId: {
              accountId: account.id,
              plaidId: transaction.transaction_id,
            },
          },
          create: {
            accountId: account.id,
            plaidId: transaction.transaction_id,
            date: new Date(transaction.date),
            name: transaction.name,
            amount: transaction.amount,
            category: transaction.category ? transaction.category[0] : null,
            merchantName: transaction.merchant_name,
            pending: transaction.pending,
            // Additional fields
            isoCurrencyCode: transaction.iso_currency_code,
            unofficialCurrencyCode: transaction.unofficial_currency_code,
            authorizedDate: transaction.authorized_date
              ? new Date(transaction.authorized_date)
              : null,
            authorizedDatetime: transaction.authorized_datetime
              ? new Date(transaction.authorized_datetime)
              : null,
            datetime: transaction.datetime
              ? new Date(transaction.datetime)
              : null,
            paymentChannel: transaction.payment_channel,
            transactionCode: transaction.transaction_code || null,
            personalFinanceCategory:
              transaction.personal_finance_category?.primary || null,
            merchantEntityId: transaction.merchant_entity_id,
            // Location data
            locationAddress: transaction.location?.address,
            locationCity: transaction.location?.city,
            locationRegion: transaction.location?.region,
            locationPostalCode: transaction.location?.postal_code,
            locationCountry: transaction.location?.country,
            locationLat: transaction.location?.lat || null,
            locationLon: transaction.location?.lon || null,
            // Payment metadata
            byOrderOf: transaction.payment_meta?.by_order_of,
            payee: transaction.payment_meta?.payee,
            payer: transaction.payment_meta?.payer,
            paymentMethod: transaction.payment_meta?.payment_method,
            paymentProcessor: transaction.payment_meta?.payment_processor,
            ppd_id: transaction.payment_meta?.ppd_id,
            reason: transaction.payment_meta?.reason,
            referenceNumber: transaction.payment_meta?.reference_number,
          },
          update: {}, // No update if transaction exists
        });
      })
    );
  }

  return {
    message: "Transactions downloaded successfully",
    downloadLog,
    numTransactions: allTransactions.length,
  };
}

async function handleInvestmentTransactions(
  account: Account & {
    plaidItem: PlaidItem;
  }
) {
  console.log("Starting investment transaction sync for account:", account.id);

  const endDate = new Date().toISOString().split("T")[0];
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 24); // Get 24 months of history
  const startDateStr = startDate.toISOString().split("T")[0];

  let allInvestmentTransactions: InvestmentTransaction[] = [];
  let allSecurities: Security[] = [];
  let hasMore = true;
  let offset = 0;
  const PAGE_SIZE = 500;

  try {
    // Keep fetching transactions until we get them all
    while (hasMore) {
      console.log("Fetching investment transactions with offset:", offset);

      const response = await plaidClient.investmentsTransactionsGet({
        access_token: account.plaidItem.accessToken,
        start_date: startDateStr,
        end_date: endDate,
        options: {
          offset,
          count: PAGE_SIZE,
          account_ids: [account.plaidId],
        },
      });

      console.log("Plaid API Response:", {
        total_transactions: response.data.investment_transactions.length,
        total_available: response.data.total_investment_transactions,
        securities: response.data.securities.length,
        offset,
      });

      // Add transactions and securities to our collections
      allInvestmentTransactions = [
        ...allInvestmentTransactions,
        ...response.data.investment_transactions,
      ];
      allSecurities = [...allSecurities, ...response.data.securities];

      // Check if we need to fetch more
      offset += response.data.investment_transactions.length;
      hasMore = offset < response.data.total_investment_transactions;
    }

    console.log("Finished fetching all investment transactions:", {
      total_fetched: allInvestmentTransactions.length,
      total_securities: allSecurities.length,
    });

    // Delete existing transactions for this time period
    await prisma.transaction.deleteMany({
      where: {
        accountId: account.id,
        date: {
          gte: startDate,
          lte: new Date(endDate),
        },
      },
    });

    // Create download log entry
    const downloadLog = await prisma.transactionDownloadLog.create({
      data: {
        accountId: account.id,
        startDate,
        endDate: new Date(endDate),
        numTransactions: allInvestmentTransactions.length,
        status: "success",
      },
    });

    // Insert new transactions
    if (allInvestmentTransactions.length > 0) {
      await prisma.$transaction(
        allInvestmentTransactions.map((transaction) => {
          const security = transaction.security_id
            ? allSecurities.find(
                (s) => s.security_id === transaction.security_id
              )
            : null;

          return prisma.transaction.create({
            data: {
              accountId: account.id,
              plaidId: transaction.investment_transaction_id,
              date: new Date(transaction.date),
              name: transaction.name,
              amount: transaction.amount,
              category: transaction.type,
              merchantName: security?.name || null,
              pending: false,
              // Investment transaction fields
              fees: transaction.fees || 0,
              price: transaction.price || 0,
              quantity: transaction.quantity || 0,
              // Security fields
              securityId: transaction.security_id || null,
              tickerSymbol: security?.ticker_symbol || null,
              isin: security?.isin || null,
              cusip: security?.cusip || null,
              sedol: security?.sedol || null,
              institutionSecurityId: security?.institution_security_id || null,
              securityName: security?.name || null,
              securityType: security?.type || null,
              closePrice: security?.close_price || null,
              closePriceAsOf: security?.close_price_as_of
                ? new Date(security.close_price_as_of)
                : null,
              isCashEquivalent: security?.is_cash_equivalent || null,
              type: transaction.type || null,
              subtype: transaction.subtype || null,
              isoCurrencyCode: transaction.iso_currency_code,
              unofficialCurrencyCode: transaction.unofficial_currency_code,
              marketIdentifierCode: security?.market_identifier_code || null,
              sector: security?.sector || null,
              industry: security?.industry || null,
            },
          });
        })
      );
    }

    return {
      message: "Investment transactions downloaded successfully",
      downloadLog,
      numTransactions: allInvestmentTransactions.length,
    };
  } catch (error) {
    console.error("Investment transactions sync error details:", error);
    if (error && typeof error === 'object' && 'response' in error && error.response && typeof error.response === 'object' && 'data' in error.response) {
      console.error((error.response as any).data);
    }
    throw error;
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ accountId: string }> }
) {
  const { accountId } = await params;

  // Get the account and its Plaid item
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    include: { plaidItem: true },
  });

  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  try {
    const result = await downloadTransactions(prisma, account);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error downloading transactions:", error);
    if (error && typeof error === 'object' && 'response' in error && error.response && typeof error.response === 'object' && 'data' in error.response) {
      console.error((error.response as any).data);
    }
    // Log the error
    await prisma.transactionDownloadLog.create({
      data: {
        accountId: accountId,
        startDate: new Date(),
        endDate: new Date(),
        numTransactions: 0,
        status: "error",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      },
    });

    return NextResponse.json(
      { error: "Failed to download transactions" },
      { status: 500 }
    );
  }
}
