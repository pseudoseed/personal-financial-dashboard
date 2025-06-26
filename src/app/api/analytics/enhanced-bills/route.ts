import { NextRequest, NextResponse } from 'next/server';
import { getEnhancedBillsData } from '@/lib/enhancedBills';

export async function GET(request: NextRequest) {
  try {
    const userId = "cmccxbmo000008of2p0eyw0o5"; // Default user for now

    console.log('Getting enhanced bills data for user:', userId);

    // Get enhanced bills data
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