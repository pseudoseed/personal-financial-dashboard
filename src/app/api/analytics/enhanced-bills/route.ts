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

    console.log('DEBUG: Raw accounts:', JSON.stringify(accounts, null, 2));
    console.log('DEBUG: Raw recurringPayments:', JSON.stringify(recurringPayments, null, 2));
    console.log('DEBUG: Raw recurringExpenses:', JSON.stringify(recurringExpenses, null, 2));

    const billsData = await getEnhancedBillsData(userId);
    
    console.log('Enhanced bills data calculated:', {
      upcomingBillsCount: billsData.upcomingBills.length,
      paymentHistoryCount: billsData.paymentHistory.length,
      insightsCount: billsData.paymentInsights.length,
      cashFlow: {
        next30Days: billsData.cashFlowForecast.next30Days.netFlow,
        next90Days: billsData.cashFlowForecast.next90Days.netFlow,
      },
    });

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