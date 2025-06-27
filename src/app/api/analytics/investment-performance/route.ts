import { NextRequest, NextResponse } from 'next/server';
import { calculateInvestmentPerformance, SnapshotType } from '@/lib/investmentPerformance';
import { getCurrentUserId } from '@/lib/userManagement';

export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    const { searchParams } = new URL(request.url);
    const snapshotType = (searchParams.get('snapshotType') as SnapshotType) || 'weekly';

    console.log('Calculating investment performance for user:', userId, 'with snapshot type:', snapshotType);

    // Calculate investment performance
    const performance = await calculateInvestmentPerformance(userId, snapshotType);
    
    console.log('Investment performance calculated:', {
      portfolioValue: performance.portfolioValue,
      changePercent: performance.changePercent,
      assetAllocationCount: performance.assetAllocation.length,
      historicalDataPoints: performance.historicalData.length,
    });

    return NextResponse.json(performance);
  } catch (error) {
    console.error('Error calculating investment performance:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: 'Failed to calculate investment performance', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 