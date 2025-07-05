import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { loanService } from '@/lib/loanService';
import { ensureDefaultUser } from '@/lib/startupValidation';

export const dynamic = 'force-dynamic';

/**
 * GET /api/analytics/loan-summary
 * Get comprehensive loan portfolio summary for dashboard
 */
export async function GET(request: NextRequest) {
  try {
    const userExists = await ensureDefaultUser();
    if (!userExists) {
      return NextResponse.json({ error: 'System not properly initialized' }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || 'default';
    const showSensitiveData = searchParams.get('showSensitiveData') !== 'false';

    // Get loan summary
    const summary = await loanService.getLoanSummary(userId);

    // Get detailed loan breakdown
    const loans = await prisma.loanDetails.findMany({
      where: { userId },
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
          orderBy: { severity: 'desc' }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    // Process loans with calculations
    const processedLoans = await Promise.all(
      loans.map(async (loan) => {
        const balance = loan.account.balances[0]?.current || 0;
        
        let calculations = null;
        if (balance > 0) {
          try {
            calculations = await loanService.getLoanCalculations(loan.id);
          } catch (error) {
            console.warn(`Failed to calculate loan ${loan.id}:`, error);
          }
        }

        return {
          id: loan.id,
          accountId: loan.accountId,
          accountName: loan.account.name,
          loanType: loan.loanType,
          currentBalance: balance,
          currentInterestRate: loan.currentInterestRate,
          introductoryRate: loan.introductoryRate,
          introductoryRateExpiry: loan.introductoryRateExpiry,
          paymentsPerMonth: loan.paymentsPerMonth,
          paymentsRemaining: loan.paymentsRemaining,
          monthlyPayment: loan.account.nextMonthlyPayment,
          alerts: loan.alerts,
          calculations,
          lastPlaidSync: loan.lastPlaidSync,
          dataSources: {
            currentInterestRate: loan.currentInterestRateSource,
            introductoryRate: loan.introductoryRateSource,
            paymentsPerMonth: loan.paymentsPerMonthSource,
            paymentsRemaining: loan.paymentsRemainingSource
          }
        };
      })
    );

    // Include loans that have loan data, even if balance is 0 (for credit cards, recent payments, etc.)
    const activeLoans = processedLoans.filter(loan => 
      loan.currentBalance > 0 || 
      loan.currentInterestRate || 
      loan.introductoryRate || 
      loan.paymentsRemaining ||
      loan.loanType
    );

    // Calculate additional metrics
    const totalMonthlyPayments = activeLoans.reduce((sum, loan) => sum + (loan.monthlyPayment || 0), 0);
    const averageInterestRate = activeLoans.length > 0 
      ? activeLoans.reduce((sum, loan) => sum + (loan.currentInterestRate || 0), 0) / activeLoans.length 
      : 0;

    // Get upcoming alerts
    const upcomingAlerts = activeLoans
      .flatMap(loan => loan.alerts)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .slice(0, 5);

    // Calculate interest rate distribution
    const interestRateDistribution = activeLoans.reduce((acc, loan) => {
      const rate = loan.currentInterestRate || 0;
      const range = rate < 5 ? '0-5%' : 
                   rate < 10 ? '5-10%' : 
                   rate < 15 ? '10-15%' : 
                   rate < 20 ? '15-20%' : '20%+';
      acc[range] = (acc[range] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Calculate loan type distribution
    const loanTypeDistribution = activeLoans.reduce((acc, loan) => {
      const type = loan.loanType || 'unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const response = {
      summary: {
        ...summary,
        totalMonthlyPayments,
        averageInterestRate
      },
      loans: showSensitiveData ? activeLoans : activeLoans.map(loan => ({
        ...loan,
        currentInterestRate: loan.currentInterestRate ? '••••' : null,
        introductoryRate: loan.introductoryRate ? '••••' : null,
        paymentsRemaining: loan.paymentsRemaining ? '••••' : null
      })),
      upcomingAlerts,
      distributions: {
        interestRates: interestRateDistribution,
        loanTypes: loanTypeDistribution
      },
      insights: {
        highestInterestRate: Math.max(...activeLoans.map(l => l.currentInterestRate || 0)),
        lowestInterestRate: Math.min(...activeLoans.map(l => l.currentInterestRate || 0)),
        largestBalance: Math.max(...activeLoans.map(l => l.currentBalance)),
        totalInterestProjected: activeLoans.reduce((sum, loan) => 
          sum + (loan.calculations?.totalInterest || 0), 0
        )
      }
    };

    return NextResponse.json({ data: response });

  } catch (error) {
    console.error('Error fetching loan summary:', error);
    return NextResponse.json(
      { error: 'Failed to fetch loan summary' },
      { status: 500 }
    );
  }
} 