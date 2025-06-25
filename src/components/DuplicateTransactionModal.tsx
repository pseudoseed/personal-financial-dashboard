"use client";

import { useState, useRef, useEffect } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { formatBalance } from "@/lib/formatters";
import { format } from "date-fns";
import { useDialogDismiss } from "@/lib/useDialogDismiss";

interface Transaction {
  id: string;
  name: string;
  amount: number;
  date: string;
  merchantName?: string;
}

interface DuplicateTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  duplicateTransactions: Transaction[];
  timeSpan?: any;
  isMasked?: boolean;
}

export function DuplicateTransactionModal({ 
  isOpen, 
  onClose, 
  duplicateTransactions, 
  timeSpan,
  isMasked = false
}: DuplicateTransactionModalProps) {
  const [sortField, setSortField] = useState<'date' | 'amount'>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Use the dialog dismiss hook - Duplicate transaction modal doesn't require input
  const dialogRef = useDialogDismiss({
    isOpen,
    onClose,
    allowEscape: true,
    allowClickOutside: true,
    requireInput: false,
  });

  // Sort transactions
  const sortedTransactions = [...duplicateTransactions].sort((a, b) => {
    let comparison = 0;
    
    if (sortField === 'date') {
      comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
    } else if (sortField === 'amount') {
      comparison = Math.abs(a.amount) - Math.abs(b.amount);
    }
    
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const handleSort = (field: 'date' | 'amount') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div 
        ref={dialogRef}
        className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-zinc-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Duplicate Transactions Detected
            </h2>
            {timeSpan && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Time span: {timeSpan.hours} hours, {timeSpan.minutes} minutes
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="mb-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Found {duplicateTransactions.length} transactions with similar amounts and timing.
            </p>
          </div>

          {/* Sort Controls */}
          <div className="mb-4 flex gap-2">
            <button
              onClick={() => handleSort('date')}
              className={`px-3 py-1 text-xs rounded ${
                sortField === 'date' 
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' 
                  : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
              }`}
            >
              Sort by Date {sortField === 'date' && (sortDirection === 'asc' ? '↑' : '↓')}
            </button>
            <button
              onClick={() => handleSort('amount')}
              className={`px-3 py-1 text-xs rounded ${
                sortField === 'amount' 
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' 
                  : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
              }`}
            >
              Sort by Amount {sortField === 'amount' && (sortDirection === 'asc' ? '↑' : '↓')}
            </button>
          </div>

          {/* Transactions List */}
          <div className="space-y-3">
            {sortedTransactions.map((transaction, index) => (
              <div
                key={transaction.id}
                className="p-4 border border-gray-200 dark:border-zinc-700 rounded-lg bg-gray-50 dark:bg-zinc-800"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                        #{index + 1}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {format(new Date(transaction.date), 'MMM d, yyyy HH:mm')}
                      </span>
                    </div>
                    
                    <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                      <p className={`font-semibold ${
                        transaction.amount >= 0 
                          ? 'text-red-600 dark:text-red-400' 
                          : 'text-green-600 dark:text-green-400'
                      }`}>
                        {isMasked ? "••••••" : formatBalance(Math.abs(transaction.amount))}
                      </p>
                      
                      <p className="font-medium">
                        {isMasked ? "••••••••••" : transaction.name}
                      </p>
                      
                      {transaction.merchantName && (
                        <p>Merchant: {isMasked ? "••••••••••" : transaction.merchantName}</p>
                      )}
                      
                      <p className="text-xs">
                        Transaction ID: {isMasked ? "••••••••" : transaction.id.slice(-8)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Time Analysis */}
          {timeSpan && (
            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <h3 className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-2">
                Time Analysis
              </h3>
              <p className="text-sm text-blue-700 dark:text-blue-400">
                These transactions occurred within {timeSpan.hours} hours and {timeSpan.minutes} minutes of each other, 
                which is unusually close timing for transactions of similar amounts.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 