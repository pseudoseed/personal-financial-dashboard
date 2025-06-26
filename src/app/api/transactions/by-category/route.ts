import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const accountIds = searchParams.get('accountIds')?.split(',') || [];
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');
    const minAmount = searchParams.get('minAmount') ? parseFloat(searchParams.get('minAmount')!) : undefined;
    const maxAmount = searchParams.get('maxAmount') ? parseFloat(searchParams.get('maxAmount')!) : undefined;
    const limit = parseInt(searchParams.get('limit') || '1000', 10);
    const categoryType = searchParams.get('categoryType') || 'granular'; // 'granular' or 'general'

    if (!category) {
      return NextResponse.json({ error: 'Category parameter is required' }, { status: 400 });
    }

    // Build where clause for transactions - match the same logic as /api/transactions/for-ai
    const whereClause: any = {};

    // Filter by account IDs
    if (accountIds.length > 0) {
      whereClause.accountId = { in: accountIds };
    }

    // Filter by date range
    if (startDateStr || endDateStr) {
      whereClause.date = {};
      if (startDateStr) whereClause.date.gte = new Date(startDateStr);
      if (endDateStr) whereClause.date.lte = new Date(endDateStr);
    }

    // Filter by amount range
    if (minAmount !== undefined || maxAmount !== undefined) {
      whereClause.amount = { ...whereClause.amount };
      if (minAmount !== undefined) whereClause.amount.gte = minAmount;
      if (maxAmount !== undefined) whereClause.amount.lte = maxAmount;
    }

    // Get all transactions first, then filter by category logic
    const allTransactions = await prisma.transaction.findMany({
      where: whereClause,
      take: limit * 2, // Get more transactions to account for filtering
      orderBy: {
        date: 'desc',
      },
      select: {
        id: true,
        date: true,
        name: true,
        amount: true,
        category: true,
        merchantName: true,
        pending: true,
        accountId: true,
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

    // Filter transactions by category only (no spend logic)
    const filteredTransactions = allTransactions.filter(tx => {
      const t = tx as any;
      const effectiveCategory = categoryType === 'general'
        ? (t.categoryAiGeneral || t.categoryAiGranular || t.category || 'Miscellaneous')
        : (t.categoryAiGranular || t.categoryAiGeneral || t.category || 'Miscellaneous');
      return effectiveCategory === category;
    }).slice(0, limit);

    // Calculate summary statistics
    const totalAmount = filteredTransactions.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
    const transactionCount = filteredTransactions.length;
    const averageAmount = transactionCount > 0 ? totalAmount / transactionCount : 0;

    return NextResponse.json({
      transactions: filteredTransactions,
      summary: {
        totalAmount,
        transactionCount,
        averageAmount,
        category,
        categoryType,
      },
    });
  } catch (error) {
    console.error('Error fetching transactions by category:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transactions by category' },
      { status: 500 }
    );
  }
} 