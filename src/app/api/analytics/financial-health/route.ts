import { NextRequest, NextResponse } from 'next/server';
import { calculateFinancialHealth, getFinancialHealthTrend } from '@/lib/financialHealth';

export async function GET(request: NextRequest) {
  try {
    const userId = "cmccxbmo000008of2p0eyw0o5"; // Default user for now

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
    console.error('Error calculating financial health:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: 'Failed to calculate financial health metrics', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 