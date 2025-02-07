"use client";

import { Pie } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";

// Register ChartJS components
ChartJS.register(ArcElement, Tooltip, Legend);

interface Account {
  id: string;
  type: string;
  subtype: string | null;
  balance: {
    current: number;
  };
}

interface FinancialGroupChartProps {
  accounts: Account[];
  isMasked?: boolean;
}

// Define financial groups and their properties
const financialGroups = {
  Assets: {
    color: "rgba(16, 185, 129, 0.7)", // Green
    types: ["depository"],
    subtypes: [
      "checking",
      "savings",
      "cd",
      "money market",
      "paypal",
      "cash management",
      "ebt",
      "prepaid",
    ],
  },
  Investments: {
    color: "rgba(139, 92, 246, 0.7)", // Purple
    types: ["investment", "brokerage"],
    subtypes: [
      "401k",
      "401a",
      "403b",
      "457b",
      "529",
      "ira",
      "roth",
      "roth 401k",
      "brokerage",
      "mutual fund",
      "simple ira",
      "sep ira",
      "pension",
      "trust",
      "crypto exchange",
      "non-taxable brokerage account",
      "hsa",
      "non-custodial wallet",
      "sarsep",
    ],
  },
  Liabilities: {
    color: "rgba(239, 68, 68, 0.7)", // Red
    types: ["credit", "loan"],
    subtypes: [
      "credit card",
      "auto",
      "mortgage",
      "student",
      "line of credit",
      "home equity",
      "construction",
      "consumer",
    ],
  },
};

export function FinancialGroupChart({
  accounts,
  isMasked = false,
}: FinancialGroupChartProps) {
  const formatBalance = (amount: number) => {
    return isMasked ? "••••••" : `$${amount.toLocaleString()}`;
  };

  const groupData = accounts.reduce(
    (acc, account) => {
      const type = account.type.toLowerCase();
      const balance = account.balance.current;

      if (type === "credit" || type === "loan") {
        acc.liabilities += Math.abs(balance);
      } else {
        acc.assets += balance;
      }

      return acc;
    },
    { assets: 0, liabilities: 0 }
  );

  const totalBalance = groupData.assets + groupData.liabilities;

  const chartData = {
    labels: ["Assets", "Liabilities"],
    datasets: [
      {
        data: [groupData.assets, groupData.liabilities],
        backgroundColor: ["rgba(16, 185, 129, 0.7)", "rgba(239, 68, 68, 0.7)"],
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        position: "right" as const,
        align: "center" as const,
      },
      tooltip: {
        callbacks: {
          label: (context: { raw: number; label: string }) => {
            const value = context.raw;
            const percentage = ((value / totalBalance) * 100).toFixed(1);
            return `${context.label}: ${formatBalance(value)} (${percentage}%)`;
          },
        },
      },
    },
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow-md">
      <h2 className="text-lg font-semibold mb-4">Financial Groups</h2>
      <div className="space-y-4">
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm font-medium">Assets</span>
            <span className="text-sm font-medium text-green-600">
              {formatBalance(groupData.assets)}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="h-2 rounded-full bg-green-500"
              style={{
                width: `${Math.min(
                  (groupData.assets /
                    Math.max(groupData.assets, groupData.liabilities)) *
                    100,
                  100
                )}%`,
              }}
            ></div>
          </div>
        </div>
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm font-medium">Liabilities</span>
            <span className="text-sm font-medium text-red-600">
              {formatBalance(groupData.liabilities)}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="h-2 rounded-full bg-red-500"
              style={{
                width: `${Math.min(
                  (groupData.liabilities /
                    Math.max(groupData.assets, groupData.liabilities)) *
                    100,
                  100
                )}%`,
              }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
}
