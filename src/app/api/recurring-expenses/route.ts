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