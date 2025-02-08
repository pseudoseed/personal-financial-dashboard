import { NextResponse } from "next/server";
import {
  Configuration,
  PlaidApi,
  PlaidEnvironments,
  Transaction as PlaidTransaction,
} from "plaid";
import { prisma } from "@/lib/db";

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
    let allTransactions: PlaidTransaction[] = [];
    let hasMore = true;
    let offset = 0;

    // Calculate date range - request 24 months of data
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 24); // Go back 24 months from today

    console.log(
      "Requesting transactions from",
      startDate.toISOString().split("T")[0],
      "to",
      endDate.toISOString().split("T")[0]
    );

    // Keep fetching transactions until we get them all
    while (hasMore) {
      console.log(`Fetching transactions with offset ${offset}...`);
      const response = await plaidClient.transactionsGet({
        access_token: account.plaidItem.accessToken,
        start_date: startDate.toISOString().split("T")[0],
        end_date: endDate.toISOString().split("T")[0],
        options: {
          count: 500,
          offset: offset,
          account_ids: [account.plaidId],
          include_original_description: true, // Request additional transaction details
        },
      });

      console.log("Plaid API Response:", {
        total_transactions: response.data.total_transactions,
        transactions_returned: response.data.transactions.length,
      });

      const fetchedTransactions = response.data.transactions;
      if (fetchedTransactions.length === 0) {
        console.log("No more transactions returned from Plaid");
        break;
      }

      // Log the date range of received transactions
      if (fetchedTransactions.length > 0) {
        const dates = fetchedTransactions.map((t) => new Date(t.date));
        const oldestDate = new Date(Math.min(...dates.map((d) => d.getTime())));
        const newestDate = new Date(Math.max(...dates.map((d) => d.getTime())));
        console.log("Received transactions date range:", {
          oldest: oldestDate.toISOString().split("T")[0],
          newest: newestDate.toISOString().split("T")[0],
          count: fetchedTransactions.length,
        });
      }

      allTransactions = [...allTransactions, ...fetchedTransactions];

      console.log(
        `Fetched ${fetchedTransactions.length} transactions. Total: ${allTransactions.length}`
      );

      if (
        fetchedTransactions.length < 500 ||
        offset + fetchedTransactions.length >= response.data.total_transactions
      ) {
        console.log("No more pages to fetch");
        hasMore = false;
      } else {
        offset += fetchedTransactions.length;
        hasMore = true;
      }
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
        allTransactions.map((transaction) =>
          prisma.transaction.upsert({
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
            },
            update: {}, // No update if transaction exists
          })
        )
      );
    }

    return NextResponse.json({
      message: "Transactions downloaded successfully",
      downloadLog,
      numTransactions: allTransactions.length,
    });
  } catch (error) {
    console.error("Error downloading transactions:", error);

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
