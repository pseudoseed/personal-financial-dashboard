"use client";

import { Account } from "@/types/account";
import { formatBalance } from "@/lib/formatters";
import { useSensitiveData } from "@/app/providers";
import { useMemo } from "react";
import { MetricCard } from "@/components/MetricCard";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { 
  ExclamationTriangleIcon,
  CheckCircleIcon,
  InformationCircleIcon,
  LightBulbIcon
} from "@heroicons/react/24/outline";
import { maskSensitiveValue } from '@/lib/ui';

interface DashboardSummaryProps {
  accounts: Account[];
  isMasked?: boolean;
}

interface FinancialHealthData {
  overallScore: number;
  emergencyFundRatio: number;
  debtToIncomeRatio: number;
  savingsRate: number;
  creditUtilization: number;
  recommendations: {
    priority: 'high' | 'medium' | 'low';
    title: string;
    description: string;
    action: string;
  }[];
  trend?: {
    score: number;
    change: number;
    period: string;
  };
}

function getScoreColor(score: number): string {
  if (score >= 80) return "text-green-600 dark:text-green-400";
  if (score >= 60) return "text-yellow-600 dark:text-yellow-400";
  return "text-pink-600 dark:text-pink-400";
}

function getPriorityColor(priority: 'high' | 'medium' | 'low'): string {
  switch (priority) {
    case 'high': return "text-pink-600 dark:text-pink-400";
    case 'medium': return "text-yellow-600 dark:text-yellow-400";
    case 'low': return "text-green-600 dark:text-green-400";
  }
}

function getPriorityIcon(priority: 'high' | 'medium' | 'low') {
  switch (priority) {
    case 'high': return ExclamationTriangleIcon;
    case 'medium': return InformationCircleIcon;
    case 'low': return CheckCircleIcon;
  }
}

