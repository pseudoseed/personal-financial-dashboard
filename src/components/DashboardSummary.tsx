"use client";

import { Account } from "@/types/account";
import { formatBalance } from "@/lib/formatters";
import { useSensitiveData } from "@/app/providers";
import { useMemo } from "react";
import { MetricCard } from "@/components/MetricCard";

interface DashboardSummaryProps {
  accounts: Account[];
  isMasked?: boolean;
}

export function DashboardSummary({
  accounts,
  isMasked = false,
}: DashboardSummaryProps) {
  const { showSensitiveData } = useSensitiveData();

  // Calculate financial summary
  const summary = useMemo(() => {
    return accounts.reduce(
      (acc, account) => {
        const balance = account.balance.current;
        
        if (account.type === "credit" || account.type === "loan") {
          acc.totalLiabilities += Math.abs(balance);
        } else {
          acc.totalAssets += balance;
        }
        
        return acc;
      },
      { totalAssets: 0, totalLiabilities: 0 }
    );
  }, [accounts]);

  const netWorth = summary.totalAssets - summary.totalLiabilities;

  // Calculate credit utilization
  const creditAccounts = accounts.filter(
    (account) => account.type === "credit" && account.balance.limit
  );
  
  const totalCreditLimit = creditAccounts.reduce(
    (sum, account) => sum + (account.balance.limit || 0),
    0
  );
  
  const totalCreditBalance = creditAccounts.reduce(
    (sum, account) => sum + Math.abs(account.balance.current),
    0
  );
  
  const creditUtilization = totalCreditLimit > 0 
    ? (totalCreditBalance / totalCreditLimit) * 100 
    : 0;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-surface-900 dark:text-surface-dark-900">
        Financial Summary
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Net Worth"
          value={showSensitiveData ? formatBalance(netWorth) : "••••••"}
          color={netWorth >= 0 ? "text-success-600 dark:text-success-400" : "text-error-600 dark:text-error-400"}
        />
        <MetricCard
          title="Total Assets"
          value={showSensitiveData ? formatBalance(summary.totalAssets) : "••••••"}
        />
        <MetricCard
          title="Total Liabilities"
          value={showSensitiveData ? formatBalance(summary.totalLiabilities) : "••••••"}
        />
        <MetricCard
          title="Credit Utilization"
          value={showSensitiveData ? `${creditUtilization.toFixed(1)}%` : "••••••"}
          color={creditUtilization > 30 ? "text-error-600 dark:text-error-400" : "text-success-600 dark:text-success-400"}
          progress={showSensitiveData ? creditUtilization : undefined}
          progressColor={creditUtilization > 30 ? "bg-error-500 dark:bg-error-400" : "bg-success-500 dark:bg-success-400"}
        />
      </div>
    </div>
  );
}
