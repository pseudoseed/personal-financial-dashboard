'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { formatCurrency } from '@/lib/ui';
import { useSensitiveData } from '@/app/providers';
import { format } from 'date-fns';
import { 
  CheckIcon, 
  XMarkIcon, 
  PlusIcon, 
  CreditCardIcon,
  CalendarIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

interface Subscription {
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

interface SubscriptionData {
  existingSubscriptions: Subscription[];
  suggestedSubscriptions: Subscription[];
  summary: {
    totalSubscriptions: number;
    totalMonthlyCost: number;
    totalYearlyCost: number;
    totalWeeklyCost: number;
    totalQuarterlyCost: number;
    annualEquivalent: number;
    suggestedCount: number;
  };
}

export function SubscriptionsCard() {
  const { showSensitiveData } = useSensitiveData();
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('dismissedSubscriptionSuggestions');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    }
    return new Set();
  });

  const { data, isLoading, error, refetch } = useQuery<SubscriptionData>({
    queryKey: ['subscriptions'],
    queryFn: async () => {
      const response = await fetch('/api/analytics/subscriptions');
      if (!response.ok) throw new Error('Failed to fetch subscriptions');
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const handleConfirm = async (subscription: Subscription) => {
    setConfirmingId(subscription.merchantName + subscription.amount + subscription.frequency);
    try {
      const response = await fetch('/api/recurring-expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: subscription.name,
          merchantName: subscription.merchantName,
          amount: subscription.amount,
          frequency: subscription.frequency,
          nextDueDate: subscription.nextDueDate,
          lastTransactionDate: subscription.lastTransactionDate,
          confidence: subscription.confidence,
          isActive: true,
          isConfirmed: true,
        }),
      });
      
      if (response.ok) {
        refetch();
      }
    } catch (error) {
      console.error('Error confirming subscription:', error);
    } finally {
      setConfirmingId(null);
    }
  };

  const handleDismiss = (subscription: Subscription) => {
    const suggestionKey = `${subscription.merchantName}|${subscription.amount}|${subscription.frequency}`;
    const newDismissed = new Set(dismissedSuggestions).add(suggestionKey);
    setDismissedSuggestions(newDismissed);
    localStorage.setItem('dismissedSubscriptionSuggestions', JSON.stringify([...newDismissed]));
  };

  // Filter out dismissed suggestions
  const filteredSuggestions = data?.suggestedSubscriptions?.filter((sub) => {
    const suggestionKey = `${sub.merchantName}|${sub.amount}|${sub.frequency}`;
    return !dismissedSuggestions.has(suggestionKey);
  }) || [];

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return "text-green-600 dark:text-green-400";
    if (confidence >= 60) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const getSubscriptionIcon = (merchantName: string) => {
    const name = merchantName.toLowerCase();
    if (name.includes('netflix') || name.includes('spotify') || name.includes('hulu')) {
      return '🎬';
    } else if (name.includes('amazon') || name.includes('prime')) {
      return '📦';
    } else if (name.includes('apple') || name.includes('google')) {
      return '📱';
    } else if (name.includes('microsoft') || name.includes('adobe')) {
      return '💻';
    } else if (name.includes('gym') || name.includes('fitness')) {
      return '💪';
    } else if (name.includes('costco') || name.includes('sams')) {
      return '🛒';
    }
    return '💳';
  };

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className="p-6">
        <div className="text-center text-gray-500 text-sm">
          Unable to load subscriptions
        </div>
      </Card>
    );
  }

  const { existingSubscriptions, summary } = data;
  const hasExistingSubscriptions = existingSubscriptions.length > 0;
  const hasSuggestions = filteredSuggestions.length > 0;

  return (
    <Card className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-1">
            Subscriptions
          </h3>
          <p className="text-sm text-surface-600 dark:text-surface-400">
            Track your recurring services and memberships
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <CreditCardIcon className="w-5 h-5 text-surface-400" />
          <span className="text-sm font-medium text-surface-600 dark:text-surface-400">
            {showSensitiveData ? formatCurrency(summary.annualEquivalent) : "••••••"} / year
          </span>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="text-center">
          <div className="text-lg font-semibold text-surface-900 dark:text-surface-100">
            {summary.totalSubscriptions}
          </div>
          <div className="text-xs text-surface-600 dark:text-surface-400">Active</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-semibold text-green-600 dark:text-green-400">
            {showSensitiveData ? formatCurrency(summary.totalMonthlyCost) : "••••••"}
          </div>
          <div className="text-xs text-surface-600 dark:text-surface-400">Monthly</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-semibold text-blue-600 dark:text-blue-400">
            {showSensitiveData ? formatCurrency(summary.totalYearlyCost) : "••••••"}
          </div>
          <div className="text-xs text-surface-600 dark:text-surface-400">Yearly</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-semibold text-orange-600 dark:text-orange-400">
            {summary.suggestedCount}
          </div>
          <div className="text-xs text-surface-600 dark:text-surface-400">Suggested</div>
        </div>
      </div>

      {/* Existing Subscriptions */}
      {hasExistingSubscriptions && (
        <div className="mb-6">
          <h4 className="text-sm font-medium text-surface-700 dark:text-surface-300 mb-3">
            Active Subscriptions
          </h4>
          <div className="space-y-3">
            {existingSubscriptions.slice(0, 5).map((subscription) => (
              <div key={subscription.id} className="flex items-center justify-between p-3 bg-surface-50 dark:bg-surface-800 rounded-lg">
                <div className="flex items-center space-x-3">
                  <span className="text-lg">{getSubscriptionIcon(subscription.merchantName)}</span>
                  <div>
                    <div className="font-medium text-surface-900 dark:text-surface-100">
                      {subscription.merchantName}
                    </div>
                    <div className="text-xs text-surface-600 dark:text-surface-400">
                      {subscription.frequency} • {subscription.category || 'Subscription'}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-surface-900 dark:text-surface-100">
                    {showSensitiveData ? formatCurrency(subscription.amount) : "••••••"}
                  </div>
                  {subscription.nextDueDate && (
                    <div className="text-xs text-surface-600 dark:text-surface-400 flex items-center">
                      <CalendarIcon className="w-3 h-3 mr-1" />
                      {format(new Date(subscription.nextDueDate), "MMM d")}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          {existingSubscriptions.length > 5 && (
            <div className="text-center mt-3">
              <Button variant="secondary" size="sm" onClick={() => window.location.href = '/dashboard/recurring-expenses'}>
                View All {existingSubscriptions.length} Subscriptions
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Suggested Subscriptions */}
      {hasSuggestions && (
        <div>
          <h4 className="text-sm font-medium text-surface-700 dark:text-surface-300 mb-3 flex items-center">
            <ExclamationTriangleIcon className="w-4 h-4 mr-2 text-yellow-500" />
            Suggested Subscriptions
          </h4>
          <div className="space-y-3">
            {filteredSuggestions.slice(0, 3).map((subscription, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <div className="flex items-center space-x-3">
                  <span className="text-lg">{getSubscriptionIcon(subscription.merchantName)}</span>
                  <div>
                    <div className="font-medium text-surface-900 dark:text-surface-100">
                      {subscription.merchantName}
                    </div>
                    <div className="text-xs text-surface-600 dark:text-surface-400">
                      {subscription.frequency} • {subscription.confidence}% confidence
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="text-right mr-3">
                    <div className="font-semibold text-surface-900 dark:text-surface-100">
                      {showSensitiveData ? formatCurrency(subscription.amount) : "••••••"}
                    </div>
                    <div className={`text-xs ${getConfidenceColor(subscription.confidence)}`}>
                      {subscription.confidence}% match
                    </div>
                  </div>
                  <div className="flex space-x-1">
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => handleConfirm(subscription)}
                      disabled={confirmingId === subscription.merchantName + subscription.amount + subscription.frequency}
                      className="px-2 py-1"
                    >
                      <CheckIcon className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleDismiss(subscription)}
                      className="px-2 py-1"
                    >
                      <XMarkIcon className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {filteredSuggestions.length > 3 && (
            <div className="text-center mt-3">
              <Button variant="secondary" size="sm" onClick={() => window.location.href = '/dashboard/recurring-expenses'}>
                View All {filteredSuggestions.length} Suggestions
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!hasExistingSubscriptions && !hasSuggestions && (
        <div className="text-center py-8">
          <CreditCardIcon className="w-12 h-12 text-surface-400 mx-auto mb-4" />
          <h4 className="text-lg font-medium text-surface-900 dark:text-surface-100 mb-2">
            No Subscriptions Found
          </h4>
          <p className="text-sm text-surface-600 dark:text-surface-400 mb-4">
            We&apos;ll automatically detect your subscriptions as you make recurring payments.
          </p>
          <Button 
            variant="primary" 
            onClick={() => window.location.href = '/dashboard/recurring-expenses'}
          >
            <PlusIcon className="w-4 h-4 mr-2" />
            Detect Subscriptions
          </Button>
        </div>
      )}
    </Card>
  );
} 