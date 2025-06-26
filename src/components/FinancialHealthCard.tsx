"use client";

import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
import { MetricCard } from "@/components/MetricCard";
import { 
  ArrowTrendingUpIcon, 
  ArrowTrendingDownIcon, 
  ExclamationTriangleIcon,
  CheckCircleIcon,
  InformationCircleIcon
} from "@heroicons/react/24/outline";
import { useState } from "react";

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

function getPriorityColor(priority: 'high' | 'medium' | 'low'): string {
  switch (priority) {
    case 'high':
      return 'text-red-600 bg-red-50 dark:bg-red-900/20';
    case 'medium':
      return 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20';
    case 'low':
      return 'text-green-600 bg-green-50 dark:bg-green-900/20';
  }
}

function getPriorityIcon(priority: 'high' | 'medium' | 'low') {
  switch (priority) {
    case 'high':
      return <ExclamationTriangleIcon className="w-4 h-4" />;
    case 'medium':
      return <InformationCircleIcon className="w-4 h-4" />;
    case 'low':
      return <CheckCircleIcon className="w-4 h-4" />;
  }
}

export function useFinancialHealthData() {
  return useQuery<FinancialHealthData>({
    queryKey: ["financialHealth"],
    queryFn: async () => {
      const response = await fetch("/api/analytics/financial-health");
      if (!response.ok) throw new Error("Failed to fetch financial health");
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function FinancialHealthScoreCard() {
  const { data, isLoading, error } = useFinancialHealthData();
  if (isLoading || error || !data) return null;
  const { overallScore } = data;
  return (
    <MetricCard
      title="Financial Health Score"
      value={`${overallScore} (${getScoreLabel(overallScore)})`}
      color={getScoreColor(overallScore)}
    />
  );
}

export function EmergencyFundCard() {
  const { data, isLoading, error } = useFinancialHealthData();
  if (isLoading || error || !data) return null;
  return (
    <MetricCard
      title="Emergency Fund"
      value={`${data.emergencyFundRatio.toFixed(1)} months`}
    />
  );
}

export function DebtToIncomeCard() {
  const { data, isLoading, error } = useFinancialHealthData();
  if (isLoading || error || !data) return null;
  return (
    <MetricCard
      title="Debt-to-Income"
      value={`${(data.debtToIncomeRatio * 100).toFixed(1)}%`}
    />
  );
}

export function SavingsRateCard() {
  const { data, isLoading, error } = useFinancialHealthData();
  if (isLoading || error || !data) return null;
  return (
    <MetricCard
      title="Savings Rate"
      value={`${data.savingsRate.toFixed(1)}%`}
    />
  );
}

export function CreditUtilizationCard() {
  const { data, isLoading, error } = useFinancialHealthData();
  if (isLoading || error || !data) return null;
  return (
    <MetricCard
      title="Credit Utilization"
      value={`${data.creditUtilization.toFixed(1)}%`}
    />
  );
}

export function FinancialRecommendationsCard() {
  const { data, isLoading, error } = useFinancialHealthData();
  const [open, setOpen] = useState(false);
  if (isLoading || error || !data || !data.recommendations.length) return null;
  return (
    <Card className="p-4">
      <button
        className="w-full flex justify-between items-center text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        Recommendations
        <span>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="space-y-3">
          {data.recommendations.map((rec, index) => (
            <div
              key={index}
              className={`p-3 rounded-lg border ${getPriorityColor(rec.priority)}`}
            >
              <div className="flex items-start space-x-3">
                {getPriorityIcon(rec.priority)}
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900 dark:text-gray-100">
                    {rec.title}
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {rec.description}
                  </p>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mt-2">
                    💡 {rec.action}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
} 