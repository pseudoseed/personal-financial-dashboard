"use client";

import React from "react";
import { CalculatorIcon } from "@heroicons/react/24/outline";
import { formatBalance } from "@/lib/formatters";
import { useSensitiveData } from "@/app/providers";
import { LoanDetails } from "@/types/loan";
import { Modal } from "@/components/ui/Modal";

interface LoanCalculationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  loan: LoanDetails & {
    account?: {
      id: string;
      name: string;
      type: string;
      balance: {
        current: number;
        available?: number | null;
        limit?: number | null;
      };
      balances?: Array<{ current: number; date: Date }>;
      nextMonthlyPayment?: number | null;
    };
    calculations?: {
      remainingPayments: number;
      totalInterest: number;
      payoffDate: Date;
      optimalPayment: number;
      interestSavings: number;
    };
  };
}

export function LoanCalculationDialog({ 
  isOpen, 
  onClose, 
  loan 
}: LoanCalculationDialogProps) {
  const { showSensitiveData } = useSensitiveData();

  const currentBalance = loan.account?.balance?.current || 0;
  const interestRate = loan.currentInterestRate || 0;
  const paymentsPerMonth = loan.paymentsPerMonth || 1;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Loan Calculations"
      subtitle={loan.account?.name || 'Unknown Account'}
      icon={<CalculatorIcon className="w-6 h-6 text-green-500" />}
      maxWidth="max-w-2xl"
    >
      {/* Current Loan Info */}
      <div className="bg-gray-50 dark:bg-zinc-700 rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Current Loan Information
        </h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600 dark:text-gray-400">Current Balance:</span>
            <div className="font-medium text-gray-900 dark:text-white">
              {showSensitiveData ? formatBalance(currentBalance) : '••••••'}
            </div>
          </div>
          <div>
            <span className="text-gray-600 dark:text-gray-400">Interest Rate:</span>
            <div className="font-medium text-gray-900 dark:text-white">
              {showSensitiveData ? `${interestRate.toFixed(2)}%` : '••••••'}
            </div>
          </div>
          <div>
            <span className="text-gray-600 dark:text-gray-400">Payments per Month:</span>
            <div className="font-medium text-gray-900 dark:text-white">
              {paymentsPerMonth}
            </div>
          </div>
          <div>
            <span className="text-gray-600 dark:text-gray-400">Monthly Rate:</span>
            <div className="font-medium text-gray-900 dark:text-white">
              {showSensitiveData ? `${(interestRate / 12).toFixed(4)}%` : '••••••'}
            </div>
          </div>
        </div>
      </div>

      {/* Calculation Results */}
      {loan.calculations ? (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Calculation Results
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
              <h4 className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">
                Payment Information
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-blue-600 dark:text-blue-400">Remaining Payments:</span>
                  <span className="font-medium text-blue-700 dark:text-blue-300">
                    {loan.calculations.remainingPayments}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-600 dark:text-blue-400">Optimal Payment:</span>
                  <span className="font-medium text-blue-700 dark:text-blue-300">
                    {showSensitiveData ? formatBalance(loan.calculations.optimalPayment) : '••••••'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-600 dark:text-blue-400">Payoff Date:</span>
                  <span className="font-medium text-blue-700 dark:text-blue-300">
                    {new Date(loan.calculations.payoffDate).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
              <h4 className="text-sm font-medium text-green-700 dark:text-green-300 mb-2">
                Interest Analysis
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-green-600 dark:text-green-400">Total Interest:</span>
                  <span className="font-medium text-green-700 dark:text-green-300">
                    {showSensitiveData ? formatBalance(loan.calculations.totalInterest) : '••••••'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-green-600 dark:text-green-400">Interest Savings:</span>
                  <span className="font-medium text-green-700 dark:text-green-300">
                    {showSensitiveData ? formatBalance(loan.calculations.interestSavings) : '••••••'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-green-600 dark:text-green-400">Interest Rate:</span>
                  <span className="font-medium text-green-700 dark:text-green-300">
                    {showSensitiveData ? `${interestRate.toFixed(2)}%` : '••••••'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Scenarios */}
          <div className="bg-gray-50 dark:bg-zinc-700 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Payment Scenarios
            </h4>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center p-2 bg-white dark:bg-zinc-600 rounded">
                <div>
                  <span className="font-medium text-gray-900 dark:text-white">Minimum Payment</span>
                  <div className="text-gray-600 dark:text-gray-400">
                    Standard monthly payment
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium text-gray-900 dark:text-white">
                    {showSensitiveData ? formatBalance(loan.account?.nextMonthlyPayment || 0) : '••••••'}
                  </div>
                  <div className="text-gray-600 dark:text-gray-400">
                    {loan.calculations.remainingPayments} payments
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center p-2 bg-green-100 dark:bg-green-900/30 rounded">
                <div>
                  <span className="font-medium text-green-700 dark:text-green-300">Optimal Payment</span>
                  <div className="text-green-600 dark:text-green-400">
                    Pay off faster, save interest
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium text-green-700 dark:text-green-300">
                    {showSensitiveData ? formatBalance(loan.calculations.optimalPayment) : '••••••'}
                  </div>
                  <div className="text-green-600 dark:text-green-400">
                    {Math.ceil(loan.calculations.remainingPayments * 0.7)} payments
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center p-2 bg-blue-100 dark:bg-blue-900/30 rounded">
                <div>
                  <span className="font-medium text-blue-700 dark:text-blue-300">Aggressive Payment</span>
                  <div className="text-blue-600 dark:text-blue-400">
                    Maximum payment to pay off quickly
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium text-blue-700 dark:text-blue-300">
                    {showSensitiveData ? formatBalance(loan.calculations.optimalPayment * 1.5) : '••••••'}
                  </div>
                  <div className="text-blue-600 dark:text-blue-400">
                    {Math.ceil(loan.calculations.remainingPayments * 0.5)} payments
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-8">
          <CalculatorIcon className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Calculations Not Available
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Loan calculation data is not available. This may be due to missing loan information.
          </p>
        </div>
      )}

      {/* Calculation Method */}
      <div className="bg-gray-50 dark:bg-zinc-700 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Calculation Method
        </h4>
        <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
          <p>• Uses standard amortization formula</p>
          <p>• Assumes fixed interest rate throughout loan term</p>
          <p>• Optimal payment calculated to minimize total interest</p>
          <p>• Payoff scenarios based on different payment amounts</p>
        </div>
      </div>
    </Modal>
  );
} 