'use client';

import { useState, useEffect } from 'react';
import { DashboardCard } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { formatCurrency } from '@/lib/ui';
import { ActivityFeedData, Activity, getActivityIcon, getActivityColor, getRelativeTime } from '@/lib/activityFeed';
import { Modal } from '@/components/ui/Modal';
import { clsx } from 'clsx';
import React from 'react';

interface ActivityFeedCardProps {
  className?: string;
}

export function ActivityFeedCard({ className = '' }: ActivityFeedCardProps) {
  const [data, setData] = useState<ActivityFeedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [hideSensitiveData, setHideSensitiveData] = useState(false);
  const [detailsActivity, setDetailsActivity] = useState<Activity | null>(null);

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

  useEffect(() => {
    const handler = (e: any) => setDetailsActivity(e.detail);
    window.addEventListener('openActivityDetails', handler);
    return () => window.removeEventListener('openActivityDetails', handler);
  }, []);

  if (loading) {
    return (
      <DashboardCard 
        title="Activity Feed" 
        className={clsx('p-2', className)}
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
        className={clsx('p-2', className)}
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
        className={clsx('p-2', className)}
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
    <DashboardCard title="Activity Feed" className={clsx('p-2', className)}>
      <div className="space-y-2">
        {displayedActivities.map((activity, idx) => (
          <ActivityItem
            key={activity.id}
            activity={activity}
            isLast={idx === displayedActivities.length - 1}
            hideSensitiveData={hideSensitiveData}
            sanitizeText={sanitizeText}
            sanitizeAmount={sanitizeAmount}
            onViewDetails={() => setDetailsActivity(activity)}
          />
        ))}
      </div>
      {detailsActivity && (
        <Modal
          isOpen={!!detailsActivity}
          onClose={() => setDetailsActivity(null)}
          icon={<div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${getActivityColor(detailsActivity.type)}`}>{getActivityIcon(detailsActivity.type)}</div>}
          title={detailsActivity.title}
          subtitle={getRelativeTime(detailsActivity.date)}
          maxWidth="max-w-md"
        >
          <div className="space-y-6">
            {/* Summary Section */}
            <div>
              <div className="text-xs font-semibold text-surface-500 dark:text-surface-400 mb-2 uppercase tracking-wide">Summary</div>
              <div className="flex flex-col items-center gap-1">
                <span className={`text-2xl font-bold ${typeof detailsActivity.amount === 'number' ? (detailsActivity.amount >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400') : 'text-surface-400 dark:text-surface-500'}`}>
                  {typeof detailsActivity.amount === 'number' ? `${detailsActivity.amount >= 0 ? '+' : ''}${formatCurrency(detailsActivity.amount)}` : '--'}
                </span>
                {detailsActivity.metadata?.frequency && (
                  <div className="text-sm text-surface-700 dark:text-surface-300 font-medium">{detailsActivity.metadata.frequency}</div>
                )}
                {detailsActivity.description && (
                  <div className="text-sm text-surface-500 dark:text-surface-400 mt-1">{detailsActivity.description}</div>
                )}
              </div>
            </div>

            {/* Status & Category Section */}
            <div>
              <div className="text-xs font-semibold text-surface-500 dark:text-surface-400 mb-2 uppercase tracking-wide">Status & Category</div>
              <div className="flex flex-wrap gap-2">
                <span className="text-xs px-3 py-1 rounded-full bg-surface-100 dark:bg-surface-700 text-surface-700 dark:text-surface-200 font-semibold border border-surface-200 dark:border-surface-600">Status: {detailsActivity.status}</span>
                <span className="text-xs px-3 py-1 rounded-full bg-surface-100 dark:bg-surface-700 text-surface-700 dark:text-surface-200 font-semibold border border-surface-200 dark:border-surface-600">Category: {detailsActivity.category}</span>
              </div>
            </div>

            {/* Details Section */}
            <div>
              <div className="text-xs font-semibold text-surface-500 dark:text-surface-400 mb-2 uppercase tracking-wide">Details</div>
              <div className="bg-surface-50 dark:bg-surface-900 rounded-lg p-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div className="font-medium text-surface-600 dark:text-surface-400">Date</div>
                <div className="text-surface-900 dark:text-surface-100 text-right">{new Date(detailsActivity.date).toLocaleString()}</div>
                {detailsActivity.metadata && Object.keys(detailsActivity.metadata ?? {}).map(key => (
                  <React.Fragment key={key}>
                    <div className="font-medium text-surface-600 dark:text-surface-400">{key.charAt(0).toUpperCase() + key.slice(1)}</div>
                    <div className="text-surface-900 dark:text-surface-100 text-right">{String(detailsActivity.metadata?.[key])}</div>
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-center pt-2">
              <Button variant="primary" size="lg" className="rounded-md px-8 py-3 font-bold text-base shadow-sm" onClick={() => setDetailsActivity(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </DashboardCard>
  );
}

interface ActivityItemProps {
  activity: Activity;
  isLast: boolean;
  hideSensitiveData: boolean;
  sanitizeText: (text: string) => string;
  sanitizeAmount: (amount: number | undefined) => number | undefined;
  onViewDetails: () => void;
}

function ActivityItem({ activity, isLast, hideSensitiveData, sanitizeText, sanitizeAmount, onViewDetails }: ActivityItemProps) {
  const sanitizedAmount = sanitizeAmount(activity.amount);
  const isPositive = sanitizedAmount && sanitizedAmount >= 0;
  const amountColor = sanitizedAmount ? (isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400') : 'text-surface-600 dark:text-surface-400';

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center w-full">
      {/* Activity Icon */}
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm ${getActivityColor(activity.type)} mr-2`}>
        {getActivityIcon(activity.type)}
      </div>

      {/* Activity Content */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between w-full">
          <div className="min-w-0">
            <h4 className="text-sm font-semibold text-surface-900 dark:text-surface-100 truncate" title={activity.title}>
              {sanitizeText(activity.title)}
            </h4>
            <p className="text-xs text-surface-600 dark:text-surface-400 truncate" title={activity.description}>
              {sanitizeText(activity.description)}
            </p>
          </div>
          <div className="flex flex-col items-end ml-2 mt-1 sm:mt-0">
            {sanitizedAmount !== undefined && (
              <span className={`text-base font-bold ${amountColor}`}>{isPositive ? '+' : ''}{formatCurrency(sanitizedAmount)}</span>
            )}
            <span className="text-xs text-surface-500 dark:text-surface-500 mt-0.5">
              {hideSensitiveData ? '••••' : getRelativeTime(activity.date)}
            </span>
          </div>
        </div>
        {/* Status and Category Tags */}
        <div className="flex flex-wrap gap-2 mt-1">
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            activity.status === 'completed' ? 'text-green-600 bg-green-50 dark:bg-green-900/20' :
            activity.status === 'pending' ? 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20' :
            'text-red-600 bg-red-50 dark:bg-red-900/20'
          }`}>
            {hideSensitiveData ? '••••' : activity.status}
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300">
            {hideSensitiveData ? '••••' : activity.category}
          </span>
          {activity.metadata?.accountName && (
            <span className="text-xs text-surface-500 dark:text-surface-500 truncate" title={activity.metadata.accountName}>
              {sanitizeText(activity.metadata.accountName)}
            </span>
          )}
        </div>
        {/* View Details Button */}
        <div className="flex justify-end mt-1">
          <button
            className="text-xs text-primary-600 hover:underline focus:outline-none px-2 py-1 rounded transition"
            onClick={onViewDetails}
            aria-label="View details"
            tabIndex={0}
          >
            View Details
          </button>
        </div>
      </div>
    </div>
  );
} 