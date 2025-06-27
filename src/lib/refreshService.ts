import { prisma } from "./db";
import { plaidClient } from "./plaid";
import { smartSyncTransactions } from "./transactionSyncService";
import { getCurrentUserId } from "./userManagement";

// Cache for storing refresh timestamps and data
const refreshCache = new Map<string, { timestamp: number; data: any }>();
const manualRefreshCounts = new Map<string, { count: number; resetTime: number }>();

// Configuration
const REFRESH_CONFIG = {
  // Cache TTL in milliseconds
  CACHE_TTL: {
    HIGH_ACTIVITY: 2 * 60 * 60 * 1000, // 2 hours for credit cards, checking
    MEDIUM_ACTIVITY: 4 * 60 * 60 * 1000, // 4 hours for savings
    LOW_ACTIVITY: 24 * 60 * 60 * 1000, // 24 hours for investment, loans
  },
  // Rate limiting
  MANUAL_REFRESH_LIMIT: 3, // Max manual refreshes per day
  MANUAL_REFRESH_WINDOW: 24 * 60 * 60 * 1000, // 24 hours
  // Auto-refresh threshold (how old data can be before auto-refresh)
  AUTO_REFRESH_THRESHOLD: 6 * 60 * 60 * 1000, // 6 hours
  // Transaction sync configuration
  INCLUDE_TRANSACTIONS: true, // Whether to include transaction sync in balance refresh
  TRANSACTION_SYNC_FREQUENCY: 0.3, // 30% chance to sync transactions during balance refresh
};

// Account activity levels
const ACCOUNT_ACTIVITY_LEVELS = {
  HIGH: ["credit", "depository"], // Credit cards, checking accounts
  MEDIUM: ["savings"], // Savings accounts
  LOW: ["investment", "loan", "other"], // Investment, loans, other
};

function getAccountActivityLevel(accountType: string): keyof typeof REFRESH_CONFIG.CACHE_TTL {
  const normalizedType = accountType.toLowerCase();
  
  if (ACCOUNT_ACTIVITY_LEVELS.HIGH.includes(normalizedType)) {
    return "HIGH_ACTIVITY";
  } else if (ACCOUNT_ACTIVITY_LEVELS.MEDIUM.includes(normalizedType)) {
    return "MEDIUM_ACTIVITY";
  } else {
    return "LOW_ACTIVITY";
  }
}

function getCacheKey(accountId: string, operation: string): string {
  return `${accountId}:${operation}`;
}

function isCacheValid(cacheKey: string, ttl: number): boolean {
  const cached = refreshCache.get(cacheKey);
  if (!cached) return false;
  
  const now = Date.now();
  return (now - cached.timestamp) < ttl;
}

function canManualRefresh(_userId: string): boolean {
  const userId = 'default';
  const now = Date.now();
  const userData = manualRefreshCounts.get(userId);
  
  if (!userData) {
    manualRefreshCounts.set(userId, { count: 1, resetTime: now + REFRESH_CONFIG.MANUAL_REFRESH_WINDOW });
    return true;
  }
  
  // Reset counter if window has passed
  if (now > userData.resetTime) {
    manualRefreshCounts.set(userId, { count: 1, resetTime: now + REFRESH_CONFIG.MANUAL_REFRESH_WINDOW });
    return true;
  }
  
  // Check if under limit
  if (userData.count < REFRESH_CONFIG.MANUAL_REFRESH_LIMIT) {
    userData.count++;
    return true;
  }
  
  return false;
}

function shouldAutoRefresh(account: any): boolean {
  if (!account.balances || account.balances.length === 0) {
    return true; // No balance data, need refresh
  }
  
  const lastBalance = account.balances[0];
  const lastUpdateTime = new Date(lastBalance.date).getTime();
  const now = Date.now();
  
  return (now - lastUpdateTime) > REFRESH_CONFIG.AUTO_REFRESH_THRESHOLD;
}

function shouldSyncTransactions(): boolean {
  if (!REFRESH_CONFIG.INCLUDE_TRANSACTIONS) {
    return false;
  }
  
  // Use probability to determine if we should sync transactions
  // This prevents transaction syncs from happening on every balance refresh
  return Math.random() < REFRESH_CONFIG.TRANSACTION_SYNC_FREQUENCY;
}

