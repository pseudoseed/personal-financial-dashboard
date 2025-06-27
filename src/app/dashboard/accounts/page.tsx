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
    accountsData?.reduce((acc, account) => {
      if (account.institution && !acc[account.institution]) {
        acc[account.institution] = [];
      }
      if (account.institution) {
        acc[account.institution].push(account);
      }
      return acc;
    }, {} as Record<string, Account[]>) || {};

  const hiddenAccounts = accountsData?.filter((account) => account.hidden) || [];

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
      const response = await fetch("/api/accounts/refresh", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to refresh balances");
      }

      await refetch();
    } catch (error) {
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
        body: JSON.stringify({ institutionId }),
      });

      if (!response.ok) {
        throw new Error("Failed to refresh institution");
      }

      await refetch();
    } catch (error) {
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
        <AccountConnectionButtons />
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
              className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              disabled={isRefreshing}
            >
              <ArrowPathIcon
                className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`}
              />
              Refresh All
            </button>
            <button
              onClick={() => setShowHidden(!showHidden)}
              className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              {showHidden ? (
                <LockOpenIcon className="h-4 w-4 mr-2" />
              ) : (
                <LockClosedIcon className="h-4 w-4 mr-2" />
              )}
              {showHidden ? "Hide Hidden" : "Show Hidden"}
            </button>
          </div>
        </div>

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