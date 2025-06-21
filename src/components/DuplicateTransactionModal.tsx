"use client";

import { XMarkIcon } from "@heroicons/react/24/outline";
import { formatBalance } from "@/lib/formatters";
import { format } from "date-fns";

interface DuplicateTransaction {
  id: string;
  name: string;
  amount: number;
  date: string;
  merchantName?: string;
  accountId: string;
}

interface DuplicateTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  duplicateTransactions: DuplicateTransaction[];
  timeSpan?: {
    first: string;
    last: string;
    hoursDiff: number;
  };
}

export function DuplicateTransactionModal({ 
  isOpen, 
  onClose, 
  duplicateTransactions, 
  timeSpan 
}: DuplicateTransactionModalProps) {
  if (!isOpen || !duplicateTransactions || duplicateTransactions.length < 2) return null;

  // Sort transactions by date
  const sortedTransactions = [...duplicateTransactions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-zinc-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Duplicate Charge Detection
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {duplicateTransactions.length} duplicate transactions found
              {timeSpan && (
                <span className="ml-2">
                  • {timeSpan.hoursDiff.toFixed(1)} hours apart
                </span>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          {/* Summary */}
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
            <div className="flex items-center space-x-2 mb-2">
              <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
              <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                Potential Duplicate Charges
              </h3>
            </div>
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              {sortedTransactions[0].name} • {formatBalance(Math.abs(sortedTransactions[0].amount))}
            </p>
            {sortedTransactions[0].merchantName && (
              <p className="text-sm text-yellow-600 dark:text-yellow-400">
                Merchant: {sortedTransactions[0].merchantName}
              </p>
            )}
          </div>

          {/* Transactions List */}
          <div className="space-y-4">
            {sortedTransactions.map((transaction, index) => (
              <div
                key={transaction.id}
                className={`p-4 rounded-lg border ${
                  index === 0 
                    ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' 
                    : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded ${
                          index === 0
                            ? 'bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300'
                            : 'bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-300'
                        }`}
                      >
                        {index === 0 ? 'FIRST' : `DUPLICATE ${index}`}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {format(new Date(transaction.date), 'MMM d, yyyy h:mm a')}
                      </span>
                    </div>
                    
                    <h4 className="font-medium text-gray-900 dark:text-white mb-1">
                      {transaction.name}
                    </h4>
                    
                    <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                      <p className={`font-semibold ${
                        transaction.amount >= 0 
                          ? 'text-red-600 dark:text-red-400' 
                          : 'text-green-600 dark:text-green-400'
                      }`}>
                        {formatBalance(Math.abs(transaction.amount))}
                      </p>
                      
                      {transaction.merchantName && (
                        <p>Merchant: {transaction.merchantName}</p>
                      )}
                      
                      <p className="text-xs">
                        Transaction ID: {transaction.id.slice(-8)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Time Analysis */}
          {timeSpan && (
            <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Time Analysis
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">First Charge:</span>
                  <p className="text-gray-900 dark:text-white">
                    {format(new Date(timeSpan.first), 'MMM d, yyyy h:mm a')}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Last Charge:</span>
                  <p className="text-gray-900 dark:text-white">
                    {format(new Date(timeSpan.last), 'MMM d, yyyy h:mm a')}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Time Span:</span>
                  <p className="text-gray-900 dark:text-white">
                    {timeSpan.hoursDiff.toFixed(1)} hours
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Recommendations */}
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
              What to do next:
            </h3>
            <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
              <li>• Review each transaction to confirm if they're actual duplicates</li>
              <li>• Check if one transaction is pending and will be removed</li>
              <li>• Contact the merchant if you believe this is an error</li>
              <li>• Consider dismissing this type of transaction if it's legitimate</li>
            </ul>
          </div>
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