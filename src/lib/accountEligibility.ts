import { Account, PlaidItem } from "@prisma/client";

export interface AccountWithPlaidItem extends Account {
  plaidItem: PlaidItem;
}

/**
 * Check if an account is eligible for Plaid API calls
 * Returns false for manual accounts, archived accounts, and accounts with disconnected PlaidItems
 */
export function isAccountEligibleForPlaidCalls(account: AccountWithPlaidItem): boolean {
  // Manual accounts should never make Plaid API calls
  if (account.plaidItem.accessToken === "manual") {
    return false;
  }

  // Archived accounts should not make Plaid API calls
  if (account.archived) {
    return false;
  }

  // Accounts with disconnected PlaidItems should not make API calls
  if (account.plaidItem.status === "disconnected") {
    return false;
  }

  // Accounts without a valid access token should not make API calls
  if (!account.plaidItem.accessToken || account.plaidItem.accessToken === "manual") {
    return false;
  }

  return true;
}

/**
 * Check if a PlaidItem is eligible for Plaid API calls
 * Returns false for manual items and disconnected items
 */
export function isPlaidItemEligibleForApiCalls(plaidItem: PlaidItem): boolean {
  // Manual items should never make Plaid API calls
  if (plaidItem.accessToken === "manual") {
    return false;
  }

  // Disconnected items should not make API calls
  if (plaidItem.status === "disconnected") {
    return false;
  }

  // Items without a valid access token should not make API calls
  if (!plaidItem.accessToken || plaidItem.accessToken === "manual") {
    return false;
  }

  return true;
}

/**
 * Filter accounts to only include those eligible for Plaid API calls
 */
export function filterEligibleAccounts(accounts: AccountWithPlaidItem[]): AccountWithPlaidItem[] {
  return accounts.filter(isAccountEligibleForPlaidCalls);
}

/**
 * Filter PlaidItems to only include those eligible for API calls
 */
export function filterEligiblePlaidItems(plaidItems: PlaidItem[]): PlaidItem[] {
  return plaidItems.filter(isPlaidItemEligibleForApiCalls);
}

/**
 * Get a descriptive reason why an account is not eligible for Plaid API calls
 */
export function getAccountIneligibilityReason(account: AccountWithPlaidItem): string | null {
  if (account.plaidItem.accessToken === "manual") {
    return "Manual account - no Plaid integration";
  }

  if (account.archived) {
    return "Account is archived";
  }

  if (account.plaidItem.status === "disconnected") {
    return "PlaidItem is disconnected";
  }

  if (!account.plaidItem.accessToken || account.plaidItem.accessToken === "manual") {
    return "No valid access token";
  }

  return null; // Account is eligible
}

/**
 * Get a descriptive reason why a PlaidItem is not eligible for API calls
 */
export function getPlaidItemIneligibilityReason(plaidItem: PlaidItem): string | null {
  if (plaidItem.accessToken === "manual") {
    return "Manual item - no Plaid integration";
  }

  if (plaidItem.status === "disconnected") {
    return "PlaidItem is disconnected";
  }

  if (!plaidItem.accessToken || plaidItem.accessToken === "manual") {
    return "No valid access token";
  }

  return null; // PlaidItem is eligible
} 