import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/db';
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const accountIds = searchParams.get('accountIds')?.split(',') || [];
    const baseMonth = searchParams.get('baseMonth'); // Format: YYYY-MM

    // Determine the months to compare
    let currentMonthStart: Date;
    let currentMonthEnd: Date;
    let previousMonthStart: Date;
    let previousMonthEnd: Date;

    if (baseMonth) {
      const [year, month] = baseMonth.split('-').map(Number);
      currentMonthStart = new Date(year, month - 1, 1);
      currentMonthEnd = endOfMonth(currentMonthStart);
      previousMonthStart = subMonths(currentMonthStart, 1);
      previousMonthEnd = endOfMonth(previousMonthStart);
    } else {
      // Default to current month vs previous month
      currentMonthStart = startOfMonth(new Date());
      currentMonthEnd = endOfMonth(currentMonthStart);
      previousMonthStart = subMonths(currentMonthStart, 1);
      previousMonthEnd = endOfMonth(previousMonthStart);
    }

    // Build where clause
    const whereClause: any = {};
    if (accountIds.length > 0) {
      whereClause.accountId = { in: accountIds };
    }

    // Get current month transactions
    const currentMonthTransactions = await prisma.transaction.findMany({
      where: {
        ...whereClause,
        date: {
          gte: currentMonthStart,
          lte: currentMonthEnd,
        },
      },
      select: {
        id: true,
        date: true,
        name: true,
        amount: true,
        category: true,
        categoryAi: true,
        merchantName: true,
        account: {
          select: {
            type: true,
          },
        },
      },
    });

    // Get previous month transactions
    const previousMonthTransactions = await prisma.transaction.findMany({
      where: {
        ...whereClause,
        date: {
          gte: previousMonthStart,
          lte: previousMonthEnd,
        },
      },
      select: {
        id: true,
        date: true,
        name: true,
        amount: true,
        category: true,
        categoryAi: true,
        merchantName: true,
        account: {
          select: {
            type: true,
          },
        },
      },
    });

    // Calculate overall metrics
    const currentMonthIncome = currentMonthTransactions
      .filter(t => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);
    
    const currentMonthExpenses = currentMonthTransactions
      .filter(t => t.amount < 0)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const previousMonthIncome = previousMonthTransactions
      .filter(t => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);
    
    const previousMonthExpenses = previousMonthTransactions
      .filter(t => t.amount < 0)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    // Calculate category breakdown
    const currentMonthByCategory = groupTransactionsByCategory(currentMonthTransactions);
    const previousMonthByCategory = groupTransactionsByCategory(previousMonthTransactions);

    // Calculate changes
    const incomeChange = currentMonthIncome - previousMonthIncome;
    const incomeChangePercent = previousMonthIncome > 0 ? (incomeChange / previousMonthIncome) * 100 : 0;
    
    const expenseChange = currentMonthExpenses - previousMonthExpenses;
    const expenseChangePercent = previousMonthExpenses > 0 ? (expenseChange / previousMonthExpenses) * 100 : 0;

    const netChange = (currentMonthIncome - currentMonthExpenses) - (previousMonthIncome - previousMonthExpenses);

    // Calculate category changes
    const categoryChanges = calculateCategoryChanges(currentMonthByCategory, previousMonthByCategory);

    // Get top spending categories
    const topCategories = Object.entries(currentMonthByCategory)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([category, amount]) => ({
        category,
        amount,
        previousAmount: previousMonthByCategory[category] || 0,
        change: amount - (previousMonthByCategory[category] || 0),
        changePercent: previousMonthByCategory[category] > 0 
          ? ((amount - previousMonthByCategory[category]) / previousMonthByCategory[category]) * 100 
          : 0,
      }));

    // Calculate transaction count changes
    const currentMonthCount = currentMonthTransactions.length;
    const previousMonthCount = previousMonthTransactions.length;
    const transactionCountChange = currentMonthCount - previousMonthCount;

    return NextResponse.json({
      periods: {
        current: {
          start: currentMonthStart,
          end: currentMonthEnd,
          label: format(currentMonthStart, 'MMMM yyyy'),
        },
        previous: {
          start: previousMonthStart,
          end: previousMonthEnd,
          label: format(previousMonthStart, 'MMMM yyyy'),
        },
      },
      summary: {
        income: {
          current: currentMonthIncome,
          previous: previousMonthIncome,
          change: incomeChange,
          changePercent: incomeChangePercent,
        },
        expenses: {
          current: currentMonthExpenses,
          previous: previousMonthExpenses,
          change: expenseChange,
          changePercent: expenseChangePercent,
        },
        net: {
          current: currentMonthIncome - currentMonthExpenses,
          previous: previousMonthIncome - previousMonthExpenses,
          change: netChange,
        },
        transactionCount: {
          current: currentMonthCount,
          previous: previousMonthCount,
          change: transactionCountChange,
        },
      },
      categories: {
        top: topCategories,
        changes: categoryChanges,
      },
      insights: generateInsights({
        incomeChange,
        incomeChangePercent,
        expenseChange,
        expenseChangePercent,
        netChange,
        topCategories,
        transactionCountChange,
      }),
    });
  } catch (error) {
    console.error('Error calculating month-over-month comparison:', error);
    return NextResponse.json(
      { error: 'Failed to calculate month-over-month comparison' },
      { status: 500 }
    );
  }
}

