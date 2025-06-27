"use client";

import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { getFinancialGroup } from "@/lib/accountTypes";
import { formatBalance } from "@/lib/formatters";
import { useSensitiveData } from "@/app/providers";

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

export function FinancialGroupChart({
  accounts,
}: FinancialGroupChartProps) {
  const { showSensitiveData } = useSensitiveData();
  
  const groupData = (accounts || []).reduce(
    (acc, account) => {
      const group = getFinancialGroup(account.type);
      if (group === "Liabilities") {
        acc.liabilities += Math.abs(account.balance?.current || 0);
      } else {
        acc.assets += account.balance?.current || 0;
      }
      return acc;
    },
    { assets: 0, liabilities: 0 }
  );

  const chartData = [
    { name: "Assets", value: groupData.assets },
    { name: "Liabilities", value: groupData.liabilities },
  ];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="p-2 bg-background border rounded-md shadow-md">
          <p className="label">{`${label} : ${showSensitiveData ? formatBalance(payload[0].value) : "••••••"}`}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="card">
      <h2 className="text-xl font-semibold text-surface-600 dark:text-gray-200 mb-4">Financial Groups</h2>
      <div className="space-y-4">
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm font-medium text-surface-600 dark:text-gray-400">Assets</span>
            <span className="text-sm font-medium text-green-600">
              {showSensitiveData ? formatBalance(groupData.assets) : "••••••"}
            </span>
          </div>
          <div className="w-full bg-surface-200 dark:bg-surface-300 rounded-full h-2">
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
            <span className="text-sm font-medium text-surface-600 dark:text-gray-400">Liabilities</span>
            <span className="text-sm font-medium text-pink-500 dark:text-pink-400">
              {showSensitiveData ? formatBalance(groupData.liabilities) : "••••••"}
            </span>
          </div>
          <div className="w-full bg-surface-200 dark:bg-surface-300 rounded-full h-2">
            <div
              className="h-2 rounded-full bg-pink-500 dark:bg-pink-400"
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
