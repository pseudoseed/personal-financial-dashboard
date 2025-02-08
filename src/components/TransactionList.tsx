"use client";

import { useState } from "react";
import { Transaction, TransactionDownloadLog } from "@prisma/client";

interface TransactionListProps {
  accountId: string;
  initialTransactions: Transaction[];
  downloadLogs: TransactionDownloadLog[];
}

export function TransactionList({
  accountId,
  initialTransactions,
  downloadLogs,
}: TransactionListProps) {
  const [transactions, setTransactions] = useState(initialTransactions);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/accounts/${accountId}/transactions`, {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to download transactions");
      }

      const data = await response.json();

      // Refresh the page to show new transactions
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAll = async () => {
    if (
      !confirm(
        "Are you sure you want to delete ALL transactions and download logs? This cannot be undone."
      )
    ) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/accounts/${accountId}/transactions/delete-all`,
        {
          method: "POST",
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete transactions");
      }

      const data = await response.json();
      alert(data.message);

      // Refresh the page to show changes
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-900">Transactions</h2>
          <div className="flex gap-2">
            <button
              onClick={handleDeleteAll}
              disabled={isLoading}
              className={`px-4 py-2 rounded-md text-white ${
                isLoading
                  ? "bg-gray-400"
                  : "bg-red-600 hover:bg-red-700 active:bg-red-800"
              }`}
              title="Delete all transactions and download logs"
            >
              Delete All
            </button>
            <button
              onClick={handleDownload}
              disabled={isLoading}
              className={`px-4 py-2 rounded-md text-white ${
                isLoading
                  ? "bg-gray-400"
                  : "bg-blue-600 hover:bg-blue-700 active:bg-blue-800"
              }`}
            >
              {isLoading ? "Downloading..." : "Download Transactions"}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="px-6 py-3 bg-red-100 border border-red-400 text-red-700">
          {error}
        </div>
      )}

      {/* Download History */}
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-sm font-medium text-gray-500 mb-2">
          Download History
        </h3>
        <div className="bg-gray-50 rounded-md p-2 text-sm">
          {downloadLogs.length === 0 ? (
            <p className="text-gray-500">No previous downloads</p>
          ) : (
            <ul className="space-y-2">
              {downloadLogs.slice(0, 5).map((log) => (
                <li
                  key={log.id}
                  className="flex justify-between items-center text-sm"
                >
                  <span>
                    {new Date(log.createdAt).toLocaleDateString()} -{" "}
                    {log.numTransactions} transactions
                  </span>
                  <span
                    className={`px-2 py-1 rounded-full text-xs ${
                      log.status === "success"
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {log.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Transactions Table */}
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
              transactions.map((transaction) => (
                <tr key={transaction.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(transaction.date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {transaction.name}
                    {transaction.pending && (
                      <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                        Pending
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {transaction.category || "-"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium">
                    <span
                      className={
                        transaction.amount < 0
                          ? "text-red-600"
                          : "text-green-600"
                      }
                    >
                      ${Math.abs(transaction.amount).toFixed(2)}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
