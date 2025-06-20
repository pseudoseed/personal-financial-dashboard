"use client";

import { Account } from "@/types/account";

interface DashboardSummaryProps {
  accounts: Account[];
  isMasked?: boolean;
}

export function DashboardSummary({
  accounts,
  isMasked = false,
}: DashboardSummaryProps) {
  const formatBalance = (amount: number) => {
    return isMasked ? "••••••" : `$${amount.toLocaleString()}`;
  };

  // Log the number of accounts being processed
  console.log(`Processing ${accounts.length} accounts for DashboardSummary`);

  const summary = accounts.reduce(
    (acc, account) => {
      const type = account.type.toLowerCase();
      const balance = account.balance.current;

      if (type === "credit" || type === "loan") {
        acc.totalLiabilities += Math.abs(balance);
      } else {
        acc.totalAssets += balance;
      }

      if (type === "credit") {
        acc.totalCredit += account.balance.limit || 0;
        acc.usedCredit += Math.abs(balance);
      }

      return acc;
    },
    {
      totalAssets: 0,
      totalLiabilities: 0,
      totalCredit: 0,
      usedCredit: 0,
    }
  );

  const netWorth = summary.totalAssets - summary.totalLiabilities;
  const creditUtilization = summary.totalCredit
    ? (summary.usedCredit / summary.totalCredit) * 100
    : 0;

  // Log the financial summary for debugging
  console.log("DashboardSummary calculated values:");
  console.log(`  Net Worth: ${netWorth.toLocaleString()}`);
  console.log(`  Total Assets: ${summary.totalAssets.toLocaleString()}`);
  console.log(
    `  Total Liabilities: ${summary.totalLiabilities.toLocaleString()}`
  );
  console.log(`  Credit Utilization: ${creditUtilization.toFixed(1)}%`);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-surface-900 dark:text-surface-dark-900">
        Financial Summary
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface-100 dark:bg-surface-dark-100 border border-border rounded-lg p-6 min-h-[100px]">
          <h3 className="text-sm font-medium text-surface-600 dark:text-surface-dark-400 mb-2">
            Net Worth
          </h3>
          <p
            className={`text-2xl font-bold ${
              netWorth >= 0 ? "text-success-600 dark:text-success-400" : "text-error-600 dark:text-error-400"
            }`}
          >
            {formatBalance(netWorth)}
          </p>
        </div>

        <div className="bg-surface-100 dark:bg-surface-dark-100 border border-border rounded-lg p-6 min-h-[100px]">
          <h3 className="text-sm font-medium text-surface-600 dark:text-surface-dark-400 mb-2">
            Total Assets
          </h3>
          <p className="text-2xl font-bold text-surface-900 dark:text-surface-dark-900">
            {formatBalance(summary.totalAssets)}
          </p>
        </div>

        <div className="bg-surface-100 dark:bg-surface-dark-100 border border-border rounded-lg p-6 min-h-[100px]">
          <h3 className="text-sm font-medium text-surface-600 dark:text-surface-dark-400 mb-2">
            Total Liabilities
          </h3>
          <p className="text-2xl font-bold text-surface-900 dark:text-surface-dark-900">
            {formatBalance(summary.totalLiabilities)}
          </p>
        </div>

        {!isMasked && (
          <div className="bg-surface-100 dark:bg-surface-dark-100 border border-border rounded-lg p-6 min-h-[100px]">
            <h3 className="text-sm font-medium text-surface-600 dark:text-surface-dark-400 mb-2">
              Credit Utilization
            </h3>
            <p className={`text-2xl font-bold text-surface-900 dark:text-surface-dark-900 ${
              creditUtilization > 30 ? 'text-error-600 dark:text-error-400' : 'text-success-600 dark:text-success-400'
            }`}>
              {creditUtilization.toFixed(1)}%
            </p>
            <div className="w-full bg-surface-200 dark:bg-surface-dark-300 rounded-full h-2 mt-3">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${
                  creditUtilization > 30 ? "bg-error-500 dark:bg-error-400" : "bg-success-500 dark:bg-success-400"
                }`}
                style={{ width: `${Math.min(creditUtilization, 100)}%` }}
              ></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
