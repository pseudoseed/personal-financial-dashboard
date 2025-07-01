"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MetricCard } from "@/components/MetricCard";
import { Modal } from "@/components/ui/Modal";
import { 
  ExclamationTriangleIcon,
  CheckCircleIcon,
  InformationCircleIcon,
  LightBulbIcon
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

export function FinancialHealthMetrics() {
  const [showRecommendations, setShowRecommendations] = useState(false);

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
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="card animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
            <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          </div>
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="card">
            <div className="text-center text-gray-500 text-sm">
              Unable to load data
            </div>
          </div>
        ))}
      </div>
    );
  }

  const { overallScore, emergencyFundRatio, debtToIncomeRatio, savingsRate, recommendations } = data;
  const scoreColor = getScoreColor(overallScore);
  const highPriorityCount = recommendations.filter(r => r.priority === 'high').length;

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {/* Financial Health Score */}
        <MetricCard
          title="Financial Health"
          value={`${overallScore}%`}
          color={scoreColor}
        />

        {/* Emergency Fund */}
        <MetricCard
          title="Emergency Fund"
          value={`${emergencyFundRatio.toFixed(1)} months`}
          color={emergencyFundRatio >= 6 ? "text-green-600 dark:text-green-400" : 
                 emergencyFundRatio >= 3 ? "text-yellow-600 dark:text-yellow-400" : 
                 "text-pink-600 dark:text-pink-400"}
        />

        {/* Debt-to-Income */}
        <MetricCard
          title="Debt-to-Income"
          value={`${(debtToIncomeRatio * 100).toFixed(1)}%`}
          color={debtToIncomeRatio <= 0.28 ? "text-green-600 dark:text-green-400" : 
                 debtToIncomeRatio <= 0.36 ? "text-yellow-600 dark:text-yellow-400" : 
                 "text-pink-600 dark:text-pink-400"}
        />

        {/* Savings Rate */}
        <MetricCard
          title="Savings Rate"
          value={`${savingsRate.toFixed(1)}%`}
          color={savingsRate >= 20 ? "text-green-600 dark:text-green-400" : 
                 savingsRate >= 10 ? "text-yellow-600 dark:text-yellow-400" : 
                 "text-pink-600 dark:text-pink-400"}
        />

        {/* Recommendations Card */}
        <div className="card cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors" onClick={() => setShowRecommendations(true)}>
          <h3 className="text-xl font-semibold text-surface-600 dark:text-gray-200 mb-2">
            Recommendations
          </h3>
          <p className="text-3xl font-bold text-surface-900 dark:text-surface-100">
            {recommendations.length}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {highPriorityCount > 0 ? `${highPriorityCount} urgent` : 'All good'}
          </p>
        </div>
      </div>

      {/* Recommendations Modal */}
      <Modal
        isOpen={showRecommendations}
        onClose={() => setShowRecommendations(false)}
        title="Financial Recommendations"
      >
        <div className="space-y-4">
          {recommendations.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircleIcon className="h-12 w-12 text-green-600 dark:text-green-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">
                Great job! Your financial health is in excellent shape.
              </p>
            </div>
          ) : (
            recommendations.map((recommendation, index) => {
              const Icon = getPriorityIcon(recommendation.priority);
              const priorityColor = getPriorityColor(recommendation.priority);
              
              return (
                <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <Icon className={`h-5 w-5 mt-0.5 ${priorityColor}`} />
                    <div className="flex-1">
                      <h4 className="font-semibold text-surface-900 dark:text-surface-100 mb-1">
                        {recommendation.title}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {recommendation.description}
                      </p>
                      <div className="text-sm">
                        <span className="font-medium text-surface-700 dark:text-surface-300">
                          Action:
                        </span>
                        <span className="ml-1 text-gray-600 dark:text-gray-400">
                          {recommendation.action}
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
    </>
  );
} 