"use client";

import { Suspense, useEffect, useState } from "react";
import { DashboardMetrics } from "@/components/DashboardMetrics";
import { ListStatCard } from "@/components/ListStatCard";
import { Account } from "@/types/account";
import { BillsVsCashCard } from "@/components/BillsVsCashCard";
import TopVendorsCard from '@/components/TopVendorsCard';
import DashboardSidebarCards from '@/components/DashboardSidebarCards';
import { QuickInsights } from "@/components/QuickInsights";
import { useSensitiveData } from "@/app/providers";

async function getAccounts(): Promise<Account[]> {
  try {
    const response = await fetch("/api/accounts");
    if (!response.ok) throw new Error("Failed to fetch accounts");
    return response.json();
  } catch (error) {
    console.error("Error fetching accounts:", error);
    return [];
  }
}

export default function DashboardPage() {
  const { showSensitiveData } = useSensitiveData();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAccounts = async () => {
      setIsLoading(true);
      const accountsData = await getAccounts();
      setAccounts(accountsData);
      setIsLoading(false);
    };
    fetchAccounts();
  }, []);

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-gray-200 rounded w-1/4"></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card min-h-[120px] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const connectedAccounts = accounts.filter(a => a.institution);
  const manualAccounts = accounts.filter(a => !a.institution);

  const accountStatusStats = [
    { label: "Connected Accounts", value: connectedAccounts.length },
    { label: "Manual Accounts", value: manualAccounts.length },
    { label: "Total Accounts", value: accounts.length },
  ];

  return (
    <>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-1">
          Financial Dashboard
        </h1>
        <p className="text-secondary-500 dark:text-secondary-400">
          Track your accounts, transactions, and financial health
        </p>
      </div>

      {/* Main Dashboard Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Column - Metrics and Summary */}
        <div className="lg:col-span-3 space-y-6">
          <DashboardMetrics accounts={accounts} />
          <TopVendorsCard />
        </div>

        {/* Right Column - Quick Actions and Insights */}
        <div className="space-y-6">
          <DashboardSidebarCards accountStatusStats={accountStatusStats} />
          <QuickInsights />
        </div>
      </div>
    </>
  );
} 