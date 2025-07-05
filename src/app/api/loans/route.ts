import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { loanService } from '@/lib/loanService';
import { ensureDefaultUser } from '@/lib/startupValidation';
import { maskSensitiveValue } from '@/lib/ui';
import { CreateLoanRequest, UpdateLoanRequest, DataSource } from '@/types/loan';

export const dynamic = 'force-dynamic';

/**
 * GET /api/loans
 * Get all loans for the user with optional filtering and pagination
 */
export async function GET(request: NextRequest) {
  try {
    const userExists = await ensureDefaultUser();
    if (!userExists) {
      return NextResponse.json({ error: 'System not properly initialized' }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || 'default';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const showSensitiveData = searchParams.get('showSensitiveData') !== 'false';
    const includeCalculations = searchParams.get('includeCalculations') === 'true';
    const loanType = searchParams.get('loanType');
    const hasAlerts = searchParams.get('hasAlerts');

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = { userId };
    if (loanType) {
      where.loanType = loanType;
    }
    if (hasAlerts === 'true') {
      where.alerts = {
        some: {
          isActive: true,
          isDismissed: false
        }
      };
    }

    // Get loans with related data
    const [loans, total] = await Promise.all([
      prisma.loanDetails.findMany({
        where,
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
            take: 5
          }
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.loanDetails.count({ where })
    ]);

    // Process loans with optional calculations and masking
    const processedLoans = await Promise.all(
      loans.map(async (loan) => {
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
          // Convert cents to dollars for display
          originalAmount: loan.originalAmount != null ? loan.originalAmount / 100 : null,
          currentBalance: loan.currentBalance != null ? loan.currentBalance / 100 : null,
          paymentsMade: loan.paymentsMade != null ? loan.paymentsMade / 100 : null,
        };

        // Mask sensitive data if requested
        if (!showSensitiveData) {
          return loanService.maskLoanData(processedLoan, false);
        }

        return processedLoan;
      })
    );

    return NextResponse.json({
      data: processedLoans,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching loans:', error);
    return NextResponse.json(
      { error: 'Failed to fetch loans' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/loans
 * Create a new loan or update existing loan details
 */
export async function POST(request: NextRequest) {
  try {
    const userExists = await ensureDefaultUser();
    if (!userExists) {
      return NextResponse.json({ error: 'System not properly initialized' }, { status: 503 });
    }

    const body: CreateLoanRequest = await request.json();
    const userId = 'default'; // TODO: Get from auth

    // Validate required fields
    if (!body.accountId) {
      return NextResponse.json(
        { error: 'Account ID is required' },
        { status: 400 }
      );
    }

    // Check if loan already exists for this account
    const existingLoan = await prisma.loanDetails.findUnique({
      where: { accountId: body.accountId }
    });

    if (existingLoan) {
      return NextResponse.json(
        { error: 'Loan already exists for this account' },
        { status: 409 }
      );
    }

    // Create the loan
    const loan = await prisma.loanDetails.create({
      data: {
        accountId: body.accountId,
        userId,
        currentInterestRate: body.currentInterestRate,
        currentInterestRateSource: 'manual',
        introductoryRate: body.introductoryRate,
        introductoryRateSource: 'manual',
        introductoryRateExpiry: body.introductoryRateExpiry,
        introductoryRateExpirySource: 'manual',
        rateType: body.rateType,
        paymentsPerMonth: body.paymentsPerMonth || 1,
        paymentsPerMonthSource: 'manual',
        paymentsRemaining: body.paymentsRemaining,
        paymentsRemainingSource: 'user_provided',
        autoCalculatePayments: body.autoCalculatePayments ?? true,
        loanType: body.loanType,
        loanTerm: body.loanTerm,
        gracePeriod: body.gracePeriod,
        // Convert dollars to cents for storage
        originalAmount: body.originalAmount != null ? Math.round(body.originalAmount * 100) : null,
        currentBalance: body.currentBalance != null ? Math.round(body.currentBalance * 100) : (body.originalAmount != null ? Math.round(body.originalAmount * 100) : null),
        startDate: body.startDate,
        paymentsMade: body.paymentsMade != null ? Math.round(body.paymentsMade * 100) : null,
      },
      include: {
        account: {
          include: {
            balances: {
              orderBy: { date: 'desc' },
              take: 1
            }
          }
        }
      }
    });

    // Convert cents to dollars for response
    const responseLoan = {
      ...loan,
      originalAmount: loan.originalAmount != null ? loan.originalAmount / 100 : null,
      currentBalance: loan.currentBalance != null ? loan.currentBalance / 100 : null,
      paymentsMade: loan.paymentsMade != null ? loan.paymentsMade / 100 : null,
    };

    return NextResponse.json({ data: responseLoan }, { status: 201 });
  } catch (error) {
    console.error('Error creating loan:', error);
    return NextResponse.json(
      { error: 'Failed to create loan' },
      { status: 500 }
    );
  }
} 