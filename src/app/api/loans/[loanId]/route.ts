import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { loanService } from '@/lib/loanService';
import { ensureDefaultUser } from '@/lib/startupValidation';
import type { DataSource, RateType, LoanType } from '@/types/loan';

export const dynamic = 'force-dynamic';

/**
 * GET /api/loans/[loanId]
 * Get specific loan details with calculations
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ loanId: string }> }
) {
  try {
    const userExists = await ensureDefaultUser();
    if (!userExists) {
      return NextResponse.json({ error: 'System not properly initialized' }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const includeCalculations = searchParams.get('includeCalculations') === 'true';
    const showSensitiveData = searchParams.get('showSensitiveData') !== 'false';

    const { loanId } = await params;

    const loan = await prisma.loanDetails.findUnique({
      where: { id: loanId },
      include: {
        account: {
          include: {
            balances: {
              orderBy: { date: 'desc' },
              take: 1
            }
          }
        },
        alerts: {
          where: { isActive: true, isDismissed: false },
          orderBy: { createdAt: 'desc' }
        },
        paymentHistory: {
          orderBy: { paymentDate: 'desc' },
          take: 10
        }
      }
    });

    if (!loan) {
      return NextResponse.json(
        { error: 'Loan not found' },
        { status: 404 }
      );
    }

    let calculations = null;
    if (includeCalculations) {
      try {
        calculations = await loanService.getLoanCalculations(loan.id);
      } catch (error) {
        console.warn(`Failed to calculate loan ${loan.id}:`, error);
      }
    }

    const processedLoan = {
      ...loan,
      calculations,
      account: {
        ...loan.account,
        balance: loan.account.balances[0] || {
          current: 0,
          available: null,
          limit: null,
          date: new Date()
        }
      },
      // Ensure *Source fields are DataSource type and convert cents to dollars
      currentInterestRateSource: loan.currentInterestRateSource as DataSource,
      introductoryRateSource: loan.introductoryRateSource as DataSource,
      introductoryRateExpirySource: loan.introductoryRateExpirySource as DataSource,
      paymentsPerMonthSource: loan.paymentsPerMonthSource as DataSource,
      paymentsRemainingSource: loan.paymentsRemainingSource as DataSource,
      loanTermSource: (loan as any).loanTermSource as DataSource,
      rateType: loan.rateType as RateType,
      loanType: loan.loanType as LoanType,
      // Convert cents to dollars for display
      originalAmount: loan.originalAmount != null ? loan.originalAmount / 100 : null,
      currentBalance: loan.currentBalance != null ? loan.currentBalance / 100 : null,
      paymentsMade: loan.paymentsMade != null ? loan.paymentsMade / 100 : null,
    };

    // Mask sensitive data if requested
    const finalLoan = showSensitiveData 
      ? processedLoan 
      : loanService.maskLoanData(processedLoan, false);

    return NextResponse.json({ data: finalLoan });

  } catch (error) {
    console.error('Error fetching loan:', error);
    return NextResponse.json(
      { error: 'Failed to fetch loan' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/loans/[loanId]
 * Update specific loan details
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ loanId: string }> }
) {
  try {
    const userExists = await ensureDefaultUser();
    if (!userExists) {
      return NextResponse.json({ error: 'System not properly initialized' }, { status: 503 });
    }

    const body = await request.json();
    const {
      currentInterestRate,
      currentInterestRateSource,
      introductoryRate,
      introductoryRateSource,
      introductoryRateExpiry,
      introductoryRateExpirySource,
      rateType,
      paymentsPerMonth,
      paymentsPerMonthSource,
      paymentsRemaining,
      paymentsRemainingSource,
      autoCalculatePayments,
      loanType,
      loanTerm,
      gracePeriod,
      preserveManualEntries = true,
      originalAmount,
      currentBalance,
      startDate,
      paymentsMade
    } = body;

    const { loanId } = await params;
    
    // Convert dollar values to cents for storage
    const loan = await loanService.updateLoan(
      loanId,
      {
        currentInterestRate,
        currentInterestRateSource,
        introductoryRate,
        introductoryRateSource,
        introductoryRateExpiry: introductoryRateExpiry ? new Date(introductoryRateExpiry) : undefined,
        introductoryRateExpirySource,
        rateType,
        paymentsPerMonth,
        paymentsPerMonthSource,
        paymentsRemaining,
        paymentsRemainingSource,
        autoCalculatePayments,
        loanType,
        loanTerm,
        gracePeriod,
        originalAmount: originalAmount != null ? Math.round(originalAmount * 100) : undefined,
        currentBalance: currentBalance != null ? Math.round(currentBalance * 100) : undefined,
        startDate,
        paymentsMade: paymentsMade != null ? Math.round(paymentsMade * 100) : undefined,
      },
      preserveManualEntries
    );

    // Convert cents to dollars for response, and ensure *Source fields are DataSource
    const responseLoan = {
      ...loan,
      originalAmount: loan.originalAmount != null ? loan.originalAmount / 100 : null,
      currentBalance: loan.currentBalance != null ? loan.currentBalance / 100 : null,
      paymentsMade: loan.paymentsMade != null ? loan.paymentsMade / 100 : null,
      currentInterestRateSource: loan.currentInterestRateSource as DataSource,
      introductoryRateSource: loan.introductoryRateSource as DataSource,
      introductoryRateExpirySource: loan.introductoryRateExpirySource as DataSource,
      paymentsPerMonthSource: loan.paymentsPerMonthSource as DataSource,
      paymentsRemainingSource: loan.paymentsRemainingSource as DataSource,
      loanTermSource: loan.loanTermSource as DataSource,
    };

    return NextResponse.json({
      data: responseLoan,
      message: 'Loan updated successfully'
    });

  } catch (error) {
    console.error('Error updating loan:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update loan' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/loans/[loanId]
 * Update specific loan details
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { loanId: string } }
) {
  try {
    const { loanId } = params;
    const body = await request.json();

    // Validate required fields
    const { currentInterestRate, paymentsPerMonth, paymentsRemaining, loanTerm } = body;

    // Update the loan
    const updatedLoan = await prisma.loanDetails.update({
      where: { id: loanId },
      data: {
        ...(currentInterestRate !== undefined && { currentInterestRate }),
        ...(paymentsPerMonth !== undefined && { paymentsPerMonth }),
        ...(paymentsRemaining !== undefined && { paymentsRemaining }),
        ...(loanTerm !== undefined && { loanTerm }),
        // Update the source to manual since this is a manual edit
        ...(currentInterestRate !== undefined && { currentInterestRateSource: 'manual' }),
        ...(paymentsPerMonth !== undefined && { paymentsPerMonthSource: 'manual' }),
        ...(paymentsRemaining !== undefined && { paymentsRemainingSource: 'manual' }),
        ...(loanTerm !== undefined && { loanTermSource: 'manual' }),
      },
      include: {
        account: {
          include: {
            balances: {
              orderBy: { date: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: updatedLoan,
    });
  } catch (error: any) {
    console.error('Error updating loan:', error);
    return NextResponse.json(
      { error: 'Failed to update loan', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/loans/[loanId]
 * Delete loan details
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { loanId: string } }
) {
  try {
    const { loanId } = params;

    // Delete the loan
    await prisma.loanDetails.delete({
      where: { id: loanId },
    });

    return NextResponse.json({
      success: true,
      message: 'Loan deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting loan:', error);
    return NextResponse.json(
      { error: 'Failed to delete loan', details: error.message },
      { status: 500 }
    );
  }
} 