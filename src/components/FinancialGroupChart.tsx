"use client";

import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { getFinancialGroup } from "@/lib/accountTypes";
import { formatBalance } from "@/lib/formatters";

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

export function FinancialGroupChart({
  accounts,
  isMasked = false,
}: FinancialGroupChartProps) {
  const groupData = accounts.reduce(
    (acc, account) => {
      const group = getFinancialGroup(account.type);
      if (group === "Liabilities") {
        acc.liabilities += Math.abs(account.balance.current);
      } else {
        acc.assets += account.balance.current;
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
          <p className="label">{`${label} : ${formatBalance(payload[0].value)}`}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-64 md:h-80 lg:h-96">
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
              <span className="text-sm font-medium text-pink-500 dark:text-pink-400">
                {formatBalance(groupData.liabilities)}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
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
    </div>
  );
}
