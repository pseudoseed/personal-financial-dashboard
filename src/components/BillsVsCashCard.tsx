"use client";

import { useState, useEffect } from "react";
import { formatBalance } from "@/lib/formatters";
import { useSensitiveData } from "@/app/providers";
import { CalculationDetailsDialog } from "./CalculationDetailsDialog";
import { maskSensitiveValue } from '@/lib/ui';

interface UpcomingBill {
  id: string;
  accountName: string;
  dueDate: string;
  amount: number;
  minPayment: number;
  isOverdue: boolean;
  daysUntilDue: number;
  paymentStatus: string;
  category: string;
}

interface CashFlowForecast {
  next30Days: {
    income: number;
    expenses: number;
    netFlow: number;
    availableCash: number;
  };
}

interface EnhancedBillsData {
  upcomingBills: UpcomingBill[];
  cashFlowForecast: CashFlowForecast;
  recurringPayments?: any[];
  accounts?: any[];
}

function sumAllPendingBills(upcomingBills: UpcomingBill[]): number {
  return (upcomingBills || [])
    .filter((bill) => bill.paymentStatus === 'pending')
    .reduce((sum, bill) => sum + bill.amount, 0);
}

export function BillsVsCashCard() {
  const { showSensitiveData } = useSensitiveData();
  const [data, setData] = useState<EnhancedBillsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState<'bills' | 'cash' | 'net' | 'income'>('bills');

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch("/api/analytics/enhanced-bills");
        const result = await response.json();
        console.log('DEBUG: BillsVsCashCard enhanced bills data:', result);
        setData(result);
      } catch (error) {
        console.error("Error fetching enhanced bills data:", error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  let totalBillsDueThisMonth = 0;
  let expectedIncome = 0;
  let availableCash = 0;
  let netPosition = 0;

  if (data) {
    totalBillsDueThisMonth = sumAllPendingBills(data.upcomingBills);
    expectedIncome = data.cashFlowForecast?.next30Days?.income || 0;
    availableCash = data.cashFlowForecast?.next30Days?.availableCash || 0;
    netPosition = expectedIncome + availableCash - totalBillsDueThisMonth;
    console.log('DEBUG: BillsVsCashCard calculated values:', { totalBillsDueThisMonth, expectedIncome, availableCash, netPosition });
  }

  const isNetPositive = netPosition >= 0;
  const isHealthy = netPosition >= 0;

  const handleMetricClick = (metric: 'bills' | 'cash' | 'net' | 'income') => {
    setSelectedMetric(metric);
    setDialogOpen(true);
  };

  // Filter upcoming bills for the current month
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const upcomingBillsThisMonth = data?.upcomingBills?.filter(bill => {
    const due = new Date(bill.dueDate);
    return due.getMonth() === currentMonth && due.getFullYear() === currentYear;
  }) || [];

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
              {maskSensitiveValue(formatBalance(totalBillsDueThisMonth), showSensitiveData)}
            </p>
            {/* List individual upcoming bills for this month */}
            {upcomingBillsThisMonth.length > 0 ? (
              <ul className="mt-2 space-y-1">
                {upcomingBillsThisMonth.map(bill => (
                  <li key={bill.id} className="flex justify-between text-xs text-gray-700 dark:text-gray-300">
                    <span>{bill.accountName} ({bill.dueDate}):</span>
                    <span>{maskSensitiveValue(formatBalance(bill.amount), showSensitiveData)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-gray-500 mt-2">No bills due this month.</p>
            )}
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
              {maskSensitiveValue(formatBalance(expectedIncome), showSensitiveData)}
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
              {maskSensitiveValue(formatBalance(availableCash), showSensitiveData)}
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
              {maskSensitiveValue(formatBalance(netPosition), showSensitiveData)}
            </p>
          </div>
        </div>
      </div>
      <CalculationDetailsDialog
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        metricType={selectedMetric}
        data={{
          totalBillsDueThisMonth,
          availableCash,
          expectedIncome,
          recurringPayments: data.recurringPayments || [],
          accounts: data.accounts || [],
        }}
      />
    </>
  );
} 