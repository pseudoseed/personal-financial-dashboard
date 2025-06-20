"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { NetWorthChart } from "@/components/NetWorthChart";
import { FinancialGroupChart } from "@/components/FinancialGroupChart";
import { TransactionChart } from "@/components/TransactionChart";
import { DashboardMetrics } from "@/components/DashboardMetrics";
import { Account } from "@/types/account";
import { useTheme } from "../../providers";
import {
  ChartBarIcon,
  CurrencyDollarIcon,
  CalendarIcon,
} from "@heroicons/react/24/outline";

export default function AnalyticsPage() {
  const [isMasked, setIsMasked] = useState(false);
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
            <DashboardMetrics accounts={accountsData || []} />

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <NetWorthChart
                accounts={accountsWithHistory || []}
                isMasked={isMasked}
              />
              <FinancialGroupChart accounts={accountsData} isMasked={isMasked} />
            </div>

            <div className="grid grid-cols-1 gap-6 mb-6">
              <TransactionChart isMasked={isMasked} />
            </div>

            {/* Additional Analytics Insights */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
                <h3 className="text-lg font-semibold mb-4">Account Type Distribution</h3>
                <div className="space-y-3">
                  {(() => {
                    const typeCounts = accountsData.reduce((acc, account) => {
                      const type = account.type.toLowerCase();
                      acc[type] = (acc[type] || 0) + 1;
                      return acc;
                    }, {} as Record<string, number>);

                    return Object.entries(typeCounts).map(([type, count]) => (
                      <div key={type} className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-600 capitalize">
                          {type.replace(/([A-Z])/g, ' $1').trim()}
                        </span>
                        <span className="text-sm font-semibold text-gray-900">
                          {isMasked ? '••' : count}
                        </span>
                      </div>
                    ));
                  })()}
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
                <h3 className="text-lg font-semibold mb-4">Institution Breakdown</h3>
                <div className="space-y-3">
                  {(() => {
                    const institutionCounts = accountsData.reduce((acc, account) => {
                      const institution = account.institution || 'Manual';
                      acc[institution] = (acc[institution] || 0) + 1;
                      return acc;
                    }, {} as Record<string, number>);

                    return Object.entries(institutionCounts).map(([institution, count]) => (
                      <div key={institution} className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-600">
                          {institution}
                        </span>
                        <span className="text-sm font-semibold text-gray-900">
                          {isMasked ? '••' : count}
                        </span>
                      </div>
                    ));
                  })()}
                </div>
              </div>
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