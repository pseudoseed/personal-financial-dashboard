"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
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

function getPriorityColor(priority: 'high' | 'medium' | 'low'): string {
  switch (priority) {
    case 'high':
      return 'text-red-600 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
    case 'medium':
      return 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
    case 'low':
      return 'text-green-600 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
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

export function FinancialRecommendationsCard() {
  const [isModalOpen, setIsModalOpen] = useState(false);

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
      <Card className="p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
        </div>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className="p-4">
        <div className="text-center text-gray-500 text-sm">
          Unable to load recommendations
        </div>
      </Card>
    );
  }

  const { recommendations } = data;
  const highPriorityCount = recommendations.filter(r => r.priority === 'high').length;
  const mediumPriorityCount = recommendations.filter(r => r.priority === 'medium').length;

  return (
    <>
      <Card className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors" onClick={() => setIsModalOpen(true)}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Recommendations
          </h3>
          <LightBulbIcon className="w-4 h-4 text-yellow-500" />
        </div>

        <div className="text-center">
          <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {recommendations.length}
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400">
            {highPriorityCount > 0 ? `${highPriorityCount} high priority` : 
             mediumPriorityCount > 0 ? `${mediumPriorityCount} medium priority` : 
             'All good!'}
          </div>
        </div>
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Financial Recommendations">
        <div className="space-y-4">
          {recommendations.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircleIcon className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                Great job!
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Your financial health is in good shape. Keep up the good work!
              </p>
            </div>
          ) : (
            recommendations.map((rec, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg border ${getPriorityColor(rec.priority)}`}
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
            ))
          )}
        </div>
      </Modal>
    </>
  );
} 