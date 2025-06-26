"use client";

import { useQuery } from "@tanstack/react-query";
import { MetricCard } from "@/components/MetricCard";
import { 
  ArrowTrendingUpIcon, 
  ArrowTrendingDownIcon
} from "@heroicons/react/24/outline";

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

function getScoreLabel(score: number): string {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Good";
  if (score >= 40) return "Fair";
  return "Poor";
}

export function FinancialHealthCard() {
  const { data, isLoading, error } = useQuery<FinancialHealthData>({
    queryKey: ["financialHealth"],
    queryFn: async () => {
      const response = await fetch("/api/analytics/financial-health");
      if (!response.ok) throw new Error("Failed to fetch financial health");
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  if (isLoading) {
    return (
      <div className="card animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
        <div className="h-6 bg-gray-200 rounded w-1/3"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="card">
        <div className="text-center text-gray-500 text-sm">
          Unable to load financial health data
        </div>
      </div>
    );
  }

  const { overallScore, trend } = data;
  const scoreColor = getScoreColor(overallScore);
  const scoreLabel = getScoreLabel(overallScore);

  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold text-surface-600 dark:text-gray-200 mb-2">
            Financial Health
          </h3>
          <div className="flex items-baseline space-x-2">
            <p className={`text-3xl font-bold ${scoreColor}`}>
              {overallScore}
            </p>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {scoreLabel}
            </span>
          </div>
        </div>
        {trend && (
          <div className="flex items-center space-x-1">
            {trend.change > 0 ? (
              <ArrowTrendingUpIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
            ) : (
              <ArrowTrendingDownIcon className="h-5 w-5 text-pink-600 dark:text-pink-400" />
            )}
            <span className={`text-sm font-medium ${
              trend.change > 0 
                ? "text-green-600 dark:text-green-400" 
                : "text-pink-600 dark:text-pink-400"
            }`}>
              {Math.abs(trend.change)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
} 