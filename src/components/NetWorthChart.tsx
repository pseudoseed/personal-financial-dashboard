"use client";

import { useQuery } from "@tanstack/react-query";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
  TooltipItem,
} from "chart.js";
import { format, compareAsc } from "date-fns";
import { useState, useRef, useEffect } from "react";
import {
  PencilIcon,
  CheckIcon,
  XMarkIcon,
  TrashIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  BuildingLibraryIcon,
  ArrowDownTrayIcon,
} from "@heroicons/react/24/solid";
import { TransactionList } from "@/components/TransactionList";
import {
  Account,
  PlaidItem,
  Transaction,
  TransactionDownloadLog,
} from "@prisma/client";
import { formatBalance } from "@/lib/formatters";
import { useSensitiveData } from "@/app/providers";
import { useTheme } from "@/app/providers";
import { useMemo } from "react";
import { Account as AccountType } from "@/types/account";

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface NetWorthChartProps {
  accounts: AccountType[];
  isMasked?: boolean;
}

export function NetWorthChart({ accounts, isMasked = false }: NetWorthChartProps) {
  const { showSensitiveData } = useSensitiveData();
  const { darkMode } = useTheme();

  const chartData = useMemo(() => {
    if (!accounts.length) return { labels: [], datasets: [] };

    // Group balances by month
    const monthlyData = new Map<string, { assets: number; liabilities: number }>();

    accounts.forEach((account) => {
      if (!account.balances) return;

      account.balances.forEach((balance) => {
        if (!balance.date) {
          console.warn(`Missing date for account ${account.name}:`, balance);
          return;
        }

        const monthKey = balance.date.substring(0, 7); // YYYY-MM format
        const current = monthlyData.get(monthKey) || { assets: 0, liabilities: 0 };

        if (account.type === "credit" || account.type === "loan") {
          current.liabilities += Math.abs(balance.current);
        } else {
          current.assets += balance.current;
        }

        monthlyData.set(monthKey, current);
      });
    });

    // Convert to sorted array
    const sortedMonths = Array.from(monthlyData.keys()).sort();
    
    if (sortedMonths.length === 0) {
      console.warn("No balance data found for any accounts");
      return { labels: [], datasets: [] };
    }

    const labels = sortedMonths.map((month) => {
      const [year, monthNum] = month.split("-");
      return new Date(parseInt(year), parseInt(monthNum) - 1).toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      });
    });

    const assetsData = sortedMonths.map((month) => {
      const data = monthlyData.get(month)!;
      return showSensitiveData ? data.assets : 0;
    });

    const liabilitiesData = sortedMonths.map((month) => {
      const data = monthlyData.get(month)!;
      return showSensitiveData ? data.liabilities : 0;
    });

    const netWorthData = sortedMonths.map((month) => {
      const data = monthlyData.get(month)!;
      return showSensitiveData ? data.assets - data.liabilities : 0;
    });

    // Removed verbose debug logging

    return {
      labels,
      datasets: [
        {
          label: "Assets",
          data: assetsData,
          borderColor: "rgb(34, 197, 94)",
          backgroundColor: "rgba(34, 197, 94, 0.1)",
          tension: 0.1,
        },
        {
          label: "Liabilities",
          data: liabilitiesData,
          borderColor: "rgb(239, 68, 68)",
          backgroundColor: "rgba(239, 68, 68, 0.1)",
          tension: 0.1,
        },
        {
          label: "Net Worth",
          data: netWorthData,
          borderColor: "rgb(59, 130, 246)",
          backgroundColor: "rgba(59, 130, 246, 0.1)",
          tension: 0.1,
        },
      ],
    };
  }, [accounts, showSensitiveData]);

  const options: ChartOptions<"line"> = {
    responsive: true,
    plugins: {
      legend: {
        position: "top" as const,
        labels: {
          color: darkMode ? "#9ca3af" : "#374151",
          usePointStyle: true,
        },
      },
      title: {
        display: true,
        text: "Net Worth Over Time",
        color: darkMode ? "#9ca3af" : "#374151",
      },
      tooltip: {
        callbacks: {
          label: function (tooltipItem: TooltipItem<"line">) {
            if (!showSensitiveData) return "••••••";
            const label = tooltipItem.dataset.label || "";
            const value = tooltipItem.raw as number;
            return `${label}: $${value.toLocaleString()}`;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: false,
        ticks: {
          callback: function (value) {
            if (!showSensitiveData) return "••••••";
            return `$${value.toLocaleString()}`;
          },
          color: darkMode ? "#9ca3af" : "#374151",
        },
        grid: {
          color: darkMode ? "#374151" : "#e5e7eb",
        },
      },
      x: {
        ticks: {
          color: darkMode ? "#9ca3af" : "#374151",
        },
        grid: {
          color: darkMode ? "#374151" : "#e5e7eb",
        },
      },
    },
  };

  if (!accounts.length) {
    return (
      <div className="card">
        <h3 className="text-lg font-semibold text-surface-600 dark:text-gray-200 mb-4">
          Net Worth Over Time
        </h3>
        <div className="text-center py-8 text-surface-500 dark:text-gray-400">
          No account data available
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 className="text-lg font-semibold text-surface-600 dark:text-gray-200 mb-4">
        Net Worth Over Time
      </h3>
      <Line options={options} data={chartData} />
    </div>
  );
}
