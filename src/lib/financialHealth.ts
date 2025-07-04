import { prisma } from './db';
import { Account, Transaction } from '@prisma/client';
import { getFinancialGroup } from './accountTypes';

// Helper function to check if an account is truly liquid for emergency fund purposes
function isLiquidForEmergencyFund(account: { type: string; subtype: string | null }): boolean {
  const liquidSubtypes = ['checking', 'savings', 'money market', 'paypal', 'cash management', 'ebt', 'prepaid'];
  return account.type === 'depository' && 
         !!account.subtype && 
         liquidSubtypes.includes(account.subtype.toLowerCase());
}

export interface FinancialHealthMetrics {
  overallScore: number;
  emergencyFundRatio: number;
  debtToIncomeRatio: number;
  savingsRate: number;
  creditUtilization: number;
  recommendations: FinancialRecommendation[];
}

export interface FinancialRecommendation {
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  action: string;
}

export interface FinancialHealthTrend {
  score: number;
  change: number;
  period: string;
}

export async function calculateFinancialHealth(_userId: string): Promise<FinancialHealthMetrics> {
  const userId = 'default';
  // Get all user data
  const accounts = await prisma.account.findMany({
    where: { userId, hidden: false },
    include: {
      balances: {
        orderBy: { date: 'desc' },
        take: 1,
      },
    },
  });

  // Emergency Fund: get user-selected accounts
  const efAccountLinks: { accountId: string }[] = await prisma.emergencyFundAccount.findMany({ where: { userId } });
  const efAccountIds: string[] = efAccountLinks.map((link) => link.accountId);
  let efAccounts = accounts.filter(acc => efAccountIds.includes(acc.id));
  // If none selected, fall back to default logic - only truly liquid depository accounts
  if (efAccounts.length === 0) {
    efAccounts = accounts.filter(isLiquidForEmergencyFund);
  }

  const transactions = await prisma.transaction.findMany({
    where: {
      account: { userId, hidden: false },
      date: {
        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
      },
    },
  });

  const recurringExpenses: any[] = await prisma.recurringExpense.findMany({
    where: { userId, isActive: true },
  });

  const recurringPayments: any[] = await prisma.recurringPayment.findMany({
    where: { userId, isActive: true },
  });

  // Calculate metrics
  const emergencyFundRatio = calculateEmergencyFundRatio(efAccounts, recurringExpenses);
  const debtToIncomeRatio = calculateDebtToIncomeRatio(accounts, recurringPayments, recurringExpenses);
  const savingsRate = calculateSavingsRate(transactions, recurringPayments);
  const creditUtilization = calculateCreditUtilization(accounts);

  // Calculate overall score
  const overallScore = calculateOverallScore({
    emergencyFundRatio,
    debtToIncomeRatio,
    savingsRate,
    creditUtilization,
  });

  // Generate recommendations
  const recommendations = generateRecommendations({
    emergencyFundRatio,
    debtToIncomeRatio,
    savingsRate,
    creditUtilization,
    overallScore,
  });

  // Net Worth, Assets, Liabilities
  const totalAssets = accounts.filter(a => getFinancialGroup(a.type) === 'Assets').reduce((sum, a) => sum + (a.balances[0]?.current || 0), 0);
  const totalLiabilities = accounts.filter(a => getFinancialGroup(a.type) === 'Liabilities').reduce((sum, a) => sum + Math.abs(a.balances[0]?.current || 0), 0);
  const netWorth = totalAssets - totalLiabilities;

  // Log key metrics only (removed verbose debug logging)
  console.log(`[Financial Health] Score: ${overallScore}, Net Worth: $${netWorth.toLocaleString()}, Emergency Fund: ${emergencyFundRatio.toFixed(1)} months`);

  // Store the metrics
  await prisma.financialHealthMetrics.create({
    data: {
      userId,
      overallScore,
      emergencyFundRatio,
      debtToIncomeRatio,
      savingsRate,
      creditUtilization,
    },
  });

  return {
    overallScore,
    emergencyFundRatio,
    debtToIncomeRatio,
    savingsRate,
    creditUtilization,
    recommendations,
  };
}

