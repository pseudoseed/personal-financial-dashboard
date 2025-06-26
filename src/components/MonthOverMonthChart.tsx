"use client";

import { useQuery } from "@tanstack/react-query";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
} from "chart.js";
import { formatBalance } from "@/lib/formatters";
import { ArrowTrendingUpIcon, ArrowTrendingDownIcon } from "@heroicons/react/24/outline";
import { useSensitiveData } from "@/app/providers";

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface MonthOverMonthChartProps {}

interface MonthOverMonthData {
  periods: {
    current: { label: string };
    previous: { label: string };
  };
  summary: {
    income: {
      current: number;
      previous: number;
      change: number;
      changePercent: number;
    };
    expenses: {
      current: number;
      previous: number;
      change: number;
      changePercent: number;
    };
    net: {
      current: number;
      previous: number;
      change: number;
    };
  };
  categories: {
    top: Array<{
      category: string;
      amount: number;
      previousAmount: number;
      change: number;
      changePercent: number;
    }>;
  };
}

export function MonthOverMonthChart({}: MonthOverMonthChartProps) {
  const { showSensitiveData } = useSensitiveData();
  
  const { data, isLoading, error } = useQuery<MonthOverMonthData>({
    queryKey: ["monthOverMonth"],
    queryFn: async () => {
      const response = await fetch("/api/analytics/month-over-month");
      if (!response.ok) throw new Error("Failed to fetch month-over-month data");
      return response.json();
    },
  });

  if (isLoading) {
    return (
      <div className="card">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 dark:bg-zinc-700 rounded w-1/3 mb-4"></div>
          <div className="h-64 bg-gray-200 dark:bg-zinc-700 rounded"></div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="card">
        <p className="text-red-500 dark:text-red-400">Failed to load month-over-month data</p>
      </div>
    );
  }

  // Calculate net change percentage
  const netSummary = data.summary.net;
  let netChangePercent: number | null = null;
  if (netSummary.previous !== 0) {
    netChangePercent = (netSummary.change / Math.abs(netSummary.previous)) * 100;
  } else if (netSummary.current !== 0) {
    netChangePercent = null; // Represents infinite change, handled in UI
  } else {
    netChangePercent = 0; // 0 to 0 is 0% change
  }

  // Prepare chart data for top categories
  const topCategories = data.categories.top.slice(0, 8); // Show top 8 categories
  
  const chartData = {
    labels: topCategories.map(cat => cat.category),
    datasets: [
      {
        label: data.periods.previous.label,
        data: topCategories.map(cat => cat.previousAmount),
        backgroundColor: "rgba(156, 163, 175, 0.7)", // Gray for previous month
        borderColor: "rgba(156, 163, 175, 1)",
        borderWidth: 1,
      },
      {
        label: data.periods.current.label,
        data: topCategories.map(cat => cat.amount),
        backgroundColor: topCategories.map(cat => 
          cat.changePercent > 0 
            ? 'rgba(244, 114, 182, 0.7)' // App's pink for increases
            : 'rgba(34, 197, 94, 0.7)' // App's green for decreases
        ),
        borderColor: topCategories.map(cat => 
          cat.changePercent > 0 
            ? 'rgb(244, 114, 182)' 
            : 'rgb(34, 197, 94)'
        ),
        borderWidth: 1,
      },
    ],
  };

  const chartOptions: ChartOptions<"bar"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top" as const,
        labels: {
          color: showSensitiveData ? "#374151" : "#6b7280",
          usePointStyle: true,
        },
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const value = context.raw as number;
            return `${context.dataset.label}: ${showSensitiveData ? formatBalance(value) : "••••••"}`;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value) => showSensitiveData ? formatBalance(value as number) : "••••••",
          color: showSensitiveData ? "#374151" : "#6b7280",
        },
        grid: {
          color: showSensitiveData ? "#e5e7eb" : "#374151",
        },
      },
      x: {
        ticks: {
          color: showSensitiveData ? "#374151" : "#6b7280",
          maxRotation: 45,
        },
        grid: {
          display: false,
        },
      },
    },
  };

  // Determine if dark mode is active for chart colors
  const isDarkMode = typeof window !== 'undefined' && document.documentElement.classList.contains('dark');
  
  // Update chart colors for dark mode
  if (isDarkMode) {
    chartOptions.plugins!.legend!.labels!.color = "#9ca3af"; // dark:text-gray-400
    chartOptions.scales!.y!.ticks!.color = "#9ca3af"; // dark:text-gray-400
    chartOptions.scales!.x!.ticks!.color = "#9ca3af"; // dark:text-gray-400
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-surface-600 dark:text-gray-200">Month-over-Month Comparison</h2>
        <div className="text-sm text-surface-600 dark:text-gray-400">
          {data.periods.current.label} vs {data.periods.previous.label}
        </div>
      </div>

      {/* Summary metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="text-center p-4 bg-gray-50 dark:bg-[rgb(46,46,46)] rounded-lg">
          <p className="text-sm text-surface-600 dark:text-gray-400 mb-1">Income</p>
          <div className="flex items-center justify-center space-x-1 mb-1">
            {data.summary.income.changePercent > 0 ? (
              <ArrowTrendingUpIcon className="w-4 h-4 text-green-500 dark:text-green-400" />
            ) : data.summary.income.changePercent < 0 ? (
              <ArrowTrendingDownIcon className="w-4 h-4 text-pink-500 dark:text-pink-400" />
            ) : (
              <ArrowTrendingUpIcon className="w-4 h-4 text-gray-400 dark:text-gray-400" />
            )}
            <span className={`text-lg font-semibold ${
              data.summary.income.changePercent > 0
                ? 'text-green-500 dark:text-green-400'
                : data.summary.income.changePercent < 0
                  ? 'text-pink-500 dark:text-pink-400'
                  : 'text-gray-500 dark:text-gray-400'
            }`}>
              {data.summary.income.changePercent > 0 ? '+' : ''}
              {data.summary.income.changePercent.toFixed(1)}%
            </span>
          </div>
          <p className={`text-xs font-medium ${
            data.summary.income.changePercent > 0
              ? 'text-green-600 dark:text-green-400'
              : data.summary.income.changePercent < 0
                ? 'text-pink-600 dark:text-pink-400'
                : 'text-gray-500 dark:text-gray-400'
          }`}>
            {showSensitiveData ? formatBalance(data.summary.income.current) : "••••••"}
          </p>
        </div>

        <div className="text-center p-4 bg-gray-50 dark:bg-[rgb(46,46,46)] rounded-lg">
          <p className="text-sm text-surface-600 dark:text-gray-400 mb-1">Expenses</p>
          <div className="flex items-center justify-center space-x-1 mb-1">
            {data.summary.expenses.changePercent < 0 ? (
              <ArrowTrendingDownIcon className="w-4 h-4 text-green-500 dark:text-green-400" />
            ) : data.summary.expenses.changePercent > 0 ? (
              <ArrowTrendingUpIcon className="w-4 h-4 text-pink-500 dark:text-pink-400" />
            ) : (
              <ArrowTrendingDownIcon className="w-4 h-4 text-gray-400 dark:text-gray-400" />
            )}
            <span className={`text-lg font-semibold ${
              data.summary.expenses.changePercent < 0
                ? 'text-green-500 dark:text-green-400'
                : data.summary.expenses.changePercent > 0
                  ? 'text-pink-500 dark:text-pink-400'
                  : 'text-gray-500 dark:text-gray-400'
            }`}>
              {data.summary.expenses.changePercent > 0 ? '+' : ''}
              {data.summary.expenses.changePercent.toFixed(1)}%
            </span>
          </div>
          <p className={`text-xs font-medium ${
            data.summary.expenses.changePercent < 0
              ? 'text-green-600 dark:text-green-400'
              : data.summary.expenses.changePercent > 0
                ? 'text-pink-600 dark:text-pink-400'
                : 'text-gray-500 dark:text-gray-400'
          }`}>
            {showSensitiveData ? formatBalance(data.summary.expenses.current) : "••••••"}
          </p>
        </div>

        <div className="text-center p-4 bg-gray-50 dark:bg-[rgb(46,46,46)] rounded-lg">
          <p className="text-sm text-surface-600 dark:text-gray-400 mb-1">Net</p>
          <div className="flex items-center justify-center space-x-1 mb-1">
            {data.summary.net.change > 0 ? (
              <ArrowTrendingUpIcon className="w-4 h-4 text-green-500 dark:text-green-400" />
            ) : data.summary.net.change < 0 ? (
              <ArrowTrendingDownIcon className="w-4 h-4 text-pink-500 dark:text-pink-400" />
            ) : (
              <ArrowTrendingUpIcon className="w-4 h-4 text-gray-400 dark:text-gray-400" />
            )}
            <span className={`text-lg font-semibold ${
              data.summary.net.change > 0
                ? 'text-green-500 dark:text-green-400'
                : data.summary.net.change < 0
                  ? 'text-pink-500 dark:text-pink-400'
                  : 'text-gray-500 dark:text-gray-400'
            }`}>
              {netChangePercent !== null ? (
                <>
                  {netChangePercent > 0 ? '+' : ''}
                  {netChangePercent.toFixed(1)}%
                </>
              ) : (
                'N/A'
              )}
            </span>
          </div>
          <p className={`text-xs font-medium ${
            data.summary.net.change > 0
              ? 'text-green-600 dark:text-green-400'
              : data.summary.net.change < 0
                ? 'text-pink-600 dark:text-pink-400'
                : 'text-gray-500 dark:text-gray-400'
          }`}>
            {showSensitiveData ? formatBalance(data.summary.net.current) : "••••••"}
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="h-80">
        <Bar options={chartOptions} data={chartData} />
      </div>

      {/* Category changes list */}
      <div className="mt-6">
        <h3 className="text-sm font-medium text-surface-600 dark:text-gray-300 mb-3">
          Top Category Changes
        </h3>
        <div className="space-y-2">
          {topCategories.slice(0, 5).map((category, index) => (
            <div key={index} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-[rgb(46,46,46)] rounded">
              <span className="text-sm font-medium text-surface-600 dark:text-gray-300">
                {category.category}
              </span>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-surface-600 dark:text-gray-400">
                  {showSensitiveData ? formatBalance(category.amount) : "••••••"}
                </span>
                <div className="flex items-center space-x-1">
                  {category.changePercent > 0 ? (
                    <ArrowTrendingUpIcon className="w-3 h-3 text-pink-500 dark:text-pink-400" />
                  ) : (
                    <ArrowTrendingDownIcon className="w-3 h-3 text-green-500 dark:text-green-400" />
                  )}
                  <span className={`text-xs font-medium ${
                    category.changePercent > 0 
                      ? 'text-pink-500 dark:text-pink-400' 
                      : 'text-green-500 dark:text-green-400'
                  }`}>
                    {category.changePercent > 0 ? '+' : ''}
                    {category.changePercent.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 