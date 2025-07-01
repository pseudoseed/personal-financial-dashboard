"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { format } from "date-fns";
import { PlusIcon, MagnifyingGlassIcon, TrashIcon } from "@heroicons/react/24/outline";
import { DashboardCard, Card } from "@/components/ui/Card";
import { Pagination } from "@/components/ui/Pagination";
import { useSensitiveData } from "@/app/providers";

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

const ITEMS_PER_PAGE = 5;

export default function RecurringExpensesPage() {
  const [expenses, setExpenses] = useState<RecurringExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [detecting, setDetecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'confirmed' | 'recommended'>('confirmed');
  const [confirmedPage, setConfirmedPage] = useState(1);
  const [potentialPage, setPotentialPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"nextDueDate" | "amount" | "confidence" | "merchantName">("nextDueDate");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const { showSensitiveData } = useSensitiveData();

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

  // Split expenses into potential and confirmed
  const potentialExpenses = expenses.filter(e => !e.isConfirmed);
  const confirmedExpenses = expenses.filter(e => e.isConfirmed);

  async function confirmExpense(id: string) {
    try {
      const res = await fetch(`/api/recurring-expenses/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isConfirmed: true }),
      });
      if (res.ok) {
        await fetchExpenses();
      } else {
        setError("Failed to confirm recurring expense");
      }
    } catch (err) {
      setError("Failed to confirm recurring expense");
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

  // Pagination logic
  const confirmedTotalPages = Math.ceil(confirmedExpenses.length / ITEMS_PER_PAGE) || 1;
  const potentialTotalPages = Math.ceil(potentialExpenses.length / ITEMS_PER_PAGE) || 1;
  const confirmedPaginated = confirmedExpenses.slice((confirmedPage - 1) * ITEMS_PER_PAGE, confirmedPage * ITEMS_PER_PAGE);
  const potentialPaginated = potentialExpenses.slice((potentialPage - 1) * ITEMS_PER_PAGE, potentialPage * ITEMS_PER_PAGE);

  // Tab bar
  const tabClass = (tab: 'confirmed' | 'recommended') =>
    `px-4 py-2 rounded-t-lg font-semibold cursor-pointer transition-colors border-b-2 ${
      activeTab === tab
        ? 'border-blue-600 text-blue-600 dark:text-blue-400 bg-white dark:bg-zinc-900'
        : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 bg-gray-50 dark:bg-zinc-800'
    }`;

  // Summary values
  const totalActive = confirmedExpenses.length;
  const totalMonthly = confirmedExpenses
    .filter(e => e.isActive && e.frequency === "monthly")
    .reduce((sum, e) => sum + e.amount, 0);
  const totalUnconfirmed = potentialExpenses.length;

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
      {/* Summary Card */}
      <DashboardCard title="Summary" subtitle="Overview of your confirmed recurring expenses and unconfirmed recommendations." className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-surface-600 dark:text-surface-400">Total Active:</span>
            <span className="ml-2 font-semibold">{totalActive}</span>
          </div>
          <div>
            <span className="text-surface-600 dark:text-surface-400">Monthly Total:</span>
            <span className="ml-2 font-semibold text-success-600 dark:text-success-400">
              {showSensitiveData ? `$${totalMonthly.toFixed(2)}` : "••••••"}
            </span>
          </div>
          <div>
            <span className="text-surface-600 dark:text-surface-400">Unconfirmed:</span>
            <span className="ml-2 font-semibold text-warning-600 dark:text-warning-400">
              {totalUnconfirmed}
            </span>
          </div>
        </div>
      </DashboardCard>
      {/* Main Card with Tabs */}
      <DashboardCard
        title="Recurring Expenses"
        subtitle="Manage and track your regular payments and subscriptions"
        className="mb-8"
      >
        {/* Tab Bar */}
        <div className="flex gap-2 border-b border-gray-200 dark:border-zinc-700 mb-4">
          <button
            className={tabClass('confirmed')}
            onClick={() => setActiveTab('confirmed')}
            aria-selected={activeTab === 'confirmed'}
            aria-controls="confirmed-tab"
            tabIndex={0}
          >
            Confirmed
          </button>
          <button
            className={tabClass('recommended')}
            onClick={() => setActiveTab('recommended')}
            aria-selected={activeTab === 'recommended'}
            aria-controls="recommended-tab"
            tabIndex={0}
          >
            Recommended
          </button>
        </div>
        {/* Tab Content */}
        {activeTab === 'confirmed' && (
          <Card className="bg-white dark:bg-zinc-900">
            {loading ? (
              <div className="p-6 text-center">Loading...</div>
            ) : error ? (
              <div className="p-6 text-error-600 dark:text-error-400">{error}</div>
            ) : confirmedExpenses.length === 0 ? (
              <div className="p-6 text-surface-500 dark:text-surface-400 text-sm">No confirmed recurring expenses.</div>
            ) : (
              <>
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
                      {confirmedPaginated.map(exp => (
                        <tr key={exp.id} className="bg-white dark:bg-surface-900">
                          <td className="px-4 py-2 whitespace-nowrap font-medium">{exp.merchantName || exp.name}</td>
                          <td className="px-4 py-2 whitespace-nowrap">{showSensitiveData ? `$${exp.amount.toFixed(2)}` : "••••••"}</td>
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
                <Pagination
                  currentPage={confirmedPage}
                  totalPages={confirmedTotalPages}
                  totalItems={confirmedExpenses.length}
                  itemsPerPage={ITEMS_PER_PAGE}
                  onPageChange={setConfirmedPage}
                />
              </>
            )}
          </Card>
        )}
        {activeTab === 'recommended' && (
          <Card className="bg-white dark:bg-zinc-900">
            {loading ? (
              <div className="p-6 text-center">Loading...</div>
            ) : error ? (
              <div className="p-6 text-error-600 dark:text-error-400">{error}</div>
            ) : potentialExpenses.length === 0 ? (
              <div className="p-6 text-surface-500 dark:text-surface-400 text-sm">No potential recurring expenses detected.</div>
            ) : (
              <>
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
                      {potentialPaginated.map(exp => (
                        <tr key={exp.id} className="bg-white dark:bg-surface-900">
                          <td className="px-4 py-2 whitespace-nowrap font-medium">{exp.merchantName || exp.name}</td>
                          <td className="px-4 py-2 whitespace-nowrap">{showSensitiveData ? `$${exp.amount.toFixed(2)}` : "••••••"}</td>
                          <td className="px-4 py-2 whitespace-nowrap capitalize">{exp.frequency}</td>
                          <td className="px-4 py-2 whitespace-nowrap">{exp.nextDueDate ? format(new Date(exp.nextDueDate), 'MMM d, yyyy') : '-'}</td>
                          <td className="px-4 py-2 whitespace-nowrap">{exp.confidence}%</td>
                          <td className="px-4 py-2 whitespace-nowrap text-right">
                            <button
                              onClick={() => confirmExpense(exp.id)}
                              className="text-success-600 hover:text-success-800 dark:text-success-400 dark:hover:text-success-200 p-1 rounded focus:outline-none focus:ring-2 focus:ring-success-500 border border-success-200 dark:border-success-700 bg-success-50 dark:bg-success-900/20"
                              title="Add recurring expense"
                            >
                              Add
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination
                  currentPage={potentialPage}
                  totalPages={potentialTotalPages}
                  totalItems={potentialExpenses.length}
                  itemsPerPage={ITEMS_PER_PAGE}
                  onPageChange={setPotentialPage}
                />
              </>
            )}
          </Card>
        )}
      </DashboardCard>
    </div>
  );
} 