import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { detectRecurringExpenses, saveDetectedExpenses } from '@/lib/recurringExpenseDetection';

// GET: List all recurring expenses
export async function GET(request: NextRequest) {
  try {
    const userId = 'default'; // TODO: Replace with real user auth
    const expenses = await prisma.recurringExpense.findMany({
      where: { userId },
      orderBy: [{ nextDueDate: 'asc' }, { confidence: 'desc' }],
      include: { transactions: true },
    });
    return NextResponse.json({ expenses });
  } catch (error) {
    console.error('Error fetching recurring expenses:', error);
    return NextResponse.json({ error: 'Failed to fetch recurring expenses' }, { status: 500 });
  }
}

// POST: Detect new recurring expenses
export async function POST(request: NextRequest) {
  try {
    const userId = 'default'; // TODO: Replace with real user auth
    
    console.log('Starting recurring expense detection...');
    const detected = await detectRecurringExpenses(userId);
    
    if (detected.length > 0) {
      console.log(`Saving ${detected.length} detected expenses...`);
      const saved = await saveDetectedExpenses(userId, detected);
      
      return NextResponse.json({ 
        detected: saved,
        message: `Found and saved ${saved.length} new recurring expenses`
      });
    } else {
      return NextResponse.json({ 
        detected: [],
        message: 'No new recurring expenses detected'
      });
    }
  } catch (error) {
    console.error('Error detecting recurring expenses:', error);
    return NextResponse.json({ error: 'Failed to detect recurring expenses' }, { status: 500 });
  }
} 