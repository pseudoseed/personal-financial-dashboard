import { Account, PlaidItem, PrismaClient } from "@prisma/client";
import {
  Configuration,
  PlaidApi,
  PlaidEnvironments,
  Transaction as PlaidTransaction,
  InvestmentTransaction,
  Security,
} from "plaid";
import { v4 as uuidv4 } from 'uuid';

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

export async function downloadTransactions(
  prisma: PrismaClient,
  account: Account & {
    plaidItem: PlaidItem;
  },
  force?: boolean
) {
  if (account.type === "investment") {
    return handleInvestmentTransactions(prisma, account);
  } else {
    return handleRegularTransactions(prisma, account, force);
  }
}

async function handleRegularTransactions(
  prisma: PrismaClient,
  account: Account & {
    plaidItem: PlaidItem;
  },
  force?: boolean,
  _hasRetried?: boolean // internal flag to prevent infinite retry
) {
  let allTransactions: PlaidTransaction[] = [];
  let hasMore = true;
  // If forcing a full refresh, ignore the existing cursor
  let cursor: string | undefined = force ? undefined : (account as any).plaidSyncCursor || undefined;

  // Keep fetching transactions until we get them all
  while (hasMore) {
    let plaidApiCallStart = Date.now();
    let plaidApiCallError = null;
    let response;
    try {
      response = await plaidClient.transactionsSync({
        access_token: account.plaidItem.accessToken,
        cursor,
        count: 500,
        options: {
          include_original_description: true,
          account_id: account.plaidId,
        },
      });
      await logPlaidApiCall({
        prisma,
        endpoint: '/transactions/sync',
        responseStatus: 200,
        institutionId: account.plaidItem.institutionId,
        accountId: account.id,
        durationMs: Date.now() - plaidApiCallStart,
        userId: account.userId,
      });
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      plaidApiCallError = errorMessage;
      // Plaid error handling for invalid cursor
      const plaidErrorCode = error?.response?.data?.error_code;
      const plaidErrorMessage = error?.response?.data?.error_message;
      if (
        plaidErrorCode === 'INVALID_FIELD' &&
        plaidErrorMessage && plaidErrorMessage.includes('cursor not associated with access_token') &&
        !force && !_hasRetried
      ) {
        // Clear the cursor in the DB and retry once
        await prisma.account.update({
          where: { id: account.id },
          data: { plaidSyncCursor: null },
        });
        // Retry from scratch (force = true)
        return handleRegularTransactions(prisma, account, true, true);
      }
      await logPlaidApiCall({
        prisma,
        endpoint: '/transactions/sync',
        responseStatus: (error as any)?.response?.status || 500,
        institutionId: account.plaidItem.institutionId,
        accountId: account.id,
        durationMs: Date.now() - plaidApiCallStart,
        errorMessage,
        userId: account.userId,
      });
      throw error;
    }

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
    // Only include transactions with valid amount
    const validAddedTransactions = addedTransactions.filter(tx => typeof tx.amount === 'number' && !isNaN(tx.amount));
    const invalidAddedTransactions = addedTransactions.filter(tx => typeof tx.amount !== 'number' || isNaN(tx.amount));
    if (invalidAddedTransactions.length > 0) {
      // console.warn('[PLAID SYNC] Skipping transactions with invalid amount:', invalidAddedTransactions.map(tx => ({ transaction_id: tx.transaction_id, name: tx.name, amount: tx.amount })));
    }
    allTransactions = [...allTransactions, ...validAddedTransactions];

    // Process modified transactions (update existing ones)
    for (const modifiedTx of modifiedTransactions) {
      if (typeof modifiedTx.amount !== 'number' || isNaN(modifiedTx.amount)) {
        // console.warn('[PLAID SYNC] Skipping modified transaction with invalid amount:', { transaction_id: modifiedTx.transaction_id, name: modifiedTx.name, amount: modifiedTx.amount });
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
          amount: account.invertTransactions ? -modifiedTx.amount : modifiedTx.amount,
          category: modifiedTx.category ? modifiedTx.category[0] : null,
          merchantName: modifiedTx.merchant_name,
          pending: modifiedTx.pending,
          // Additional fields
          isoCurrencyCode: modifiedTx.iso_currency_code,
          unofficialCurrencyCode: modifiedTx.unofficial_currency_code,
          authorizedDate: modifiedTx.authorized_date
            ? new Date(modifiedTx.authorized_date)
            : null,
          authorizedDatetime: modifiedTx.authorized_datetime
            ? new Date(modifiedTx.authorized_datetime)
            : null,
          datetime: modifiedTx.datetime ? new Date(modifiedTx.datetime) : null,
          paymentChannel: modifiedTx.payment_channel,
          transactionCode: modifiedTx.transaction_code,
          personalFinanceCategory:
            modifiedTx.personal_finance_category?.primary || null,
          merchantEntityId: modifiedTx.merchant_entity_id,
          // Location data
          locationAddress: modifiedTx.location?.address,
          locationCity: modifiedTx.location?.city,
          locationRegion: modifiedTx.location?.region,
          locationPostalCode: modifiedTx.location?.postal_code,
          locationCountry: modifiedTx.location?.country,
          locationLat: modifiedTx.location?.lat || null,
          locationLon: modifiedTx.location?.lon || null,
          // Payment metadata
          byOrderOf: modifiedTx.payment_meta?.by_order_of,
          payee: modifiedTx.payment_meta?.payee,
          payer: modifiedTx.payment_meta?.payer,
          paymentMethod: modifiedTx.payment_meta?.payment_method,
          paymentProcessor: modifiedTx.payment_meta?.payment_processor,
          ppd_id: modifiedTx.payment_meta?.ppd_id,
          reason: modifiedTx.payment_meta?.reason,
          referenceNumber: modifiedTx.payment_meta?.reference_number,
        },
      });
    }

    // Process removed transactions
    if (removedTransactions.length > 0) {
      await prisma.transaction.deleteMany({
        where: {
          accountId: account.id,
          plaidId: {
            in: removedTransactions.map((tx) => tx.transaction_id),
          },
        },
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
            amount: account.invertTransactions ? -transaction.amount : transaction.amount,
            category: transaction.category ? transaction.category[0] : null,
            merchantName: transaction.merchant_name,
            pending: transaction.pending,
            isoCurrencyCode: transaction.iso_currency_code,
            unofficialCurrencyCode: transaction.unofficial_currency_code,
            authorizedDate: transaction.authorized_date ? new Date(transaction.authorized_date) : null,
            authorizedDatetime: transaction.authorized_datetime ? new Date(transaction.authorized_datetime) : null,
            datetime: transaction.datetime ? new Date(transaction.datetime) : null,
            paymentChannel: transaction.payment_channel,
            transactionCode: transaction.transaction_code,
            personalFinanceCategory: transaction.personal_finance_category?.primary || null,
            merchantEntityId: transaction.merchant_entity_id,
            locationAddress: transaction.location?.address,
            locationCity: transaction.location?.city,
            locationRegion: transaction.location?.region,
            locationPostalCode: transaction.location?.postal_code,
            locationCountry: transaction.location?.country,
            locationLat: transaction.location?.lat || null,
            locationLon: transaction.location?.lon || null,
            byOrderOf: transaction.payment_meta?.by_order_of,
            payee: transaction.payment_meta?.payee,
            payer: transaction.payment_meta?.payer,
            paymentMethod: transaction.payment_meta?.payment_method,
            paymentProcessor: transaction.payment_meta?.payment_processor,
            ppd_id: transaction.payment_meta?.ppd_id,
            reason: transaction.payment_meta?.reason,
            referenceNumber: transaction.payment_meta?.reference_number,
          },
          update: {
            date: new Date(transaction.date),
            name: transaction.name,
            amount: account.invertTransactions ? -transaction.amount : transaction.amount,
            category: transaction.category ? transaction.category[0] : null,
            merchantName: transaction.merchant_name,
            pending: transaction.pending,
            isoCurrencyCode: transaction.iso_currency_code,
            unofficialCurrencyCode: transaction.unofficial_currency_code,
            authorizedDate: transaction.authorized_date ? new Date(transaction.authorized_date) : null,
            authorizedDatetime: transaction.authorized_datetime ? new Date(transaction.authorized_datetime) : null,
            datetime: transaction.datetime ? new Date(transaction.datetime) : null,
            paymentChannel: transaction.payment_channel,
            transactionCode: transaction.transaction_code,
            personalFinanceCategory: transaction.personal_finance_category?.primary || null,
            merchantEntityId: transaction.merchant_entity_id,
            locationAddress: transaction.location?.address,
            locationCity: transaction.location?.city,
            locationRegion: transaction.location?.region,
            locationPostalCode: transaction.location?.postal_code,
            locationCountry: transaction.location?.country,
            locationLat: transaction.location?.lat || null,
            locationLon: transaction.location?.lon || null,
            byOrderOf: transaction.payment_meta?.by_order_of,
            payee: transaction.payment_meta?.payee,
            payer: transaction.payment_meta?.payer,
            paymentMethod: transaction.payment_meta?.payment_method,
            paymentProcessor: transaction.payment_meta?.payment_processor,
            ppd_id: transaction.payment_meta?.ppd_id,
            reason: transaction.payment_meta?.reason,
            referenceNumber: transaction.payment_meta?.reference_number,
          },
        });
      })
    );
  }

  // Update the account with the new cursor and last sync time
  await prisma.account.update({
    where: { id: account.id },
    data: {
      plaidSyncCursor: { set: cursor },
      lastSyncTime: { set: new Date() },
    },
  });

  return {
    downloadLog,
    transactionsAdded: allTransactions.length,
  };
}

