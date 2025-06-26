import { NextRequest, NextResponse } from 'next/server';
import { calculateFinancialHealth, getFinancialHealthTrend } from '@/lib/financialHealth';

export async function GET(request: NextRequest) {
  try {
    const userId = "default"; // Use the default user ID that matches database initialization

    console.log('Calculating financial health for user:', userId);

    // Calculate current financial health
    const metrics = await calculateFinancialHealth(userId);
    
    console.log('Financial health metrics calculated:', metrics);
    
    // Get trend data
    const trend = await getFinancialHealthTrend(userId);

    return NextResponse.json({
      ...metrics,
      trend,
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : JSON.stringify(error);
    const errStack = error instanceof Error ? error.stack : undefined;
    console.error('Error calculating financial health:', errMsg);
    if (errStack) console.error('Error stack:', errStack);
    return NextResponse.json(
      { error: 'Failed to calculate financial health metrics', details: errMsg },
      { status: 500 }
    );
  }
} 