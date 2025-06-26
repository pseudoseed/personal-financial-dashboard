'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
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

  if (loading) {
    return (
      <Card className={`p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={`p-6 ${className}`}>
        <div className="text-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Activity Feed</h3>
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={fetchData} variant="secondary">
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  if (!data || data.activities.length === 0) {
    return (
      <Card className={`p-6 ${className}`}>
        <div className="text-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Activity Feed</h3>
          <p className="text-gray-500">No recent activity</p>
        </div>
      </Card>
    );
  }

  const displayedActivities = showAll ? data.activities : data.activities.slice(0, 10);

  return (
    <Card className={`p-6 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Activity Feed</h3>
        <div className="flex items-center space-x-2">
          <span className="text-xs text-gray-500">
            {data.summary.totalActivities} activities
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
      </div>

      {/* Activity Timeline */}
      <div className="space-y-4">
        {displayedActivities.map((activity, index) => (
          <ActivityItem key={activity.id} activity={activity} isLast={index === displayedActivities.length - 1} />
        ))}
      </div>

      {/* Summary Stats */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="grid grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-sm font-semibold text-gray-900">{data.summary.recentTransactions}</div>
            <div className="text-xs text-gray-500">Transactions</div>
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-900">{data.summary.pendingPayments}</div>
            <div className="text-xs text-gray-500">Pending</div>
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-900">{data.summary.anomalies}</div>
            <div className="text-xs text-gray-500">Alerts</div>
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-900">
              {getRelativeTime(data.summary.lastRefresh)}
            </div>
            <div className="text-xs text-gray-500">Updated</div>
          </div>
        </div>
      </div>
    </Card>
  );
}

interface ActivityItemProps {
  activity: Activity;
  isLast: boolean;
}

function ActivityItem({ activity, isLast }: ActivityItemProps) {
  const isPositive = activity.amount && activity.amount >= 0;
  const amountColor = activity.amount ? (isPositive ? 'text-green-600' : 'text-red-600') : 'text-gray-600';

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
            <h4 className="text-sm font-medium text-gray-900 truncate">
              {activity.title}
            </h4>
            <p className="text-sm text-gray-600 mt-1">
              {activity.description}
            </p>
            {activity.metadata?.accountName && (
              <p className="text-xs text-gray-500 mt-1">
                {activity.metadata.accountName}
              </p>
            )}
          </div>
          
          {/* Amount and Time */}
          <div className="flex flex-col items-end ml-2">
            {activity.amount !== undefined && (
              <span className={`text-sm font-medium ${amountColor}`}>
                {isPositive ? '+' : ''}{formatCurrency(activity.amount)}
              </span>
            )}
            <span className="text-xs text-gray-500 mt-1">
              {getRelativeTime(activity.date)}
            </span>
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex items-center justify-between mt-2">
          <span className={`text-xs px-2 py-1 rounded-full ${
            activity.status === 'completed' ? 'text-green-600 bg-green-50' :
            activity.status === 'pending' ? 'text-yellow-600 bg-yellow-50' :
            'text-red-600 bg-red-50'
          }`}>
            {activity.status}
          </span>
          <span className="text-xs text-gray-500 capitalize">
            {activity.category}
          </span>
        </div>
      </div>

      {/* Timeline Line */}
      {!isLast && (
        <div className="absolute left-4 top-8 w-0.5 h-8 bg-gray-200 ml-3"></div>
      )}
    </div>
  );
} 