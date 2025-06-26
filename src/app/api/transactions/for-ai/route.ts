import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/db';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '1000', 10);
  const accountIds = searchParams.get('accountIds')?.split(',') || [];
  const startDateStr = searchParams.get('startDate');
  const endDateStr = searchParams.get('endDate');
  const categories = searchParams.get('categories')?.split(',') || [];
  const minAmount = searchParams.get('minAmount') ? parseFloat(searchParams.get('minAmount')!) : undefined;
  const maxAmount = searchParams.get('maxAmount') ? parseFloat(searchParams.get('maxAmount')!) : undefined;

  try {
    // Build where clause for transactions
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

    // Filter by categories
    if (categories.length > 0) {
      whereClause.category = { in: categories };
    }

    // Filter by amount range
    if (minAmount !== undefined || maxAmount !== undefined) {
      whereClause.amount = { ...whereClause.amount };
      if (minAmount !== undefined) whereClause.amount.gte = minAmount;
      if (maxAmount !== undefined) whereClause.amount.lte = maxAmount;
    }

    const transactions = await prisma.transaction.findMany({
      where: whereClause,
      take: limit,
      orderBy: {
        date: 'desc',
      },
      select: {
        id: true,
        name: true,
        amount: true,
        category: true,
        categoryAiGranular: true,
        categoryAiGeneral: true,
      },
    });

    return NextResponse.json({ transactions: transactions || [] });
  } catch (error) {
    const errObj = error instanceof Error ? error : { message: String(error) };
    console.error('Error in /api/transactions/for-ai:', errObj);
    return NextResponse.json({ error: 'Failed to fetch transactions for AI' }, { status: 500 });
  }
}
