"use client";

import { useQuery } from "@tanstack/react-query";
import { ExclamationTriangleIcon, ArrowRightIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { useSensitiveData } from "@/app/providers";

interface QuickInsightsProps {}

export function QuickInsights({}: QuickInsightsProps) {
  const { showSensitiveData } = useSensitiveData();
  
  const { data: anomaliesData, isLoading: isLoadingAnomalies } = useQuery({
    queryKey: ["anomalies", "quick"],
    queryFn: async () => {
      const response = await fetch("/api/analytics/anomalies?timeWindow=30&newMerchantThreshold=200&zScoreThreshold=3.0");
      if (!response.ok) throw new Error("Failed to fetch anomalies");
      return response.json();
    },
  });

  const { data: momData, isLoading: isLoadingMoM } = useQuery({
    queryKey: ["monthOverMonth"],
    queryFn: async () => {
      const response = await fetch("/api/analytics/month-over-month");
      if (!response.ok) throw new Error("Failed to fetch month-over-month data");
      return response.json();
    },
  });

  const anomalies = anomaliesData?.anomalies || [];
  const highPriorityAnomalies = anomalies.filter((a: any) => a.severity === 'high').slice(0, 3);
  const mediumPriorityAnomalies = anomalies.filter((a: any) => a.severity === 'medium').slice(0, 2);

  const topAnomalies = [...highPriorityAnomalies, ...mediumPriorityAnomalies].slice(0, 3);
  const totalAnomalies = anomalies.length;
  const highCount = anomalies.filter((a: any) => a.severity === 'high').length;

  const insights = [];

  // Add anomaly insights
  if (highCount > 0) {
    insights.push({
      type: 'warning',
      title: showSensitiveData ? `${highCount} High Priority Alerts` : "••••••••••",
      description: showSensitiveData ? `${totalAnomalies} total anomalies detected` : "••••••••••",
      icon: ExclamationTriangleIcon,
      color: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-50 dark:bg-red-900/20',
      borderColor: 'border-red-200 dark:border-red-800',
    });
  }

  // Add month-over-month insights
  if (momData) {
    const { income, expenses, netChange, insights: momInsights } = momData;
    
    if (netChange < 0) {
      insights.push({
        type: 'trend',
        title: 'Spending Increased',
        description: showSensitiveData ? `Net change: $${Math.abs(netChange).toFixed(2)} decrease` : "••••••••••",
        icon: ArrowRightIcon,
        color: 'text-orange-600 dark:text-orange-400',
        bgColor: 'bg-orange-50 dark:bg-orange-900/20',
        borderColor: 'border-orange-200 dark:border-orange-800',
      });
    } else if (netChange > 0) {
      insights.push({
        type: 'trend',
        title: 'Savings Increased',
        description: showSensitiveData ? `Net change: $${netChange.toFixed(2)} increase` : "••••••••••",
        icon: ArrowRightIcon,
        color: 'text-green-600 dark:text-green-400',
        bgColor: 'bg-green-50 dark:bg-green-900/20',
        borderColor: 'border-green-200 dark:border-green-800',
      });
    }

    // Add top MoM insight if available
    if (momInsights && momInsights.length > 0) {
      const topInsight = momInsights[0];
      insights.push({
        type: 'insight',
        title: showSensitiveData ? topInsight.title : "••••••••••",
        description: showSensitiveData ? topInsight.description : "••••••••••",
        icon: ArrowRightIcon,
        color: 'text-blue-600 dark:text-blue-400',
        bgColor: 'bg-blue-50 dark:bg-blue-900/20',
        borderColor: 'border-blue-200 dark:border-blue-800',
      });
    }
  }

  if (isLoadingAnomalies || isLoadingMoM) {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-md p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 dark:bg-zinc-700 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 dark:bg-zinc-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (insights.length === 0) {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-md p-6">
        <h2 className="text-lg font-semibold dark:text-gray-100 mb-4">Quick Insights</h2>
        <p className="text-gray-500 dark:text-gray-400">No significant insights to display</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold dark:text-gray-100">Quick Insights</h2>
        <Link
          href="/dashboard/analytics"
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center space-x-1"
        >
          <span>View All</span>
          <ArrowRightIcon className="w-3 h-3" />
        </Link>
      </div>

      <div className="space-y-3">
        {insights.slice(0, 3).map((insight, index) => (
          <div
            key={index}
            className={`p-3 rounded-lg border ${insight.bgColor} ${insight.borderColor}`}
          >
            <div className="flex items-start space-x-3">
              <insight.icon className={`w-5 h-5 mt-0.5 ${insight.color}`} />
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {insight.title}
                </h3>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  {insight.description}
                </p>
              </div>
            </div>
          </div>
        ))}

        {totalAnomalies > 3 && (
          <div className="pt-2">
            <Link
              href="/dashboard/analytics"
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center space-x-1"
            >
              <span>View all {showSensitiveData ? totalAnomalies : "••"} anomalies</span>
              <ArrowRightIcon className="w-3 h-3" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
} 