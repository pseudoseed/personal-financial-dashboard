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

export function FinancialGroupChart({ accounts }: FinancialGroupChartProps) {
  // Helper function to determine financial group
  const getFinancialGroup = (type: string, subtype: string | null) => {
    const lowerType = type.toLowerCase();
    const lowerSubtype = subtype?.toLowerCase() || "";

    for (const [group, info] of Object.entries(financialGroups)) {
      if (
        info.types.includes(lowerType) ||
        info.subtypes.includes(lowerSubtype)
      ) {
        return group;
      }
    }
    return "Other";
  };

  // Calculate data by financial group
  const groupData = accounts.reduce((acc, account) => {
    const group = getFinancialGroup(account.type, account.subtype);
    if (!acc[group]) {
      acc[group] = 0;
    }
    acc[group] += account.balance.current;
    return acc;
  }, {} as Record<string, number>);

  const totalBalance = Object.values(groupData).reduce(
    (sum, balance) => sum + balance,
    0
  );

  const chartData = {
    labels: Object.keys(groupData),
    datasets: [
      {
        data: Object.values(groupData),
        backgroundColor: Object.keys(groupData).map(
          (group) =>
            financialGroups[group as keyof typeof financialGroups]?.color ||
            "rgba(107, 114, 128, 0.7)"
        ),
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
            return `${
              context.label
            }: $${value.toLocaleString()} (${percentage}%)`;
          },
        },
      },
    },
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md h-[400px] flex flex-col">
      <h2 className="text-lg font-semibold mb-4">Balance by Financial Group</h2>
      <div className="flex-1 flex items-center justify-center relative w-full">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-[85%] h-[85%]">
            <Pie options={chartOptions} data={chartData} />
          </div>
        </div>
      </div>
    </div>
  );
}