function calculateEmergencyFundRatio(
  accounts: (Account & { balances: any[] })[],
  recurringExpenses: any[]
): number {
  const liquidAssets = accounts
    .filter(isLiquidForEmergencyFund)
    .reduce((total, account) => {
      const balance = account.balances[0]?.current || 0;
      return total + balance;
    }, 0);
  const monthlyExpenses = recurringExpenses.reduce((total, expense) => {
    let monthlyAmount = expense.amount;
    switch (expense.frequency) {
      case 'weekly':
        monthlyAmount = expense.amount * 4.33;
        break;
      case 'bi-weekly':
        monthlyAmount = expense.amount * 2.17;
        break;
      case 'quarterly':
        monthlyAmount = expense.amount / 3;
        break;
      case 'yearly':
        monthlyAmount = expense.amount / 12;
        break;
    }
    return total + monthlyAmount;
  }, 0);
  // Removed verbose debug logging
  return monthlyExpenses > 0 ? liquidAssets / monthlyExpenses : 0;
}

function calculateDebtToIncomeRatio(
  accounts: (Account & { balances: any[] })[],
  recurringPayments: any[],
  recurringExpenses: any[]
): number {
  // Industry-standard DTI: (Total Monthly Debt Payments + Recurring Expenses) / Gross Monthly Income
  // Numerator: sum of minimum monthly payments from debt accounts (if available) + all recurring monthly expenses (deduplicated by amount)
  // Denominator: sum of recurring payments (normalized to monthly)

  // 1. Sum minimum monthly payments from debt accounts (credit, loan, line of credit)
  let totalMonthlyDebtPayments = 0;
  const minPaymentAmounts = new Set<number>();
  accounts
    .filter(account => ['credit', 'loan', 'line of credit'].includes(account.type))
    .forEach(account => {
      const minPayment = account.minimumPaymentAmount;
      if (typeof minPayment === 'number' && minPayment > 0) {
        totalMonthlyDebtPayments += minPayment;
        minPaymentAmounts.add(minPayment);
      }
    });

  // 2. Add all recurring monthly expenses (normalized to monthly), skipping any whose amount matches a minimum payment
  const recurringMonthlyExpenses = recurringExpenses.reduce((total, expense) => {
    let monthlyAmount = expense.amount;
    switch (expense.frequency) {
      case 'weekly':
        monthlyAmount = expense.amount * 4.33;
        break;
      case 'bi-weekly':
        monthlyAmount = expense.amount * 2.17;
        break;
      case 'quarterly':
        monthlyAmount = expense.amount / 3;
        break;
      case 'yearly':
        monthlyAmount = expense.amount / 12;
        break;
    }
    // Deduplicate: only add if this monthlyAmount is not already in minPaymentAmounts
    if (!minPaymentAmounts.has(monthlyAmount)) {
      return total + monthlyAmount;
    } else {
      // Optionally log deduplication
      // console.log(`[DTI Deduplication] Skipping recurring expense amount already counted as minimum payment: $${monthlyAmount}`);
      return total;
    }
  }, 0);
  totalMonthlyDebtPayments += recurringMonthlyExpenses;

  // 3. Calculate monthly income from recurring payments (normalized to monthly)
  const monthlyIncome = recurringPayments.reduce((total, payment) => {
    let monthlyAmount = payment.amount;
    switch (payment.frequency) {
      case 'weekly':
        monthlyAmount = payment.amount * 4.33;
        break;
      case 'bi-weekly':
        monthlyAmount = payment.amount * 2.17;
        break;
      case 'quarterly':
        monthlyAmount = payment.amount / 3;
        break;
      case 'yearly':
        monthlyAmount = payment.amount / 12;
        break;
    }
    return total + monthlyAmount;
  }, 0);

  // Removed verbose debug logging
  return monthlyIncome > 0 ? totalMonthlyDebtPayments / monthlyIncome : 0;
}

function calculateSavingsRate(
  transactions: Transaction[],
  recurringPayments: any[]
): number {
  const monthlyIncome = recurringPayments.reduce((total, payment) => {
    let monthlyAmount = payment.amount;
    switch (payment.frequency) {
      case 'weekly':
        monthlyAmount = payment.amount * 4.33;
        break;
      case 'bi-weekly':
        monthlyAmount = payment.amount * 2.17;
        break;
      case 'quarterly':
        monthlyAmount = payment.amount / 3;
        break;
      case 'yearly':
        monthlyAmount = payment.amount / 12;
        break;
    }
    return total + monthlyAmount;
  }, 0);
  const monthlyExpenses = transactions
    .filter(t => t.amount < 0)
    .reduce((total, transaction) => total + Math.abs(transaction.amount), 0);
  // Removed verbose debug logging
  return monthlyIncome > 0 ? ((monthlyIncome - monthlyExpenses) / monthlyIncome) * 100 : 0;
}

