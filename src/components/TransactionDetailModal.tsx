"use client";

import { useState } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { formatBalance } from "@/lib/formatters";
import { format } from "date-fns";

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
}

export function TransactionDetailModal({ transaction, isOpen, onClose }: TransactionDetailModalProps) {
  if (!isOpen || !transaction) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-zinc-800 rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Transaction Details
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Transaction Name */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Transaction Name
            </h3>
            <p className="text-lg font-semibold text-gray-900 dark:text-white mt-1">
              {transaction.name}
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
              {formatBalance(Math.abs(transaction.amount))}
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
                {transaction.merchantName}
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
                  <p>{transaction.locationAddress}</p>
                )}
                {(transaction.locationCity || transaction.locationRegion) && (
                  <p>
                    {[transaction.locationCity, transaction.locationRegion, transaction.locationPostalCode]
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
              <p className="text-gray-900 dark:text-white mt-1">
                {transaction.personalFinanceCategory.replace(/_/g, ' ')}
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end p-6 border-t border-gray-200 dark:border-gray-700">
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