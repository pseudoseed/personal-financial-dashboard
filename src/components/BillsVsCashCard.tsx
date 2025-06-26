"use client";

import { useState, useEffect } from "react";
import { formatBalance } from "@/lib/formatters";
import { useSensitiveData } from "@/app/providers";
import { CalculationDetailsDialog } from "./CalculationDetailsDialog";

interface BillsData {
  totalBillsDueThisMonth: number;
  totalBillsDueNext30Days?: number;
  availableCash: number;
  expectedIncome?: number;
  accounts: Array<{
    id: string;
    name: string;
    type: string;
    balances: Array<{
      available: number;
      current: number;
    }>;
    lastStatementBalance?: number;
    minimumPaymentAmount?: number;
    nextPaymentDueDate?: string;
    pendingTransactions?: Array<{
      id: string;
      name: string;
      amount: number;
      date: string;
      merchantName?: string;
    }>;
  }>;
  recurringPayments?: Array<{
    id: string;
    name: string;
    amount: number;
    date: string;
    merchantName?: string;
  }>;
}

export function BillsVsCashCard() {
  const { showSensitiveData } = useSensitiveData();
  const [data, setData] = useState<BillsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState<"bills" | "cash" | "net" | "income">("bills");
  const [recurringPayments, setRecurringPayments] = useState<any[]>([]);

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

  useEffect(() => {
    async function fetchRecurringPayments() {
      try {
        const response = await fetch("/api/recurring-payments");
        const result = await response.json();
        setRecurringPayments(result);
      } catch (error) {
        // ignore
      }
    }
    fetchRecurringPayments();
  }, []);

  const netPosition = data ? (data.availableCash + (data.expectedIncome || 0)) - data.totalBillsDueThisMonth : 0;
  const isNetPositive = netPosition >= 0;
  const isHealthy = netPosition >= 0;

  const handleMetricClick = (metric: "bills" | "cash" | "net" | "income") => {
    setSelectedMetric(metric);
    setDialogOpen(true);
  };

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

  return (
    <>
      <div className="card p-4 bg-white dark:bg-black border border-gray-200 dark:border-gray-800">
        <h3 className="text-xl font-semibold text-surface-600 dark:text-gray-200 mb-3">
          This Month at a Glance
        </h3>
        <div className="space-y-3">
          <div 
            className={`p-3 rounded-lg cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:shadow-md ${isHealthy ? 'bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30' : 'bg-pink-50 dark:bg-pink-900/20 hover:bg-pink-100 dark:hover:bg-pink-900/30'}`}
            onClick={() => handleMetricClick("bills")}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleMetricClick("bills");
              }
            }}
          >
            <p className={`text-xs font-medium ${isHealthy ? 'text-green-700 dark:text-green-300' : 'text-pink-700 dark:text-pink-300'} mb-1`}>
              Upcoming Bills
            </p>
            <p className={`text-lg font-bold ${isHealthy ? 'text-green-700 dark:text-green-300' : 'text-pink-700 dark:text-pink-300'}`}>
              {showSensitiveData ? formatBalance(data.totalBillsDueThisMonth) : "••••••"}
            </p>
          </div>

          {/* Expected Income */}
          <div 
            className={`p-3 rounded-lg cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:shadow-md bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30`}
            onClick={() => handleMetricClick("income")}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleMetricClick("income");
              }
            }}
          >
            <p className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">
              Expected Income
            </p>
            <p className="text-lg font-bold text-blue-700 dark:text-blue-300">
              {showSensitiveData ? formatBalance(data.expectedIncome || 0) : "••••••"}
            </p>
          </div>

          {/* Available Cash */}
          <div 
            className={`p-3 rounded-lg cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:shadow-md bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30`}
            onClick={() => handleMetricClick("cash")}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleMetricClick("cash");
              }
            }}
          >
            <p className="text-xs font-medium text-green-700 dark:text-green-300 mb-1">
              Available Cash
            </p>
            <p className="text-lg font-bold text-green-700 dark:text-green-300">
              {showSensitiveData ? formatBalance(data.availableCash) : "••••••"}
            </p>
          </div>

          <div 
            className={`p-3 rounded-lg cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:shadow-md ${isNetPositive ? 'bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30' : 'bg-pink-50 dark:bg-pink-900/20 hover:bg-pink-100 dark:hover:bg-pink-900/30'}`}
            onClick={() => handleMetricClick("net")}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleMetricClick("net");
              }
            }}
          >
            <p className={`text-xs font-medium ${isNetPositive ? 'text-green-700 dark:text-green-300' : 'text-pink-700 dark:text-pink-300'} mb-1`}>
              Net Position
            </p>
            <p className={`text-lg font-bold ${isNetPositive ? 'text-green-700 dark:text-green-300' : 'text-pink-700 dark:text-pink-300'}`}>
              {showSensitiveData ? formatBalance(netPosition) : "••••••"}
            </p>
          </div>
        </div>
      </div>

      {/* Calculation Details Dialog */}
      {data && (
        <CalculationDetailsDialog
          isOpen={dialogOpen}
          onClose={() => setDialogOpen(false)}
          metricType={selectedMetric}
          data={{
            ...data,
            recurringPayments: recurringPayments,
          }}
        />
      )}
    </>
  );
} 