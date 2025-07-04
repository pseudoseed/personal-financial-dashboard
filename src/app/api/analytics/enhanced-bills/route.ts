import { NextRequest, NextResponse } from 'next/server';
import { getEnhancedBillsData } from '@/lib/enhancedBills';
import { getCurrentUserId } from '@/lib/userManagement';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();

    console.log('Getting enhanced bills data for user:', userId);

    // Get enhanced bills data
    // Add debug logging for raw data
    const accounts = await prisma.account.findMany({
      where: { userId, hidden: false, type: { in: ['credit', 'loan'] } },
      include: {
        balances: {
          orderBy: { date: 'desc' },
          take: 1,
        },
      },
    });
    const recurringPayments = await prisma.recurringPayment.findMany({ where: { userId } });
    const recurringExpenses = await prisma.recurringExpense.findMany({ where: { userId } });

    // Removed large JSON dumps for cleaner logging

    const billsData = await getEnhancedBillsData(userId);
    
    console.log(`[Enhanced Bills] Calculated: ${billsData.upcomingBills.length} upcoming bills, ${billsData.paymentHistory.length} payment history entries`);

    return NextResponse.json(billsData);
  } catch (error) {
    console.error('Error getting enhanced bills data:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: 'Failed to get enhanced bills data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 