function groupTransactionsByCategory(transactions: any[]): Record<string, number> {
  const grouped: Record<string, number> = {};
  
  transactions
    .filter(t => t.amount < 0) // Only expenses
    .forEach(transaction => {
      const category = transaction.categoryAi || transaction.category || 'Uncategorized';
      grouped[category] = (grouped[category] || 0) + Math.abs(transaction.amount);
    });
  
  return grouped;
}

function calculateCategoryChanges(
  current: Record<string, number>,
  previous: Record<string, number>
): Array<{
  category: string;
  current: number;
  previous: number;
  change: number;
  changePercent: number;
  type: 'increase' | 'decrease' | 'new' | 'discontinued';
}> {
  const allCategories = new Set([...Object.keys(current), ...Object.keys(previous)]);
  const changes: any[] = [];

  allCategories.forEach(category => {
    const currentAmount = current[category] || 0;
    const previousAmount = previous[category] || 0;
    const change = currentAmount - previousAmount;
    const changePercent = previousAmount > 0 ? (change / previousAmount) * 100 : 0;

    let type: 'increase' | 'decrease' | 'new' | 'discontinued';
    if (currentAmount > 0 && previousAmount === 0) {
      type = 'new';
    } else if (currentAmount === 0 && previousAmount > 0) {
      type = 'discontinued';
    } else if (change > 0) {
      type = 'increase';
    } else {
      type = 'decrease';
    }

    changes.push({
      category,
      current: currentAmount,
      previous: previousAmount,
      change,
      changePercent,
      type,
    });
  });

  return changes.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
}

function generateInsights(data: {
  incomeChange: number;
  incomeChangePercent: number;
  expenseChange: number;
  expenseChangePercent: number;
  netChange: number;
  topCategories: any[];
  transactionCountChange: number;
}): string[] {
  const insights: string[] = [];

  // Income insights
  if (data.incomeChangePercent > 10) {
    insights.push(`Income increased ${data.incomeChangePercent.toFixed(1)}% from last month`);
  } else if (data.incomeChangePercent < -10) {
    insights.push(`Income decreased ${Math.abs(data.incomeChangePercent).toFixed(1)}% from last month`);
  }

  // Expense insights
  if (data.expenseChangePercent > 10) {
    insights.push(`Spending increased ${data.expenseChangePercent.toFixed(1)}% from last month`);
  } else if (data.expenseChangePercent < -10) {
    insights.push(`Great job! Spending decreased ${Math.abs(data.expenseChangePercent).toFixed(1)}% from last month`);
  }

  // Net change insights
  if (data.netChange > 0) {
    insights.push(`Net cash flow improved by $${data.netChange.toFixed(2)} from last month`);
  } else if (data.netChange < 0) {
    insights.push(`Net cash flow decreased by $${Math.abs(data.netChange).toFixed(2)} from last month`);
  }

  // Top category insights
  const biggestIncrease = data.topCategories
    .filter(c => c.changePercent > 20)
    .sort((a, b) => b.changePercent - a.changePercent)[0];
  
  if (biggestIncrease) {
    insights.push(`${biggestIncrease.category} spending increased ${biggestIncrease.changePercent.toFixed(1)}% from last month`);
  }

  const biggestDecrease = data.topCategories
    .filter(c => c.changePercent < -20)
    .sort((a, b) => a.changePercent - b.changePercent)[0];
  
  if (biggestDecrease) {
    insights.push(`${biggestDecrease.category} spending decreased ${Math.abs(biggestDecrease.changePercent).toFixed(1)}% from last month`);
  }

  // Transaction count insights
  if (data.transactionCountChange > 10) {
    insights.push(`${data.transactionCountChange} more transactions than last month`);
  } else if (data.transactionCountChange < -10) {
    insights.push(`${Math.abs(data.transactionCountChange)} fewer transactions than last month`);
  }

  return insights.slice(0, 5); // Limit to 5 insights
} 