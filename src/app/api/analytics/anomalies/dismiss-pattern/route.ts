import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { safeErrorLog, createErrorResponse } from '@/lib/errorHandling';
import { getCurrentUserId } from '@/lib/userManagement';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pattern, patternType, reason, anomalyId } = body;

    // Validate required fields
    if (!pattern || !patternType) {
      return NextResponse.json(
        { error: 'Missing required fields: pattern and patternType are required' },
        { status: 400 }
      );
    }

    // Removed verbose debug logging

    // Get the current user ID
    const userId = await getCurrentUserId();

    // Removed verbose debug logging

    // Create dismissal rule using the correct schema
    const ruleValue = JSON.stringify({
      pattern,
      patternType,
      reason: reason || null
    });

    const dismissalRule = await (prisma as any).anomalyDismissalRule.create({
      data: {
        userId: userId,
        ruleType: patternType, // Use patternType as ruleType
        ruleValue: ruleValue,  // Store pattern data as JSON string
      }
    });

    // Removed verbose debug logging

    // If an anomalyId was provided, also hide that specific anomaly
    if (anomalyId) {
      // Removed verbose debug logging
      
      // Check if the anomaly exists before trying to update it
      const existingAnomaly = await (prisma as any).anomalyDetectionResult.findUnique({
        where: { id: anomalyId }
      });
      
      if (existingAnomaly) {
        await (prisma as any).anomalyDetectionResult.update({
          where: { id: anomalyId },
          data: { isHidden: true }
        });
        // Removed verbose debug logging
      } else {
        // Removed verbose debug logging
      }
    }

    return NextResponse.json({ 
      success: true, 
      dismissalRule,
      message: `Dismissal rule created for ${patternType}: ${pattern}`
    });

  } catch (error) {
    const errorResponse = createErrorResponse(error, 'Failed to create dismissal rule');
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get the current user ID
    const userId = await getCurrentUserId();

    // Get all dismissal rules for the user
    const dismissalRules = await (prisma as any).anomalyDismissalRule.findMany({
      where: { userId: userId },
      orderBy: { createdAt: 'desc' }
    });

    // Parse the ruleValue JSON for each rule
    const parsedRules = dismissalRules.map((rule: any) => ({
      ...rule,
      ruleData: JSON.parse(rule.ruleValue)
    }));

    return NextResponse.json({ dismissalRules: parsedRules });

  } catch (error) {
    const errorResponse = createErrorResponse(error, 'Failed to fetch dismissal rules');
    return NextResponse.json(errorResponse, { status: 500 });
  }
} 