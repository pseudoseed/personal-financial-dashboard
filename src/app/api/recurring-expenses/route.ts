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
    let body;
    try {
      body = await request.json();
    } catch (jsonError) {
      console.error('Invalid or missing JSON in request body:', jsonError);
      return NextResponse.json(
        { error: 'Invalid or missing JSON in request body' },
        { status: 400 }
      );
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      console.error('Request body must be a valid JSON object:', body);
      return NextResponse.json(
        { error: 'Request body must be a valid JSON object' },
        { status: 400 }
      );
    }

    console.log('Attempting to create recurring expense with body:', body);

    const recurringExpense = await prisma.recurringExpense.create({
      data: {
        ...body,
        userId,
      },
    });

    return NextResponse.json(recurringExpense);
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