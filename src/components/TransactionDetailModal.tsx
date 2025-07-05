"use client";

import { useState } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { formatBalance } from "@/lib/formatters";
import { format } from "date-fns";
import { useDialogDismiss } from "@/lib/useDialogDismiss";

interface Transaction {
  id: string;
  name: string;
  amount: number;
  date: string;
  category?: string;
  merchantName?: string;
  pending: boolean;
  locationAddress?: string;
  locationCity?: string;
  locationRegion?: string;
  locationPostalCode?: string;
  paymentChannel?: string;
  personalFinanceCategory?: string;
  categoryAi?: string;
}

interface TransactionDetailModalProps {
  transaction: Transaction | null;
  isOpen: boolean;
  onClose: () => void;
  isMasked?: boolean;
}

export function TransactionDetailModal({ transaction, isOpen, onClose, isMasked = false }: TransactionDetailModalProps) {
  // Use the dialog dismiss hook - Transaction detail modal doesn't require input
  const dialogRef = useDialogDismiss({
    isOpen,
    onClose,
    allowEscape: true,
    allowClickOutside: true,
    requireInput: false,
  });

  if (!isOpen || !transaction) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div 
        ref={dialogRef}
        className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-zinc-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Transaction Details
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-4 flex-1 overflow-y-auto">
          {/* Transaction Name */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Transaction Name
            </h3>
            <p className="text-lg font-semibold text-gray-900 dark:text-white mt-1">
              {isMasked ? "••••••••••" : transaction.name}
            </p>
          </div>

          {/* Amount */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Amount
            </h3>
            <p className={`text-2xl font-bold mt-1 ${
              transaction.amount >= 0 
                ? 'text-red-600 dark:text-red-400' 
                : 'text-green-600 dark:text-green-400'
            }`}>
              {isMasked ? "••••••" : formatBalance(Math.abs(transaction.amount))}
            </p>
          </div>

          {/* Date */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Date
            </h3>
            <p className="text-gray-900 dark:text-white mt-1">
              {format(new Date(transaction.date), 'PPP')}
            </p>
          </div>

          {/* Status */}
          {transaction.pending && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Status
              </h3>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 mt-1">
                Pending
              </span>
            </div>
          )}

          {/* Merchant */}
          {transaction.merchantName && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Merchant
              </h3>
              <p className="text-gray-900 dark:text-white mt-1">
                {isMasked ? "••••••••••" : transaction.merchantName}
              </p>
            </div>
          )}

          {/* Category */}
          {(transaction.category || transaction.categoryAi) && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Category
              </h3>
              <p className="text-gray-900 dark:text-white mt-1">
                {transaction.categoryAi || transaction.category}
              </p>
            </div>
          )}

          {/* Payment Channel */}
          {transaction.paymentChannel && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Payment Method
              </h3>
              <p className="text-gray-900 dark:text-white mt-1 capitalize">
                {transaction.paymentChannel.replace('_', ' ')}
              </p>
            </div>
          )}

          {/* Location */}
          {(transaction.locationAddress || transaction.locationCity) && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Location
              </h3>
              <div className="text-gray-900 dark:text-white mt-1">
                {transaction.locationAddress && (
                  <p>{isMasked ? "••••••••••" : transaction.locationAddress}</p>
                )}
                {(transaction.locationCity || transaction.locationRegion) && (
                  <p>
                    {isMasked ? "••••••••••" : [transaction.locationCity, transaction.locationRegion, transaction.locationPostalCode]
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Personal Finance Category */}
          {transaction.personalFinanceCategory && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Personal Finance Category
              </h3>
              <p className="text-gray-900 dark:text-white mt-1 capitalize">
                {transaction.personalFinanceCategory.replace(/_/g, ' ')}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end items-center p-6 border-t border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 sticky bottom-0 z-10" style={{ boxShadow: '0 -2px 8px rgba(0,0,0,0.03)' }}>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
} 