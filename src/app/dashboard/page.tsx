"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardSummary } from "@/components/DashboardSummary";
import { DashboardMetrics } from "@/components/DashboardMetrics";
import DashboardSidebarCards from "@/components/DashboardSidebarCards";
import { AccountCard } from "@/components/AccountCard";
import { Account } from "@/types/account";
import { DashboardSkeleton } from "@/components/LoadingStates";
import { AuthenticationAlerts } from "@/components/AuthenticationAlerts";
import { RecurringExpensesCard } from '@/components/RecurringExpensesCard';
import { RecurringPaymentsCard } from '@/components/RecurringPaymentsCard';
import { InvestmentPerformanceCard } from '@/components/InvestmentPerformanceCard';
import { EnhancedBillsCard } from '@/components/EnhancedBillsCard';
import { ActivityFeedCard } from '@/components/ActivityFeedCard';
import { EmptyStateDashboard } from "@/components/EmptyStateDashboard";

// Fetch accounts data
async function fetchAccounts(): Promise<Account[]> {
  const response = await fetch("/api/accounts");
  if (!response.ok) {
    throw new Error("Failed to fetch accounts");
  }
  return response.json();
}

// Check if data needs refresh
function shouldAutoRefresh(accounts: Account[]): boolean {
  if (!accounts || accounts.length === 0) return false;
  
  const now = Date.now();
  const sixHoursAgo = now - (6 * 60 * 60 * 1000); // 6 hours
  
  return accounts.some(account => {
    if (!account.balances || account.balances.length === 0) return true;
    const lastBalance = account.balances[0];
    const lastUpdateTime = new Date(lastBalance.date).getTime();
    return lastUpdateTime < sixHoursAgo;
  });
}

// Check if transactions need sync
function shouldAutoSyncTransactions(accounts: Account[]): boolean {
  if (!accounts || accounts.length === 0) return false;
  
  const now = Date.now();
  const fourHoursAgo = now - (4 * 60 * 60 * 1000); // 4 hours
  
  return accounts.some(account => {
    if (!account.lastSyncTime) return true;
    const lastSyncTime = new Date(account.lastSyncTime).getTime();
    return lastSyncTime < fourHoursAgo;
  });
}

export default function DashboardPage() {
  const [hasAutoRefreshed, setHasAutoRefreshed] = useState(false);
  const [hasAutoSyncedTransactions, setHasAutoSyncedTransactions] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const {
    data: accounts,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["accounts"],
    queryFn: fetchAccounts,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // Auto-refresh logic with proper state management
  useEffect(() => {
    if (accounts && !hasAutoRefreshed && !isRefreshing) {
      const needsRefresh = shouldAutoRefresh(accounts);
      const needsTransactionSync = shouldAutoSyncTransactions(accounts);
      
      if (needsRefresh) {
        // Perform auto-refresh with proper state management
        setIsRefreshing(true);
        fetch("/api/accounts/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ includeTransactionSync: true }),
        })
        .then(() => {
          setHasAutoRefreshed(true);
          setHasAutoSyncedTransactions(needsTransactionSync);
          refetch(); // Refresh the accounts data
        })
        .catch(error => {
          console.error("Auto-refresh failed:", error);
        })
        .finally(() => {
          setIsRefreshing(false);
        });
      } else if (needsTransactionSync && !hasAutoSyncedTransactions && !isRefreshing) {
        // Only sync transactions if balance data is fresh
        setIsRefreshing(true);
        fetch("/api/transactions/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        })
        .then(() => {
          setHasAutoSyncedTransactions(true);
          refetch(); // Refresh the accounts data
        })
        .catch(error => {
          console.error("Transaction sync failed:", error);
        })
        .finally(() => {
          setIsRefreshing(false);
        });
      }
    }
  }, [accounts, hasAutoRefreshed, hasAutoSyncedTransactions, isRefreshing, refetch]);

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">
            Error Loading Dashboard
          </h2>
          <p className="text-red-700 dark:text-red-300">
            {error instanceof Error ? error.message : "An unknown error occurred"}
          </p>
          <button
            onClick={() => refetch()}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!accounts || accounts.length === 0) {
    return <EmptyStateDashboard />;
  }

  const visibleAccounts = accounts.filter((account) => !account.hidden);
  
  // Prepare account status stats for sidebar
  const connectedAccounts = visibleAccounts.filter(a => a.institution);
  const manualAccounts = visibleAccounts.filter(a => !a.institution);
  const accountStatusStats = [
    { label: "Connected Accounts", value: connectedAccounts.length },
    { label: "Manual Accounts", value: manualAccounts.length },
    { label: "Total Accounts", value: visibleAccounts.length },
  ];

  return (
    <div className="max-w-screen-xl mx-auto px-4 lg:px-8">
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Main Content */}
        <div className="flex-1 min-w-0 space-y-8">
          <DashboardSummary accounts={visibleAccounts} />
          <InvestmentPerformanceCard />
          <EnhancedBillsCard />
          <RecurringExpensesCard />
          <RecurringPaymentsCard />
        </div>

        {/* Sidebar */}
        <div className="w-full max-w-full lg:w-[420px] lg:max-w-[420px] flex-shrink-0">
          <DashboardSidebarCards accountStatusStats={accountStatusStats} />
        </div>
      </div>
    </div>
  );
} 