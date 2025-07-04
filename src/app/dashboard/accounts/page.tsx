"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { usePlaidLink } from "react-plaid-link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AccountCard } from "@/components/AccountCard";
import { ManualAccountForm } from "@/components/ManualAccountForm";
import { RecurringPaymentsCard } from "@/components/RecurringPaymentsCard";
import { ManualBalanceUpdateCard } from "@/components/ManualBalanceUpdateCard";
import {
  EyeIcon,
  EyeSlashIcon,
  LockOpenIcon,
  LockClosedIcon,
  ArrowPathIcon,
  XCircleIcon,
  ArchiveBoxIcon,
  TrashIcon,
  ArrowUturnLeftIcon,
} from "@heroicons/react/24/solid";
import { ChevronUpIcon, ChevronDownIcon } from "@heroicons/react/24/outline";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { Account } from "@/types/account";
import { useTheme } from "../../providers";
import { AccountConnectionButtons } from "@/components/AccountConnectionButtons";
import { AuthenticationAlerts, AuthenticationAlertsRef } from "@/components/AuthenticationAlerts";
import { CostOptimizationCard } from "@/components/CostOptimizationCard";
import { useNotifications } from "@/components/ui/Notification";

export default function AccountsPage() {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRefreshingInstitutions, setIsRefreshingInstitutions] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [showDisconnected, setShowDisconnected] = useState(false);
  const [refreshingInstitutions, setRefreshingInstitutions] = useState<Record<string, boolean>>({});
  const [disconnectingInstitutions, setDisconnectingInstitutions] = useState<Record<string, boolean>>({});
  const [institutionShowHidden, setInstitutionShowHidden] = useState<Record<string, boolean>>({});
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [refreshResults, setRefreshResults] = useState<any>(null);
  const { darkMode, setDarkMode } = useTheme();
  const { addNotification } = useNotifications();
  const queryClient = useQueryClient();
  const authAlertsRef = useRef<AuthenticationAlertsRef>(null);

  const { data: accountsData, refetch, isLoading: accountsLoading, error: accountsError } = useQuery<Account[]>({
    queryKey: ["accounts"],
    queryFn: async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      try {
        const response = await fetch("/api/accounts", {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        
        if (!response.ok) throw new Error("Failed to fetch accounts");
        return response.json();
      } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error("Request timed out");
        }
        throw error;
      }
    },
    staleTime: 30000, // 30 seconds
    gcTime: 300000, // 5 minutes
  });

  const { data: archivedAccountsData } = useQuery<Account[]>({
    queryKey: ["archivedAccounts"],
    queryFn: async () => {
      const response = await fetch("/api/accounts?includeArchived=true");
      if (!response.ok) throw new Error("Failed to fetch archived accounts");
      const allAccounts = await response.json();
      return allAccounts.filter((account: Account) => account.archived);
    },
  });

  const { data: disconnectedAccountsData } = useQuery<Account[]>({
    queryKey: ["disconnectedAccounts"],
    queryFn: async () => {
      const response = await fetch("/api/accounts/disconnected");
      if (!response.ok) throw new Error("Failed to fetch disconnected accounts");
      return response.json();
    },
  });

  // Group accounts by institution, include all non-archived accounts
  const accountsByInstitution =
    (accountsData || []).reduce((acc, account) => {
      // Include all non-archived accounts
      if (account.archived) return acc;
      
      const institutionName = account.plaidItem?.institutionName || 'Manual Account';
      
      if (!acc[institutionName]) {
        acc[institutionName] = [];
      }
      acc[institutionName].push(account);
      return acc;
    }, {} as Record<string, Account[]>);

  const hiddenAccounts = (accountsData || []).filter((account) => account.hidden);
  const archivedAccounts = archivedAccountsData || [];
  const disconnectedAccounts = disconnectedAccountsData || [];

  // Build a mapping from display name to Plaid institutionId
  const institutionIdMap = (accountsData || []).reduce((acc, account) => {
    const institutionName = account.plaidItem?.institutionName || 'Manual Account';
    if (account.plaidItem?.institutionId) {
      acc[institutionName] = account.plaidItem.institutionId;
    }
    return acc;
  }, {} as Record<string, string>);

  const activeAccounts = accountsData?.filter(
    (account) => !account.archived
  ) || [];

  // Trigger fetch after component mounts
  useEffect(() => {
    if (typeof window !== 'undefined') {
      refetch();
    }
  }, [refetch]);

  const archiveAccount = async (accountId: string) => {
    try {
      const response = await fetch(`/api/accounts/${accountId}/archive`, {
        method: "POST",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to archive account");
      }

      addNotification({
        type: "success",
        title: "Account archived",
        message: "Account has been archived successfully.",
      });

      // Refresh both queries
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["archivedAccounts"] });
    } catch (error) {
      addNotification({
        type: "error",
        title: "Archive failed",
        message: error instanceof Error ? error.message : "Failed to archive account",
      });
    }
  };

  const restoreAccount = async (accountId: string) => {
    try {
      const response = await fetch(`/api/accounts/${accountId}/restore`, {
        method: "POST",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to restore account");
      }

      addNotification({
        type: "success",
        title: "Account restored",
        message: "Account has been restored successfully.",
      });

      // Refresh both queries
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["archivedAccounts"] });
    } catch (error) {
      addNotification({
        type: "error",
        title: "Restore failed",
        message: error instanceof Error ? error.message : "Failed to restore account",
      });
    }
  };

  const deleteAccount = async (accountId: string) => {
    const confirmed = confirm(
      "Are you sure you want to permanently delete this account?\n\n" +
      "⚠️  WARNING: This action will:\n" +
      "• Permanently delete the account and all its data\n" +
      "• Remove all transaction history\n" +
      "• Remove all balance history\n\n" +
      "This action CANNOT be undone."
    );

    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(`/api/accounts/${accountId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete account");
      }

      addNotification({
        type: "success",
        title: "Account deleted",
        message: "Account has been permanently deleted.",
      });

      // Refresh both queries
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["archivedAccounts"] });
    } catch (error) {
      addNotification({
        type: "error",
        title: "Delete failed",
        message: error instanceof Error ? error.message : "Failed to delete account",
      });
    }
  };

  const refreshInstitutions = async () => {
    try {
      setIsRefreshingInstitutions(true);
      const response = await fetch("/api/plaid/refresh-institutions", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to refresh institutions");
      }

      await refetch();
    } catch (error) {
      console.error("Error refreshing institutions:", error);
    } finally {
      setIsRefreshingInstitutions(false);
    }
  };

  const refreshBalances = async () => {
    try {
      setIsRefreshing(true);
      setRefreshError(null);
      setRefreshResults(null);
      
      const response = await fetch("/api/accounts/refresh", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          manual: true 
        }),
      });

      const data = await response.json();
      setRefreshResults(data);

      if (!response.ok) {
        const errorMessage = data.error || `Failed to refresh balances (${response.status})`;
        setRefreshError(errorMessage);
        addNotification({
          type: "error",
          title: "Refresh Failed",
          message: errorMessage,
        });
        return;
      }

      // Show success notification with results
      const successMessage = `Refreshed ${data.accountsRefreshed} accounts, skipped ${data.accountsSkipped}${data.errors > 0 ? `, ${data.errors} errors` : ''}`;
      addNotification({
        type: "success",
        title: "Refresh Complete",
        message: successMessage,
      });

      await refetch();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to refresh balances";
      setRefreshError(errorMessage);
      addNotification({
        type: "error",
        title: "Refresh Failed",
        message: errorMessage,
      });
      console.error("Error refreshing balances:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const refreshInstitution = async (institution: string) => {
    const apiInstitutionId = institutionIdMap[institution] || institution;
    try {
      setRefreshingInstitutions((prev) => ({ ...prev, [institution]: true }));
      const response = await fetch("/api/accounts/refresh", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          institutionId: apiInstitutionId,
          manual: true 
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to refresh institution");
      }

      const data = await response.json();
      
      // Show success notification
      const successMessage = `Refreshed ${data.accountsRefreshed} accounts in ${institution}${data.errors > 0 ? `, ${data.errors} errors` : ''}`;
      addNotification({
        type: "success",
        title: "Institution Refresh Complete",
        message: successMessage,
      });

      await refetch();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to refresh institution";
      addNotification({
        type: "error",
        title: "Institution Refresh Failed",
        message: errorMessage,
      });
      console.error("Error refreshing institution:", error);
    } finally {
      setRefreshingInstitutions((prev) => ({
        ...prev,
        [institution]: false,
      }));
    }
  };

  const disconnectInstitution = async (institution: string) => {
    // Map "Manual Account" to "manual" for the API
    const apiInstitutionId = institution === "Manual Account" ? "manual" : (institutionIdMap[institution] || institution);
    
    const confirmed = confirm(
      `Are you sure you want to disconnect "${institution}"?\n\n` +
      "⚠️  WARNING: This action will:\n" +
      "• Remove ALL accounts associated with this institution\n" +
      "• Delete all transaction history for these accounts\n" +
      "• Remove all balance history data\n\n" +
      "This action CANNOT be undone. You will need to reconnect the institution to restore access."
    );
    
    if (!confirmed) {
      return;
    }

    try {
      setDisconnectingInstitutions((prev) => ({
        ...prev,
        [institution]: true,
      }));

      const response = await fetch("/api/accounts/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ institutionId: apiInstitutionId }),
      });

      if (response.ok) {
        addNotification({
          type: "success",
          title: "Institution disconnected",
          message: `Successfully disconnected ${institution} and all associated accounts.`,
        });
        // Invalidate queries to refresh the data
        queryClient.invalidateQueries({ queryKey: ["accounts"] });
        queryClient.invalidateQueries({ queryKey: ["accountsWithHistory"] });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to disconnect institution");
      }
    } catch (error) {
      addNotification({
        type: "error",
        title: "Disconnection failed",
        message: error instanceof Error ? error.message : "Failed to disconnect institution. Please try again.",
      });
    } finally {
      setDisconnectingInstitutions((prev) => ({
        ...prev,
        [institution]: false,
      }));
    }
  };

  const toggleInstitutionHidden = (institution: string) => {
    setInstitutionShowHidden((prev) => ({
      ...prev,
      [institution]: !prev[institution],
    }));
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Accounts
        </h1>
      </div>

      {/* Authentication Alerts */}
      <AuthenticationAlerts ref={authAlertsRef} />

      {/* Cost Optimization Card - Only show if there are Plaid accounts */}
      {activeAccounts.length > 0 && (
        <CostOptimizationCard accounts={activeAccounts} />
      )}

      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Account Management</h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={refreshBalances}
              disabled={isRefreshing}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50"
            >
              <ArrowPathIcon
                className={`h-4 w-4 mr-2 ${
                  isRefreshing ? "animate-spin" : ""
                }`}
              />
              {isRefreshing ? "Refreshing..." : "Refresh All"}
            </button>
            <button
              onClick={refreshInstitutions}
              disabled={isRefreshingInstitutions}
              className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              <ArrowPathIcon
                className={`h-4 w-4 mr-2 ${
                  isRefreshingInstitutions ? "animate-spin" : ""
                }`}
              />
              {isRefreshingInstitutions ? "Refreshing..." : "Refresh Institutions"}
            </button>
          </div>
        </div>

        {/* Error Display */}
        {refreshError && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex">
              <div className="flex-shrink-0">
                <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                  Refresh Error
                </h3>
                <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                  {refreshError}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Results Display */}
        {refreshResults && !refreshError && (
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex">
              <div className="flex-shrink-0">
                <ArrowPathIcon className="h-5 w-5 text-blue-400" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                  Refresh Results
                </h3>
                <div className="mt-2 text-sm text-blue-700 dark:text-blue-300">
                  <div>Refreshed: {refreshResults.accountsRefreshed} accounts</div>
                  <div>Skipped: {refreshResults.accountsSkipped} accounts</div>
                  {refreshResults.errors > 0 && (
                    <div className="text-red-600 dark:text-red-400">
                      Errors: {refreshResults.errors} accounts
                    </div>
                  )}
                  {refreshResults.results?.errors?.length > 0 && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-red-600 dark:text-red-400">
                        View Error Details
                      </summary>
                      <div className="mt-2 text-xs space-y-1">
                        {refreshResults.results.errors.map((error: any, index: number) => (
                          <div key={index} className="text-red-600 dark:text-red-400">
                            Account {error.accountId}: {error.error}
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {accountsLoading ? (
          <div className="space-y-6">
            <div className="animate-pulse">
              <div className="h-6 bg-gray-200 dark:bg-zinc-700 rounded w-1/3 mb-4"></div>
              <div className="h-32 bg-gray-200 dark:bg-zinc-700 rounded"></div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(accountsByInstitution).map(([institution, accounts]) => {
            const activeAccountsForInstitution = accounts.filter(
              (account) => !account.hidden
            );
            const hiddenAccountsForInstitution = accounts.filter(
              (account) => account.hidden
            );
            const showHiddenForInstitution = institutionShowHidden[institution];

            return (
              <div key={institution} className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-medium text-gray-900 dark:text-white">{institution}</h3>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => refreshInstitution(institution)}
                      className="inline-flex items-center px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      disabled={refreshingInstitutions[institution]}
                    >
                      <ArrowPathIcon
                        className={`h-4 w-4 ${
                          refreshingInstitutions[institution] ? "animate-spin" : ""
                        }`}
                      />
                    </button>
                    <button
                      onClick={() => disconnectInstitution(institution)}
                      className="inline-flex items-center px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      disabled={disconnectingInstitutions[institution]}
                      title="Disconnect institution and remove all associated accounts"
                    >
                      <XCircleIcon className="h-4 w-4" />
                    </button>
                    {hiddenAccountsForInstitution.length > 0 && (
                      <button
                        onClick={() => toggleInstitutionHidden(institution)}
                        className="inline-flex items-center px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        {showHiddenForInstitution ? (
                          <LockOpenIcon className="h-4 w-4" />
                        ) : (
                          <LockClosedIcon className="h-4 w-4" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {activeAccountsForInstitution.map((account) => (
                    <AccountCard
                      key={account.id}
                      account={account}
                      onRefresh={refetch}
                      onArchive={() => archiveAccount(account.id)}
                    />
                  ))}
                  {showHiddenForInstitution &&
                    hiddenAccountsForInstitution.map((account) => (
                      <AccountCard
                        key={account.id}
                        account={account}
                        onRefresh={refetch}
                        onArchive={() => archiveAccount(account.id)}
                      />
                    ))}
                </div>
              </div>
            );
          })}
        </div>
        )}
      </div>

      {/* Archived Accounts Section */}
      {archivedAccounts.length > 0 && (
        <div className="mt-8 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white flex items-center">
              <ArchiveBoxIcon className="h-6 w-6 mr-2 text-gray-500" />
              Archived Accounts
            </h2>
            <button
              onClick={() => setShowArchived(!showArchived)}
              className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              {showArchived ? "Hide" : "Show"} Archived ({archivedAccounts.length})
            </button>
          </div>
          
          {showArchived && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {archivedAccounts.map((account) => (
                <div
                  key={account.id}
                  className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white">
                        {account.name}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {account.plaidItem?.institutionName || "Manual Account"}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        {account.type} • {account.subtype}
                      </p>
                    </div>
                    <div className="flex items-center space-x-1">
                      {account.plaidItem?.accessToken === "manual" && (
                        <button
                          onClick={() => restoreAccount(account.id)}
                          className="inline-flex items-center px-2 py-1 border border-green-300 dark:border-green-600 rounded-md shadow-sm text-xs font-medium text-green-700 dark:text-green-200 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/40 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                          title="Restore account"
                        >
                          <ArrowUturnLeftIcon className="h-3 w-3" />
                        </button>
                      )}
                      <button
                        onClick={() => deleteAccount(account.id)}
                        className="inline-flex items-center px-2 py-1 border border-red-300 dark:border-red-600 rounded-md shadow-sm text-xs font-medium text-red-700 dark:text-red-200 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                        title="Permanently delete account"
                      >
                        <TrashIcon className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-300">
                    <p>Current Balance: ${account.currentBalance?.toFixed(2) || "0.00"}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Archived account - not included in normal views
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}



      {/* Recurring Payments Section */}
      <div className="mt-8">
        <RecurringPaymentsCard />
      </div>

      {/* Manual Balance Update Section */}
      <div className="mt-8">
        <ManualBalanceUpdateCard />
      </div>

      {/* Disconnected Accounts Section - Collapsible */}
      {disconnectedAccounts.length > 0 && (
        <div className="mt-8 space-y-4">
          <div
            className="flex justify-between items-center px-6 py-4 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            onClick={() => setShowDisconnected(!showDisconnected)}
          >
            <div className="flex items-center">
              <XCircleIcon className="h-6 w-6 mr-2 text-red-500" />
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
                Disconnected Accounts
              </h2>
              <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
                ({disconnectedAccounts.length})
              </span>
            </div>
            {showDisconnected ? (
              <ChevronUpIcon className="w-6 h-6 text-gray-400" />
            ) : (
              <ChevronDownIcon className="w-6 h-6 text-gray-400" />
            )}
          </div>
          
          {showDisconnected && (
            <div className="space-y-4">
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400" />
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                      Account Access Revoked
                    </h3>
                    <div className="mt-2 text-sm text-yellow-700 dark:text-yellow-300">
                      <p>
                        These accounts have been disconnected from their financial institutions. 
                        This commonly happens when:
                      </p>
                      <ul className="mt-2 list-disc list-inside space-y-1">
                        <li>You changed your bank password</li>
                        <li>The institution updated their security requirements</li>
                        <li>Access was revoked from the institution's side</li>
                      </ul>
                      <p className="mt-2">
                        To restore access, click the "Reconnect" button below each account.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {disconnectedAccounts.map((account) => (
                  <div
                    key={account.id}
                    className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-medium text-gray-900 dark:text-white">
                          {account.name}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {account.plaidItem?.institutionName || "Unknown Institution"}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          {account.type} • {account.subtype}
                        </p>
                      </div>
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => {
                            const institutionId = account.plaidItem?.institutionId;
                            if (institutionId && authAlertsRef.current) {
                              authAlertsRef.current.handleReauth(institutionId);
                            }
                          }}
                          className="inline-flex items-center px-3 py-1 border border-blue-300 dark:border-blue-600 rounded-md shadow-sm text-xs font-medium text-blue-700 dark:text-blue-200 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                          title="Reconnect account"
                        >
                          <ArrowPathIcon className="h-3 w-3 mr-1" />
                          Reconnect
                        </button>
                        <button
                          onClick={() => archiveAccount(account.id)}
                          className="inline-flex items-center px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-xs font-medium text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                          title="Archive account"
                        >
                          <ArchiveBoxIcon className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">
                      <p>Last Known Balance: ${account.currentBalance?.toFixed(2) || "0.00"}</p>
                      <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                        Disconnected - needs reconnection to update
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 