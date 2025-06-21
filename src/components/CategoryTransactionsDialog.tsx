"use client";

import { useState, useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import { 
  XMarkIcon,
  MagnifyingGlassIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  FunnelIcon,
} from "@heroicons/react/24/outline";
import { useQuery } from "@tanstack/react-query";

interface CategoryTransactionsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  category: string;
  dateRange: { startDate?: Date; endDate?: Date };
  accountIds: string[];
  isMasked: boolean;
}

interface Transaction {
  id: string;
  date: string;
  name: string;
  amount: number;
  category: string | null;
  categoryAi: string | null;
  merchantName: string | null;
  pending: boolean;
  account: {
    name: string;
    type: string;
    plaidItem: {
      institutionName: string | null;
    };
  };
}

interface TransactionSummary {
  totalAmount: number;
  transactionCount: number;
  averageAmount: number;
  category: string;
}

type SortField = 'date' | 'amount' | 'name';
type SortDirection = 'asc' | 'desc';

export function CategoryTransactionsDialog({ 
  isOpen, 
  onClose, 
  category, 
  dateRange, 
  accountIds, 
  isMasked 
}: CategoryTransactionsDialogProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [isMounted, setIsMounted] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Build API URL with filters
  const buildApiUrl = () => {
    const params = new URLSearchParams();
    params.set('category', category);
    params.set('limit', '1000');
    
    if (accountIds.length > 0) {
      params.set('accountIds', accountIds.join(','));
    }
    
    if (dateRange.startDate) {
      params.set('startDate', dateRange.startDate.toISOString().split('T')[0]);
    }
    
    if (dateRange.endDate) {
      params.set('endDate', dateRange.endDate.toISOString().split('T')[0]);
    }
    
    return `/api/transactions/by-category?${params.toString()}`;
  };

  // Fetch transactions
  const {
    data,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['categoryTransactions', category, dateRange, accountIds],
    queryFn: async () => {
      const response = await fetch(buildApiUrl());
      if (!response.ok) {
        throw new Error('Failed to fetch transactions');
      }
      return response.json() as Promise<{
        transactions: Transaction[];
        summary: TransactionSummary;
      }>;
    },
    enabled: isOpen,
  });

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Handle ESC key and click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    const handleClickOutside = (event: MouseEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    // Add event listeners
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);

    // Prevent body scroll when dialog is open
    document.body.style.overflow = 'hidden';

    // Cleanup
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  const formatCurrency = (amount: number) => {
    return isMasked ? "••••••" : `$${Math.abs(amount).toLocaleString()}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getSortedTransactions = () => {
    if (!data?.transactions) return [];
    
    let filtered = data.transactions.filter(tx => 
      tx.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (tx.merchantName && tx.merchantName.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return filtered.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortField) {
        case 'date':
          aValue = new Date(a.date).getTime();
          bValue = new Date(b.date).getTime();
          break;
        case 'amount':
          aValue = Math.abs(a.amount);
          bValue = Math.abs(b.amount);
          break;
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        default:
          return 0;
      }
      
      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
  };

  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center gap-1 hover:bg-gray-100 dark:hover:bg-zinc-800 px-2 py-1 rounded transition-colors"
    >
      {children}
      {sortField === field && (
        sortDirection === 'asc' ? (
          <ChevronUpIcon className="w-4 h-4" />
        ) : (
          <ChevronDownIcon className="w-4 h-4" />
        )
      )}
    </button>
  );

  if (!isOpen) return null;

  const sortedTransactions = getSortedTransactions();
  const summary = data?.summary;

  const dialogContent = (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div 
        ref={dialogRef}
        className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-zinc-700">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {category} Transactions
            </h2>
            {summary && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {summary.transactionCount} transactions • {formatCurrency(summary.totalAmount)} total
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            aria-label="Close dialog"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Search and Filters */}
        <div className="p-6 border-b border-gray-200 dark:border-zinc-700">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search transactions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <FunnelIcon className="w-4 h-4" />
              <span>{sortedTransactions.length} of {data?.transactions.length || 0} transactions</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-6">
              <div className="animate-pulse space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-16 bg-gray-100 dark:bg-zinc-700 rounded"></div>
                ))}
              </div>
            </div>
          ) : error ? (
            <div className="p-6">
              <div className="text-center text-red-600 dark:text-red-400">
                Error loading transactions: {error instanceof Error ? error.message : 'Unknown error'}
              </div>
            </div>
          ) : sortedTransactions.length === 0 ? (
            <div className="p-6">
              <div className="text-center text-gray-500 dark:text-gray-400">
                {searchTerm ? 'No transactions match your search.' : 'No transactions found for this category.'}
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-zinc-700 sticky top-0">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      <SortableHeader field="date">Date</SortableHeader>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      <SortableHeader field="name">Transaction</SortableHeader>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Account
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Original Category
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      <SortableHeader field="amount">Amount</SortableHeader>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-zinc-800 divide-y divide-gray-200 dark:divide-zinc-700">
                  {sortedTransactions.map((transaction) => (
                    <tr key={transaction.id} className="hover:bg-gray-50 dark:hover:bg-zinc-700">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {formatDate(transaction.date)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                        <div>
                          <div className="font-medium">{transaction.name}</div>
                          {transaction.merchantName && (
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {transaction.merchantName}
                            </div>
                          )}
                          {transaction.pending && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 mt-1">
                              Pending
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                        <div>
                          <div>{transaction.account.plaidItem.institutionName || 'Unknown'}</div>
                          <div className="text-xs">{transaction.account.name}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                        {transaction.category || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium">
                        <span className={transaction.amount < 0 ? "text-pink-500 dark:text-pink-400" : "text-green-600 dark:text-green-400"}>
                          {formatCurrency(transaction.amount)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (!isMounted) {
    return null;
  }

  return ReactDOM.createPortal(
    dialogContent,
    document.getElementById("dialog-root") as HTMLElement
  );
} 