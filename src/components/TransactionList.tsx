"use client";

import { useState, useEffect } from "react";
import { Transaction } from "@prisma/client";
import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/outline";
import { useSensitiveData } from "@/app/providers";

interface TransactionListProps {
  accountId: string;
  initialTransactions: Transaction[];
  downloadLogs: any[];
}

export function TransactionList({
  accountId,
  initialTransactions,
  downloadLogs,
}: TransactionListProps) {
  const { showSensitiveData } = useSensitiveData();
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions);
  const [isTableExpanded, setIsTableExpanded] = useState(false);

  useEffect(() => {
    setTransactions(initialTransactions);
  }, [initialTransactions]);

  const displayAmount = (amount: number) => {
    return showSensitiveData ? `$${Math.abs(amount).toFixed(2)}` : "••••";
  };

  const displayTransactionName = (name: string) => {
    return showSensitiveData ? name : "••••••••••";
  };

  return (
    <div className="card">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-surface-600 dark:text-gray-200">
          Transactions
        </h2>
      </div>

      <div>
        <div
          className="flex justify-between items-center px-6 py-3 bg-gray-50 dark:bg-[rgb(46,46,46)] border-y border-gray-200 dark:border-zinc-700 cursor-pointer"
          onClick={() => setIsTableExpanded(!isTableExpanded)}
        >
          <h3 className="text-sm font-medium text-surface-600 dark:text-gray-400">
            Transaction Records
          </h3>
          {isTableExpanded ? (
            <ChevronUpIcon className="w-5 h-5 text-surface-600 dark:text-gray-400" />
          ) : (
            <ChevronDownIcon className="w-5 h-5 text-surface-600 dark:text-gray-400" />
          )}
        </div>

        {isTableExpanded && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-700">
              <thead className="bg-gray-50 dark:bg-[rgb(46,46,46)]">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-surface-600 dark:text-gray-400 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-surface-600 dark:text-gray-400 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-surface-600 dark:text-gray-400 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-surface-600 dark:text-gray-400 uppercase tracking-wider">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-zinc-900 divide-y divide-gray-200 dark:divide-zinc-700">
                {transactions.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-6 py-4 text-center text-sm text-surface-600 dark:text-gray-400"
                    >
                      No transactions found
                    </td>
                  </tr>
                ) : (
                  transactions.map((transaction) => (
                    <tr key={transaction.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-surface-600 dark:text-gray-400">
                        {new Date(transaction.date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-sm text-surface-900 dark:text-surface-dark-900">
                        {displayTransactionName(transaction.name)}
                        {transaction.pending && (
                          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-surface-600 dark:text-gray-400">
                        {(transaction as any).categoryAi || transaction.category || "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium">
                        <span
                          className={
                            transaction.amount < 0
                              ? "text-pink-500 dark:text-pink-400"
                              : "text-green-600"
                          }
                        >
                          {displayAmount(transaction.amount)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Download History */}
      <div className="mt-6">
        <div className="flex justify-between items-center px-6 py-3 bg-gray-50 dark:bg-[rgb(46,46,46)] border-y border-gray-200 dark:border-zinc-700">
          <h3 className="text-sm font-medium text-surface-600 dark:text-gray-400">
            Download History
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-700">
            <thead className="bg-gray-50 dark:bg-[rgb(46,46,46)]">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-surface-600 dark:text-gray-400 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-surface-600 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-surface-600 dark:text-gray-400 uppercase tracking-wider">
                  Transactions Added
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-zinc-900 divide-y divide-gray-200 dark:divide-zinc-700">
              {downloadLogs.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    className="px-6 py-4 text-center text-sm text-surface-600 dark:text-gray-400"
                  >
                    No download history found
                  </td>
                </tr>
              ) : (
                downloadLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-surface-600 dark:text-gray-400">
                      {new Date(log.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-surface-600 dark:text-gray-400">
                      {log.status}
                    </td>
                    <td className="px-6 py-4 text-sm text-surface-600 dark:text-gray-400">
                      {showSensitiveData ? log.transactionsAdded : "••"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
