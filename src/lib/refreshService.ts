import { prisma } from "./db";
import { plaidClient } from "./plaid";
import { smartSyncTransactions } from "./transactionSyncService";
import { getCurrentUserId } from "./userManagement";

// Cache for storing refresh timestamps and data
const refreshCache = new Map<string, { timestamp: number; data: any }>();
const manualRefreshCounts = new Map<string, { count: number; resetTime: number }>();

// Request deduplication - prevent concurrent requests for same institution
const activeRequests = new Map<string, Promise<any>>();

// Liability data cache - cache liability data for 24 hours
const liabilityCache = new Map<string, { timestamp: number; data: any }>();
const LIABILITY_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

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

// Request deduplication function
async function deduplicateRequest<T>(key: string, requestFn: () => Promise<T>): Promise<T> {
  // Check if there's already an active request for this key
  if (activeRequests.has(key)) {
    return await activeRequests.get(key)!;
  }
  
  // Create new request
  const requestPromise = requestFn().finally(() => {
    // Clean up the active request when it completes
    activeRequests.delete(key);
  });
  
  // Store the request promise
  activeRequests.set(key, requestPromise);
  
  return requestPromise;
}

export async function smartRefreshAccounts(
  _userId?: string, 
  forceRefresh: boolean = false,
  includeTransactions: boolean = false
) {
  const userId = 'default';
  
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
  
  // Log validation issues for debugging
  logAccountValidationIssues(accounts);
  
  const results = {
    refreshed: [] as string[],
    skipped: [] as string[],
    errors: [] as Array<{ accountId: string; error: string }>,
    transactionSync: null as any,
  };
  
  // Validate accounts before processing
  const validAccounts = [];
  for (const account of accounts) {
    const validation = validateAccountData(account);
    
    if (!validation.isValid) {
      results.errors.push({ 
        accountId: account.id, 
        error: `Account validation failed: ${validation.errors.join(', ')}` 
      });
      continue;
    }
    
    // Skip manual accounts
    if (account.plaidItem.accessToken === "manual") {
      results.skipped.push(account.id);
      continue;
    }
    
    validAccounts.push(account);
  }
  
  // Group valid accounts by institution for batch processing
  const accountsByInstitution = new Map<string, any[]>();
  
  for (const account of validAccounts) {
    const institutionKey = account.plaidItem.id;
    if (!accountsByInstitution.has(institutionKey)) {
      accountsByInstitution.set(institutionKey, []);
    }
    accountsByInstitution.get(institutionKey)!.push(account);
  }
  
  // Process each institution with deduplication
  const institutionPromises = Array.from(accountsByInstitution.entries()).map(
    async ([institutionId, institutionAccounts]) => {
      const deduplicationKey = `refresh_${institutionId}`;
      
      return deduplicateRequest(deduplicationKey, async () => {
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
            return;
          }
          
          // Perform the refresh
          await refreshInstitutionAccounts(institutionAccounts, results);
          
          // Update cache
          refreshCache.set(cacheKey, { timestamp: Date.now(), data: { refreshed: true } });
          
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          console.error(`Error refreshing institution ${institutionId}:`, errorMessage);
          institutionAccounts.forEach(account => {
            results.errors.push({ accountId: account.id, error: errorMessage });
          });
        }
      });
    }
  );
  
  // Wait for all institution refreshes to complete
  await Promise.all(institutionPromises);
  
  // Optionally sync transactions
  if (includeTransactions || shouldSyncTransactions()) {
    try {
      const transactionResults = await smartSyncTransactions(userId, false);
      results.transactionSync = transactionResults;
    } catch (error) {
      results.transactionSync = {
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }
  
  return results;
}

async function refreshInstitutionAccounts(accounts: any[], results: any) {
  const firstAccount = accounts[0];
  
  // Additional validation before making any API calls
  if (!firstAccount.plaidItem?.accessToken || firstAccount.plaidItem.accessToken === "manual") {
    throw new Error("Invalid access token for institution");
  }
  
  if (firstAccount.plaidItem.provider === "coinbase") {
    // Handle Coinbase accounts
    for (const account of accounts) {
      try {
        await refreshCoinbaseAccount(account);
        results.refreshed.push(account.id);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error(`Error refreshing Coinbase account ${account.id}:`, errorMessage);
        results.errors.push({ accountId: account.id, error: errorMessage });
      }
    }
  } else {
    // Handle Plaid accounts
    try {
      // Validate that we have the required data before making API call
      if (!firstAccount.plaidItem.accessToken) {
        throw new Error("Missing access token for Plaid institution");
      }
      
      const response = await plaidClient.accountsBalanceGet({
        access_token: firstAccount.plaidItem.accessToken,
      });
      
      // Validate Plaid response
      if (!response.data?.accounts || !Array.isArray(response.data.accounts)) {
        throw new Error("Invalid response from Plaid API");
      }
      
      // Get liability data for credit/loan accounts if available
      let liabilityData = null;
      const hasCreditOrLoanAccounts = accounts.some(account => 
        account.type === "credit" || account.type === "loan"
      );
      
      if (hasCreditOrLoanAccounts) {
        try {
          liabilityData = await fetchBatchedLiabilities(firstAccount.plaidItem.accessToken, accounts);
        } catch (error) {
          console.warn("Failed to fetch liability data:", error instanceof Error ? error.message : "Unknown error");
          // Don't fail the entire refresh if liability fetch fails
        }
      }
      
      for (const account of accounts) {
        try {
          const plaidAccount = response.data.accounts.find(
            (acc: any) => acc.account_id === account.plaidId
          );
          
          if (!plaidAccount) {
            const errorMsg = `Account not found in Plaid response (plaidId: ${account.plaidId})`;
            console.error(errorMsg);
            results.errors.push({ accountId: account.id, error: errorMsg });
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
          
          // Update liability data if available
          if (liabilityData && (account.type === "credit" || account.type === "loan")) {
            try {
              await updateAccountLiabilities(account, liabilityData);
            } catch (error) {
              console.warn(`Failed to update liability data for account ${account.id}:`, error instanceof Error ? error.message : "Unknown error");
            }
          }
          
          results.refreshed.push(account.id);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          console.error(`Error processing account ${account.id}:`, errorMessage);
          results.errors.push({ accountId: account.id, error: errorMessage });
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`Error refreshing Plaid institution:`, errorMessage);
      throw error;
    }
  }
}

async function refreshCoinbaseAccount(account: any) {
  // Implementation for Coinbase refresh
  // This would be similar to your existing Coinbase refresh logic
}

// Batched liability fetching with caching
async function fetchBatchedLiabilities(accessToken: string, accounts: any[]) {
  const institutionKey = accounts[0].plaidItem.id;
  const cacheKey = `liability_${institutionKey}`;
  
  // Check cache first
  const cached = liabilityCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < LIABILITY_CACHE_TTL) {
    return cached.data;
  }
  
  // Fetch fresh liability data
  const accountIds = accounts.map(account => account.plaidId);
  const response = await plaidClient.liabilitiesGet({
    access_token: accessToken,
    options: {
      account_ids: accountIds,
    },
  });
  
  // Cache the response
  liabilityCache.set(cacheKey, { 
    timestamp: Date.now(), 
    data: response.data.liabilities 
  });
  
  return response.data.liabilities;
}

// Update account with liability data from batched response
async function updateAccountLiabilities(account: any, liabilityData: any) {
  if (!liabilityData) return;
  
  // Handle credit card liabilities
  const credit = liabilityData.credit?.find((c: any) => c.account_id === account.plaidId);
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
  const mortgage = liabilityData.mortgage?.find((m: any) => m.account_id === account.plaidId);
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
  
  // Handle student loan liabilities
  const student = liabilityData.student?.find((s: any) => s.account_id === account.plaidId);
  if (student) {
    await prisma.account.update({
      where: { id: account.id },
      data: {
        lastStatementBalance: student.last_payment_amount || null,
        minimumPaymentAmount: student.minimum_payment_amount || null,
        nextPaymentDueDate: student.next_payment_due_date ? new Date(student.next_payment_due_date) : null,
        lastPaymentDate: student.last_payment_date ? new Date(student.last_payment_date) : null,
        lastPaymentAmount: student.last_payment_amount || null,
        originationDate: student.origination_date ? new Date(student.origination_date) : null,
        originationPrincipalAmount: student.origination_principal_amount || null,
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
  liabilityCache.clear();
  activeRequests.clear();
}

// Utility function to validate account data integrity
export function validateAccountData(account: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check required fields
  if (!account.id) {
    errors.push("Missing account ID");
  }
  
  if (!account.plaidId) {
    errors.push("Missing plaidId");
  }
  
  if (!account.plaidItem) {
    errors.push("Missing plaidItem");
  } else {
    if (!account.plaidItem.id) {
      errors.push("Missing plaidItem.id");
    }
    
    if (!account.plaidItem.accessToken) {
      errors.push("Missing accessToken");
    }
    
    if (account.plaidItem.accessToken === "manual") {
      errors.push("Manual account - should be skipped");
    }
  }
  
  if (!account.type) {
    errors.push("Missing account type");
  }
  
  if (!account.name) {
    errors.push("Missing account name");
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// Utility function to log account validation issues
export function logAccountValidationIssues(accounts: any[]): void {
  console.log("=== Account Validation Report ===");
  
  const validationResults = accounts.map(account => ({
    accountId: account.id,
    plaidId: account.plaidId,
    name: account.name,
    type: account.type,
    institution: account.plaidItem?.institutionName || account.plaidItem?.institutionId,
    validation: validateAccountData(account)
  }));
  
  const invalidAccounts = validationResults.filter(result => !result.validation.isValid);
  const validAccounts = validationResults.filter(result => result.validation.isValid);
  
  console.log(`Total accounts: ${accounts.length}`);
  console.log(`Valid accounts: ${validAccounts.length}`);
  console.log(`Invalid accounts: ${invalidAccounts.length}`);
  
  if (invalidAccounts.length > 0) {
    console.log("\n=== Invalid Accounts ===");
    invalidAccounts.forEach(account => {
      console.log(`Account ${account.accountId} (${account.name}):`);
      account.validation.errors.forEach(error => {
        console.log(`  - ${error}`);
      });
    });
  }
  
  console.log("=== End Validation Report ===");
} 