"use client";

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
} from "chart.js";
import { format, compareAsc } from "date-fns";
import { Account } from "@/types/account";

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
  accounts: Account[];
  isMasked?: boolean;
}

export function NetWorthChart({
  accounts,
  isMasked = false,
}: NetWorthChartProps) {
  const formatBalance = (amount: number) => {
    return isMasked ? "••••••" : `$${amount.toLocaleString()}`;
  };

  // Create a map to store net worth by month
  const monthlyNetWorth = new Map<string, number>();

  // Process each account
  accounts.forEach((account) => {
    const isLiability =
      account.type.toLowerCase() === "credit" ||
      account.type.toLowerCase() === "loan";
    const multiplier = isLiability ? -1 : 1;

    if (account.balances && account.balances.length > 0) {
      // Process historical balances
      account.balances.forEach((balance) => {
        // Ensure we have a valid date and current balance
        if (!balance.date) {
          console.warn(`Missing date for account ${account.name}:`, balance);
          return;
        }

        const current = balance.current;
        if (current === null || current === undefined) {
          console.warn(
            `Missing current balance for account ${account.name} on ${balance.date}:`,
            balance
          );
          return;
        }

        if (!isFinite(current)) {
          console.warn(
            `Invalid balance value for account ${account.name} on ${balance.date}:`,
            current
          );
          return;
        }

        const monthKey = format(new Date(balance.date), "yyyy-MM");
        const currentValue = monthlyNetWorth.get(monthKey) || 0;
        const newValue = currentValue + current * multiplier;

        if (!isFinite(newValue)) {
          console.warn(
            `Invalid calculation result for ${account.name} on ${monthKey}:`,
            {
              currentValue,
              current,
              multiplier,
              newValue,
            }
          );
          return;
        }

        monthlyNetWorth.set(monthKey, newValue);
      });
    }
  });

  // Convert to array and sort by date
  const sortedData = Array.from(monthlyNetWorth.entries())
    .map(([monthKey, value]) => ({
      date: new Date(monthKey + "-01"), // Convert YYYY-MM to date
      netWorth: value,
    }))
    .sort((a, b) => compareAsc(a.date, b.date));

  console.log("Monthly net worth data:", sortedData);

  const chartData = {
    labels: sortedData.map((item) => format(item.date, "MMM yyyy")),
    datasets: [
      {
        label: "Net Worth",
        data: sortedData.map((item) => item.netWorth),
        borderColor: "rgb(16, 185, 129)",
        backgroundColor: "rgba(16, 185, 129, 0.5)",
        tension: 0.1,
      },
    ],
  };
  console.log(chartData);

  const chartOptions: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: true,
        text: "Net Worth Over Time",
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const value = context.raw as number;
            return `Net Worth: ${formatBalance(value)}`;
          },
        },
      },
    },
    scales: {
      y: {
        type: "linear",
        beginAtZero: false,
        grace: "5%",
        ticks: {
          callback: (value) => formatBalance(value as number),
          maxTicksLimit: 10,
        },
      },
      x: {
        grid: {
          display: true,
        },
        ticks: {
          maxRotation: 45,
          minRotation: 45,
        },
      },
    },
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md h-[400px] flex flex-col">
      <h2 className="text-lg font-semibold mb-4">Net Worth Over Time</h2>
      <div className="flex-1">
        <Line options={chartOptions} data={chartData} />
      </div>
    </div>
  );
}
