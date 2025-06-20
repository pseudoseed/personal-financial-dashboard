"use client";

import { useSensitiveData } from "@/app/providers";
import { Account } from "@/types/account";
import { MetricCard } from "./MetricCard";
import { formatBalance } from "@/lib/formatters";

interface DashboardMetricsProps {
  accounts: Account[];
}

interface Metrics {
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  creditUtilization: number;
  hasCreditAccounts: boolean;
}

function calculateMetrics(accounts: Account[]): Metrics {
  const summary = accounts.reduce(
    (acc, account) => {
      const balance = account.balance.current;
      if (getFinancialGroup(account.type) === "Liabilities") {
        acc.totalLiabilities += Math.abs(balance);
      } else {
        acc.totalAssets += balance;
      }
      return acc;
    },
    { totalAssets: 0, totalLiabilities: 0 }
  );

  const netWorth = summary.totalAssets - summary.totalLiabilities;

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
  const creditUtilization =
    totalCreditLimit > 0 ? (totalCreditBalance / totalCreditLimit) * 100 : 0;

  return {
    netWorth,
    totalAssets: summary.totalAssets,
    totalLiabilities: summary.totalLiabilities,
    creditUtilization,
    hasCreditAccounts: creditAccounts.length > 0,
  };
}

function getFinancialGroup(type: string): string {
  if (type === "credit") return "Liabilities";
  if (type === "loan") return "Liabilities";
  return "Assets";
}

export function DashboardMetrics({ accounts }: DashboardMetricsProps) {
  const { showSensitiveData } = useSensitiveData();
  const metrics = calculateMetrics(accounts);

  const getNetWorthColor = (netWorth: number) => {
    if (netWorth >= 0) return "text-success-600 dark:text-success-400";
    return "text-error-600 dark:text-error-400";
  };

  const getCreditUtilizationColor = (utilization: number) => {
    if (utilization < 30) return "text-success-600 dark:text-success-400";
    if (utilization < 70) return "text-warning-600 dark:text-warning-400";
    return "text-error-600 dark:text-error-400";
  };

  const getCreditUtilizationBarColor = (utilization: number) => {
    if (utilization < 30) return "bg-success-500";
    if (utilization < 70) return "bg-warning-500";
    return "bg-error-500";
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      <MetricCard
        title="Net Worth"
        value={showSensitiveData ? formatBalance(metrics.netWorth) : "••••••"}
        color={getNetWorthColor(metrics.netWorth)}
      />
      <MetricCard
        title="Assets"
        value={showSensitiveData ? formatBalance(metrics.totalAssets) : "••••••"}
        color="text-surface-900 dark:text-surface-dark-900"
      />
      <MetricCard
        title="Liabilities"
        value={showSensitiveData ? formatBalance(metrics.totalLiabilities) : "••••••"}
        color="text-surface-900 dark:text-surface-dark-900"
      />
      {showSensitiveData && metrics.hasCreditAccounts && (
        <MetricCard
          title="Credit Utilization"
          value={`${metrics.creditUtilization.toFixed(1)}%`}
          color={getCreditUtilizationColor(metrics.creditUtilization)}
          progress={metrics.creditUtilization}
          progressColor={getCreditUtilizationBarColor(
            metrics.creditUtilization
          )}
        />
      )}
    </div>
  );
} 