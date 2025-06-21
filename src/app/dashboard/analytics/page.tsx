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
import { Account } from "@/types/account";
import { useTheme } from "../../providers";
import {
  ChartBarIcon,
  CurrencyDollarIcon,
  CalendarIcon,
  ShieldExclamationIcon,
} from "@heroicons/react/24/outline";

export default function AnalyticsPage() {
  const [isMasked, setIsMasked] = useState(false);
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

        {accountsData?.length ? (
          <>
          <div className="mb-6">
            <DashboardMetrics accounts={accountsData || []} />
          </div>

            {/* Anomaly Detection */}
            {showAnomalyAlert ? (
              <div className="mb-6">
                <AnomalyAlert 
                  isMasked={isMasked} 
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
                  isMasked={isMasked}
                />
              </div>
              <div className="lg:col-span-1 grid gap-6">
                <FinancialGroupChart accounts={accountsData} isMasked={isMasked} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <AccountTypeDistribution
                    accounts={accountsData}
                    isMasked={isMasked}
                  />
                  <InstitutionBreakdown
                    accounts={accountsData}
                    isMasked={isMasked}
                  />
                </div>
              </div>
            </div>

            {/* Month-over-Month Comparison */}
            <div className="mb-6">
              <MonthOverMonthChart isMasked={isMasked} />
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <h2 className="text-2xl font-semibold text-gray-600 mb-4">No accounts found</h2>
            <p className="text-gray-500 mb-6">Connect your first account to view analytics and insights</p>
          </div>
        )}
      </div>
    </div>
  );
} 