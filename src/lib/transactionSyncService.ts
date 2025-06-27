import { prisma } from "./db";
import { plaidClient } from "./plaid";
import { downloadTransactions } from "./transactions";
import { getCurrentUserId } from "./userManagement";

// Cache for storing transaction sync timestamps and data
const transactionSyncCache = new Map<string, { timestamp: number; data: any }>();
const transactionSyncCounts = new Map<string, { count: number; resetTime: number }>();

// Configuration
const TRANSACTION_SYNC_CONFIG = {
  // Cache TTL in milliseconds
  CACHE_TTL: {
    HIGH_ACTIVITY: 2 * 60 * 60 * 1000, // 2 hours for credit cards, checking
    MEDIUM_ACTIVITY: 4 * 60 * 60 * 1000, // 4 hours for savings
    LOW_ACTIVITY: 12 * 60 * 60 * 1000, // 12 hours for investment, loans
  },
  // Rate limiting for transaction syncs (separate from balance refresh)
  MANUAL_SYNC_LIMIT: 5, // Max manual transaction syncs per day
  MANUAL_SYNC_WINDOW: 24 * 60 * 60 * 1000, // 24 hours
  // Auto-sync threshold (how old transaction data can be before auto-sync)
  AUTO_SYNC_THRESHOLD: 4 * 60 * 60 * 1000, // 4 hours
  // Force sync threshold (when to force a full resync)
  FORCE_SYNC_THRESHOLD: 7 * 24 * 60 * 60 * 1000, // 7 days
};

// Account activity levels for transaction sync
const ACCOUNT_ACTIVITY_LEVELS = {
  HIGH: ["credit", "depository"], // Credit cards, checking accounts
  MEDIUM: ["savings"], // Savings accounts
  LOW: ["investment", "loan", "other"], // Investment, loans, other
};

function getAccountActivityLevel(accountType: string): keyof typeof TRANSACTION_SYNC_CONFIG.CACHE_TTL {
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
  return `${operation}_${accountId}`;
}

function isCacheValid(cacheKey: string, ttl: number): boolean {
  const cached = transactionSyncCache.get(cacheKey);
  if (!cached) return false;
  return Date.now() - cached.timestamp < ttl;
}

function canManualTransactionSync(userId: string): boolean {
  const now = Date.now();
  const userData = transactionSyncCounts.get(userId);
  
  if (!userData) {
    transactionSyncCounts.set(userId, { count: 1, resetTime: now + TRANSACTION_SYNC_CONFIG.MANUAL_SYNC_WINDOW });
    return true;
  }
  
  // Reset counter if window has passed
  if (now > userData.resetTime) {
    transactionSyncCounts.set(userId, { count: 1, resetTime: now + TRANSACTION_SYNC_CONFIG.MANUAL_SYNC_WINDOW });
    return true;
  }
  
  // Check if under limit
  if (userData.count < TRANSACTION_SYNC_CONFIG.MANUAL_SYNC_LIMIT) {
    userData.count++;
    return true;
  }
  
  return false;
}

function shouldAutoSyncTransactions(account: any): boolean {
  if (!account.lastSyncTime) return true;
  
  const now = Date.now();
  const lastSync = new Date(account.lastSyncTime).getTime();
  const timeSinceLastSync = now - lastSync;
  const ttl = TRANSACTION_SYNC_CONFIG.AUTO_SYNC_THRESHOLD;
  
  return timeSinceLastSync > ttl;
}

function shouldForceSync(account: any): boolean {
  if (!account.lastSyncTime) return true;
  
  const now = Date.now();
  const lastSync = new Date(account.lastSyncTime).getTime();
  const timeSinceLastSync = now - lastSync;
  
  return timeSinceLastSync > TRANSACTION_SYNC_CONFIG.FORCE_SYNC_THRESHOLD;
}

function getTransactionCount(result: any): number {
  return result.numTransactions || 0;
}

