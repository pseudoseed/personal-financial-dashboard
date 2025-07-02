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

    // Fetch fresh liabilities from Plaid for this account before creating the loan
    try {
      const { smartRefreshAccounts } = await import('@/lib/refreshService');
      await smartRefreshAccounts(userId, true, false, detectionId);
    } catch (liabError) {
      console.error('Failed to refresh liabilities from Plaid:', liabError);
      // Continue even if liabilities refresh fails
    }

    // Create the loan
    const loan = await LoanDetectionService.createLoanFromDetection(
      detection,
      userId,
      additionalData
    );

    // After creation, fetch fresh liabilities and update the loan
    let updatedLoan = loan;
    try {
      const { smartRefreshAccounts } = await import('@/lib/refreshService');
      await smartRefreshAccounts(userId, true, false, detectionId);
      // Re-fetch the updated loan from the DB
      const updatedLoanFromDb = await import('@/lib/db').then(({ prisma }) =>
        prisma.loanDetails.findUnique({
          where: { id: loan.id },
          include: {
            account: {
              include: {
                balances: { orderBy: { date: 'desc' }, take: 1 }
              }
            }
          }
        })
      );
      if (updatedLoanFromDb) updatedLoan = updatedLoanFromDb;
    } catch (liabError) {
      console.error('Failed to refresh liabilities and update loan:', liabError);
      // Continue even if liabilities refresh fails
    }

    return NextResponse.json({
      data: updatedLoan,
      message: 'Loan created and updated with Plaid liabilities'
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating loan from detection:', error);
    return NextResponse.json(
      { error: 'Failed to create loan from detection' },
      { status: 500 }
    );
  }
} 