"use client";

import { useState, useEffect } from "react";
import { Transaction } from "@prisma/client";

interface AllTransactionsListProps {
  isMasked?: boolean;
}

export function AllTransactionsList({ isMasked = false }: AllTransactionsListProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTableExpanded, setIsTableExpanded] = useState(false);

  useEffect(() => {
    fetchTransactions();
  }, []);

  // Remove automatic AI categorization to avoid timing issues
  // useEffect(() => {
  //   if (transactions.length > 0) {
  //     triggerAICategorization();
  //   }
  // }, [transactions.length]);

  const triggerAICategorization = async () => {
    try {
      // Send transactions to AI for categorization
      const response = await fetch('/api/ai/categorize-transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions: transactions.slice(0, 50) }), // Limit to first 50 for performance
      });
      
      if (response.ok) {
        // Refresh transactions after categorization
        setTimeout(() => fetchTransactions(), 1000);
      }
    } catch (err) {
      console.error('Failed to trigger AI categorization:', err);
    }
  };

  const fetchTransactions = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/transactions?t=${Date.now()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch transactions');
      }
      const data = await response.json();
      setTransactions(data.transactions || []);
      
      // Debug: Log the first few transactions to see if categoryAi is present
      if (data.transactions && data.transactions.length > 0) {
        console.log(`[DEBUG ${new Date().toISOString()}] First 3 transactions:`, data.transactions.slice(0, 3).map((t: any) => ({
          id: t.id,
          name: t.name,
          category: t.category,
          categoryAi: t.categoryAi
        })));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = () => {
    fetchTransactions();
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">All Transactions</h2>
        </div>
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-100 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">All Transactions</h2>
        </div>
        <div className="p-6">
          <div className="px-6 py-3 bg-pink-100 border border-pink-400 text-pink-800 rounded">
            {error}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-900">All Transactions</h2>
          <div className="flex gap-2">
            <button
              onClick={handleRefresh}
              className="text-sm text-gray-600 hover:text-gray-900 px-2 py-1 rounded hover:bg-gray-100"
              title="Refresh transactions"
            >
              ↻ Refresh
            </button>
            <button
              onClick={triggerAICategorization}
              className="text-sm text-blue-600 hover:text-blue-900 px-2 py-1 rounded hover:bg-blue-100"
              title="Categorize transactions with AI"
            >
              🤖 AI Categorize
            </button>
            <button
              onClick={() => setIsTableExpanded(!isTableExpanded)}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              {isTableExpanded ? 'Hide' : 'Show'} Transactions
            </button>
          </div>
        </div>
      </div>

      {isTableExpanded && (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
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
                transactions.slice(0, 100).map((transaction) => (
                  <tr key={transaction.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(transaction.date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {isMasked ? '••••••••••' : transaction.name}
                      {transaction.pending && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {(() => {
                        const categoryAi = (transaction as any).categoryAi;
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
                        {isMasked ? '••••' : `$${Math.abs(transaction.amount).toFixed(2)}`}
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
      )}
    </div>
  );
} 