import { NextRequest, NextResponse } from 'next/server';
import { calculateFinancialHealth } from '@/lib/financialHealth';
import { getCurrentUserId } from '@/lib/userManagement';

export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();

    console.log('Calculating financial health for user:', userId);

    // Calculate financial health
    const healthData = await calculateFinancialHealth(userId);
    
    console.log('Financial health calculated:', {
      overallScore: healthData.overallScore,
      emergencyFundRatio: healthData.emergencyFundRatio,
      debtToIncomeRatio: healthData.debtToIncomeRatio,
      savingsRate: healthData.savingsRate,
      creditUtilization: healthData.creditUtilization,
      recommendationsCount: healthData.recommendations.length,
    });

    return NextResponse.json(healthData);
  } catch (error) {
    console.error('Error calculating financial health:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: 'Failed to calculate financial health', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 