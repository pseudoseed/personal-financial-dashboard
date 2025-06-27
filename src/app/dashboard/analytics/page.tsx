"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { NetWorthChart } from "@/components/NetWorthChart";
import { FinancialGroupChart } from "@/components/FinancialGroupChart";
import { DashboardMetrics } from "@/components/DashboardMetrics";
import { AccountTypeDistribution } from "@/components/AccountTypeDistribution";
import { InstitutionBreakdown } from "@/components/InstitutionBreakdown";
import { MonthOverMonthChart } from "@/components/MonthOverMonthChart";
import { AnomalyAlert } from "@/components/AnomalyAlert";
import { SubscriptionsCard } from "@/components/SubscriptionsCard";
import { Account } from "@/types/account";
import { useTheme } from "../../providers";
import { useSensitiveData } from "@/app/providers";
import {
  ChartBarIcon,
  CurrencyDollarIcon,
  CalendarIcon,
  ShieldExclamationIcon,
} from "@heroicons/react/24/outline";

function SuggestedRecurringPaymentsCard() {
  const { data: suggestions = [], isLoading, refetch } = useQuery({
    queryKey: ["suggestedRecurringIncome"],
    queryFn: async () => {
      const res = await fetch("/api/analytics/suggested-recurring-income");
      if (!res.ok) throw new Error("Failed to fetch suggestions");
      return res.json();
    },
  });
  const [addingId, setAddingId] = useState<string | null>(null);
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('dismissedRecurringSuggestions');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    }
    return new Set();
  });

  const handleAdd = async (suggestion: any) => {
    setAddingId(suggestion.name + suggestion.amount + suggestion.frequency);
    await fetch("/api/recurring-payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: suggestion.name,
        amount: suggestion.amount,
        frequency: suggestion.frequency,
        nextPaymentDate: suggestion.lastDate,
        paymentType: "paycheck",
        isActive: true,
        isConfirmed: false,
        confidence: 80,
      }),
    });
    setAddingId(null);
    refetch();
  };

  const handleDismiss = (suggestion: any) => {
    const suggestionKey = `${suggestion.name}|${suggestion.amount}|${suggestion.frequency}`;
    const newDismissed = new Set(dismissedSuggestions).add(suggestionKey);
    setDismissedSuggestions(newDismissed);
    localStorage.setItem('dismissedRecurringSuggestions', JSON.stringify([...newDismissed]));
  };

  // Filter out dismissed suggestions
  const filteredSuggestions = suggestions.filter((s: any) => {
    const suggestionKey = `${s.name}|${s.amount}|${s.frequency}`;
    return !dismissedSuggestions.has(suggestionKey);
  });

  if (isLoading) return <div className="card p-4 mb-6">Loading suggestions...</div>;
  if (!filteredSuggestions.length) return null;

  return (
    <div className="card p-4 mb-6">
      <h2 className="text-lg font-semibold mb-2">Suggested Recurring Payments</h2>
      <p className="text-sm text-gray-500 mb-4">Based on your transaction history, we found these possible recurring income sources. Add them with one click!</p>
      <div className="space-y-3">
        {filteredSuggestions.map((s: any) => (
          <div key={s.name + s.amount + s.frequency} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-zinc-800 rounded-lg">
            <div>
              <div className="font-medium">{s.name}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">{s.frequency} • ${s.amount.toLocaleString()} • Last: {new Date(s.lastDate).toLocaleDateString()}</div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 text-sm"
                onClick={() => handleDismiss(s)}
              >
                Dismiss
              </button>
              <button
                className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                onClick={() => handleAdd(s)}
                disabled={addingId === s.name + s.amount + s.frequency}
              >
                {addingId === s.name + s.amount + s.frequency ? "Adding..." : "Add as Recurring Payment"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const { showSensitiveData } = useSensitiveData();
  const [showAnomalyAlert, setShowAnomalyAlert] = useState(true);
  const { darkMode } = useTheme();

  const { data: accountsData, isLoading: isLoadingAccounts } = useQuery<Account[]>({
    queryKey: ["accounts"],
    queryFn: async () => {
      const response = await fetch("/api/accounts");
      if (!response.ok) throw new Error("Failed to fetch accounts");
      return response.json();
    },
  });

  const { data: accountsWithHistory, isLoading: isLoadingHistory } = useQuery<Account[]>({
    queryKey: ["accountsWithHistory"],
    queryFn: async () => {
      const response = await fetch("/api/accounts/history");
      if (!response.ok) throw new Error("Failed to fetch account history");
      return response.json();
    },
  });

  if (isLoadingAccounts || isLoadingHistory) {
    return (
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-24 bg-gray-100 rounded"></div>
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="h-[400px] bg-gray-100 rounded"></div>
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="h-[200px] bg-gray-100 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Analytics & Insights</h1>
        </div>
        <div className="mb-6">
          <DashboardMetrics accounts={accountsData || []} />
        </div>

        {/* Anomaly Detection */}
        {showAnomalyAlert ? (
          <div className="mb-6">
            <AnomalyAlert 
              isMasked={!showSensitiveData} 
              limit={5} 
              onHide={() => setShowAnomalyAlert(false)}
            />
          </div>
        ) : (
          <div className="mb-6">
            <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <ShieldExclamationIcon className="w-5 h-5 text-gray-400" />
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Anomaly Detection Hidden
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Click to restore anomaly monitoring
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAnomalyAlert(true)}
                  className="px-3 py-1 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Show
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 items-start">
          <div className="lg:col-span-1">
            <NetWorthChart
              accounts={accountsWithHistory || []}
              isMasked={!showSensitiveData}
            />
          </div>
          <div className="lg:col-span-1 grid gap-6">
            <FinancialGroupChart accounts={accountsData || []} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <AccountTypeDistribution
                accounts={accountsData || []}
              />
              <InstitutionBreakdown
                accounts={accountsData || []}
              />
            </div>
          </div>
        </div>

        {/* Month-over-Month Comparison */}
        <div className="mb-6">
          <MonthOverMonthChart />
        </div>

        {/* Subscriptions Card */}
        <div className="mb-6">
          <SubscriptionsCard />
        </div>

        {/* Suggested Recurring Payments - Now at the end */}
        <SuggestedRecurringPaymentsCard />
      </div>
    </div>
  );
} 