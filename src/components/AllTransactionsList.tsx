"use client";

import { useQuery } from "@tanstack/react-query";
import { useSensitiveData } from "@/app/providers";

interface Transaction {
  id: string;
  name: string;
  amount: number;
  date: string;
  category?: string;
  pending: boolean;
  categoryAi?: string;
}

interface AllTransactionsListProps {}

export function AllTransactionsList({}: AllTransactionsListProps) {
  const { showSensitiveData } = useSensitiveData();

  const { data: transactions, isLoading, error } = useQuery<Transaction[]>({
    queryKey: ["allTransactions"],
    queryFn: async () => {
      const response = await fetch("/api/transactions");
      if (!response.ok) throw new Error("Failed to fetch transactions");
      return response.json();
    },
  });

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-md">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            All Transactions
          </h2>
          <div className="animate-pulse space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-md">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            All Transactions
          </h2>
          <p className="text-red-600 dark:text-red-400">
            Error loading transactions: {error.message}
          </p>
        </div>
      </div>
    );
  }

  if (!transactions || transactions.length === 0) {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-md">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            All Transactions
          </h2>
          <p className="text-gray-500 dark:text-gray-400">
            No transactions found. Connect your accounts to see transaction data.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-md">
      <div className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          All Transactions
        </h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {transactions.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-6 py-4 text-center text-sm text-gray-500"
                  >
                    No transactions found
                  </td>
                </tr>
              ) : (
                transactions.slice(0, 100).map((transaction: Transaction) => (
                  <tr key={transaction.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(transaction.date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {showSensitiveData ? transaction.name : '••••••••••'}
                      {transaction.pending && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {(() => {
                        const categoryAi = transaction.categoryAi;
                        const category = transaction.category;
                        const displayCategory = categoryAi || category || "-";
                        
                        // Debug: Log category values for first few transactions
                        if (transactions.indexOf(transaction) < 3) {
                          console.log(`[DEBUG ${new Date().toISOString()}] Category display:`, {
                            id: transaction.id,
                            name: transaction.name,
                            category,
                            categoryAi,
                            displayCategory
                          });
                        }
                        
                        return displayCategory;
                      })()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium">
                      <span
                        className={
                          transaction.amount < 0
                            ? "text-pink-500 dark:text-pink-400"
                            : "text-green-600"
                        }
                      >
                        {showSensitiveData ? `$${Math.abs(transaction.amount).toFixed(2)}` : '••••'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {transactions.length > 100 && (
            <div className="px-6 py-4 text-center text-sm text-gray-500">
              Showing first 100 transactions. Use account-specific views for more details.
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 