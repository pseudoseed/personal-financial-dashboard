"use client";

import { Account } from "@/types/account";
import { formatBalance } from "@/lib/formatters";
import { useSensitiveData } from "@/app/providers";
import { useMemo } from "react";
import { MetricCard } from "@/components/MetricCard";
import { useQuery } from "@tanstack/react-query";

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

  // Fetch financial health metrics
  const { data: health, isLoading: healthLoading, error: healthError } = useQuery({
    queryKey: ["financialHealth"],
    queryFn: async () => {
      const response = await fetch("/api/analytics/financial-health");
      if (!response.ok) throw new Error("Failed to fetch financial health");
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="">
      <h2 className="text-xl font-semibold text-surface-900 dark:text-surface-dark-900">
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
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
        {health && (
          <>
            <MetricCard
              title="Financial Health Score"
              value={health.overallScore !== undefined ? `${health.overallScore} (${getScoreLabel(health.overallScore)})` : "-"}
              color={getScoreColor(health.overallScore)}
            />
            <MetricCard
              title="Emergency Fund"
              value={`${health.emergencyFundRatio.toFixed(1)} months`}
            />
            <MetricCard
              title="Debt-to-Income"
              value={`${(health.debtToIncomeRatio * 100).toFixed(1)}%`}
            />
            <MetricCard
              title="Savings Rate"
              value={`${health.savingsRate.toFixed(1)}%`}
            />
            <MetricCard
              title="Credit Utilization"
              value={`${health.creditUtilization.toFixed(1)}%`}
              color={health.creditUtilization > 30 ? "text-error-600 dark:text-error-400" : "text-success-600 dark:text-success-400"}
              progress={health.creditUtilization}
              progressColor={health.creditUtilization > 30 ? "bg-error-500 dark:bg-error-400" : "bg-success-500 dark:bg-success-400"}
            />
          </>
        )}
      </div>
    </div>
  );
}

function getScoreColor(score: number): string {
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-yellow-600";
  return "text-red-600";
}

function getScoreLabel(score: number): string {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Good";
  if (score >= 40) return "Fair";
  return "Poor";
}
