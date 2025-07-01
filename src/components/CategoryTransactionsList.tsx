"use client";

import { useState } from "react";
import { 
  MagnifyingGlassIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  FunnelIcon,
} from "@heroicons/react/24/outline";
import { useSensitiveData } from "@/app/providers";

interface CategoryTransactionsListProps {
  transactions: Transaction[];
  categoryType: 'granular' | 'general';
}

interface Transaction {
  id: string;
  date: string;
  name: string;
  amount: number;
  category: string | null;
  categoryAiGranular: string | null;
  categoryAiGeneral: string | null;
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

export function CategoryTransactionsList({ transactions, categoryType }: CategoryTransactionsListProps) {
  console.log('CategoryTransactionsList render', { transactions, categoryType, stack: new Error().stack });
  if (!transactions || !Array.isArray(transactions)) {
    throw new Error("CategoryTransactionsList: 'transactions' prop is required and must be an array.");
  }
  if (!categoryType || (categoryType !== 'granular' && categoryType !== 'general')) {
    throw new Error("CategoryTransactionsList: 'categoryType' prop is required and must be 'granular' or 'general'.");
  }
  const { showSensitiveData } = useSensitiveData();
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const totalAmount = transactions.reduce((sum, tx) => sum + tx.amount, 0);
  const transactionCount = transactions.length;

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getSortedTransactions = () => {
    let filtered = showSensitiveData 
      ? transactions.filter(tx => 
          tx.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (tx.merchantName && tx.merchantName.toLowerCase().includes(searchTerm.toLowerCase()))
        )
      : transactions; // Show all transactions when sensitive data is hidden

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
      className="flex items-center gap-1 hover:bg-gray-100 dark:hover:bg-zinc-800 px-2 py-1 rounded transition-colors text-xs"
    >
      {children}
      {sortField === field && (
        sortDirection === 'asc' ? (
          <ChevronUpIcon className="w-3 h-3" />
        ) : (
          <ChevronDownIcon className="w-3 h-3" />
        )
      )}
    </button>
  );

  const sortedTransactions = getSortedTransactions();

  return (
    <div className="space-y-4">
      {/* Summary and Search */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {transactionCount} transactions • ${totalAmount.toLocaleString()} total
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder={showSensitiveData ? "Search transactions..." : "Search disabled when sensitive data is hidden"}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              disabled={!showSensitiveData}
              className="w-full sm:w-64 pl-9 pr-4 py-2 text-sm border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
            <FunnelIcon className="w-3 h-3" />
            <span>{sortedTransactions.length}</span>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="overflow-x-auto">
        <div className="border border-gray-200 dark:border-zinc-700 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-zinc-700">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">
                  <SortableHeader field="date">Date</SortableHeader>
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">
                  <SortableHeader field="name">Transaction</SortableHeader>
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">
                  Account
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">
                  AI Category
                </th>
                <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">
                  <SortableHeader field="amount">Amount</SortableHeader>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-zinc-800 divide-y divide-gray-200 dark:divide-zinc-700">
              {sortedTransactions.slice(0, 10).map((transaction) => (
                <tr key={transaction.id} className="hover:bg-gray-50 dark:hover:bg-zinc-700">
                  <td className="px-4 py-3 whitespace-nowrap text-gray-500 dark:text-gray-400">
                    {new Date(transaction.date).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-gray-900 dark:text-white">
                    <div>
                      <div className="font-medium">
                        {showSensitiveData ? transaction.name : "••••••••••"}
                      </div>
                      {transaction.merchantName && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {showSensitiveData ? transaction.merchantName : "••••••••••"}
                        </div>
                      )}
                      {transaction.pending && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 mt-1">
                          Pending
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                    <div className="text-xs">
                      <div>{showSensitiveData ? (transaction.account?.plaidItem?.institutionName || 'Unknown') : "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"}</div>
                      <div>{showSensitiveData ? (transaction.account?.name || 'Unknown') : "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                    {categoryType === 'granular' ? (transaction.categoryAiGranular || '-') : (transaction.categoryAiGeneral || '-')}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right font-medium">
                    <span className={transaction.amount < 0 ? "text-pink-500 dark:text-pink-400" : "text-green-600 dark:text-green-400"}>
                      ${Math.abs(transaction.amount).toLocaleString()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {sortedTransactions.length > 10 && (
            <div className="px-4 py-3 text-center text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-zinc-700">
              Showing first 10 of {sortedTransactions.length} transactions
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 