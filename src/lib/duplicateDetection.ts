import { prisma } from "./db";
import { disconnectPlaidTokens } from "./plaid";

export interface DuplicateAccount {
  id: string;
  name: string;
  type: string;
  subtype: string;
  mask?: string | null;
  balances: Array<{
    current: number;
    available: number | null;
    date: Date;
  }>;
  plaidItem: {
    itemId: string;
    institutionId: string;
    institutionName: string | null;
  };
}

export interface DuplicateGroup {
  institutionId: string;
  institutionName: string | null;
  accounts: DuplicateAccount[];
  shouldMerge: boolean;
}

/**
 * Detect duplicate accounts for a given institution
 */
export async function detectDuplicates(institutionId: string): Promise<DuplicateGroup | null> {
  try {
    // Get all accounts for this institution
    const accounts = await prisma.account.findMany({
      where: {
        plaidItem: {
          institutionId: institutionId,
        },
      },
      include: {
        plaidItem: {
          select: {
            itemId: true,
            institutionId: true,
            institutionName: true,
          },
        },
        balances: {
          orderBy: {
            date: "desc",
          },
          take: 1,
        },
      },
    });

    if (accounts.length <= 1) {
      return null; // No duplicates
    }

    // Group accounts by type, subtype, name, AND mask to identify true duplicates
    const accountGroups = new Map<string, DuplicateAccount[]>();
    
    accounts.forEach(account => {
      // Use mask (last 4 digits) as the primary identifier for duplicates
      // If no mask is available, fall back to name-based grouping
      const key = account.mask 
        ? `${account.type}_${account.subtype}_${account.name}_${account.mask}`
        : `${account.type}_${account.subtype}_${account.name}`;
        
      if (!accountGroups.has(key)) {
        accountGroups.set(key, []);
      }
      accountGroups.get(key)!.push({
        id: account.id,
        name: account.name,
        type: account.type,
        subtype: account.subtype || '',
        mask: account.mask,
        balances: account.balances,
        plaidItem: account.plaidItem,
      });
    });

    // Find groups with multiple accounts (true duplicates - same account number)
    const duplicateGroups = Array.from(accountGroups.values())
      .filter(group => group.length > 1);

    if (duplicateGroups.length === 0) {
      return null; // No duplicates found
    }

    // Flatten all duplicate accounts
    const allDuplicates = duplicateGroups.flat();

    return {
      institutionId,
      institutionName: accounts[0].plaidItem.institutionName || 'Unknown Institution',
      accounts: allDuplicates,
      shouldMerge: true,
    };
  } catch (error) {
    console.error("Error detecting duplicates:", error);
    return null;
  }
}

/**
 * Merge duplicate accounts, keeping the one with the most recent balance
 */
