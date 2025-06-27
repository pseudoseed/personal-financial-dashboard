import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { format } from 'date-fns';
import { useSensitiveData } from '@/app/providers';

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
}

const PAGE_SIZE = 5;

export function RecurringExpensesCard() {
  const { showSensitiveData } = useSensitiveData();
  const [expenses, setExpenses] = useState<RecurringExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    async function fetchExpenses() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/recurring-expenses');
        if (!res.ok) {
          throw new Error('Failed to fetch recurring expenses');
        }
        const data = await res.json();
        setExpenses(data.expenses || []);
      } catch (err) {
        setError('Failed to load recurring expenses');
        console.error('Error fetching recurring expenses:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchExpenses();
  }, []);

  const paginated = (expenses || []).slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.ceil((expenses || []).length / PAGE_SIZE);
  const totalMonthly = (expenses || [])
    .filter(e => e.isActive && e.frequency === 'monthly')
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
    <div className="card">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-1">
            Recurring Expenses
          </h3>
          <p className="text-sm text-surface-600 dark:text-surface-400">
            Automated expense tracking and management
          </p>
        </div>
        <a 
          href="/dashboard/recurring-expenses" 
          className="text-primary-600 dark:text-primary-400 text-sm font-medium hover:underline focus:outline-none focus:underline transition-colors"
        >
          See all
        </a>
      </div>
      
      <div className="mb-3 text-sm text-surface-600 dark:text-surface-400">
        Total Monthly Recurring: <span className="font-semibold text-success-600 dark:text-success-400">
          {showSensitiveData ? `$${totalMonthly.toFixed(2)}` : "••••••"}
        </span>
      </div>
      
      {loading ? (
        <div className="animate-pulse space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex justify-between items-center">
              <div className="h-4 bg-surface-200 dark:bg-surface-700 rounded w-1/3"></div>
              <div className="h-4 bg-surface-200 dark:bg-surface-700 rounded w-1/4"></div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="text-error-600 dark:text-error-400 text-sm py-2">
          {error}
        </div>
      ) : expenses.length === 0 ? (
        <div className="text-surface-500 dark:text-surface-400 text-sm py-2">
          No recurring expenses detected.
        </div>
      ) : (
        <div>
          {/* Mobile-friendly list view */}
          <div className="space-y-2 mb-3">
            {paginated.map(exp => (
              <div key={exp.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 rounded-lg bg-surface-50 dark:bg-surface-800">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-surface-900 dark:text-surface-100 truncate">
                      {exp.merchantName || exp.name}
                    </span>
                    {!exp.isConfirmed && (
                      <span className="px-1.5 py-0.5 text-xs bg-warning-100 dark:bg-warning-900/20 text-warning-700 dark:text-warning-300 rounded">
                        Unconfirmed
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-surface-600 dark:text-surface-400">
                    <span>{showSensitiveData ? `$${exp.amount.toFixed(2)}` : "••••••"}</span>
                    <span className={`capitalize ${getFrequencyColor(exp.frequency)}`}>
                      {exp.frequency}
                    </span>
                    {exp.nextDueDate && (
                      <span>
                        Due: {format(new Date(exp.nextDueDate), 'MMM d')}
                      </span>
                    )}
                    <span className={getConfidenceColor(exp.confidence)}>
                      {exp.confidence}% confidence
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center pt-2 border-t border-surface-200 dark:border-surface-700">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setPage(p => Math.max(1, p - 1))} 
                disabled={page === 1}
                className="text-xs"
              >
                Previous
              </Button>
              <span className="text-xs text-surface-500 dark:text-surface-400">
                Page {page} of {totalPages}
              </span>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setPage(p => Math.min(totalPages, p + 1))} 
                disabled={page === totalPages}
                className="text-xs"
              >
                Next
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 