import { NextRequest, NextResponse } from 'next/server';
import { getActivityFeedData } from '@/lib/activityFeed';
import { getCurrentUserId } from '@/lib/userManagement';

export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');

    // Removed verbose debug logging

    // Get activity feed data
    const activityData = await getActivityFeedData(userId, limit);
    
    console.log(`[Activity Feed] Calculated ${activityData.summary.totalActivities} activities for user ${userId}`);

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