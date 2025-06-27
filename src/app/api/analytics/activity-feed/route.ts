import { NextRequest, NextResponse } from 'next/server';
import { getActivityFeedData } from '@/lib/activityFeed';
import { getCurrentUserId } from '@/lib/userManagement';

export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');

    console.log('DEBUG: User ID from getCurrentUserId:', userId);
    console.log('Getting activity feed data for user:', userId, 'with limit:', limit);

    // Get activity feed data
    const activityData = await getActivityFeedData(userId, limit);
    
    console.log('Activity feed data calculated:', {
      totalActivities: activityData.summary.totalActivities,
      recentTransactions: activityData.summary.recentTransactions,
      pendingPayments: activityData.summary.pendingPayments,
      anomalies: activityData.summary.anomalies,
    });

    return NextResponse.json(activityData);
  } catch (error) {
    console.error('Error getting activity feed data:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: 'Failed to get activity feed data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 