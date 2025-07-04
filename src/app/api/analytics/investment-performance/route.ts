import { NextRequest, NextResponse } from 'next/server';
import { calculateInvestmentPerformance, SnapshotType } from '@/lib/investmentPerformance';
import { getCurrentUserId } from '@/lib/userManagement';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const snapshotType = (searchParams.get('snapshotType') as SnapshotType) || 'weekly';

    // Removed verbose debug logging

    // Calculate investment performance
    const performance = await calculateInvestmentPerformance(snapshotType);
    
    console.log(`[Investment Performance] Calculated ${performance.historicalData.length} data points`);

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