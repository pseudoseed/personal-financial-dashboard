import { PrismaClient } from "@prisma/client";

export interface DataValidationResult {
  orphanedAccounts: Array<{
    id: string;
    name: string;
    plaidId: string;
    reason: string;
  }>;
  orphanedBalances: Array<{
    id: string;
    accountId: string;
    reason: string;
  }>;
  orphanedTransactions: Array<{
    id: string;
    accountId: string;
    reason: string;
  }>;
  orphanedDownloadLogs: Array<{
    id: string;
    accountId: string;
    reason: string;
  }>;
  dataInconsistencies: Array<{
    type: string;
    description: string;
    count: number;
  }>;
}

export async function validateDataIntegrity(prisma: PrismaClient): Promise<DataValidationResult> {
  const result: DataValidationResult = {
    orphanedAccounts: [],
    orphanedBalances: [],
    orphanedTransactions: [],
    orphanedDownloadLogs: [],
    dataInconsistencies: [],
  };

  try {
    // Check for accounts without PlaidItems (excluding manual accounts)
    // This is handled by foreign key constraints, so we'll check for accounts with invalid itemId
    const allAccounts = await prisma.account.findMany({
      include: {
        plaidItem: true,
      },
    });

    const accountsWithoutPlaidItems = allAccounts.filter(account => !account.plaidItem);
    
    result.orphanedAccounts.push(
      ...accountsWithoutPlaidItems.map(account => ({
        id: account.id,
        name: account.name,
        plaidId: account.plaidId,
        reason: "Account has no associated PlaidItem",
      }))
    );

    // Check for balance records without accounts
    // This is handled by foreign key constraints, but we can check for any that might exist
    const allBalances = await prisma.accountBalance.findMany({
      include: {
        account: true,
      },
    });

    const balancesWithoutAccounts = allBalances.filter(balance => !balance.account);
    
    result.orphanedBalances.push(
      ...balancesWithoutAccounts.map(balance => ({
        id: balance.id,
        accountId: balance.accountId,
        reason: "Balance record has no associated account",
      }))
    );

    // Check for transaction records without accounts
    const allTransactions = await prisma.transaction.findMany({
      include: {
        account: true,
      },
    });

    const transactionsWithoutAccounts = allTransactions.filter(transaction => !transaction.account);
    
    result.orphanedTransactions.push(
      ...transactionsWithoutAccounts.map(transaction => ({
        id: transaction.id,
        accountId: transaction.accountId,
        reason: "Transaction has no associated account",
      }))
    );

    // Check for download logs without accounts
    const allDownloadLogs = await prisma.transactionDownloadLog.findMany({
      include: {
        account: true,
      },
    });

    const downloadLogsWithoutAccounts = allDownloadLogs.filter(log => !log.account);
    
    result.orphanedDownloadLogs.push(
      ...downloadLogsWithoutAccounts.map(log => ({
        id: log.id,
        accountId: log.accountId,
        reason: "Download log has no associated account",
      }))
    );

    // Check for data inconsistencies
    const accountCount = await prisma.account.count();
    const plaidItemCount = await prisma.plaidItem.count();
    const balanceCount = await prisma.accountBalance.count();
    const transactionCount = await prisma.transaction.count();

    // Check for accounts with no balance history
    const accountsWithNoBalances = await prisma.account.count({
      where: {
        balances: {
          none: {},
        },
      },
    });

    if (accountsWithNoBalances > 0) {
      result.dataInconsistencies.push({
        type: "Accounts without balance history",
        description: `${accountsWithNoBalances} accounts have no balance records`,
        count: accountsWithNoBalances,
      });
    }

    // Check for accounts with no transactions
    const accountsWithNoTransactions = await prisma.account.count({
      where: {
        transactions: {
          none: {},
        },
      },
    });

    if (accountsWithNoTransactions > 0) {
      result.dataInconsistencies.push({
        type: "Accounts without transactions",
        description: `${accountsWithNoTransactions} accounts have no transaction records`,
        count: accountsWithNoTransactions,
      });
    }

    // Check for PlaidItems with no accounts
    const plaidItemsWithNoAccounts = await prisma.plaidItem.count({
      where: {
        accounts: {
          none: {},
        },
      },
    });

    if (plaidItemsWithNoAccounts > 0) {
      result.dataInconsistencies.push({
        type: "PlaidItems without accounts",
        description: `${plaidItemsWithNoAccounts} PlaidItems have no associated accounts`,
        count: plaidItemsWithNoAccounts,
      });
    }

    // Add summary statistics
    result.dataInconsistencies.push(
      {
        type: "Summary Statistics",
        description: `Total: ${accountCount} accounts, ${plaidItemCount} PlaidItems, ${balanceCount} balances, ${transactionCount} transactions`,
        count: accountCount + plaidItemCount + balanceCount + transactionCount,
      }
    );

  } catch (error) {
    console.error("Error validating data integrity:", error);
    result.dataInconsistencies.push({
      type: "Validation Error",
      description: `Error occurred during validation: ${error instanceof Error ? error.message : "Unknown error"}`,
      count: 0,
    });
  }

  return result;
}

export async function getDataHealthSummary(prisma: PrismaClient): Promise<{
  totalAccounts: number;
  totalPlaidItems: number;
  totalBalances: number;
  totalTransactions: number;
  accountsWithBalances: number;
  accountsWithTransactions: number;
  manualAccounts: number;
  plaidAccounts: number;
  coinbaseAccounts: number;
}> {
  const [
    totalAccounts,
    totalPlaidItems,
    totalBalances,
    totalTransactions,
    accountsWithBalances,
    accountsWithTransactions,
    manualAccounts,
    plaidAccounts,
    coinbaseAccounts,
  ] = await Promise.all([
    prisma.account.count(),
    prisma.plaidItem.count(),
    prisma.accountBalance.count(),
    prisma.transaction.count(),
    prisma.account.count({
      where: {
        balances: {
          some: {},
        },
      },
    }),
    prisma.account.count({
      where: {
        transactions: {
          some: {},
        },
      },
    }),
    prisma.account.count({
      where: {
        plaidItem: {
          accessToken: "manual",
        },
      },
    }),
    prisma.account.count({
      where: {
        plaidItem: {
          provider: "plaid",
        },
      },
    }),
    prisma.account.count({
      where: {
        plaidItem: {
          provider: "coinbase",
        },
      },
    }),
  ]);

  return {
    totalAccounts,
    totalPlaidItems,
    totalBalances,
    totalTransactions,
    accountsWithBalances,
    accountsWithTransactions,
    manualAccounts,
    plaidAccounts,
    coinbaseAccounts,
  };
} 