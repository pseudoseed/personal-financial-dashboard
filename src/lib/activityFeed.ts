import { prisma } from './db';

export interface ActivityFeedData {
  activities: Activity[];
  summary: ActivitySummary;
}

export interface Activity {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  amount?: number;
  date: string;
  status: 'completed' | 'pending' | 'failed';
  category: string;
  metadata?: Record<string, any>;
}

export type ActivityType = 
  | 'transaction'
  | 'bill_payment'
  | 'account_refresh'
  | 'balance_change'
  | 'recurring_expense'
  | 'recurring_payment'
  | 'anomaly_detected'
  | 'financial_health_update'
  | 'account_connected'
  | 'account_disconnected';

export interface ActivitySummary {
  totalActivities: number;
  recentTransactions: number;
  pendingPayments: number;
  anomalies: number;
  lastRefresh: string;
}

export async function getActivityFeedData(_userId: string, limit: number = 20): Promise<ActivityFeedData> {
  // Force use of 'default' user ID since that's where the accounts are stored
  const userId = 'default';
  const activities: Activity[] = [];
  
  // Get recent transactions from connected accounts only (exclude manual)
  const transactions = await prisma.transaction.findMany({
    where: { 
      account: {
        userId,
        hidden: false,
        plaidItem: {
          NOT: { accessToken: 'manual' },
        },
      },
    },
    include: {
      account: { include: { plaidItem: true } },
    },
    orderBy: { date: 'desc' },
    take: Math.floor(limit * 0.6), // 60% of activities
  });

  // Get account balance changes from connected accounts only (exclude manual)
  const balanceChanges = await prisma.accountBalance.findMany({
    where: { 
      account: {
        userId,
        hidden: false,
        plaidItem: {
          NOT: { accessToken: 'manual' },
        },
      },
    },
    include: {
      account: { include: { plaidItem: true } },
    },
    orderBy: { date: 'desc' },
    take: Math.floor(limit * 0.2), // 20% of activities
  });

  // Get anomaly detections (keep as is)
  const anomalies = await prisma.anomalyDetectionResult.findMany({
    where: { 
      settings: { userId },
      isHidden: false,
    },
    include: {
      transaction: {
        include: { account: { include: { plaidItem: true } } }
      },
    },
    orderBy: { createdAt: 'desc' },
    take: Math.floor(limit * 0.2), // 20% of activities
  });

  // Convert transactions to activities (only from connected accounts)
  transactions.forEach(transaction => {
    // Only include if account is not manual (Plaid or Coinbase)
    const provider = transaction.account?.plaidItem?.provider;
    if (transaction.account?.plaidItem?.accessToken === 'manual') return;
    // Optionally, you could check for provider === 'coinbase' to include Coinbase
    activities.push({
      id: `transaction-${transaction.id}`,
      type: 'transaction',
      title: transaction.name,
      description: `${transaction.amount >= 0 ? 'Received' : 'Spent'} ${Math.abs(transaction.amount).toFixed(2)}`,
      amount: transaction.amount,
      date: transaction.date.toISOString(),
      status: transaction.pending ? 'pending' : 'completed',
      category: transaction.category || 'Uncategorized',
      metadata: {
        merchantName: transaction.merchantName,
        accountName: transaction.account.nickname || transaction.account.name,
        provider,
      },
    });
  });

  // Convert balance changes to activities (only from connected accounts)
  balanceChanges.forEach((balance, index) => {
    if (index === 0) return; // Skip the most recent balance as it's current
    const previousBalance = balanceChanges[index + 1];
    if (!previousBalance) return;
    if (balance.account?.plaidItem?.accessToken === 'manual') return;
    const provider = balance.account?.plaidItem?.provider;
    const change = balance.current - previousBalance.current;
    if (Math.abs(change) < 0.01) return; // Ignore tiny changes
    activities.push({
      id: `balance-${balance.id}`,
      type: 'balance_change',
      title: `${balance.account.nickname || balance.account.name} Balance Update`,
      description: `Balance ${change >= 0 ? 'increased' : 'decreased'} by ${Math.abs(change).toFixed(2)}`,
      amount: change,
      date: balance.date.toISOString(),
      status: 'completed',
      category: 'Balance Update',
      metadata: {
        accountName: balance.account.nickname || balance.account.name,
        newBalance: balance.current,
        previousBalance: previousBalance.current,
        provider,
      },
    });
  });

  // Convert anomalies to activities (keep as is)
  anomalies.forEach(anomaly => {
    activities.push({
      id: `anomaly-${anomaly.id}`,
      type: 'anomaly_detected',
      title: `Anomaly Detected: ${anomaly.transaction.name}`,
      description: `${anomaly.reason} - ${anomaly.severity} severity`,
      amount: anomaly.transaction.amount,
      date: anomaly.createdAt.toISOString(),
      status: anomaly.isResolved ? 'completed' : 'pending',
      category: 'Security Alert',
      metadata: {
        anomalyType: anomaly.type,
        severity: anomaly.severity,
        accountName: anomaly.transaction.account.nickname || anomaly.transaction.account.name,
        provider: anomaly.transaction.account?.plaidItem?.provider,
      },
    });
  });

  // Sort all activities by date (most recent first)
  activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Limit to requested number
  const limitedActivities = activities.slice(0, limit);

  // Calculate summary
  const summary: ActivitySummary = {
    totalActivities: limitedActivities.length,
    recentTransactions: transactions.length,
    pendingPayments: limitedActivities.filter(a => a.status === 'pending').length,
    anomalies: anomalies.length,
    lastRefresh: new Date().toISOString(),
  };

  return {
    activities: limitedActivities,
    summary,
  };
}

export function getActivityIcon(type: ActivityType): string {
  switch (type) {
    case 'transaction':
      return '💳';
    case 'bill_payment':
      return '📄';
    case 'account_refresh':
      return '🔄';
    case 'balance_change':
      return '💰';
    case 'recurring_expense':
      return '📅';
    case 'recurring_payment':
      return '💸';
    case 'anomaly_detected':
      return '⚠️';
    case 'financial_health_update':
      return '📊';
    case 'account_connected':
      return '🔗';
    case 'account_disconnected':
      return '🔌';
    default:
      return '📋';
  }
}

export function getActivityColor(type: ActivityType): string {
  switch (type) {
    case 'transaction':
      return 'text-blue-600 bg-blue-50';
    case 'bill_payment':
      return 'text-purple-600 bg-purple-50';
    case 'account_refresh':
      return 'text-gray-600 bg-gray-50';
    case 'balance_change':
      return 'text-green-600 bg-green-50';
    case 'recurring_expense':
      return 'text-red-600 bg-red-50';
    case 'recurring_payment':
      return 'text-green-600 bg-green-50';
    case 'anomaly_detected':
      return 'text-orange-600 bg-orange-50';
    case 'financial_health_update':
      return 'text-indigo-600 bg-indigo-50';
    case 'account_connected':
      return 'text-green-600 bg-green-50';
    case 'account_disconnected':
      return 'text-red-600 bg-red-50';
    default:
      return 'text-gray-600 bg-gray-50';
  }
}

export function getRelativeTime(date: string): string {
  const now = new Date();
  const activityDate = new Date(date);
  const diffInSeconds = Math.floor((now.getTime() - activityDate.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return 'Just now';
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  } else if (diffInSeconds < 2592000) {
    const days = Math.floor(diffInSeconds / 86400);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  } else {
    return activityDate.toLocaleDateString();
  }
} 