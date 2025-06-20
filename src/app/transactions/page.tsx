"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardSummary } from "@/components/DashboardSummary";
import { TransactionChart } from "@/components/TransactionChart";
import { NetWorthChart } from "@/components/NetWorthChart";
import { FinancialGroupChart } from "@/components/FinancialGroupChart";
import { AllTransactionsList } from "@/components/AllTransactionsList";
import { TransactionChartSettings } from "@/components/TransactionChartSettings";
import { Account } from "@/types/account";
import { useTheme } from "../providers";

export default function TransactionsPage() {
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
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-24 bg-gray-100 rounded"></div>
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
          <h1 className="text-3xl font-bold">Transactions & Analytics</h1>
        </div>

        {accountsData?.length ? (
          <>
            <DashboardSummary accounts={accountsData} isMasked={isMasked} />

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

            <div className="grid grid-cols-1 gap-6">
              <AllTransactionsList />
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <h2 className="text-2xl font-semibold text-gray-600 mb-4">No accounts found</h2>
            <p className="text-gray-500 mb-6">Connect your first account to view transactions and analytics</p>
          </div>
        )}
      </div>
    </div>
  );
} 