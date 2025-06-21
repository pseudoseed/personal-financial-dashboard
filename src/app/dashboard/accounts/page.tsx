"use client";

import { useCallback, useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import { useQuery } from "@tanstack/react-query";
import { AccountCard } from "@/components/AccountCard";
import { ManualAccountForm } from "@/components/ManualAccountForm";
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

export default function AccountsPage() {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRefreshingInstitutions, setIsRefreshingInstitutions] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [refreshingInstitutions, setRefreshingInstitutions] = useState<Record<string, boolean>>({});
  const [disconnectingInstitutions, setDisconnectingInstitutions] = useState<Record<string, boolean>>({});
  const [institutionShowHidden, setInstitutionShowHidden] = useState<Record<string, boolean>>({});
  const { darkMode, setDarkMode } = useTheme();

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
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ institutionId }),
      });

      if (!response.ok) {
        throw new Error("Failed to disconnect institution");
      }

      await refetch();
    } catch (error) {
      console.error("Error disconnecting institution:", error);
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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Accounts</h1>
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
                <h2 className="text-xl font-medium">{institution}</h2>
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
  );
} 