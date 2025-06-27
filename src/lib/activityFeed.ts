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
  const userId = 'default';
  const activities: Activity[] = [];
  
  // Get recent transactions
  const transactions = await prisma.transaction.findMany({
    where: { 
      account: { userId, hidden: false } 
    },
    include: {
      account: true,
    },
    orderBy: { date: 'desc' },
    take: Math.floor(limit * 0.4), // 40% of activities
  });

  // Get account balance changes
  const balanceChanges = await prisma.accountBalance.findMany({
    where: { 
      account: { userId, hidden: false } 
    },
    include: {
      account: true,
    },
    orderBy: { date: 'desc' },
    take: Math.floor(limit * 0.2), // 20% of activities
  });

  // Get recurring expenses
  const recurringExpenses = await prisma.recurringExpense.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    take: Math.floor(limit * 0.15), // 15% of activities
  });

  // Get recurring payments
  const recurringPayments = await prisma.recurringPayment.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    take: Math.floor(limit * 0.15), // 15% of activities
  });

  // Get anomaly detections
  const anomalies = await prisma.anomalyDetectionResult.findMany({
    where: { 
      settings: { userId },
      isHidden: false,
    },
    include: {
      transaction: {
        include: { account: true }
      },
    },
    orderBy: { createdAt: 'desc' },
    take: Math.floor(limit * 0.1), // 10% of activities
  });

  // Convert transactions to activities
  transactions.forEach(transaction => {
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
      },
    });
  });

  // Convert balance changes to activities
  balanceChanges.forEach((balance, index) => {
    if (index === 0) return; // Skip the most recent balance as it's current
    
    const previousBalance = balanceChanges[index + 1];
    if (!previousBalance) return;
    
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
      },
    });
  });

  // Convert recurring expenses to activities
  recurringExpenses.forEach(expense => {
    activities.push({
      id: `expense-${expense.id}`,
      type: 'recurring_expense',
      title: `Recurring Expense: ${expense.name}`,
      description: `${expense.amount.toFixed(2)} ${expense.frequency}`,
      amount: -expense.amount,
      date: expense.updatedAt.toISOString(),
      status: 'completed',
      category: expense.category || 'Recurring Expense',
      metadata: {
        merchantName: expense.merchantName,
        frequency: expense.frequency,
        confidence: expense.confidence,
      },
    });
  });

  // Convert recurring payments to activities
  recurringPayments.forEach(payment => {
    activities.push({
      id: `payment-${payment.id}`,
      type: 'recurring_payment',
      title: `Recurring Payment: ${payment.name}`,
      description: `${payment.amount.toFixed(2)} ${payment.frequency}`,
      amount: payment.amount,
      date: payment.updatedAt.toISOString(),
      status: 'completed',
      category: payment.paymentType,
      metadata: {
        frequency: payment.frequency,
        confidence: payment.confidence,
        targetAccount: payment.targetAccountId,
      },
    });
  });

  // Convert anomalies to activities
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