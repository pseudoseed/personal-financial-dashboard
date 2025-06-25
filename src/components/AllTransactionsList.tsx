"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSensitiveData } from "@/app/providers";
import { Pagination, SortConfig, SortableHeader } from "@/components/ui/Pagination";
import { TransactionTableSkeleton } from "@/components/LoadingStates";

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
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: "date",
    direction: "desc",
  });

  const { data: transactions, isLoading, error } = useQuery<Transaction[]>({
    queryKey: ["allTransactions"],
    queryFn: async () => {
      const response = await fetch("/api/transactions");
      if (!response.ok) throw new Error("Failed to fetch transactions");
      return response.json();
    },
  });

  // Sort and paginate transactions
  const sortedAndPaginatedTransactions = useMemo(() => {
    if (!transactions) return { transactions: [], totalPages: 0 };

    let sorted = [...transactions];

    // Sort transactions
    sorted.sort((a, b) => {
      const aValue = a[sortConfig.key as keyof Transaction];
      const bValue = b[sortConfig.key as keyof Transaction];

      if (typeof aValue === "string" && typeof bValue === "string") {
        // Handle date strings specially
        if (sortConfig.key === "date") {
          const aDate = new Date(aValue);
          const bDate = new Date(bValue);
          const comparison = aDate.getTime() - bDate.getTime();
          return sortConfig.direction === "asc" ? comparison : -comparison;
        }
        
        const comparison = aValue.localeCompare(bValue);
        return sortConfig.direction === "asc" ? comparison : -comparison;
      }

      if (typeof aValue === "number" && typeof bValue === "number") {
        const comparison = aValue - bValue;
        return sortConfig.direction === "asc" ? comparison : -comparison;
      }

      return 0;
    });

    // Calculate pagination
    const totalPages = Math.ceil(sorted.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginated = sorted.slice(startIndex, endIndex);

    return { transactions: paginated, totalPages };
  }, [transactions, sortConfig, currentPage, itemsPerPage]);

  const handleSort = (key: string) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
    setCurrentPage(1); // Reset to first page when sorting
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1); // Reset to first page when changing items per page
  };

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-md">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            All Transactions
          </h2>
          <TransactionTableSkeleton rowCount={10} />
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

  const { transactions: paginatedTransactions, totalPages } = sortedAndPaginatedTransactions;

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-md">
      <div className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          All Transactions ({transactions.length})
        </h2>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <SortableHeader
                  column={{ key: "date", label: "Date" }}
                  sortConfig={sortConfig}
                  onSort={handleSort}
                >
                  Date
                </SortableHeader>
                <SortableHeader
                  column={{ key: "name", label: "Description" }}
                  sortConfig={sortConfig}
                  onSort={handleSort}
                >
                  Description
                </SortableHeader>
                <SortableHeader
                  column={{ key: "categoryAi", label: "Category" }}
                  sortConfig={sortConfig}
                  onSort={handleSort}
                >
                  Category
                </SortableHeader>
                <SortableHeader
                  column={{ key: "amount", label: "Amount" }}
                  sortConfig={sortConfig}
                  onSort={handleSort}
                >
                  Amount
                </SortableHeader>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedTransactions.map((transaction: Transaction) => (
                <tr key={transaction.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {new Date(transaction.date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                    {showSensitiveData ? transaction.name : '••••••••••'}
                    {transaction.pending && (
                      <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                        Pending
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {transaction.categoryAi || transaction.category || "-"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium">
                    <span
                      className={
                        transaction.amount < 0
                          ? "text-pink-500 dark:text-pink-400"
                          : "text-green-600 dark:text-green-400"
                      }
                    >
                      {showSensitiveData ? `$${Math.abs(transaction.amount).toFixed(2)}` : '••••'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={transactions.length}
            itemsPerPage={itemsPerPage}
            onPageChange={handlePageChange}
            onItemsPerPageChange={handleItemsPerPageChange}
            sortConfig={sortConfig}
            onSort={handleSort}
          />
        )}
      </div>
    </div>
  );
} 