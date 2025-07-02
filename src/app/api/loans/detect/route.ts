import { NextRequest, NextResponse } from 'next/server';
import { LoanDetectionService } from '@/lib/loanDetectionService';
import { ensureDefaultUser } from '@/lib/startupValidation';

export const dynamic = 'force-dynamic';

/**
 * GET /api/loans/detect
 * Detect potential loans from Plaid accounts
 */
export async function GET(request: NextRequest) {
  try {
    const userExists = await ensureDefaultUser();
    if (!userExists) {
      return NextResponse.json({ error: 'System not properly initialized' }, { status: 503 });
    }

    const userId = 'default'; // TODO: Get from auth
    const detectedLoans = await LoanDetectionService.detectLoansFromAccounts(userId);

    return NextResponse.json({
      data: detectedLoans,
      message: `Found ${detectedLoans.length} potential loans`
    });

  } catch (error) {
    console.error('Error detecting loans:', error);
    return NextResponse.json(
      { error: 'Failed to detect loans' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/loans/detect
 * Create loans from detection results
 */
export async function POST(request: NextRequest) {
  try {
    const userExists = await ensureDefaultUser();
    if (!userExists) {
      return NextResponse.json({ error: 'System not properly initialized' }, { status: 503 });
    }

    const body = await request.json();
    const { detectionId, additionalData } = body;
    const userId = 'default'; // TODO: Get from auth

    // Get the detection result
    const detectedLoans = await LoanDetectionService.detectLoansFromAccounts(userId);
    const detection = detectedLoans.find(d => d.accountId === detectionId);

    if (!detection) {
      return NextResponse.json(
        { error: 'Detection result not found' },
        { status: 404 }
      );
    }

    // Create the loan
    const loan = await LoanDetectionService.createLoanFromDetection(
      detection,
      userId,
      additionalData
    );

    return NextResponse.json({
      data: loan,
      message: 'Loan created successfully from detection'
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating loan from detection:', error);
    return NextResponse.json(
      { error: 'Failed to create loan from detection' },
      { status: 500 }
    );
  }
} 