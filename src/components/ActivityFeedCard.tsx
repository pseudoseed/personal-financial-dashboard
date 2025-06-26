'use client';

import { useState, useEffect } from 'react';
import { DashboardCard } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { formatCurrency } from '@/lib/ui';
import { ActivityFeedData, Activity, getActivityIcon, getActivityColor, getRelativeTime } from '@/lib/activityFeed';

interface ActivityFeedCardProps {
  className?: string;
}

export function ActivityFeedCard({ className = '' }: ActivityFeedCardProps) {
  const [data, setData] = useState<ActivityFeedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [hideSensitiveData, setHideSensitiveData] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const limit = showAll ? 50 : 10;
      const response = await fetch(`/api/analytics/activity-feed?limit=${limit}`);
      if (!response.ok) {
        throw new Error('Failed to fetch activity feed data');
      }
      
      const activityData = await response.json();
      setData(activityData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load activity feed data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [showAll]);

  // Check for hide sensitive data preference
  useEffect(() => {
    const checkHideSensitiveData = () => {
      const stored = localStorage.getItem('hideSensitiveData');
      setHideSensitiveData(stored === 'true');
    };
    
    checkHideSensitiveData();
    window.addEventListener('storage', checkHideSensitiveData);
    return () => window.removeEventListener('storage', checkHideSensitiveData);
  }, []);

  // Sanitize sensitive data
  const sanitizeText = (text: string) => {
    if (hideSensitiveData) {
      return '••••••••';
    }
    return text;
  };

  const sanitizeAmount = (amount: number | undefined) => {
    if (hideSensitiveData) {
      return undefined;
    }
    return amount;
  };

  if (loading) {
    return (
      <DashboardCard 
        title="Activity Feed" 
        subtitle="Recent account activity"
        className={className}
      >
        <div className="animate-pulse">
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </DashboardCard>
    );
  }

  if (error) {
    return (
      <DashboardCard 
        title="Activity Feed" 
        subtitle="Recent account activity"
        className={className}
      >
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
          <Button onClick={fetchData} variant="secondary">
            Retry
          </Button>
        </div>
      </DashboardCard>
    );
  }

  if (!data || data.activities.length === 0) {
    return (
      <DashboardCard 
        title="Activity Feed" 
        subtitle="Recent account activity"
        className={className}
      >
        <div className="text-center">
          <p className="text-surface-600 dark:text-surface-400">No recent activity</p>
        </div>
      </DashboardCard>
    );
  }

  const displayedActivities = showAll ? data.activities : data.activities.slice(0, 10);

  const headerAction = (
    <div className="flex items-center space-x-2">
      <span className="text-xs text-surface-600 dark:text-surface-400">
        {hideSensitiveData ? '••••••••' : `${data.summary.totalActivities} activities`}
      </span>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setShowAll(!showAll)}
        className="text-xs"
      >
        {showAll ? 'Show Less' : 'Show More'}
      </Button>
    </div>
  );

  return (
    <DashboardCard 
      title="Activity Feed" 
      subtitle="Recent account activity"
      headerAction={headerAction}
      className={className}
    >
      {/* Activity Timeline */}
      <div className="space-y-4">
        {displayedActivities.map((activity, index) => (
          <ActivityItem 
            key={activity.id} 
            activity={activity} 
            isLast={index === displayedActivities.length - 1}
            hideSensitiveData={hideSensitiveData}
            sanitizeText={sanitizeText}
            sanitizeAmount={sanitizeAmount}
          />
        ))}
      </div>

      {/* Summary Stats */}
      <div className="mt-6 pt-4 border-t border-surface-200 dark:border-surface-700">
        <div className="grid grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-sm font-semibold text-surface-900 dark:text-surface-100">
              {hideSensitiveData ? '••••' : data.summary.recentTransactions}
            </div>
            <div className="text-xs text-surface-600 dark:text-surface-400">Transactions</div>
          </div>
          <div>
            <div className="text-sm font-semibold text-surface-900 dark:text-surface-100">
              {hideSensitiveData ? '••••' : data.summary.pendingPayments}
            </div>
            <div className="text-xs text-surface-600 dark:text-surface-400">Pending</div>
          </div>
          <div>
            <div className="text-sm font-semibold text-surface-900 dark:text-surface-100">
              {hideSensitiveData ? '••••' : data.summary.anomalies}
            </div>
            <div className="text-xs text-surface-600 dark:text-surface-400">Alerts</div>
          </div>
          <div>
            <div className="text-sm font-semibold text-surface-900 dark:text-surface-100">
              {hideSensitiveData ? '••••' : getRelativeTime(data.summary.lastRefresh)}
            </div>
            <div className="text-xs text-surface-600 dark:text-surface-400">Updated</div>
          </div>
        </div>
      </div>
    </DashboardCard>
  );
}

interface ActivityItemProps {
  activity: Activity;
  isLast: boolean;
  hideSensitiveData: boolean;
  sanitizeText: (text: string) => string;
  sanitizeAmount: (amount: number | undefined) => number | undefined;
}

function ActivityItem({ activity, isLast, hideSensitiveData, sanitizeText, sanitizeAmount }: ActivityItemProps) {
  const sanitizedAmount = sanitizeAmount(activity.amount);
  const isPositive = sanitizedAmount && sanitizedAmount >= 0;
  const amountColor = sanitizedAmount ? (isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400') : 'text-surface-600 dark:text-surface-400';

  return (
    <div className="flex items-start space-x-3">
      {/* Activity Icon */}
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm ${getActivityColor(activity.type)}`}>
        {getActivityIcon(activity.type)}
      </div>

      {/* Activity Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium text-surface-900 dark:text-surface-100 truncate">
              {sanitizeText(activity.title)}
            </h4>
            <p className="text-sm text-surface-600 dark:text-surface-400 mt-1">
              {sanitizeText(activity.description)}
            </p>
            {activity.metadata?.accountName && (
              <p className="text-xs text-surface-500 dark:text-surface-500 mt-1">
                {sanitizeText(activity.metadata.accountName)}
              </p>
            )}
          </div>
          
          {/* Amount and Time */}
          <div className="flex flex-col items-end ml-2">
            {sanitizedAmount !== undefined && (
              <span className={`text-sm font-medium ${amountColor}`}>
                {isPositive ? '+' : ''}{formatCurrency(sanitizedAmount)}
              </span>
            )}
            <span className="text-xs text-surface-500 dark:text-surface-500 mt-1">
              {hideSensitiveData ? '••••' : getRelativeTime(activity.date)}
            </span>
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex items-center justify-between mt-2">
          <span className={`text-xs px-2 py-1 rounded-full ${
            activity.status === 'completed' ? 'text-green-600 bg-green-50 dark:bg-green-900/20' :
            activity.status === 'pending' ? 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20' :
            'text-red-600 bg-red-50 dark:bg-red-900/20'
          }`}>
            {hideSensitiveData ? '••••' : activity.status}
          </span>
          <span className="text-xs text-surface-500 dark:text-surface-500 capitalize">
            {hideSensitiveData ? '••••' : activity.category}
          </span>
        </div>
      </div>

      {/* Timeline Line */}
      {!isLast && (
        <div className="absolute left-4 top-8 w-0.5 h-8 bg-surface-200 dark:bg-surface-700 ml-3"></div>
      )}
    </div>
  );
} 