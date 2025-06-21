import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { pattern, patternType, reason, anomalyId } = await request.json();

    // Get or create default user
    let user = await (prisma as any).user.findFirst({
      where: { email: 'default@example.com' }
    });

    if (!user) {
      user = await (prisma as any).user.create({
        data: {
          email: 'default@example.com',
          name: 'Default User'
        }
      });
    }

    // Create dismissal rule
    const dismissalRule = await (prisma as any).anomalyDismissalRule.create({
      data: {
        userId: user.id,
        pattern,
        patternType,
        reason: reason || null,
      }
    });

    // If an anomalyId was provided, also hide that specific anomaly
    if (anomalyId) {
      await (prisma as any).anomalyDetectionResult.update({
        where: { id: anomalyId },
        data: { isHidden: true }
      });
    }

    return NextResponse.json({ 
      success: true, 
      dismissalRule,
      message: `Dismissal rule created for ${patternType}: ${pattern}`
    });

  } catch (error) {
    console.error('Error creating dismissal rule:', error);
    return NextResponse.json(
      { error: 'Failed to create dismissal rule' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get or create default user
    let user = await (prisma as any).user.findFirst({
      where: { email: 'default@example.com' }
    });

    if (!user) {
      return NextResponse.json({ dismissalRules: [] });
    }

    // Get all dismissal rules for the user
    const dismissalRules = await (prisma as any).anomalyDismissalRule.findMany({
      where: { userId: user.id },
      orderBy: { dismissedAt: 'desc' }
    });

    return NextResponse.json({ dismissalRules });

  } catch (error) {
    console.error('Error fetching dismissal rules:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dismissal rules' },
      { status: 500 }
    );
  }
} 