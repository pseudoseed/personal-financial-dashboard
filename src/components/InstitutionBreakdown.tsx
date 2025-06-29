"use client";

import { Account } from "@/types/account";
import { useSensitiveData } from "@/app/providers";

interface InstitutionBreakdownProps {
  accounts: Account[];
}

export function InstitutionBreakdown({ accounts }: InstitutionBreakdownProps) {
  const { showSensitiveData } = useSensitiveData();
  
  const institutionCounts = (accounts || []).reduce((acc, account) => {
    const institution = account.institution || 'Manual';
    acc[institution] = (acc[institution] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="card">
      <h3 className="text-xl font-semibold text-surface-600 dark:text-gray-200 mb-4">Institution Breakdown</h3>
      <div className="space-y-3">
        {Object.entries(institutionCounts).map(([institution, count]) => (
          <div key={institution} className="flex justify-between items-center">
            <span className="text-sm font-medium text-surface-600 dark:text-gray-400">
              {showSensitiveData ? institution : "••••••••••"}
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