async function handleInvestmentTransactions(
  prisma: PrismaClient,
  account: Account & {
    plaidItem: PlaidItem;
  }
) {
  console.log(`[INVESTMENT SYNC] Starting investment transaction sync for account: ${account.id} (${account.name})`);
  
  // Validate account eligibility before attempting sync
  if (account.plaidItem.accessToken === "manual") {
    throw new Error("Manual accounts don't support investment transaction sync");
  }

  if (account.plaidItem.status === "disconnected") {
    throw new Error("Cannot sync investment transactions for disconnected PlaidItem");
  }

  if (!account.plaidId) {
    throw new Error("Account missing plaidId - cannot sync investment transactions");
  }

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
    // Pre-validate the access token before attempting investment sync
    try {
      await plaidClient.itemGet({ access_token: account.plaidItem.accessToken });
    } catch (validationError: any) {
      const errorCode = validationError?.response?.data?.error_code;
      const isTokenRevoked = [
        'ITEM_NOT_FOUND',
        'INVALID_ACCESS_TOKEN',
        'ITEM_EXPIRED'
      ].includes(errorCode);

      if (isTokenRevoked) {
        console.log(`[INVESTMENT SYNC] Token revoked for account ${account.id} (${errorCode}) - marking PlaidItem as disconnected`);
        
        // Mark the PlaidItem as disconnected
        await prisma.plaidItem.update({
          where: { id: account.plaidItem.id },
          data: { status: 'disconnected' } as any
        });
        
        throw new Error(`Access token revoked (${errorCode}) - please reconnect this institution`);
      } else {
        throw validationError;
      }
    }

    // Keep fetching transactions until we get them all
    while (hasMore) {
      try {
        console.log(`[INVESTMENT SYNC] Fetching investment transactions with offset: ${offset}`);
        
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

        console.log(`[INVESTMENT SYNC] Received ${response.data.investment_transactions.length} transactions, ${response.data.securities.length} securities`);

        // Add transactions and securities to our collections
        allInvestmentTransactions = [
          ...allInvestmentTransactions,
          ...response.data.investment_transactions,
        ];
        allSecurities = [...allSecurities, ...response.data.securities];

        // Check if we need to fetch more
        offset += response.data.investment_transactions.length;
        hasMore = offset < response.data.total_investment_transactions;
        
      } catch (apiError: any) {
        const errorCode = apiError?.response?.data?.error_code;
        const errorMessage = apiError?.response?.data?.error_message || apiError?.message || 'Unknown error';
        
        console.error(`[INVESTMENT SYNC] API error for account ${account.id}:`, {
          errorCode,
          errorMessage,
          status: apiError?.response?.status,
          offset,
          plaidId: account.plaidId
        });

        // Handle specific error cases
        if (apiError?.response?.status === 400) {
          if (errorCode === 'INVALID_ACCOUNT_ID') {
            console.log(`[INVESTMENT SYNC] Invalid account ID ${account.plaidId} - this account may no longer exist in Plaid`);
            throw new Error(`Account ${account.name} no longer exists in Plaid - please refresh your connection`);
          } else if (errorCode === 'INVALID_ACCESS_TOKEN') {
            console.log(`[INVESTMENT SYNC] Invalid access token for account ${account.id} - marking as disconnected`);
            
            // Mark the PlaidItem as disconnected
            await prisma.plaidItem.update({
              where: { id: account.plaidItem.id },
              data: { status: 'disconnected' } as any
            });
            
            throw new Error(`Access token invalid - please reconnect this institution`);
          } else {
            console.log(`[INVESTMENT SYNC] 400 error with code ${errorCode} - treating as temporary failure`);
            throw new Error(`Investment sync temporarily unavailable (${errorCode}) - please try again later`);
          }
        } else if (apiError?.response?.status === 429) {
          console.log(`[INVESTMENT SYNC] Rate limit exceeded for account ${account.id}`);
          throw new Error(`Rate limit exceeded - please try again later`);
        } else {
          // For other errors, re-throw with more context
          throw new Error(`Investment sync failed: ${errorMessage} (${errorCode || 'UNKNOWN'})`);
        }
      }
    }

    console.log(`[INVESTMENT SYNC] Successfully fetched ${allInvestmentTransactions.length} investment transactions for account ${account.id}`);

    // Delete existing transactions for this time period
    const deletedCount = await prisma.transaction.deleteMany({
      where: {
        accountId: account.id,
        date: {
          gte: startDate,
          lte: new Date(endDate),
        },
      },
    });

    console.log(`[INVESTMENT SYNC] Deleted ${deletedCount.count} existing transactions for account ${account.id}`);

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
      console.log(`[INVESTMENT SYNC] Inserting ${allInvestmentTransactions.length} new transactions for account ${account.id}`);
      
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
      
      console.log(`[INVESTMENT SYNC] Successfully inserted ${allInvestmentTransactions.length} transactions for account ${account.id}`);
    }

    return {
      message: "Investment transactions downloaded successfully",
      downloadLog,
      numTransactions: allInvestmentTransactions.length,
    };
  } catch (error) {
    console.error(`[INVESTMENT SYNC] Error syncing investment transactions for account ${account.id}:`, error);
    
    // Create error log entry
    try {
      await prisma.transactionDownloadLog.create({
        data: {
          accountId: account.id,
          startDate,
          endDate: new Date(endDate),
          numTransactions: 0,
          status: "error",
        },
      });
    } catch (logError) {
      console.error(`[INVESTMENT SYNC] Failed to create error log entry:`, logError);
    }
    
    throw error;
  }
}

