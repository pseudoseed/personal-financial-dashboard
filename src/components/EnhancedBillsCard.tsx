'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { formatCurrency, formatPercentage } from '@/lib/ui';
import { EnhancedBillData, UpcomingBill, PaymentInsight } from '@/lib/enhancedBills';

interface EnhancedBillsCardProps {
  className?: string;
}

export function EnhancedBillsCard({ className = '' }: EnhancedBillsCardProps) {
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
      <Card className={`p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-6"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={`p-6 ${className}`}>
        <div className="text-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Bills & Payments</h3>
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={fetchData} variant="secondary">
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className={`p-6 ${className}`}>
        <div className="text-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Bills & Payments</h3>
          <p className="text-gray-500">No bills data available</p>
        </div>
      </Card>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'overdue':
        return 'text-red-600 bg-red-50';
      case 'pending':
        return 'text-yellow-600 bg-yellow-50';
      case 'paid':
        return 'text-green-600 bg-green-50';
      default:
        return 'text-gray-600 bg-gray-50';
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
    <Card className={`p-6 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Bills & Payments</h3>
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
            <h4 className="text-sm font-medium text-gray-700 mb-2">Upcoming Bills</h4>
            {data.upcomingBills.length === 0 ? (
              <p className="text-gray-500 text-sm">No upcoming bills</p>
            ) : (
              <div className="space-y-3">
                {data.upcomingBills.slice(0, 5).map((bill) => (
                  <div key={bill.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-gray-900">{bill.accountName}</span>
                        <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(bill.paymentStatus)}`}>
                          {bill.paymentStatus}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm text-gray-600">
                        <span>Due: {new Date(bill.dueDate).toLocaleDateString()}</span>
                        <span>{bill.daysUntilDue} days</span>
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <div className="font-semibold text-gray-900">{formatCurrency(bill.amount)}</div>
                      <div className="text-xs text-gray-500">Min: {formatCurrency(bill.minPayment)}</div>
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
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="text-sm font-medium text-blue-700 mb-1">Next 30 Days</h4>
              <div className="text-2xl font-bold text-blue-900">
                {formatCurrency(data.cashFlowForecast.next30Days.netFlow)}
              </div>
              <div className="text-xs text-blue-600">
                Income: {formatCurrency(data.cashFlowForecast.next30Days.income)} | 
                Expenses: {formatCurrency(data.cashFlowForecast.next30Days.expenses)}
              </div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <h4 className="text-sm font-medium text-green-700 mb-1">Available Cash</h4>
              <div className="text-2xl font-bold text-green-900">
                {formatCurrency(data.cashFlowForecast.next30Days.availableCash)}
              </div>
              <div className="text-xs text-green-600">
                Covers {Math.round(data.cashFlowForecast.next30Days.availableCash / data.cashFlowForecast.next30Days.expenses * 100)}% of expenses
              </div>
            </div>
          </div>

          <div className="mb-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Monthly Breakdown</h4>
            <div className="space-y-2">
              {data.cashFlowForecast.monthlyBreakdown.slice(0, 3).map((month) => (
                <div key={month.month} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <span className="text-sm text-gray-600">{month.month}</span>
                  <div className="flex items-center space-x-4">
                    <span className="text-sm text-green-600">+{formatCurrency(month.income)}</span>
                    <span className="text-sm text-red-600">-{formatCurrency(month.expenses)}</span>
                    <span className={`text-sm font-medium ${month.netFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {month.netFlow >= 0 ? '+' : ''}{formatCurrency(month.netFlow)}
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
          <h4 className="text-sm font-medium text-gray-700 mb-3">Payment Insights</h4>
          {data.paymentInsights.length === 0 ? (
            <p className="text-gray-500 text-sm">No insights available</p>
          ) : (
            <div className="space-y-3">
              {data.paymentInsights.map((insight, index) => (
                <div key={index} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                  <span className="text-lg">{getInsightIcon(insight.type)}</span>
                  <div className="flex-1">
                    <h5 className="font-medium text-gray-900 mb-1">{insight.title}</h5>
                    <p className="text-sm text-gray-600 mb-2">{insight.description}</p>
                    {insight.action && (
                      <Button variant="secondary" size="sm" className="text-xs">
                        {insight.action}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Summary Stats */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-lg font-semibold text-gray-900">{data.upcomingBills.length}</div>
            <div className="text-xs text-gray-500">Upcoming Bills</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-gray-900">
              {data.upcomingBills.filter(b => b.isOverdue).length}
            </div>
            <div className="text-xs text-gray-500">Overdue</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-gray-900">{data.paymentInsights.length}</div>
            <div className="text-xs text-gray-500">Insights</div>
          </div>
        </div>
      </div>
    </Card>
  );
} 