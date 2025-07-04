import { prisma } from "./db";
import { plaidClient } from "./plaid";
import { smartSyncTransactions } from "./transactionSyncService";
import { getCurrentUserId } from "./userManagement";
import { v4 as uuidv4 } from 'uuid';
import { trackPlaidApiCall, getAppInstanceId } from "./plaidTracking";
import { filterEligibleAccounts, getAccountIneligibilityReason } from "./accountEligibility";

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
  includeTransactions: boolean = false,
  targetAccountId?: string,
  targetInstitutionId?: string
) {
  const userId = 'default';
  
  // Build the where clause for account filtering
  let whereClause: any = { userId, hidden: false, archived: false };
  
  if (targetAccountId) {
    // Filter to specific account
    whereClause.id = targetAccountId;
  } else if (targetInstitutionId) {
    // Filter to all accounts for the institution (by institutionId, not plaidItem.id)
    // Only include accounts from active PlaidItems
    whereClause.plaidItem = {
      institutionId: targetInstitutionId,
      status: 'active' // Only include active PlaidItems
    };
  }
  
  // Get accounts with their latest balance
  const accounts = await prisma.account.findMany({
    where: whereClause,
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
      // Check if this is just a manual account that should be skipped
      if (validation.errors.length === 1 && validation.errors[0] === "Manual account - should be skipped") {
        results.skipped.push(account.id);
        continue;
      }
      
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

// New function to refresh a specific account
export async function refreshSpecificAccount(accountId: string, forceRefresh: boolean = false) {
  return smartRefreshAccounts('default', forceRefresh, false, accountId);
}

// New function to refresh all accounts in an institution
export async function refreshInstitution(institutionId: string, forceRefresh: boolean = false) {
  return smartRefreshAccounts('default', forceRefresh, false, undefined, institutionId);
}

async function refreshInstitutionAccounts(accounts: any[], results: any) {
  const firstAccount = accounts[0];
  
  // Additional validation before making any API calls
  if (!firstAccount.plaidItem?.accessToken || firstAccount.plaidItem.accessToken === "manual") {
    const errorMsg = "Invalid access token for institution";
    accounts.forEach((account: any) => {
      results.errors.push({ accountId: account.id, error: errorMsg });
    });
    return;
  }

  // Enhanced validation: Check if PlaidItem is disconnected or orphaned
  if (firstAccount.plaidItem.status === "disconnected") {
    const errorMsg = "PlaidItem is disconnected - cannot refresh accounts";
    console.log(`[REFRESH] Skipping refresh for disconnected PlaidItem ${firstAccount.plaidItem.id}`);
    accounts.forEach((account: any) => {
      results.errors.push({ accountId: account.id, error: errorMsg });
    });
    return;
  }

  // Check if this is an orphaned item (itemId starts with bulk-disconnect)
  if (firstAccount.plaidItem.itemId && firstAccount.plaidItem.itemId.startsWith('bulk-disconnect')) {
    const errorMsg = "PlaidItem is orphaned from bulk disconnect - cannot refresh accounts";
    console.log(`[REFRESH] Skipping refresh for orphaned PlaidItem ${firstAccount.plaidItem.id} (${firstAccount.plaidItem.itemId})`);
    accounts.forEach((account: any) => {
      results.errors.push({ accountId: account.id, error: errorMsg });
    });
    return;
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
    return;
  }
  
  // Handle Plaid accounts
  try {
    // Validate that we have the required data before making API call
    if (!firstAccount.plaidItem.accessToken) {
      const errorMsg = "Missing access token for Plaid institution";
      accounts.forEach((account: any) => {
        results.errors.push({ accountId: account.id, error: errorMsg });
      });
      return;
    }
    
    // Enhanced Plaid item status check with comprehensive error handling
    try {
      const itemResponse = await plaidClient.itemGet({
        access_token: firstAccount.plaidItem.accessToken,
      });
      const item = itemResponse.data.item;
      if (item.error) {
        const errorMsg = `Plaid item error: ${item.error.error_code} - ${item.error.error_message}`;
        console.error(errorMsg);
        let specificError = errorMsg;
        
        // Check if this is a token revocation error that should mark the item as disconnected
        const shouldMarkDisconnected = [
          "ITEM_NOT_FOUND",
          "INVALID_ACCESS_TOKEN",
          "ITEM_EXPIRED"
        ].includes(item.error.error_code);

        if (shouldMarkDisconnected) {
          console.log(`[REFRESH] Marking PlaidItem ${firstAccount.plaidItem.id} as disconnected due to error: ${item.error.error_code}`);
          
          // Mark the PlaidItem as disconnected
          await prisma.plaidItem.update({
            where: { id: firstAccount.plaidItem.id },
            data: { status: 'disconnected' } as any
          });
          
          // Update all accounts in this institution to reflect the disconnected status
          for (const account of accounts) {
            await prisma.account.update({
              where: { id: account.id },
              data: { 
                plaidItem: {
                  update: {
                    status: 'disconnected'
                  }
                } as any
              }
            });
          }
        }

        switch (item.error.error_code) {
          case "ITEM_LOGIN_REQUIRED":
            specificError = "Institution requires re-authentication. Please reconnect this institution.";
            break;
          case "INVALID_ACCESS_TOKEN":
            specificError = "Access token has been revoked. Please reconnect this institution.";
            break;
          case "ITEM_NOT_FOUND":
            specificError = "Account access has been revoked. Please reconnect this institution.";
            break;
          case "INVALID_CREDENTIALS":
            specificError = "Institution credentials are invalid. Please update your login information.";
            break;
          case "INSTITUTION_DOWN":
            specificError = "Institution is temporarily unavailable. Please try again later.";
            break;
          case "ITEM_LOCKED":
            specificError = "Account is locked due to suspicious activity. Please contact the institution.";
            break;
          case "ITEM_PENDING_EXPIRATION":
            specificError = "Access will expire soon. Please reconnect this institution.";
            break;
          case "ITEM_EXPIRED":
            specificError = "Access has expired. Please reconnect this institution.";
            break;
          default:
            specificError = `Plaid error: ${item.error.error_code} - ${item.error.error_message}. Please reconnect this institution.`;
        }
        accounts.forEach((account: any) => {
          results.errors.push({ accountId: account.id, error: specificError });
        });
        return;
      }
    } catch (itemError: any) {
      console.error("Error checking Plaid item status:", itemError);
      
      // Enhanced error handling for item status check failures
      const errorCode = itemError?.response?.data?.error_code;
      const errorStatus = itemError?.response?.status;
      
      if (errorStatus === 400 && errorCode) {
        const isTokenRevoked = [
          'ITEM_NOT_FOUND',
          'INVALID_ACCESS_TOKEN',
          'ITEM_EXPIRED'
        ].includes(errorCode);

        if (isTokenRevoked) {
          console.log(`[REFRESH] Token revoked during status check for PlaidItem ${firstAccount.plaidItem.id} (${errorCode}) - marking as disconnected`);
          
          // Mark the PlaidItem as disconnected
          await prisma.plaidItem.update({
            where: { id: firstAccount.plaidItem.id },
            data: { status: 'disconnected' } as any
          });
          
                     const errorMsg = `Access token revoked (${errorCode}) - please reconnect this institution`;
           accounts.forEach((account) => {
             results.errors.push({ accountId: account.id, error: errorMsg });
           });
          return;
        }
      }
      
      // For other errors, continue with balance fetch but log the issue
      console.warn(`[REFRESH] Continuing with balance fetch despite item status check failure:`, itemError?.message || 'Unknown error');
    }
    
    let response;
    let plaidApiCallStart = Date.now();
    let plaidApiCallError = null;
    try {
      response = await plaidClient.accountsBalanceGet({
        access_token: firstAccount.plaidItem.accessToken,
      });
      await logPlaidApiCall({
        prisma,
        endpoint: '/accounts/balance/get',
        responseStatus: 200,
        institutionId: firstAccount.plaidItem.institutionId,
        accountId: firstAccount.id,
        durationMs: Date.now() - plaidApiCallStart,
        userId: firstAccount.userId,
      });
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorCode = error?.response?.data?.error_code;
      const errorStatus = error?.response?.status;
      
      plaidApiCallError = errorMessage;
      await logPlaidApiCall({
        prisma,
        endpoint: '/accounts/balance/get',
        responseStatus: errorStatus || 500,
        institutionId: firstAccount.plaidItem.institutionId,
        accountId: firstAccount.id,
        durationMs: Date.now() - plaidApiCallStart,
        errorMessage,
        userId: firstAccount.userId,
      });
      
      console.error('Plaid accountsBalanceGet error:', errorMessage);
      
      // Enhanced error handling for balance fetch failures
      if (errorStatus === 400 && errorCode) {
        const isTokenRevoked = [
          'ITEM_NOT_FOUND',
          'INVALID_ACCESS_TOKEN',
          'ITEM_EXPIRED'
        ].includes(errorCode);

        if (isTokenRevoked) {
          console.log(`[REFRESH] Token revoked during balance fetch for PlaidItem ${firstAccount.plaidItem.id} (${errorCode}) - marking as disconnected`);
          
          // Mark the PlaidItem as disconnected
          await prisma.plaidItem.update({
            where: { id: firstAccount.plaidItem.id },
            data: { status: 'disconnected' } as any
          });
          
          const errorMsg = `Access token revoked (${errorCode}) - please reconnect this institution`;
          accounts.forEach((account: any) => {
            results.errors.push({ accountId: account.id, error: errorMsg });
          });
          return;
        }
      }
      
      accounts.forEach((account: any) => {
        results.errors.push({ accountId: account.id, error: errorMessage });
      });
      return;
    }
    
    // Validate Plaid response
    if (!response.data?.accounts || !Array.isArray(response.data.accounts)) {
      const errorMsg = "Invalid response from Plaid API";
      accounts.forEach((account: any) => {
        results.errors.push({ accountId: account.id, error: errorMsg });
      });
      return;
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
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.warn("Failed to fetch liability data:", errorMessage);
        // Log and continue, but do not throw
      }
    }
    
    for (const account of accounts) {
      try {
        const plaidAccount = response.data.accounts.find(
          (acc: any) => acc.account_id === account.plaidId
        );
        if (!plaidAccount) {
          const errorMsg = `Account not found in Plaid response (plaidId: ${account.plaidId}) - account may have been removed or access revoked`;
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
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            console.warn(`Failed to update liability data for account ${account.id}:`, errorMessage);
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
    accounts.forEach((account: any) => {
      results.errors.push({ accountId: account.id, error: errorMessage });
    });
    // Do not throw, just return
    return;
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
  
  // Removed large data dump for cleaner logging
  
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
    console.log(`[Liabilities] Updated credit card ${account.name} with liability data`);
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
    console.log(`[Liabilities] Updated mortgage ${account.name} with liability data`);
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
    console.log(`[Liabilities] Updated student loan ${account.name} with liability data`);
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
    
    // Don't treat manual accounts as validation errors - they should be handled separately
    // if (account.plaidItem.accessToken === "manual") {
    //   errors.push("Manual account - should be skipped");
    // }
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
  const validationResults = accounts.map(account => ({
    accountId: account.id,
    name: account.name,
    validation: validateAccountData(account)
  }));
  
  const invalidAccounts = validationResults.filter(result => !result.validation.isValid);
  
  if (invalidAccounts.length > 0) {
    console.log(`[Validation] Found ${invalidAccounts.length} invalid accounts out of ${accounts.length} total`);
    invalidAccounts.forEach(account => {
      console.log(`[Validation] ${account.name}: ${account.validation.errors.join(', ')}`);
    });
  } else {
    console.log(`[Validation] All ${accounts.length} accounts are valid`);
  }
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

export async function refreshAllAccounts(prisma: any) {
  console.log("Starting refresh of all accounts...");

  // Get all accounts with their PlaidItems (only from active PlaidItems)
  const allAccounts = await prisma.account.findMany({
    where: {
      archived: false, // Don't refresh archived accounts
      plaidItem: {
        status: 'active' // Only include accounts from active PlaidItems
      }
    },
    include: {
      plaidItem: true,
      balances: {
        orderBy: { date: "desc" },
        take: 1,
      },
    },
  });

  // Filter out accounts that are not eligible for Plaid API calls
  const eligibleAccounts = filterEligibleAccounts(allAccounts);
  
  console.log(`[Refresh] ${eligibleAccounts.length}/${allAccounts.length} accounts eligible for Plaid API calls`);

  // Log ineligible accounts for debugging
  const ineligibleAccounts = allAccounts.filter(account => !eligibleAccounts.includes(account));
  if (ineligibleAccounts.length > 0) {
    console.log(`[Refresh] Skipping ${ineligibleAccounts.length} ineligible accounts`);
  }

  if (eligibleAccounts.length === 0) {
    console.log("No eligible accounts found for refresh");
    return { refreshed: [], errors: [] };
  }

  // Group accounts by institution for efficient API calls
  const accountsByInstitution = new Map<string, typeof eligibleAccounts>();
  
  for (const account of eligibleAccounts) {
    const institutionId = account.plaidItem.institutionId;
    if (!accountsByInstitution.has(institutionId)) {
      accountsByInstitution.set(institutionId, []);
    }
    accountsByInstitution.get(institutionId)!.push(account);
  }

  const results = { refreshed: [] as string[], errors: [] as Array<{ accountId: string; error: string }> };

  // Process each institution's accounts
  for (const [institutionId, accounts] of accountsByInstitution) {
    console.log(`[Refresh] Processing ${accounts.length} accounts for ${institutionId}`);
    
    try {
      await refreshInstitutionAccounts(accounts, results);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`Error refreshing institution ${institutionId}:`, errorMessage);
      
      // Mark all accounts in this institution as failed
      accounts.forEach((account: any) => {
        results.errors.push({ accountId: account.id, error: errorMessage });
      });
    }
  }

  console.log(`[Refresh] Completed: ${results.refreshed.length} refreshed, ${results.errors.length} errors`);
  return results;
} 