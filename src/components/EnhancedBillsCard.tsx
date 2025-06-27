'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { formatCurrency, formatPercentage } from '@/lib/ui';
import { EnhancedBillData, UpcomingBill, PaymentInsight } from '@/lib/enhancedBills';
import { useSensitiveData } from '@/app/providers';

interface EnhancedBillsCardProps {
  className?: string;
}

export function EnhancedBillsCard({ className = '' }: EnhancedBillsCardProps) {
  const { showSensitiveData } = useSensitiveData();
  const [data, setData] = useState<EnhancedBillData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'cashflow' | 'insights'>('upcoming');

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/analytics/enhanced-bills');
      if (!response.ok) {
        throw new Error('Failed to fetch enhanced bills data');
      }
      
      const billsData = await response.json();
      setData(billsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load enhanced bills data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="card">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-6"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-2">Bills & Payments</h3>
          <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
          <Button onClick={fetchData} variant="secondary">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="card">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-2">Bills & Payments</h3>
          <p className="text-gray-500 dark:text-gray-400">No bills data available</p>
        </div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'overdue':
        return 'text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-900/20';
      case 'pending':
        return 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20';
      case 'paid':
        return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20';
      default:
        return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800';
    }
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'warning':
        return '⚠️';
      case 'info':
        return 'ℹ️';
      case 'success':
        return '✅';
      default:
        return '📊';
    }
  };

  return (
    <div className="card">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-1">
            Bills & Payments
          </h3>
          <p className="text-sm text-surface-600 dark:text-surface-400">
            Track upcoming bills and cash flow
          </p>
        </div>
        <div className="flex space-x-1">
          {[
            { key: 'upcoming', label: 'Upcoming' },
            { key: 'cashflow', label: 'Cash Flow' },
            { key: 'insights', label: 'Insights' },
          ].map((tab) => (
            <Button
              key={tab.key}
              variant={activeTab === tab.key ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setActiveTab(tab.key as any)}
              className="text-xs px-2 py-1"
            >
              {tab.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Upcoming Bills Tab */}
      {activeTab === 'upcoming' && (
        <div>
          <div className="mb-4">
            <h4 className="text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">Upcoming Bills</h4>
            {(() => {
              return null;
            })()}
            {data.upcomingBills.length === 0 ? (
              <p className="text-surface-500 dark:text-surface-400 text-sm">No upcoming bills</p>
            ) : (
              <div className="space-y-3">
                {data.upcomingBills.slice(0, 5).map((bill) => (
                  <div key={bill.id} className="flex items-center justify-between p-3 bg-surface-50 dark:bg-surface-800 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-surface-900 dark:text-surface-100">{bill.accountName}</span>
                        <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(bill.paymentStatus)}`}>
                          {bill.paymentStatus}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm text-surface-600 dark:text-surface-400">
                        <span>Due: {new Date(bill.dueDate).toLocaleDateString()}</span>
                        <span>{bill.daysUntilDue} days</span>
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <div className="font-semibold text-surface-900 dark:text-surface-100">
                        {showSensitiveData ? formatCurrency(bill.amount) : "••••••"}
                      </div>
                      <div className="text-xs text-surface-500 dark:text-surface-400">
                        Min: {showSensitiveData ? formatCurrency(bill.minPayment) : "••••••"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Cash Flow Tab */}
      {activeTab === 'cashflow' && (
        <div>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <h4 className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-1">Next 30 Days</h4>
              <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                {showSensitiveData ? formatCurrency(data.cashFlowForecast.next30Days.netFlow) : "••••••"}
              </div>
              <div className="text-xs text-blue-600 dark:text-blue-400">
                Income: {showSensitiveData ? formatCurrency(data.cashFlowForecast.next30Days.income) : "••••••"} | 
                Expenses: {showSensitiveData ? formatCurrency(data.cashFlowForecast.next30Days.expenses) : "••••••"}
              </div>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
              <h4 className="text-sm font-medium text-green-700 dark:text-green-300 mb-1">Available Cash</h4>
              <div className="text-2xl font-bold text-green-900 dark:text-green-100">
                {showSensitiveData ? formatCurrency(data.cashFlowForecast.next30Days.availableCash) : "••••••"}
              </div>
              <div className="text-xs text-green-600 dark:text-green-400">
                Covers {showSensitiveData ? Math.round(data.cashFlowForecast.next30Days.availableCash / data.cashFlowForecast.next30Days.expenses * 100) : "••"}% of expenses
              </div>
            </div>
          </div>

          <div className="mb-4">
            <h4 className="text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">Monthly Breakdown</h4>
            <div className="space-y-2">
              {data.cashFlowForecast.monthlyBreakdown.slice(0, 3).map((month) => (
                <div key={month.month} className="flex items-center justify-between p-2 bg-surface-50 dark:bg-surface-800 rounded">
                  <span className="text-sm text-surface-600 dark:text-surface-400">{month.month}</span>
                  <div className="flex items-center space-x-4">
                    <span className="text-sm text-green-600 dark:text-green-400">
                      +{showSensitiveData ? formatCurrency(month.income) : "••••••"}
                    </span>
                    <span className="text-sm text-pink-600 dark:text-pink-400">
                      -{showSensitiveData ? formatCurrency(month.expenses) : "••••••"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Insights Tab */}
      {activeTab === 'insights' && (
        <div>
          <h4 className="text-sm font-medium text-surface-700 dark:text-surface-300 mb-3">Payment Insights</h4>
          <div className="space-y-3">
            {data.paymentInsights.slice(0, 5).map((insight, index) => (
              <div key={index} className="flex items-start space-x-3 p-3 bg-surface-50 dark:bg-surface-800 rounded-lg">
                <span className="text-lg">{getInsightIcon(insight.type)}</span>
                <div className="flex-1">
                  <h5 className="font-medium text-surface-900 dark:text-surface-100 mb-1">{insight.title}</h5>
                  <p className="text-sm text-surface-600 dark:text-surface-400">{insight.description}</p>
                  {insight.action && (
                    <p className="text-xs text-surface-500 dark:text-surface-400 mt-1">
                      Action: {insight.action}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary Stats */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-lg font-semibold text-gray-900 dark:text-white">{data.upcomingBills.length}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Upcoming Bills</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-gray-900 dark:text-white">
              {data.upcomingBills.filter(b => b.isOverdue).length}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Overdue</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-gray-900 dark:text-white">{data.paymentInsights.length}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Insights</div>
          </div>
        </div>
      </div>
    </div>
  );
} 