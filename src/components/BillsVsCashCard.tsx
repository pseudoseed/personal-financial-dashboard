"use client";

import { useState, useEffect } from "react";
import { formatBalance } from "@/lib/formatters";

interface BillsData {
  totalBillsDueThisMonth: number;
  availableCash: number;
}

export function BillsVsCashCard() {
  const [data, setData] = useState<BillsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch("/api/bills");
        const result = await response.json();
        setData(result);
      } catch (error) {
        console.error("Error fetching bills data:", error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  const ratio = data && data.availableCash > 0 ? data.totalBillsDueThisMonth / data.availableCash : 0;
  const isHealthy = ratio < 0.5; // Example: healthy if bills are less than 50% of cash

  if (isLoading) {
    return (
      <div className="card p-4 bg-white dark:bg-black border border-gray-200 dark:border-gray-800">
        <h3 className="text-xl font-semibold text-surface-600 dark:text-gray-200 mb-3">
          Bills vs. Cash
        </h3>
        <div className="animate-pulse space-y-3">
            <div className="h-16 bg-gray-200 dark:bg-gray-800 rounded-lg"></div>
            <div className="h-16 bg-gray-200 dark:bg-gray-800 rounded-lg"></div>
            <div className="h-16 bg-gray-200 dark:bg-gray-800 rounded-lg"></div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
        <div className="card p-4 bg-white dark:bg-black border border-gray-200 dark:border-gray-800">
            <h3 className="text-xl font-semibold text-surface-600 dark:text-gray-200 mb-3">
              Bills vs. Cash
            </h3>
            <p>Could not load data.</p>
        </div>
    )
  }

  const netPosition = data.availableCash - data.totalBillsDueThisMonth;
  const isNetPositive = netPosition >= 0;

  return (
    <div className="card p-4 bg-white dark:bg-black border border-gray-200 dark:border-gray-800">
      <h3 className="text-xl font-semibold text-surface-600 dark:text-gray-200 mb-3">
        This Month at a Glance
      </h3>
      <div className="space-y-3">
        <div className={`p-3 rounded-lg ${isHealthy ? 'bg-green-50 dark:bg-green-900/20' : 'bg-pink-50 dark:bg-pink-900/20'}`}>
          <p className={`text-xs font-medium ${isHealthy ? 'text-green-700 dark:text-green-300' : 'text-pink-700 dark:text-pink-300'} mb-1`}>
            Upcoming Bills
          </p>
          <p className={`text-lg font-bold ${isHealthy ? 'text-green-700 dark:text-green-300' : 'text-pink-700 dark:text-pink-300'}`}>
            {formatBalance(data.totalBillsDueThisMonth)}
          </p>
        </div>
        
        <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
          <p className="text-xs font-medium text-purple-700 dark:text-purple-300 mb-1">
            Available Cash
          </p>
          <p className="text-lg font-bold text-purple-700 dark:text-purple-300">
            {formatBalance(data.availableCash)}
          </p>
        </div>

        <div className={`p-3 rounded-lg ${isNetPositive ? 'bg-green-50 dark:bg-green-900/20' : 'bg-pink-50 dark:bg-pink-900/20'}`}>
          <p className={`text-xs font-medium ${isNetPositive ? 'text-green-700 dark:text-green-300' : 'text-pink-700 dark:text-pink-300'} mb-1`}>
            Net Position
          </p>
          <p className={`text-lg font-bold ${isNetPositive ? 'text-green-700 dark:text-green-300' : 'text-pink-700 dark:text-pink-300'}`}>
            {formatBalance(netPosition)}
          </p>
        </div>
      </div>
    </div>
  );
} 