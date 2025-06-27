'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { formatCurrency, formatPercentage } from '@/lib/ui';
import { InvestmentPerformanceData, SnapshotType } from '@/lib/investmentPerformance';
import { useSensitiveData } from '@/app/providers';

interface InvestmentPerformanceCardProps {
  className?: string;
}

export function InvestmentPerformanceCard({ className = '' }: InvestmentPerformanceCardProps) {
  const { showSensitiveData } = useSensitiveData();
  const [data, setData] = useState<InvestmentPerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snapshotType, setSnapshotType] = useState<SnapshotType>('weekly');

  const fetchData = async (type: SnapshotType) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/analytics/investment-performance?snapshotType=${type}`);
      if (!response.ok) {
        throw new Error('Failed to fetch investment performance data');
      }
      
      const performanceData = await response.json();
      setData(performanceData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load investment performance');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(snapshotType);
  }, [snapshotType]);

  const handleSnapshotChange = (type: SnapshotType) => {
    setSnapshotType(type);
  };

  if (loading) {
    return (
      <div className="card">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-6"></div>
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
          <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-2">Investment Performance</h3>
          <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
          <Button onClick={() => fetchData(snapshotType)} variant="secondary">
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
          <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-2">Investment Performance</h3>
          <p className="text-gray-500 dark:text-gray-400">No investment data available</p>
        </div>
      </div>
    );
  }

  const isPositive = data.changePercent >= 0;
  const changeColor = isPositive ? 'text-green-600 dark:text-green-400' : 'text-pink-600 dark:text-pink-400';
  const changeIcon = isPositive ? '↗' : '↘';

  return (
    <div className="card">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-1">
            Investment Performance
          </h3>
          <p className="text-sm text-surface-600 dark:text-surface-400">
            Portfolio tracking and analysis
          </p>
        </div>
        <div className="flex space-x-1">
          {(['all', 'daily', 'weekly', 'monthly'] as SnapshotType[]).map((type) => (
            <Button
              key={type}
              variant={snapshotType === type ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => handleSnapshotChange(type)}
              className="text-xs px-2 py-1"
            >
              {type === 'all' ? 'Live' : type.charAt(0).toUpperCase() + type.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {/* Portfolio Value and Change */}
      <div className="mb-6">
        <div className="text-3xl font-bold text-surface-900 dark:text-surface-100 mb-2">
          {showSensitiveData ? formatCurrency(data.portfolioValue) : "••••••"}
        </div>
        <div className={`flex items-center text-sm ${changeColor}`}>
          <span className="mr-1">{changeIcon}</span>
          <span className="font-medium">
            {showSensitiveData ? formatPercentage(Math.abs(data.changePercent)) : "••••••"}
          </span>
          <span className="ml-2 text-surface-600 dark:text-surface-400">
            {showSensitiveData ? `(${formatCurrency(Math.abs(data.changeAmount))})` : "(••••••)"}
          </span>
        </div>
      </div>

      {/* Asset Allocation */}
      {data.assetAllocation.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-medium text-surface-700 dark:text-surface-300 mb-3">Asset Allocation</h4>
          <div className="space-y-2">
            {data.assetAllocation.slice(0, 5).map((asset, index) => (
              <div key={asset.category} className="flex items-center justify-between">
                <div className="flex items-center">
                  <div 
                    className="w-3 h-3 rounded-full mr-2"
                    style={{ 
                      backgroundColor: `hsl(${index * 60}, 70%, 50%)` 
                    }}
                  ></div>
                  <span className="text-sm text-surface-600 dark:text-surface-400">{asset.category}</span>
                </div>
                <div className="text-sm font-medium text-surface-900 dark:text-surface-100">
                  {showSensitiveData ? formatCurrency(asset.value) : "••••••"}
                  <span className="text-surface-500 dark:text-surface-400 ml-1">
                    {showSensitiveData ? `(${formatPercentage(asset.percentage)})` : "(••••••)"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Performers */}
      {data.topPerformers.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-surface-700 dark:text-surface-300 mb-3">Top Performers</h4>
          <div className="space-y-2">
            {data.topPerformers.map((performer, index) => (
              <div key={performer.accountName} className="flex items-center justify-between">
                <span className="text-sm text-surface-600 dark:text-surface-400">{performer.accountName}</span>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-surface-900 dark:text-surface-100">
                    {showSensitiveData ? formatCurrency(performer.value) : "••••••"}
                  </span>
                  <span className={`text-xs ${performer.changePercent >= 0 ? 'text-green-600 dark:text-green-400' : 'text-pink-600 dark:text-pink-400'}`}>
                    {showSensitiveData ? `${performer.changePercent >= 0 ? '+' : ''}${formatPercentage(performer.changePercent)}` : "••••••"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Historical Data Summary */}
      {data.historicalData.length > 0 && (
        <div className="mt-4 pt-4 border-t border-surface-200 dark:border-surface-700">
          <div className="text-xs text-surface-500 dark:text-surface-400">
            {snapshotType === 'all'
              ? `Data based on all balance updates (real-time view)`
              : `Data based on ${data.historicalData.length} ${snapshotType} snapshots`}
          </div>
        </div>
      )}
    </div>
  );
} 