export async function mergeDuplicateAccounts(duplicateGroup: DuplicateGroup): Promise<{
  merged: number;
  kept: string[];
  removed: string[];
  disconnectedTokens: string[];
}> {
  const { accounts } = duplicateGroup;
  const kept: string[] = [];
  const removed: string[] = [];
  const disconnectedTokens: string[] = [];

  // Group by account type, subtype, name, and mask (same logic as detection)
  const accountGroups = new Map<string, DuplicateAccount[]>();
  
  accounts.forEach(account => {
    const key = account.mask 
      ? `${account.type}_${account.subtype}_${account.name}_${account.mask}`
      : `${account.type}_${account.subtype}_${account.name}`;
      
    if (!accountGroups.has(key)) {
      accountGroups.set(key, []);
    }
    accountGroups.get(key)!.push(account);
  });

  // For each group of duplicates, keep the one with the most recent balance
  for (const [key, duplicates] of accountGroups) {
    if (duplicates.length <= 1) {
      kept.push(duplicates[0].id);
      continue;
    }

    // Sort by most recent balance date
    const sortedDuplicates = duplicates.sort((a, b) => {
      const aDate = a.balances[0]?.date || new Date(0);
      const bDate = b.balances[0]?.date || new Date(0);
      return bDate.getTime() - aDate.getTime();
    });

    const accountToKeep = sortedDuplicates[0];
    const accountsToRemove = sortedDuplicates.slice(1);

    kept.push(accountToKeep.id);
    removed.push(...accountsToRemove.map(a => a.id));

    // Transfer any missing data to the kept account
    for (const accountToRemove of accountsToRemove) {
      // Transfer balances if the kept account doesn't have recent ones
      if (accountToRemove.balances.length > 0 && accountToKeep.balances.length === 0) {
        await prisma.accountBalance.updateMany({
          where: {
            accountId: accountToRemove.id,
          },
          data: {
            accountId: accountToKeep.id,
          },
        });
        console.log(`[MERGE] Transferred balances from ${accountToRemove.id} to ${accountToKeep.id}`);
      }

      // Transfer transactions if the kept account doesn't have any
      const keptTransactionCount = await prisma.transaction.count({
        where: { accountId: accountToKeep.id },
      });

      const removedTransactionCount = await prisma.transaction.count({
        where: { accountId: accountToRemove.id },
      });

      if (removedTransactionCount > 0 && keptTransactionCount === 0) {
        await prisma.transaction.updateMany({
          where: {
            accountId: accountToRemove.id,
          },
          data: {
            accountId: accountToKeep.id,
          },
        });
        console.log(`[MERGE] Transferred transactions from ${accountToRemove.id} to ${accountToKeep.id}`);
      }

      // Transfer emergency fund account references
      const efCount = await prisma.emergencyFundAccount.count({ where: { accountId: accountToRemove.id } });
      if (efCount > 0) {
        await prisma.emergencyFundAccount.updateMany({
          where: { accountId: accountToRemove.id },
          data: { accountId: accountToKeep.id },
        });
        console.log(`[MERGE] Transferred emergency fund references from ${accountToRemove.id} to ${accountToKeep.id}`);
      }

      // Delete the duplicate account
      await prisma.account.delete({
        where: { id: accountToRemove.id },
      });
      console.log(`[MERGE] Deleted duplicate account ${accountToRemove.id}`);
    }
  }

  // After merging accounts, identify PlaidItems that should be disconnected
  // Get all PlaidItems for this institution
  const allPlaidItems = await prisma.plaidItem.findMany({
    where: {
      institutionId: duplicateGroup.institutionId,
    },
    include: {
      accounts: true
    }
  });

  // Filter to only active items and find empty ones
  const activePlaidItems = allPlaidItems.filter(item => (item as any).status === 'active');
  const emptyPlaidItems = activePlaidItems.filter(item => item.accounts.length === 0);
  
  // Find PlaidItems that have accounts but are duplicates (keep the one with most accounts)
  const plaidItemsWithAccounts = activePlaidItems.filter(item => item.accounts.length > 0);
  
  if (plaidItemsWithAccounts.length > 1) {
    // Sort by number of accounts (keep the one with most accounts)
    const sortedItems = plaidItemsWithAccounts.sort((a, b) => b.accounts.length - a.accounts.length);
    const itemToKeep = sortedItems[0];
    const itemsToDisconnect = sortedItems.slice(1);
    
    console.log(`[MERGE] Keeping PlaidItem ${itemToKeep.id} with ${itemToKeep.accounts.length} accounts, disconnecting ${itemsToDisconnect.length} duplicate items`);
    
    // Disconnect the duplicate PlaidItems
    const disconnectResult = await disconnectPlaidTokens(
      itemsToDisconnect.map(item => ({
        id: item.id,
        accessToken: item.accessToken,
        institutionId: item.institutionId,
        institutionName: item.institutionName
      }))
    );
    
    disconnectedTokens.push(...disconnectResult.success);
    
    if (disconnectResult.failed.length > 0) {
      console.warn(`[MERGE] Failed to disconnect some PlaidItems:`, disconnectResult.failed);
    }
  }

  // Disconnect empty PlaidItems
  if (emptyPlaidItems.length > 0) {
    console.log(`[MERGE] Disconnecting ${emptyPlaidItems.length} empty PlaidItems`);
    
    const disconnectResult = await disconnectPlaidTokens(
      emptyPlaidItems.map(item => ({
        id: item.id,
        accessToken: item.accessToken,
        institutionId: item.institutionId,
        institutionName: item.institutionName
      }))
    );
    
    disconnectedTokens.push(...disconnectResult.success);
    
    if (disconnectResult.failed.length > 0) {
      console.warn(`[MERGE] Failed to disconnect some empty PlaidItems:`, disconnectResult.failed);
    }
  }

  return {
    merged: accountGroups.size,
    kept,
    removed,
    disconnectedTokens,
  };
}

/**
 * Check if an institution is likely to have unified logins
 */
export function isUnifiedLoginInstitution(institutionName: string | null): boolean {
  if (!institutionName) return false;
  
  const unifiedInstitutions = [
    'chase',
    'bank of america',
    'wells fargo',
    'citibank',
    'us bank',
    'pnc bank',
    'capital one',
    'fidelity',
    'schwab',
    'td ameritrade',
    'e*trade',
    'vanguard',
  ];

  const normalizedName = institutionName.toLowerCase();
  return unifiedInstitutions.some(institution => 
    normalizedName.includes(institution)
  );
}

/**
 * Get a user-friendly message about the merge operation
 */
export function getMergeMessage(duplicateGroup: DuplicateGroup, mergeResult: {
  merged: number;
  kept: string[];
  removed: string[];
  disconnectedTokens: string[];
}): string {
  const { institutionName, accounts } = duplicateGroup;
  const { merged, removed, disconnectedTokens } = mergeResult;

  if (removed.length === 0) {
    return `No duplicates found for ${institutionName || 'Unknown Institution'}`;
  }

  const accountTypes = [...new Set(accounts.map(a => `${a.type}/${a.subtype}`))];
  
  let message = `Merged ${removed.length} duplicate accounts for ${institutionName || 'Unknown Institution'}. Kept the most recent data for: ${accountTypes.join(', ')}`;
  
  if (disconnectedTokens.length > 0) {
    message += `\n\nDisconnected ${disconnectedTokens.length} duplicate Plaid connection(s) to optimize API usage and maintain security.`;
  }
  
  return message;
} 