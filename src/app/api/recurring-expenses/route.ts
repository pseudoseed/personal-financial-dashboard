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
    const body = await request.json();

    const recurringExpense = await prisma.recurringExpense.create({
      data: {
        ...body,
        userId,
      },
    });

    return NextResponse.json(recurringExpense);
  } catch (error) {
    console.error('Error creating recurring expense:', error);
    return NextResponse.json(
      { error: 'Failed to create recurring expense' },
      { status: 500 }
    );
  }
} 