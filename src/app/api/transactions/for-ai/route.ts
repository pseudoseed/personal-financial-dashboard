import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/db';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '1000', 10);

  try {
    const transactions = await prisma.transaction.findMany({
      where: {
        amount: {
          lt: 0,
        },
      },
      take: limit,
      orderBy: {
        date: 'desc',
      },
      select: {
        id: true,
        name: true,
        amount: true,
        category: true,
        categoryAi: true,
      },
    });

    return NextResponse.json({ transactions });
  } catch (error) {
    console.error('Error in /api/transactions/for-ai:', error);
    return NextResponse.json({ error: 'Failed to fetch transactions for AI' }, { status: 500 });
  }
}
