import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { detectRecurringExpenses, saveDetectedExpenses } from '@/lib/recurringExpenseDetection';
import { getCurrentUserId } from '@/lib/userManagement';

// GET: List all recurring expenses
export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    
    const recurringExpenses = await prisma.recurringExpense.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(recurringExpenses);
  } catch (error) {
    console.error('Error fetching recurring expenses:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recurring expenses' },
      { status: 500 }
    );
  }
}

// POST: Detect new recurring expenses
export async function POST(request: NextRequest) {
  // Use .pathname for subroute detection in Next.js API routes
  const pathname = (request.nextUrl && typeof request.nextUrl.pathname === 'string') ? request.nextUrl.pathname : '';
  if (pathname.endsWith('/latest-amounts')) {
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
  try {
    const userId = await getCurrentUserId();
    let body = null;
    try {
      body = await request.json();
    } catch (jsonError) {
      // No body or invalid JSON: treat as detection request
    }

    if (!body || (typeof body === 'object' && Object.keys(body).length === 0)) {
      // Detection flow: no body or empty object
      const detected = await detectRecurringExpenses(userId);
      if (detected.length > 0) {
        await saveDetectedExpenses(userId, detected);
      }
      return NextResponse.json({ detected });
    } else {
      // Manual creation flow
      console.log('Attempting to create recurring expense with body:', body);
      const recurringExpense = await prisma.recurringExpense.create({
        data: {
          ...body,
          userId,
        },
      });
      return NextResponse.json(recurringExpense);
    }
  } catch (error) {
    console.error('Error creating recurring expense:', error);
    if (error instanceof Error && error.message) {
      console.error('Error message:', error.message);
    }
    if (error instanceof Error && error.stack) {
      console.error('Error stack:', error.stack);
    }
    return NextResponse.json(
      { error: 'Failed to create recurring expense', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
} 