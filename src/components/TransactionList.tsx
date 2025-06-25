"use client";

import { useState, useEffect, useMemo } from "react";
import { Transaction } from "@prisma/client";
import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/outline";
import { useSensitiveData } from "@/app/providers";
import { Pagination, SortConfig, SortableHeader } from "@/components/ui/Pagination";
import { TransactionTableSkeleton } from "@/components/LoadingStates";

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
  const [isDownloadHistoryExpanded, setIsDownloadHistoryExpanded] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: "date",
    direction: "desc",
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState<"all" | "30days" | "90days" | "6months" | "1year">("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  useEffect(() => {
    setTransactions(initialTransactions);
  }, [initialTransactions]);

  // Get unique categories for filtering
  const uniqueCategories = useMemo(() => {
    const categories = new Set<string>();
    transactions.forEach(transaction => {
      const category = (transaction as any).categoryAi || transaction.category;
      if (category) {
        categories.add(category);
      }
    });
    return Array.from(categories).sort();
  }, [transactions]);

  // Filter and sort transactions
  const filteredAndSortedTransactions = useMemo(() => {
    let filtered = transactions;

    // Apply date filter
    if (dateFilter !== "all") {
      const now = new Date();
      let cutoffDate: Date;
      
      switch (dateFilter) {
        case "30days":
          cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case "90days":
          cutoffDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        case "6months":
          cutoffDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
          break;
        case "1year":
          cutoffDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
        default:
          cutoffDate = new Date(0);
      }
      
      filtered = filtered.filter(transaction => new Date(transaction.date) >= cutoffDate);
    }

    // Apply category filter
    if (categoryFilter !== "all") {
      filtered = filtered.filter(transaction => {
        const category = (transaction as any).categoryAi || transaction.category;
        return category === categoryFilter;
      });
    }

    // Apply search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(transaction => 
        transaction.name.toLowerCase().includes(term) ||
        (transaction.category && transaction.category.toLowerCase().includes(term)) ||
        ((transaction as any).categoryAi && (transaction as any).categoryAi.toLowerCase().includes(term))
      );
    }

    // Sort transactions
    filtered.sort((a, b) => {
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

    return filtered;
  }, [transactions, sortConfig, searchTerm, dateFilter, categoryFilter]);

  // Paginate transactions
  const paginatedTransactions = useMemo(() => {
    const totalPages = Math.ceil(filteredAndSortedTransactions.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return {
      transactions: filteredAndSortedTransactions.slice(startIndex, endIndex),
      totalPages,
    };
  }, [filteredAndSortedTransactions, currentPage, itemsPerPage]);

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

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1); // Reset to first page when searching
  };

  const handleDateFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setDateFilter(e.target.value as "all" | "30days" | "90days" | "6months" | "1year");
    setCurrentPage(1); // Reset to first page when filtering
  };

  const handleCategoryFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCategoryFilter(e.target.value);
    setCurrentPage(1); // Reset to first page when filtering
  };

  const clearFilters = () => {
    setSearchTerm("");
    setDateFilter("all");
    setCategoryFilter("all");
    setCurrentPage(1);
  };

  const hasActiveFilters = searchTerm || dateFilter !== "all" || categoryFilter !== "all";

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    const total = filteredAndSortedTransactions.reduce((sum, t) => sum + t.amount, 0);
    const positive = filteredAndSortedTransactions.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
    const negative = filteredAndSortedTransactions.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const count = filteredAndSortedTransactions.length;
    const average = count > 0 ? total / count : 0;

    return { total, positive, negative, count, average };
  }, [filteredAndSortedTransactions]);

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
          Transactions ({transactions.length})
        </h2>
      </div>

      <div>
        <div
          className="flex justify-between items-center px-6 py-4 bg-gray-50 dark:bg-[rgb(46,46,46)] border-y border-gray-200 dark:border-zinc-700 cursor-pointer touch-manipulation hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors"
          onClick={() => setIsTableExpanded(!isTableExpanded)}
          style={{ minHeight: '44px' }}
        >
          <h3 className="text-sm font-medium text-surface-600 dark:text-gray-400">
            Transaction Records
          </h3>
          {isTableExpanded ? (
            <ChevronUpIcon className="w-6 h-6 text-surface-600 dark:text-gray-400" />
          ) : (
            <ChevronDownIcon className="w-6 h-6 text-surface-600 dark:text-gray-400" />
          )}
        </div>

        {isTableExpanded && (
          <>
            {/* Search and Filter Bar */}
            <div className="px-6 py-4 bg-gray-50 dark:bg-[rgb(46,46,46)] border-b border-gray-200 dark:border-zinc-700">
              <div className="flex flex-col gap-4">
                {/* Search and Results Count */}
                <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                  <div className="flex-1 max-w-md">
                    <input
                      type="text"
                      placeholder="Search transactions..."
                      value={searchTerm}
                      onChange={handleSearchChange}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {filteredAndSortedTransactions.length} of {transactions.length} transactions
                  </div>
                </div>

                {/* Summary Statistics */}
                {filteredAndSortedTransactions.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-sm">
                    <div className="text-center">
                      <div className="font-medium text-gray-900 dark:text-white">
                        {displayAmount(summaryStats.total)}
                      </div>
                      <div className="text-gray-600 dark:text-gray-400">Net Total</div>
                    </div>
                    <div className="text-center">
                      <div className="font-medium text-green-600 dark:text-green-400">
                        {displayAmount(summaryStats.positive)}
                      </div>
                      <div className="text-gray-600 dark:text-gray-400">Income</div>
                    </div>
                    <div className="text-center">
                      <div className="font-medium text-pink-500 dark:text-pink-400">
                        {displayAmount(summaryStats.negative)}
                      </div>
                      <div className="text-gray-600 dark:text-gray-400">Expenses</div>
                    </div>
                    <div className="text-center">
                      <div className="font-medium text-gray-900 dark:text-white">
                        {displayAmount(summaryStats.average)}
                      </div>
                      <div className="text-gray-600 dark:text-gray-400">Average</div>
                    </div>
                    <div className="text-center">
                      <div className="font-medium text-gray-900 dark:text-white">
                        {summaryStats.count}
                      </div>
                      <div className="text-gray-600 dark:text-gray-400">Count</div>
                    </div>
                  </div>
                )}

                {/* Filter Controls */}
                <div className="flex flex-col sm:flex-row gap-4 items-center">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <select
                      value={dateFilter}
                      onChange={handleDateFilterChange}
                      className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="all">All Time</option>
                      <option value="30days">Last 30 Days</option>
                      <option value="90days">Last 90 Days</option>
                      <option value="6months">Last 6 Months</option>
                      <option value="1year">Last Year</option>
                    </select>

                    <select
                      value={categoryFilter}
                      onChange={handleCategoryFilterChange}
                      className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="all">All Categories</option>
                      {uniqueCategories.map(category => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                  </div>

                  {hasActiveFilters && (
                    <button
                      onClick={clearFilters}
                      className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      Clear Filters
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-700">
                <thead className="bg-gray-50 dark:bg-[rgb(46,46,46)]">
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
                <tbody className="bg-white dark:bg-zinc-900 divide-y divide-gray-200 dark:divide-zinc-700">
                  {paginatedTransactions.transactions.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-6 py-4 text-center text-sm text-surface-600 dark:text-gray-400"
                      >
                        {searchTerm ? "No transactions match your search" : "No transactions found"}
                      </td>
                    </tr>
                  ) : (
                    paginatedTransactions.transactions.map((transaction) => (
                      <tr key={transaction.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-surface-600 dark:text-gray-400">
                          {new Date(transaction.date).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-sm text-surface-900 dark:text-surface-dark-900">
                          {displayTransactionName(transaction.name)}
                          {transaction.pending && (
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
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
                                : "text-green-600 dark:text-green-400"
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

            {/* Pagination */}
            {paginatedTransactions.totalPages > 1 && (
              <Pagination
                currentPage={currentPage}
                totalPages={paginatedTransactions.totalPages}
                totalItems={filteredAndSortedTransactions.length}
                itemsPerPage={itemsPerPage}
                onPageChange={handlePageChange}
                onItemsPerPageChange={handleItemsPerPageChange}
                sortConfig={sortConfig}
                onSort={handleSort}
              />
            )}
          </>
        )}
      </div>

      {/* Download History */}
      <div className="mt-6">
        <div
          className="flex justify-between items-center px-6 py-4 bg-gray-50 dark:bg-[rgb(46,46,46)] border-y border-gray-200 dark:border-zinc-700 cursor-pointer touch-manipulation hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors"
          onClick={() => setIsDownloadHistoryExpanded(!isDownloadHistoryExpanded)}
          style={{ minHeight: '44px' }}
        >
          <h3 className="text-sm font-medium text-surface-600 dark:text-gray-400">
            Download History ({downloadLogs.length})
          </h3>
          {isDownloadHistoryExpanded ? (
            <ChevronUpIcon className="w-6 h-6 text-surface-600 dark:text-gray-400" />
          ) : (
            <ChevronDownIcon className="w-6 h-6 text-surface-600 dark:text-gray-400" />
          )}
        </div>

        {isDownloadHistoryExpanded && (
          <>
            {/* Download History Summary */}
            {downloadLogs.length > 0 && (
              <div className="px-6 py-4 bg-gray-50 dark:bg-[rgb(46,46,46)] border-b border-gray-200 dark:border-zinc-700">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                  <div className="text-center">
                    <div className="font-medium text-gray-900 dark:text-white">
                      {downloadLogs.length}
                    </div>
                    <div className="text-gray-600 dark:text-gray-400">Total Downloads</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium text-green-600 dark:text-green-400">
                      {downloadLogs.filter(log => log.status === 'success').length}
                    </div>
                    <div className="text-gray-600 dark:text-gray-400">Successful</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium text-red-600 dark:text-red-400">
                      {downloadLogs.filter(log => log.status === 'error').length}
                    </div>
                    <div className="text-gray-600 dark:text-gray-400">Failed</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium text-gray-900 dark:text-white">
                      {downloadLogs.length > 0 ? new Date(downloadLogs[0].createdAt).toLocaleDateString() : 'Never'}
                    </div>
                    <div className="text-gray-600 dark:text-gray-400">Last Sync</div>
                  </div>
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-700">
                <thead className="bg-gray-50 dark:bg-[rgb(46,46,46)]">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-surface-600 dark:text-gray-400 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-surface-600 dark:text-gray-400 uppercase tracking-wider">
                      Date Range
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-surface-600 dark:text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-surface-600 dark:text-gray-400 uppercase tracking-wider">
                      Transactions
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-surface-600 dark:text-gray-400 uppercase tracking-wider">
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-zinc-900 divide-y divide-gray-200 dark:divide-zinc-700">
                  {downloadLogs.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
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
                          <div className="text-xs text-gray-500 dark:text-gray-500">
                            {new Date(log.createdAt).toLocaleTimeString()}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-surface-600 dark:text-gray-400">
                          {new Date(log.startDate).toLocaleDateString()} - {new Date(log.endDate).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            log.status === 'success' 
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              : log.status === 'error'
                              ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                              : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                          }`}>
                            {log.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-surface-600 dark:text-gray-400">
                          {showSensitiveData ? log.numTransactions : "••"}
                        </td>
                        <td className="px-6 py-4 text-sm text-surface-600 dark:text-gray-400">
                          {log.errorMessage && (
                            <div className="max-w-xs">
                              <span className="text-red-600 dark:text-red-400 font-medium">Error:</span>
                              <div className="text-xs mt-1 text-gray-500 dark:text-gray-500 break-words">
                                {log.errorMessage}
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
