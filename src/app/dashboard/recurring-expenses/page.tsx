"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { format } from "date-fns";
import { PlusIcon, MagnifyingGlassIcon, TrashIcon } from "@heroicons/react/24/outline";

interface RecurringExpense {
  id: string;
  name: string;
  merchantName: string;
  amount: number;
  frequency: string;
  nextDueDate?: string;
  confidence: number;
  isActive: boolean;
  isConfirmed: boolean;
  category?: string;
  lastTransactionDate: string;
}

const ITEMS_PER_PAGE = 10;

export default function RecurringExpensesPage() {
  const [expenses, setExpenses] = useState<RecurringExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [detecting, setDetecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"nextDueDate" | "amount" | "confidence" | "merchantName">("nextDueDate");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  useEffect(() => {
    fetchExpenses();
  }, []);

  async function fetchExpenses() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/recurring-expenses");
      const data = await res.json();
      setExpenses(data || []);
    } catch (err) {
      setError("Failed to load recurring expenses");
    } finally {
      setLoading(false);
    }
  }

  async function detectNewExpenses() {
    setDetecting(true);
    try {
      const res = await fetch("/api/recurring-expenses", { method: "POST" });
      const data = await res.json();
      if (data.detected && data.detected.length > 0) {
        await fetchExpenses(); // Refresh the list
      }
    } catch (err) {
      setError("Failed to detect new recurring expenses");
    } finally {
      setDetecting(false);
    }
  }

  async function updateExpense(id: string, updates: Partial<RecurringExpense>) {
    try {
      const res = await fetch(`/api/recurring-expenses/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        await fetchExpenses();
      }
    } catch (err) {
      setError("Failed to update recurring expense");
    }
  }

  async function deleteExpense(id: string) {
    if (!confirm("Are you sure you want to delete this recurring expense?")) return;
    try {
      const res = await fetch(`/api/recurring-expenses/${id}`, { method: "DELETE" });
      if (res.ok) {
        await fetchExpenses();
      } else {
        setError("Failed to delete recurring expense");
      }
    } catch (err) {
      setError("Failed to delete recurring expense");
    }
  }

  // Filter and sort expenses
  const filteredExpenses = expenses.filter(exp => 
    exp.merchantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    exp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (exp.category && exp.category.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const sortedExpenses = [...filteredExpenses].sort((a, b) => {
    let aVal: any = a[sortBy];
    let bVal: any = b[sortBy];
    
    if (sortBy === "nextDueDate") {
      aVal = aVal ? new Date(aVal).getTime() : 0;
      bVal = bVal ? new Date(bVal).getTime() : 0;
    }
    
    if (sortOrder === "asc") {
      return aVal > bVal ? 1 : -1;
    } else {
      return aVal < bVal ? 1 : -1;
    }
  });

  const paginatedExpenses = sortedExpenses.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE
  );

  const totalPages = Math.ceil(sortedExpenses.length / ITEMS_PER_PAGE);
  const totalMonthly = expenses
    .filter(e => e.isActive && e.frequency === "monthly")
    .reduce((sum, e) => sum + e.amount, 0);

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return "text-success-600 dark:text-success-400";
    if (confidence >= 60) return "text-warning-600 dark:text-warning-400";
    return "text-error-600 dark:text-error-400";
  };

  const getFrequencyColor = (frequency: string) => {
    switch (frequency) {
      case "monthly": return "text-blue-600 dark:text-blue-400";
      case "weekly": return "text-green-600 dark:text-green-400";
      case "quarterly": return "text-purple-600 dark:text-purple-400";
      case "yearly": return "text-orange-600 dark:text-orange-400";
      default: return "text-surface-600 dark:text-surface-400";
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-surface-900 dark:text-surface-100 mb-2">
          Recurring Expenses
        </h1>
        <p className="text-surface-600 dark:text-surface-400">
          Manage and track your regular payments and subscriptions
        </p>
      </div>

      {/* Summary Card */}
      <div className="card mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-2">
              Summary
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-surface-600 dark:text-surface-400">Total Active:</span>
                <span className="ml-2 font-semibold">{expenses.filter(e => e.isActive).length}</span>
              </div>
              <div>
                <span className="text-surface-600 dark:text-surface-400">Monthly Total:</span>
                <span className="ml-2 font-semibold text-success-600 dark:text-success-400">
                  ${totalMonthly.toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-surface-600 dark:text-surface-400">Unconfirmed:</span>
                <span className="ml-2 font-semibold text-warning-600 dark:text-warning-400">
                  {expenses.filter(e => !e.isConfirmed).length}
                </span>
              </div>
            </div>
          </div>
          <Button
            onClick={detectNewExpenses}
            disabled={detecting}
            loading={detecting}
            leftIcon={<PlusIcon className="w-5 h-5" />}
          >
            {detecting ? "Detecting..." : "Detect New"}
          </Button>
        </div>
      </div>

      {/* Controls */}
      <div className="card mb-6">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-surface-400" />
            <input
              type="text"
              placeholder="Search expenses..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-surface-200 dark:border-surface-700 rounded-lg bg-surface-0 dark:bg-surface-100 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 border border-surface-200 dark:border-surface-700 rounded-lg bg-surface-0 dark:bg-surface-100 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="nextDueDate">Next Due</option>
              <option value="amount">Amount</option>
              <option value="confidence">Confidence</option>
              <option value="merchantName">Merchant</option>
            </select>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
            >
              {sortOrder === "asc" ? "↑" : "↓"}
            </Button>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="card mb-6 border-error-200 dark:border-error-800 bg-error-50 dark:bg-error-900/20">
          <p className="text-error-700 dark:text-error-300">{error}</p>
        </div>
      )}

      {/* Expenses List */}
      {loading ? (
        <div className="card">
          <div className="animate-pulse space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-surface-100 dark:bg-surface-700 rounded"></div>
            ))}
          </div>
        </div>
      ) : paginatedExpenses.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-surface-600 dark:text-surface-400 mb-4">
            {searchTerm ? "No expenses match your search." : "No recurring expenses found."}
          </p>
          {!searchTerm && (
            <Button onClick={detectNewExpenses} disabled={detecting} loading={detecting}>
              Detect Recurring Expenses
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="card mb-6">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-surface-200 dark:divide-surface-700">
                <thead>
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-surface-500 dark:text-surface-400 uppercase tracking-wider">Merchant</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-surface-500 dark:text-surface-400 uppercase tracking-wider">Amount</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-surface-500 dark:text-surface-400 uppercase tracking-wider">Frequency</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-surface-500 dark:text-surface-400 uppercase tracking-wider">Next Due</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-surface-500 dark:text-surface-400 uppercase tracking-wider">Confidence</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedExpenses.map(exp => (
                    <tr key={exp.id} className="bg-white dark:bg-surface-900">
                      <td className="px-4 py-2 whitespace-nowrap font-medium">{exp.merchantName || exp.name}</td>
                      <td className="px-4 py-2 whitespace-nowrap">${exp.amount.toFixed(2)}</td>
                      <td className="px-4 py-2 whitespace-nowrap capitalize">{exp.frequency}</td>
                      <td className="px-4 py-2 whitespace-nowrap">{exp.nextDueDate ? format(new Date(exp.nextDueDate), 'MMM d, yyyy') : '-'}</td>
                      <td className="px-4 py-2 whitespace-nowrap">{exp.confidence}%</td>
                      <td className="px-4 py-2 whitespace-nowrap text-right">
                        <button
                          onClick={() => deleteExpense(exp.id)}
                          className="text-error-600 hover:text-error-800 dark:text-error-400 dark:hover:text-error-200 p-1 rounded focus:outline-none focus:ring-2 focus:ring-error-500"
                          title="Delete recurring expense"
                        >
                          <TrashIcon className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="card mt-6">
          <div className="flex justify-between items-center">
            <div className="text-sm text-surface-600 dark:text-surface-400">
              Showing {((page - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(page * ITEMS_PER_PAGE, sortedExpenses.length)} of {sortedExpenses.length} expenses
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <span className="px-4 py-2 text-sm text-surface-600 dark:text-surface-400">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 