export async function smartSyncTransactions(
  userId?: string, 
  forceSync: boolean = false,
  accountIds?: string[]
) {
  console.log("Starting smart transaction sync process...");
  
  // Get the current user ID if not provided
  const actualUserId = userId || await getCurrentUserId();
  
  // Build where clause
  const whereClause: any = {
    userId: actualUserId,
    hidden: false,
    plaidItem: {
      accessToken: {
        not: "manual",
      },
    },
  };
  
  if (accountIds && accountIds.length > 0) {
    whereClause.id = { in: accountIds };
  }
  
  // Get accounts that need transaction syncing
  const accounts = await prisma.account.findMany({
    where: whereClause,
    include: {
      plaidItem: true,
    },
  });
  
  const results = {
    synced: [] as string[],
    skipped: [] as string[],
    errors: [] as Array<{ accountId: string; error: string }>,
    totalTransactions: 0,
  };
  
  // Group accounts by institution for batch processing
  const accountsByInstitution = new Map<string, any[]>();
  
  for (const account of accounts) {
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
      const cacheKey = getCacheKey(institutionId, "transactions");
      const activityLevel = getAccountActivityLevel(firstAccount.type);
      const ttl = TRANSACTION_SYNC_CONFIG.CACHE_TTL[activityLevel];
      
      // Check if we should sync this institution
      const needsSync = forceSync || 
        !isCacheValid(cacheKey, ttl) ||
        institutionAccounts.some(account => shouldAutoSyncTransactions(account));
      
      if (!needsSync) {
        institutionAccounts.forEach(account => results.skipped.push(account.id));
        continue;
      }
      
      // Perform the sync for each account in the institution
      for (const account of institutionAccounts) {
        try {
          const shouldForce = forceSync || shouldForceSync(account);
          const syncResult = await downloadTransactions(prisma, account, shouldForce);
          
          results.synced.push(account.id);
          const transactionCount = getTransactionCount(syncResult);
          results.totalTransactions += transactionCount;
          
          console.log(`Synced ${transactionCount} transactions for ${account.name}`);
        } catch (error) {
          console.error(`Error syncing transactions for ${account.name}:`, error);
          results.errors.push({ 
            accountId: account.id, 
            error: error instanceof Error ? error.message : "Unknown error" 
          });
        }
      }
      
      // Update cache
      transactionSyncCache.set(cacheKey, { timestamp: Date.now(), data: { synced: true } });
      
    } catch (error) {
      console.error(`Error syncing institution ${institutionId}:`, error);
      institutionAccounts.forEach(account => {
        results.errors.push({ 
          accountId: account.id, 
          error: error instanceof Error ? error.message : "Unknown error" 
        });
      });
    }
  }
  
  console.log(`Smart transaction sync completed: ${results.synced.length} synced, ${results.skipped.length} skipped, ${results.errors.length} errors, ${results.totalTransactions} total transactions`);
  return results;
}

export async function syncTransactionsForAccount(
  accountId: string,
  forceSync: boolean = false
) {
  console.log(`Syncing transactions for account: ${accountId}`);
  
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    include: {
      plaidItem: true,
    },
  });
  
  if (!account) {
    throw new Error("Account not found");
  }
  
  if (account.plaidItem.accessToken === "manual") {
    throw new Error("Manual accounts don't support transaction sync");
  }
  
  const shouldForce = forceSync || shouldForceSync(account);
  const result = await downloadTransactions(prisma, account, shouldForce);
  
  // Update cache for this account
  const cacheKey = getCacheKey(accountId, "transactions");
  transactionSyncCache.set(cacheKey, { timestamp: Date.now(), data: { synced: true } });
  
  return {
    accountId,
    transactionsAdded: getTransactionCount(result),
    downloadLog: result.downloadLog,
  };
}

export function canUserManualTransactionSync(userId: string): boolean {
  return canManualTransactionSync(userId);
}

export function getManualTransactionSyncCount(userId: string): { count: number; limit: number; resetTime: number } {
  const userData = transactionSyncCounts.get(userId);
  if (!userData) {
    return { 
      count: 0, 
      limit: TRANSACTION_SYNC_CONFIG.MANUAL_SYNC_LIMIT, 
      resetTime: Date.now() + TRANSACTION_SYNC_CONFIG.MANUAL_SYNC_WINDOW 
    };
  }
  
  return {
    count: userData.count,
    limit: TRANSACTION_SYNC_CONFIG.MANUAL_SYNC_LIMIT,
    resetTime: userData.resetTime,
  };
}

// Get transaction sync status for an account
export async function getTransactionSyncStatus(accountId: string) {
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: {
      id: true,
      name: true,
      lastSyncTime: true,
      plaidSyncCursor: true,
      type: true,
    },
  });
  
  if (!account) {
    return null;
  }
  
  const now = Date.now();
  const lastSync = account.lastSyncTime ? new Date(account.lastSyncTime).getTime() : 0;
  const timeSinceLastSync = now - lastSync;
  const activityLevel = getAccountActivityLevel(account.type);
  const ttl = TRANSACTION_SYNC_CONFIG.CACHE_TTL[activityLevel];
  
  return {
    accountId: account.id,
    accountName: account.name,
    lastSyncTime: account.lastSyncTime,
    hasCursor: !!account.plaidSyncCursor,
    timeSinceLastSync,
    needsSync: timeSinceLastSync > ttl,
    needsForceSync: timeSinceLastSync > TRANSACTION_SYNC_CONFIG.FORCE_SYNC_THRESHOLD,
    activityLevel,
    cacheTTL: ttl,
  };
}

// Clear cache (useful for testing or manual cache invalidation)
export function clearTransactionSyncCache(): void {
  transactionSyncCache.clear();
  transactionSyncCounts.clear();
} 