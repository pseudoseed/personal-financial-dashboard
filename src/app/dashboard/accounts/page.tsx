"use client";

import { useCallback, useEffect, useState } from "react";
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
} from "@heroicons/react/24/solid";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { Account } from "@/types/account";
import { useTheme } from "../../providers";
import { AccountConnectionButtons } from "@/components/AccountConnectionButtons";
import { AuthenticationAlerts } from "@/components/AuthenticationAlerts";
import { CostOptimizationCard } from "@/components/CostOptimizationCard";
import { useNotifications } from "@/components/ui/Notification";

export default function AccountsPage() {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRefreshingInstitutions, setIsRefreshingInstitutions] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [refreshingInstitutions, setRefreshingInstitutions] = useState<Record<string, boolean>>({});
  const [disconnectingInstitutions, setDisconnectingInstitutions] = useState<Record<string, boolean>>({});
  const [institutionShowHidden, setInstitutionShowHidden] = useState<Record<string, boolean>>({});
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [refreshResults, setRefreshResults] = useState<any>(null);
  const { darkMode, setDarkMode } = useTheme();
  const { addNotification } = useNotifications();
  const queryClient = useQueryClient();

  const { data: accountsData, refetch } = useQuery<Account[]>({
    queryKey: ["accounts"],
    queryFn: async () => {
      const response = await fetch("/api/accounts");
      if (!response.ok) throw new Error("Failed to fetch accounts");
      return response.json();
    },
  });

  // Group accounts by institution
  const accountsByInstitution =
    (accountsData || []).reduce((acc, account) => {
      if (account.institution && !acc[account.institution]) {
        acc[account.institution] = [];
      }
      if (account.institution) {
        acc[account.institution].push(account);
      }
      return acc;
    }, {} as Record<string, Account[]>);

  const hiddenAccounts = (accountsData || []).filter((account) => account.hidden);

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

  const refreshInstitution = async (institutionId: string) => {
    try {
      setRefreshingInstitutions((prev) => ({ ...prev, [institutionId]: true }));
      const response = await fetch("/api/accounts/refresh", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          institutionId,
          manual: true 
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to refresh institution");
      }

      const data = await response.json();
      
      // Show success notification
      const successMessage = `Refreshed ${data.accountsRefreshed} accounts in ${institutionId}${data.errors > 0 ? `, ${data.errors} errors` : ''}`;
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
        [institutionId]: false,
      }));
    }
  };

  const disconnectInstitution = async (institutionId: string) => {
    // Map "Manual Account" to "manual" for the API
    const apiInstitutionId = institutionId === "Manual Account" ? "manual" : institutionId;
    
    const confirmed = confirm(
      `Are you sure you want to disconnect "${institutionId}"?\n\n` +
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
        [institutionId]: true,
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
          message: `Successfully disconnected ${institutionId} and all associated accounts.`,
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
        [institutionId]: false,
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
      <AuthenticationAlerts />

      {/* Cost Optimization Card - Only show if there are Plaid accounts */}
      {accountsData && accountsData.length > 0 && (
        <CostOptimizationCard accounts={accountsData} />
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

        <div className="space-y-6">
          {Object.entries(accountsByInstitution).map(([institution, accounts]) => {
            const visibleAccounts = accounts.filter((account) => !account.hidden);
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
                  {visibleAccounts.map((account) => (
                    <AccountCard
                      key={account.id}
                      account={account}
                      onRefresh={refetch}
                    />
                  ))}
                  {showHiddenForInstitution &&
                    hiddenAccountsForInstitution.map((account) => (
                      <AccountCard
                        key={account.id}
                        account={account}
                        onRefresh={refetch}
                      />
                    ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recurring Payments Section */}
      <div className="mt-8">
        <RecurringPaymentsCard />
      </div>

      {/* Manual Balance Update Section */}
      <div className="mt-8">
        <ManualBalanceUpdateCard />
      </div>
    </div>
  );
} 