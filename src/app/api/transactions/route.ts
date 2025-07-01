import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/db";
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, format, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval } from "date-fns";

interface WhereClause {
  accountId?: { in: string[] };
  date?: { gte?: Date; lte?: Date };
  category?: { in: string[] };
  amount?: { gte?: number; lte?: number; gt?: number; lt?: number };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse query parameters
    const period = searchParams.get('period') || 'monthly';
    const accountIds = searchParams.get('accountIds')?.split(',') || [];
    const showIncome = searchParams.get('showIncome') !== 'false';
    const showExpenses = searchParams.get('showExpenses') !== 'false';
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');
    const categories = searchParams.get('categories')?.split(',') || [];
    const minAmount = searchParams.get('minAmount') ? parseFloat(searchParams.get('minAmount')!) : undefined;
    const maxAmount = searchParams.get('maxAmount') ? parseFloat(searchParams.get('maxAmount')!) : undefined;

    // Build where clause for transactions
    const whereClause: WhereClause = {};
    
    if (accountIds.length > 0) {
      whereClause.accountId = { in: accountIds };
    }
    
    // Determine date range for filtering
    let startDate: Date;
    let endDate: Date;
    
    if (startDateStr && endDateStr) {
      // Use provided date range
      startDate = new Date(startDateStr);
      endDate = new Date(endDateStr);
    } else {
      // Auto-generate date range based on period
      const now = new Date();
      
      switch (period) {
        case 'daily':
          startDate = startOfDay(now);
          endDate = endOfDay(now);
          break;
        case 'weekly':
          startDate = startOfWeek(now);
          endDate = endOfWeek(now);
          break;
        case 'monthly':
          startDate = startOfMonth(now);
          endDate = endOfMonth(now);
          break;
        case 'quarterly':
          // Calculate current quarter
          const quarter = Math.floor(now.getMonth() / 3);
          startDate = new Date(now.getFullYear(), quarter * 3, 1);
          endDate = new Date(now.getFullYear(), (quarter + 1) * 3, 0, 23, 59, 59, 999);
          break;
        case 'yearly':
          startDate = new Date(now.getFullYear(), 0, 1);
          endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
          break;
        default:
          // Default to current month if period is not recognized
          startDate = startOfMonth(now);
          endDate = endOfMonth(now);
      }
    }
    
    // Always apply date filtering to ensure we never return all transactions
    whereClause.date = { gte: startDate, lte: endDate };
    
    if (categories.length > 0) {
      whereClause.category = { in: categories };
    }
    
    if (minAmount !== undefined || maxAmount !== undefined) {
      whereClause.amount = {};
      if (minAmount !== undefined) whereClause.amount.gte = minAmount;
      if (maxAmount !== undefined) whereClause.amount.lte = maxAmount;
    }

    // Filter by transaction type (income vs expenses)
    if (!showIncome || !showExpenses) {
      if (showIncome && !showExpenses) {
        whereClause.amount = { ...whereClause.amount, gt: 0 };
      } else if (!showIncome && showExpenses) {
        whereClause.amount = { ...whereClause.amount, lt: 0 };
      }
    }

    // Get transactions
    const transactions = await prisma.transaction.findMany({
      where: whereClause,
      orderBy: {
        date: 'asc',
      },
      select: {
        id: true,
        date: true,
        name: true,
        amount: true,
        category: true,
        merchantName: true,
        pending: true,
        account: {
          select: {
            name: true,
            type: true,
            plaidItem: {
              select: {
                institutionName: true,
              },
            },
          },
        },
      },
    });

    // Get categoryAi values separately using raw SQL
    const categoryAiData = await prisma.$queryRawUnsafe(`
      SELECT id, "categoryAi" FROM "Transaction" 
      WHERE id IN (${transactions.map(t => `'${t.id}'`).join(',')})
    `);

    // Create a map of id to categoryAi
    const categoryAiMap = new Map();
    (categoryAiData as any[]).forEach(row => {
      categoryAiMap.set(row.id, row.categoryAi);
    });

    // Add categoryAi to each transaction
    const transactionsWithCategoryAi = transactions.map(t => ({
      ...t,
      categoryAi: categoryAiMap.get(t.id) || null
    }));