function calculateCreditUtilization(accounts: (Account & { balances: any[] })[]): number {
  const creditAccounts = accounts.filter(account => 
    ['credit', 'line of credit'].includes(account.type)
  );
  if (creditAccounts.length === 0) return 0;
  let totalBalance = 0;
  let totalLimit = 0;
  for (const account of creditAccounts) {
    const balance = account.balances[0];
    if (!balance) continue;
    totalBalance += Math.abs(balance.current || 0);
    totalLimit += balance.limit || 0;
  }
  // Removed verbose debug logging
  return totalLimit > 0 ? (totalBalance / totalLimit) * 100 : 0;
}

function calculateOverallScore(metrics: {
  emergencyFundRatio: number;
  debtToIncomeRatio: number;
  savingsRate: number;
  creditUtilization: number;
}): number {
  let score = 0;

  // Emergency fund ratio (0-25 points)
  if (metrics.emergencyFundRatio >= 6) score += 25;
  else if (metrics.emergencyFundRatio >= 3) score += 20;
  else if (metrics.emergencyFundRatio >= 1) score += 10;
  else score += 5;

  // Debt-to-income ratio (0-25 points)
  if (metrics.debtToIncomeRatio <= 0.28) score += 25;
  else if (metrics.debtToIncomeRatio <= 0.36) score += 20;
  else if (metrics.debtToIncomeRatio <= 0.43) score += 15;
  else if (metrics.debtToIncomeRatio <= 0.50) score += 10;
  else score += 5;

  // Savings rate (0-25 points)
  if (metrics.savingsRate >= 20) score += 25;
  else if (metrics.savingsRate >= 15) score += 20;
  else if (metrics.savingsRate >= 10) score += 15;
  else if (metrics.savingsRate >= 5) score += 10;
  else score += 5;

  // Credit utilization (0-25 points)
  if (metrics.creditUtilization <= 10) score += 25;
  else if (metrics.creditUtilization <= 20) score += 20;
  else if (metrics.creditUtilization <= 30) score += 15;
  else if (metrics.creditUtilization <= 40) score += 10;
  else score += 5;

  return Math.min(100, Math.max(0, score));
}

function generateRecommendations(metrics: {
  emergencyFundRatio: number;
  debtToIncomeRatio: number;
  savingsRate: number;
  creditUtilization: number;
  overallScore: number;
}): FinancialRecommendation[] {
  const recommendations: FinancialRecommendation[] = [];

  // Emergency fund recommendations
  if (metrics.emergencyFundRatio < 3) {
    recommendations.push({
      priority: 'high',
      title: 'Build Emergency Fund',
      description: `You have ${metrics.emergencyFundRatio.toFixed(1)} months of expenses saved. Aim for 3-6 months.`,
      action: 'Increase savings to cover 3-6 months of expenses',
    });
  }

  // Debt-to-income recommendations
  if (metrics.debtToIncomeRatio > 0.36) {
    recommendations.push({
      priority: 'high',
      title: 'Reduce Debt',
      description: `Your debt-to-income ratio is ${(metrics.debtToIncomeRatio * 100).toFixed(1)}%. Keep it under 36%.`,
      action: 'Focus on paying down high-interest debt first',
    });
  }

  // Savings rate recommendations
  if (metrics.savingsRate < 15) {
    recommendations.push({
      priority: 'medium',
      title: 'Increase Savings Rate',
      description: `You're saving ${metrics.savingsRate.toFixed(1)}% of your income. Aim for 15-20%.`,
      action: 'Set up automatic transfers to savings accounts',
    });
  }

  // Credit utilization recommendations
  if (metrics.creditUtilization > 30) {
    recommendations.push({
      priority: 'medium',
      title: 'Lower Credit Utilization',
      description: `You're using ${metrics.creditUtilization.toFixed(1)}% of your available credit. Keep it under 30%.`,
      action: 'Pay down credit card balances',
    });
  }

  // Positive reinforcement
  if (metrics.overallScore >= 80) {
    recommendations.push({
      priority: 'low',
      title: 'Excellent Financial Health!',
      description: 'You\'re doing great! Consider investing for long-term goals.',
      action: 'Review investment options for excess savings',
    });
  }

  return recommendations.slice(0, 3); // Return top 3 recommendations
}

export async function getFinancialHealthTrend(): Promise<FinancialHealthTrend | null> {
  const userId = 'default';
  const metrics = await prisma.financialHealthMetrics.findMany({
    where: { userId },
    orderBy: { calculatedAt: 'desc' },
    take: 2,
  });

  if (metrics.length < 2) return null;

  const currentScore = metrics[0].overallScore;
  const previousScore = metrics[1].overallScore;
  const change = currentScore - previousScore;

  return {
    score: currentScore,
    change,
    period: 'month',
  };
} 