/**
 * Fetch the latest transaction for a given merchantName or name for a user.
 * Only queries the local database, does not trigger any Plaid sync.
 * Optionally filter by frequency (e.g., 'monthly').
 */
export async function getLatestTransactionForMerchant({
  prisma,
  userId,
  merchantName,
  name,
  frequency
}: {
  prisma: PrismaClient,
  userId: string,
  merchantName?: string,
  name?: string,
  frequency?: string
}) {
  // Build where clause
  const where: any = {
    account: { userId },
    amount: { lt: 0 }, // Only expenses
  };
  if (merchantName) {
    where.merchantName = merchantName;
  } else if (name) {
    where.name = name;
  }
  // Optionally, filter by frequency (not implemented here, but could use date intervals)
  // For now, just get the latest
  return prisma.transaction.findFirst({
    where,
    orderBy: { date: 'desc' },
  });
}

async function logPlaidApiCall({
  prisma,
  endpoint,
  responseStatus,
  institutionId,
  accountId,
  durationMs,
  errorMessage,
  userId,
  appInstanceId
}: {
  prisma: any,
  endpoint: string,
  responseStatus: number,
  institutionId?: string,
  accountId?: string,
  durationMs?: number,
  errorMessage?: string,
  userId?: string,
  appInstanceId?: string
}) {
  try {
    await prisma.plaidApiCallLog.create({
      data: {
        id: uuidv4(),
        timestamp: new Date(),
        endpoint,
        responseStatus,
        institutionId: institutionId || null,
        accountId: accountId || null,
        userId: userId || null,
        durationMs: durationMs || null,
        errorMessage: errorMessage || null,
        appInstanceId: appInstanceId || null,
      },
    });
  } catch (err) {
    console.error('[PlaidApiCallLog] Failed to log Plaid API call:', err);
  }
}
