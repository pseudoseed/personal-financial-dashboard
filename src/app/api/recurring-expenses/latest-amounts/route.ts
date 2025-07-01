import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserId } from '@/lib/userManagement';

// POST: Batch fetch latest transaction amounts for a list of merchantNames/names
export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    const { merchants } = await request.json(); // [{ merchantName, name }]
    if (!Array.isArray(merchants)) {
      return NextResponse.json({ error: 'Invalid merchants array' }, { status: 400 });
    }
    // For each merchant, fetch the latest transaction
    const results = await Promise.all(
      merchants.map(async ({ merchantName, name }) => {
        const where: any = {
          account: { userId },
          amount: { lt: 0 },
        };
        if (merchantName) {
          where.merchantName = merchantName;
        } else if (name) {
          where.name = name;
        }
        const tx = await prisma.transaction.findFirst({
          where,
          orderBy: { date: 'desc' },
        });
        return {
          merchantName,
          name,
          latestAmount: tx ? Math.abs(tx.amount) : null,
          latestDate: tx ? tx.date : null,
        };
      })
    );
    return NextResponse.json({ results });
  } catch (error) {
    console.error('Error in /api/recurring-expenses/latest-amounts:', error);
    return NextResponse.json({ error: 'Failed to fetch latest amounts' }, { status: 500 });
  }
} 