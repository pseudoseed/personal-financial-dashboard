"use client";

import React, { useState, useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import { XMarkIcon, InformationCircleIcon } from "@heroicons/react/24/outline";
import { formatBalance } from "@/lib/formatters";
import { useSensitiveData } from "@/app/providers";
import { useDialogDismiss } from "@/lib/useDialogDismiss";
import { getExpectedIncomeForMonth, calculateNextPaymentDate } from "@/lib/recurringPaymentUtils";

interface CalculationDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  metricType: "bills" | "cash" | "net" | "income";
  data: {
    totalBillsDueThisMonth: number;
    availableCash: number;
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
    expectedIncome?: number;
    recurringPayments?: Array<{
      id: string;
      name: string;
      amount: number;
      frequency: string;
      dayOfWeek?: string;
      dayOfMonth?: number;
      nextPaymentDate: string;
    }>;
  };
}

export function CalculationDetailsDialog({ 
  isOpen, 
  onClose, 
  metricType, 
  data 
}: CalculationDetailsDialogProps) {
  const { showSensitiveData } = useSensitiveData();
  const dialogRef = useDialogDismiss({
    isOpen,
    onClose,
    allowEscape: true,
    allowClickOutside: true,
    requireInput: false,
  });
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Handle ESC key and click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    const handleClickOutside = (event: MouseEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    // Add event listeners
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);

    // Prevent body scroll when dialog is open
    document.body.style.overflow = 'hidden';

    // Cleanup
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Don't render if not open
  if (!isOpen) {
    return null;
  }

  const getMetricInfo = () => {
    switch (metricType) {
      case "bills":
        return {
          title: "Upcoming Bills Calculation",
          description: "Statement balances due in the next 30 days",
          accounts: data.accounts.filter(account => 
            (account.type === "credit" || account.type === "loan") && 
            account.nextPaymentDueDate
          ).filter(account => {
            const dueDate = new Date(account.nextPaymentDueDate!);
            const now = new Date();
            const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 30);
            return dueDate >= startDate && dueDate <= endDate;
          }),
          total: data.totalBillsDueThisMonth,
          calculation: "Statement balances for credit/loan accounts with due dates in the next 30 days"
        };
      case "income":
        return {
          title: "Expected Income Calculation",
          description: "Expected income from recurring payments this month",
          accounts: [],
          total: data.expectedIncome || 0,
          calculation: "Sum of expected income from active recurring payments due this month",
          payDates: data.recurringPayments ? data.recurringPayments.map(payment => {
            const payDates = [];
            let paymentDate = new Date(payment.nextPaymentDate);
            const now = new Date();
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            let iterations = 0;
            // Move to first pay date in this month
            while (paymentDate < monthStart) {
              if (iterations++ > 50) {
                break;
              }
              paymentDate = calculateNextPaymentDate(
                paymentDate,
                payment.frequency,
                payment.dayOfWeek !== undefined ? parseInt(payment.dayOfWeek as any) : undefined,
                payment.dayOfMonth
              );
            }
            iterations = 0;
            // Collect all pay dates in this month
            while (paymentDate <= monthEnd) {
              if (iterations++ > 50) {
                break;
              }
              payDates.push(new Date(paymentDate));
              paymentDate = calculateNextPaymentDate(
                paymentDate,
                payment.frequency,
                payment.dayOfWeek !== undefined ? parseInt(payment.dayOfWeek as any) : undefined,
                payment.dayOfMonth
              );
            }
            return { ...payment, payDates };
          }) : []
        };
      case "cash":
        return {
          title: "Available Cash Calculation",
          description: "Available balances from all depository accounts",
          accounts: data.accounts.filter(account => account.type === "depository"),
          total: data.availableCash,
          calculation: "Sum of available balances from checking and savings accounts"
        };
      case "net":
        return {
          title: "Net Position Calculation",
          description: "Available cash plus expected income minus upcoming bills",
          accounts: [],
          total: (data.availableCash + (data.expectedIncome || 0)) - data.totalBillsDueThisMonth,
          calculation: `Available Cash (${formatBalance(data.availableCash)}) + Expected Income (${formatBalance(data.expectedIncome || 0)}) - Upcoming Bills (${formatBalance(data.totalBillsDueThisMonth)})`
        };
    }
  };

  const metricInfo = getMetricInfo();
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 30);

  // Calculate pending charges for credit accounts
  const getPendingCharges = (account: any) => {
    if (account.type === "credit" && account.balances[0] && account.lastStatementBalance) {
      const currentBalance = account.balances[0].current;
      const statementBalance = account.lastStatementBalance;
      return currentBalance - statementBalance;
    }
    return 0;
  };

  const dialogContent = (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div 
        ref={dialogRef}
        className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-zinc-700">
          <div className="flex items-center space-x-3">
            <InformationCircleIcon className="w-6 h-6 text-blue-500" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {metricInfo.title}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {metricInfo.description}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Calculation Summary */}
          <div className="bg-gray-50 dark:bg-zinc-700 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Calculation Method
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {metricInfo.calculation}
            </p>
            {metricType === "bills" && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                <strong>Time window:</strong> {startDate.toLocaleDateString()} to {endDate.toLocaleDateString()} (30 days)
              </p>
            )}
          </div>

          {/* Total */}
          <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p className="text-sm text-blue-700 dark:text-blue-300 mb-1">Total</p>
            <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
              {showSensitiveData ? formatBalance(metricInfo.total) : "••••••"}
            </p>
          </div>

          {/* Pending Charges Summary for Bills */}
          {metricType === "bills" && (() => {
            const totalPendingCharges = (data.accounts || [])
              .filter(account => account.type === "credit")
              .reduce((sum, account) => sum + getPendingCharges(account), 0);
            
            if (totalPendingCharges > 0) {
              return (
                <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-orange-700 dark:text-orange-300 mb-2">
                    Balance Discrepancy Explanation
                  </h3>
                  <div className="space-y-2 text-sm text-orange-600 dark:text-orange-400">
                    <p>
                      <strong>Total Pending Charges:</strong> {showSensitiveData ? formatBalance(totalPendingCharges) : "••••••"}
                    </p>
                    <p>
                      The "Upcoming Bills" amount shows statement balances (what's actually due), 
                      but your current credit card balances include pending charges that haven't 
                      been added to your statement yet.
                    </p>
                    <p>
                      <strong>Current Total Credit Balance:</strong> {showSensitiveData ? formatBalance(
                        (data.accounts || [])
                          .filter(account => account.type === "credit")
                          .reduce((sum, account) => sum + (account.balances[0]?.current || 0), 0)
                      ) : "••••••"}
                    </p>
                  </div>
                </div>
              );
            }
            return null;
          })()}

          {/* Account Breakdown */}
          {metricInfo.accounts.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Account Breakdown
              </h3>
              <div className="space-y-3">
                {metricInfo.accounts.map((account) => {
                  let amount = 0;
                  let details = "";
                  let pendingCharges = 0;

                  if (metricType === "bills") {
                    amount = account.lastStatementBalance || 0;
                    const dueDate = new Date(account.nextPaymentDueDate!);
                    details = `Due: ${dueDate.toLocaleDateString()}`;
                    pendingCharges = getPendingCharges(account);
                  } else if (metricType === "cash") {
                    amount = account.balances[0]?.available || 0;
                    details = `Available balance`;
                  }

                  return (
                    <div key={account.id} className="p-3 bg-gray-50 dark:bg-zinc-700 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {account.name}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {account.type.charAt(0).toUpperCase() + account.type.slice(1)} • {details}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-gray-900 dark:text-white">
                            {showSensitiveData ? formatBalance(amount) : "••••••"}
                          </p>
                        </div>
                      </div>
                      
                      {/* Show balance breakdown for credit cards */}
                      {metricType === "bills" && account.type === "credit" && account.balances[0] && (
                        <div className="mt-2 pt-2 border-t border-gray-200 dark:border-zinc-600">
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400">Statement Balance:</span>
                              <span className="font-medium text-gray-900 dark:text-white">
                                {showSensitiveData ? formatBalance(account.lastStatementBalance || 0) : "••••••"}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400">Current Balance:</span>
                              <span className="font-medium text-gray-900 dark:text-white">
                                {showSensitiveData ? formatBalance(account.balances[0].current) : "••••••"}
                              </span>
                            </div>
                            {pendingCharges > 0 && (
                              <div className="flex justify-between col-span-2">
                                <span className="text-orange-600 dark:text-orange-400">Pending Charges:</span>
                                <span className="font-medium text-orange-600 dark:text-orange-400">
                                  {showSensitiveData ? formatBalance(pendingCharges) : "••••••"}
                                </span>
                              </div>
                            )}
                          </div>
                          
                          {/* Show pending transactions */}
                          {account.pendingTransactions && account.pendingTransactions.length > 0 && (
                            <div className="mt-3 pt-2 border-t border-gray-200 dark:border-zinc-600">
                              <p className="text-xs font-medium text-orange-600 dark:text-orange-400 mb-2">
                                Pending Transactions:
                              </p>
                              <div className="space-y-1">
                                {account.pendingTransactions.slice(0, 5).map((tx) => (
                                  <div key={tx.id} className="flex justify-between text-xs">
                                    <span className="text-gray-600 dark:text-gray-400 truncate max-w-[120px]">
                                      {tx.merchantName || tx.name}
                                    </span>
                                    <span className="font-medium text-orange-600 dark:text-orange-400">
                                      {showSensitiveData ? formatBalance(tx.amount) : "••••••"}
                                    </span>
                                  </div>
                                ))}
                                {account.pendingTransactions.length > 5 && (
                                  <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
                                    +{account.pendingTransactions.length - 5} more pending
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Net Position Details */}
          {metricType === "net" && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Calculation Details
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <div>
                    <p className="font-medium text-green-700 dark:text-green-300">Available Cash</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-green-700 dark:text-green-300">
                      {showSensitiveData ? formatBalance(data.availableCash) : "••••••"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-center">
                  <span className="text-gray-500 dark:text-gray-400">−</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <div>
                    <p className="font-medium text-red-700 dark:text-red-300">Upcoming Bills</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-red-700 dark:text-red-300">
                      {showSensitiveData ? formatBalance(data.totalBillsDueThisMonth) : "••••••"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-center">
                  <span className="text-gray-500 dark:text-gray-400">=</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div>
                    <p className="font-medium text-blue-700 dark:text-blue-300">Net Position</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-blue-700 dark:text-blue-300">
                      {showSensitiveData ? formatBalance(metricInfo.total) : "••••••"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Income Details */}
          {metricType === "income" && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Recurring Payments
              </h3>
              <div className="space-y-3">
                {Array.isArray(metricInfo.payDates) && metricInfo.payDates.map((payment) => (
                  <div key={payment.id} className="p-3 bg-gray-50 dark:bg-zinc-700 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {payment.name}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {payment.frequency}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {showSensitiveData ? formatBalance(payment.amount) : "••••••"}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 pt-2 border-t border-gray-200 dark:border-zinc-600">
                      <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                        Pay Dates:
                      </p>
                      <div className="space-y-1">
                        {payment.payDates.map((payDate) => (
                          <div key={payDate.toISOString()} className="flex justify-between text-xs">
                            <span className="text-gray-600 dark:text-gray-400">
                              {payDate.toLocaleDateString()}
                            </span>
                            <span className="font-medium text-gray-900 dark:text-white">
                              {showSensitiveData ? formatBalance(payment.amount) : "••••••"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (!isMounted) {
    return null;
  }

  return ReactDOM.createPortal(
    dialogContent,
    document.getElementById("dialog-root") as HTMLElement
  );
} 