export async function smartRefreshAccounts(
  _userId?: string, 
  forceRefresh: boolean = false,
  includeTransactions: boolean = false
) {
  const userId = 'default';
  console.log("Starting smart refresh process...");
  
  // Get all accounts with their latest balance
  const accounts = await prisma.account.findMany({
    where: { userId, hidden: false },
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
  
  const results = {
    refreshed: [] as string[],
    skipped: [] as string[],
    errors: [] as Array<{ accountId: string; error: string }>,
    transactionSync: null as any,
  };
  
  // Group accounts by institution for batch processing
  const accountsByInstitution = new Map<string, any[]>();
  
  for (const account of accounts) {
    if (account.plaidItem.accessToken === "manual") {
      results.skipped.push(account.id);
      continue;
    }
    
    const institutionKey = account.plaidItem.id;
    if (!accountsByInstitution.has(institutionKey)) {
      accountsByInstitution.set(institutionKey, []);
    }
    accountsByInstitution.get(institutionKey)!.push(account);
  }
  
  // Process each institution
  for (const [institutionId, institutionAccounts] of accountsByInstitution) {
    try {
      const firstAccount = institutionAccounts[0];
      const cacheKey = getCacheKey(institutionId, "balance");
      const activityLevel = getAccountActivityLevel(firstAccount.type);
      const ttl = REFRESH_CONFIG.CACHE_TTL[activityLevel];
      
      // Check if we should refresh this institution
      const needsRefresh = forceRefresh || 
        !isCacheValid(cacheKey, ttl) ||
        institutionAccounts.some(account => shouldAutoRefresh(account));
      
      if (!needsRefresh) {
        institutionAccounts.forEach(account => results.skipped.push(account.id));
        continue;
      }
      
      // Perform the refresh
      await refreshInstitutionAccounts(institutionAccounts, results);
      
      // Update cache
      refreshCache.set(cacheKey, { timestamp: Date.now(), data: { refreshed: true } });
      
    } catch (error) {
      console.error(`Error refreshing institution ${institutionId}:`, error);
      institutionAccounts.forEach(account => {
        results.errors.push({ accountId: account.id, error: error instanceof Error ? error.message : "Unknown error" });
      });
    }
  }
  
  // Optionally sync transactions
  if (includeTransactions || shouldSyncTransactions()) {
    try {
      console.log("Including transaction sync in refresh...");
      const transactionResults = await smartSyncTransactions(userId, false);
      results.transactionSync = transactionResults;
    } catch (error) {
      console.error("Error during transaction sync:", error);
      results.transactionSync = {
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }
  
  console.log(`Smart refresh completed: ${results.refreshed.length} refreshed, ${results.skipped.length} skipped, ${results.errors.length} errors`);
  return results;
}

async function refreshInstitutionAccounts(accounts: any[], results: any) {
  const firstAccount = accounts[0];
  
  if (firstAccount.plaidItem.provider === "coinbase") {
    // Handle Coinbase accounts
    for (const account of accounts) {
      try {
        await refreshCoinbaseAccount(account);
        results.refreshed.push(account.id);
      } catch (error) {
        results.errors.push({ accountId: account.id, error: error instanceof Error ? error.message : "Unknown error" });
      }
    }
  } else {
    // Handle Plaid accounts
    try {
      const response = await plaidClient.accountsBalanceGet({
        access_token: firstAccount.plaidItem.accessToken,
      });
      
      for (const account of accounts) {
        try {
          const plaidAccount = response.data.accounts.find(
            (acc: any) => acc.account_id === account.plaidId
          );
          
          if (!plaidAccount) {
            results.errors.push({ accountId: account.id, error: "Account not found in Plaid response" });
            continue;
          }
          
          // Create new balance record
          await prisma.accountBalance.create({
            data: {
              accountId: account.id,
              current: plaidAccount.balances.current || 0,
              available: plaidAccount.balances.available || null,
              limit: plaidAccount.balances.limit || null,
            },
          });
          
          // Fetch liability data for credit/loan accounts
          if ((account.type === "credit" || account.type === "loan")) {
            try {
              await refreshPlaidLiabilities(account);
            } catch (error) {
              console.error(`Error fetching liability data for ${account.name}:`, error);
            }
          }
          
          results.refreshed.push(account.id);
        } catch (error) {
          results.errors.push({ accountId: account.id, error: error instanceof Error ? error.message : "Unknown error" });
        }
      }
    } catch (error) {
      throw error;
    }
  }
}

async function refreshCoinbaseAccount(account: any) {
  // Implementation for Coinbase refresh
  // This would be similar to your existing Coinbase refresh logic
  console.log(`Refreshing Coinbase account: ${account.name}`);
  // Add your Coinbase refresh implementation here
}

async function refreshPlaidLiabilities(account: any) {
  const response = await plaidClient.liabilitiesGet({
    access_token: account.plaidItem.accessToken,
    options: {
      account_ids: [account.plaidId],
    },
  });
  
  const liabilities = response.data.liabilities;
  if (!liabilities) return;
  
  // Handle credit card liabilities
  const credit = liabilities.credit?.find((c: any) => c.account_id === account.plaidId);
  if (credit) {
    await prisma.account.update({
      where: { id: account.id },
      data: {
        lastStatementBalance: credit.last_statement_balance || null,
        minimumPaymentAmount: credit.minimum_payment_amount || null,
        nextPaymentDueDate: credit.next_payment_due_date ? new Date(credit.next_payment_due_date) : null,
        lastPaymentDate: credit.last_payment_date ? new Date(credit.last_payment_date) : null,
        lastPaymentAmount: credit.last_payment_amount || null,
      },
    });
  }
  
  // Handle mortgage liabilities
  const mortgage = liabilities.mortgage?.find((m: any) => m.account_id === account.plaidId);
  if (mortgage) {
    await prisma.account.update({
      where: { id: account.id },
      data: {
        nextMonthlyPayment: mortgage.next_monthly_payment || null,
        originationDate: mortgage.origination_date ? new Date(mortgage.origination_date) : null,
        originationPrincipalAmount: mortgage.origination_principal_amount || null,
      },
    });
  }
}

export async function canUserManualRefresh(_userId?: string): Promise<boolean> {
  return true;
}

export async function getManualRefreshCount(_userId?: string): Promise<{ count: number; limit: number; resetTime: number }> {
  return { count: 0, limit: REFRESH_CONFIG.MANUAL_REFRESH_LIMIT, resetTime: Date.now() + REFRESH_CONFIG.MANUAL_REFRESH_WINDOW };
}

// Clear cache (useful for testing or manual cache invalidation)
export function clearCache(): void {
  refreshCache.clear();
  manualRefreshCounts.clear();
} 