export function DashboardSummary({
  accounts,
  isMasked = false,
}: DashboardSummaryProps) {
  const { showSensitiveData } = useSensitiveData();
  const [showRecommendations, setShowRecommendations] = useState(false);

  // Calculate financial summary
  const summary = useMemo(() => {
    return accounts.reduce(
      (acc, account) => {
        const balance = account.balance?.current || 0;
        
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
    (account) => account.type === "credit" && account.balance?.limit
  );
  
  const totalCreditLimit = creditAccounts.reduce(
    (sum, account) => sum + (account.balance?.limit || 0),
    0
  );
  
  const totalCreditBalance = creditAccounts.reduce(
    (sum, account) => sum + Math.abs(account.balance?.current || 0),
    0
  );
  
  const creditUtilization = totalCreditLimit > 0 
    ? (totalCreditBalance / totalCreditLimit) * 100 
    : 0;

  // Fetch financial health data
  const { data: financialHealthData } = useQuery<FinancialHealthData>({
    queryKey: ["financialHealth"],
    queryFn: async () => {
      const response = await fetch("/api/analytics/financial-health");
      if (!response.ok) throw new Error("Failed to fetch financial health");
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const highPriorityCount = financialHealthData?.recommendations?.filter(r => r.priority === 'high').length || 0;

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <MetricCard
          title="Net Worth"
          value={maskSensitiveValue(formatBalance(netWorth), showSensitiveData)}
          color={netWorth >= 0 ? "text-success-600 dark:text-success-400" : "text-error-600 dark:text-error-400"}
        />
        <MetricCard
          title="Total Assets"
          value={maskSensitiveValue(formatBalance(summary.totalAssets), showSensitiveData)}
        />
        <MetricCard
          title="Total Liabilities"
          value={maskSensitiveValue(formatBalance(summary.totalLiabilities), showSensitiveData)}
        />
        <MetricCard
          title="Credit Utilization"
          value={maskSensitiveValue(`${creditUtilization.toFixed(1)}%`, showSensitiveData)}
          color={creditUtilization > 30 ? "text-pink-600 dark:text-pink-400" : "text-success-600 dark:text-success-400"}
          progress={showSensitiveData ? creditUtilization : undefined}
          progressColor={creditUtilization > 30 ? "bg-pink-500 dark:bg-pink-400" : "bg-success-500 dark:bg-success-400"}
        />
        
        {/* Financial Health Score */}
        {financialHealthData && (
          <MetricCard
            title="Financial Health"
            value={maskSensitiveValue(financialHealthData.overallScore.toString(), showSensitiveData)}
            color={getScoreColor(financialHealthData.overallScore)}
          />
        )}

        {/* Emergency Fund */}
        {financialHealthData && (
          <MetricCard
            title="Emergency Fund"
            value={maskSensitiveValue(`${financialHealthData.emergencyFundRatio.toFixed(1)} months`, showSensitiveData)}
            color={financialHealthData.emergencyFundRatio >= 6 ? "text-green-600 dark:text-green-400" : 
                   financialHealthData.emergencyFundRatio >= 3 ? "text-yellow-600 dark:text-yellow-400" : 
                   "text-pink-600 dark:text-pink-400"}
          />
        )}

        {/* Debt-to-Income */}
        {financialHealthData && (
          <MetricCard
            title="Debt-to-Income"
            value={maskSensitiveValue(`${(financialHealthData.debtToIncomeRatio * 100).toFixed(1)}%`, showSensitiveData)}
            color={financialHealthData.debtToIncomeRatio <= 0.28 ? "text-green-600 dark:text-green-400" : 
                   financialHealthData.debtToIncomeRatio <= 0.36 ? "text-yellow-600 dark:text-yellow-400" : 
                   "text-pink-600 dark:text-pink-400"}
          />
        )}

        {/* Savings Rate */}
        {financialHealthData && (
          <MetricCard
            title="Savings Rate"
            value={`${financialHealthData.savingsRate.toFixed(1)}%`}
            color={financialHealthData.savingsRate >= 20 ? "text-green-600 dark:text-green-400" : 
                   financialHealthData.savingsRate >= 10 ? "text-yellow-600 dark:text-yellow-400" : 
                   "text-pink-600 dark:text-pink-400"}
          />
        )}

        {/* Recommendations Card */}
        {financialHealthData && (
          <div className="card cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors" onClick={() => setShowRecommendations(true)}>
            <h3 className="text-xl font-semibold text-surface-600 dark:text-gray-200 mb-2">
              Recommendations
            </h3>
            <p className="text-3xl font-bold text-surface-900 dark:text-surface-100">
              {financialHealthData.recommendations.length}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {highPriorityCount > 0 ? `${highPriorityCount} urgent` : 'All good'}
            </p>
          </div>
        )}
      </div>

      {/* Recommendations Modal */}
      {financialHealthData && (
        <Modal
          isOpen={showRecommendations}
          onClose={() => setShowRecommendations(false)}
          title="Financial Recommendations"
        >
          <div className="space-y-4">
            {financialHealthData.recommendations.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircleIcon className="h-12 w-12 text-green-600 dark:text-green-400 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400">
                  Great job! Your financial health is in excellent shape.
                </p>
              </div>
            ) : (
              financialHealthData.recommendations.map((recommendation, index) => {
                const Icon = getPriorityIcon(recommendation.priority);
                const priorityColor = getPriorityColor(recommendation.priority);
                return (
                  <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                      <Icon className={`h-5 w-5 mt-0.5 ${priorityColor}`} />
                      <div className="flex-1">
                        <h4 className="font-semibold text-surface-900 dark:text-surface-100 mb-1">
                          {maskSensitiveValue(recommendation.title, showSensitiveData)}
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                          {maskSensitiveValue(recommendation.description, showSensitiveData)}
                        </p>
                        <div className="text-sm">
                          <span className="font-medium text-surface-700 dark:text-surface-300">
                            Action:
                          </span>
                          <span className="ml-1 text-gray-600 dark:text-gray-400">
                            {maskSensitiveValue(recommendation.action, showSensitiveData)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
