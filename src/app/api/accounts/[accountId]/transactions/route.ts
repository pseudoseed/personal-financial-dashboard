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
    let cursor: string | undefined = undefined;

    console.log("Starting transaction sync for account:", accountId);

    // Keep fetching transactions until we get them all
    while (hasMore) {
      console.log("Fetching transactions with cursor:", cursor);
      const response = await plaidClient.transactionsSync({
        access_token: account.plaidItem.accessToken,
        cursor,
        count: 500,
        options: {
          include_original_description: true,
        },
      });

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