    // Aggregate transactions by period
    let aggregatedData: Array<{ period: string; income: number; expenses: number; net: number }> = [];

    if (period === 'daily') {
      const days = eachDayOfInterval({ start: startDate, end: endDate });
      aggregatedData = days.map((day: Date) => {
        const dayStart = startOfDay(day);
        const dayEnd = endOfDay(day);
        
        const dayTransactions = transactionsWithCategoryAi.filter((tx) => {
          const txDate = new Date(tx.date);
          return txDate >= dayStart && txDate <= dayEnd;
        });

        const income = dayTransactions
          .filter((tx) => tx.amount > 0)
          .reduce((sum, tx) => sum + tx.amount, 0);
        
        const expenses = dayTransactions
          .filter((tx) => tx.amount < 0)
          .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

        return {
          period: format(day, 'MMM d, yyyy'),
          income,
          expenses,
          net: income - expenses,
        };
      });
    } else if (period === 'weekly') {
      const weeks = eachWeekOfInterval({ start: startDate, end: endDate });
      aggregatedData = weeks.map((week: Date) => {
        const weekStart = startOfWeek(week);
        const weekEnd = endOfWeek(week);
        
        const weekTransactions = transactionsWithCategoryAi.filter((tx) => {
          const txDate = new Date(tx.date);
          return txDate >= weekStart && txDate <= weekEnd;
        });

        const income = weekTransactions
          .filter((tx) => tx.amount > 0)
          .reduce((sum, tx) => sum + tx.amount, 0);
        
        const expenses = weekTransactions
          .filter((tx) => tx.amount < 0)
          .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

        return {
          period: format(week, 'MMM d, yyyy'),
          income,
          expenses,
          net: income - expenses,
        };
      });
    } else {
      // monthly
      const months = eachMonthOfInterval({ start: startDate, end: endDate });
      aggregatedData = months.map((month: Date) => {
        const monthStart = startOfMonth(month);
        const monthEnd = endOfMonth(month);
        
        const monthTransactions = transactionsWithCategoryAi.filter((tx) => {
          const txDate = new Date(tx.date);
          return txDate >= monthStart && txDate <= monthEnd;
        });

        const income = monthTransactions
          .filter((tx) => tx.amount > 0)
          .reduce((sum, tx) => sum + tx.amount, 0);
        
        const expenses = monthTransactions
          .filter((tx) => tx.amount < 0)
          .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

        return {
          period: format(month, 'MMM yyyy'),
          income,
          expenses,
          net: income - expenses,
        };
      });
    }

    // Get available accounts for settings
    const accounts = await prisma.account.findMany({
      where: {
        hidden: false,
      },
      select: {
        id: true,
        name: true,
        type: true,
        nickname: true,
        mask: true,
        plaidItem: {
          select: {
            institutionName: true,
          },
        },
      },
      orderBy: [
        { plaidItem: { institutionName: 'asc' } },
        { name: 'asc' },
      ],
    });

    // Get available categories
    const categoriesData = await prisma.transaction.groupBy({
      by: ['category'],
      where: {
        category: { not: null },
      },
      _count: {
        category: true,
      },
      orderBy: {
        _count: {
          category: 'desc',
        },
      },
    });

    return NextResponse.json({
      data: aggregatedData,
      transactions: transactionsWithCategoryAi,
      accounts,
      categories: categoriesData.map((c) => c.category).filter(Boolean),
      summary: {
        totalIncome: aggregatedData.reduce((sum, d) => sum + d.income, 0),
        totalExpenses: aggregatedData.reduce((sum, d) => sum + d.expenses, 0),
        netAmount: aggregatedData.reduce((sum, d) => sum + d.net, 0),
        transactionCount: transactionsWithCategoryAi.length,
      },
    });
  } catch (error) {
    const errorMessage = error ? (error instanceof Error ? error.message : String(error)) : 'Unknown error';
    console.log('Error fetching transaction data:', {
      message: errorMessage,
      errorType: error ? typeof error : 'null/undefined'
    });
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
  }
} 