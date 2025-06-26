import { prisma } from "./db";

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
        subtype: account.subtype,
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
}> {
  const { accounts } = duplicateGroup;
  const kept: string[] = [];
  const removed: string[] = [];

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
      }

      // Delete the duplicate account
      await prisma.account.delete({
        where: { id: accountToRemove.id },
      });
    }
  }

  return {
    merged: accountGroups.size,
    kept,
    removed,
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
}): string {
  const { institutionName, accounts } = duplicateGroup;
  const { merged, removed } = mergeResult;

  if (removed.length === 0) {
    return `No duplicates found for ${institutionName || 'Unknown Institution'}`;
  }

  const accountTypes = [...new Set(accounts.map(a => `${a.type}/${a.subtype}`))];
  
  return `Merged ${removed.length} duplicate accounts for ${institutionName || 'Unknown Institution'}. Kept the most recent data for: ${accountTypes.join(', ')}`;
} 