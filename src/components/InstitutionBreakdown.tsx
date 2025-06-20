"use client";

import { Account } from "@/types/account";

interface InstitutionBreakdownProps {
  accounts: Account[];
  isMasked: boolean;
}

export function InstitutionBreakdown({ accounts, isMasked }: InstitutionBreakdownProps) {
  const institutionCounts = accounts.reduce((acc, account) => {
    const institution = account.institution || 'Manual';
    acc[institution] = (acc[institution] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-md p-6 border border-gray-200 dark:border-zinc-800 h-full">
      <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Institution Breakdown</h3>
      <div className="space-y-3">
        {Object.entries(institutionCounts).map(([institution, count]) => (
          <div key={institution} className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              {institution}
            </span>
            <span className="text-sm font-semibold text-gray-900 dark:text-white">
              {isMasked ? '••' : count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
} 