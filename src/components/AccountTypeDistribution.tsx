"use client";

import { Account } from "@/types/account";
import { useSensitiveData } from "@/app/providers";

interface AccountTypeDistributionProps {
  accounts: Account[];
}

export function AccountTypeDistribution({ accounts }: AccountTypeDistributionProps) {
  const { showSensitiveData } = useSensitiveData();
  
  const typeCounts = (accounts || []).reduce((acc, account) => {
    const type = account.type.toLowerCase();
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="card">
      <h3 className="text-xl font-semibold text-surface-600 dark:text-gray-200 mb-4">Account Type Distribution</h3>
      <div className="space-y-3">
        {Object.entries(typeCounts).map(([type, count]) => (
          <div key={type} className="flex justify-between items-center">
            <span className="text-sm font-medium text-surface-600 dark:text-gray-400 capitalize">
              {type.replace(/_/g, ' ')}
            </span>
            <span className="text-sm font-semibold text-surface-900 dark:text-surface-dark-900">
              {showSensitiveData ? count : '••'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
} 