import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { plaidClient } from '@/lib/plaid';
import { ensureDefaultUser } from '@/lib/startupValidation';
import { v4 as uuidv4 } from 'uuid';

// Cache for storing loan sync timestamps and data
const loanSyncCache = new Map<string, { timestamp: number; data: any }>();

// Configuration for loan caching and staleness
const LOAN_SYNC_CONFIG = {
  // Default stale window in milliseconds (30 days)
  DEFAULT_STALE_WINDOW: 30 * 24 * 60 * 60 * 1000,
  // Cache TTL for loan data
  CACHE_TTL: 24 * 60 * 60 * 1000, // 24 hours
  // Rate limiting for manual refreshes
  MANUAL_REFRESH_LIMIT: 3, // Max manual refreshes per day per loan
  MANUAL_REFRESH_WINDOW: 24 * 60 * 60 * 1000, // 24 hours
};

// Utility function to log Plaid API calls
async function logPlaidApiCall({
  prisma,
  endpoint,
  responseStatus,
  institutionId,
  accountId,
  durationMs,
  errorMessage,
  userId,
  appInstanceId,
  isForcedRefresh = false
}: {
  prisma: any,
  endpoint: string,
  responseStatus: number,
  institutionId?: string,
  accountId?: string,
  durationMs?: number,
  errorMessage?: string,
  userId?: string,
  appInstanceId?: string,
  isForcedRefresh?: boolean
}) {
  try {
    await prisma.plaidApiCallLog.create({
      data: {
        id: uuidv4(),
        timestamp: new Date(),
        endpoint,
        responseStatus,
        institutionId: institutionId || null,
        accountId: accountId || null,
        userId: userId || null,
        durationMs: durationMs || null,
        errorMessage: errorMessage || null,
        appInstanceId: appInstanceId || null,
      },
    });
  } catch (err) {
    console.error('[PlaidApiCallLog] Failed to log Plaid API call:', err);
  }
}

// Check if loan data is stale
function isDataStale(lastPlaidSync: Date | null): boolean {
  if (!lastPlaidSync) {
    return true; // No sync data, consider stale
  }

  const staleWindow = LOAN_SYNC_CONFIG.DEFAULT_STALE_WINDOW;
  const now = new Date();
  const lastSync = new Date(lastPlaidSync);
  const timeSinceSync = now.getTime() - lastSync.getTime();

  return timeSinceSync >= staleWindow;
}

// Cache loan data
function cacheLoanData(loanId: string, data: any): void {
  loanSyncCache.set(loanId, {
    timestamp: Date.now(),
    data
  });
}

// Get cached loan data if available and fresh
function getCachedLoanData(loanId: string): any | null {
  const cached = loanSyncCache.get(loanId);
  if (!cached) {
    return null;
  }

  const now = Date.now();
  if (now - cached.timestamp > LOAN_SYNC_CONFIG.CACHE_TTL) {
    loanSyncCache.delete(loanId);
    return null;
  }

  return cached.data;
}

export const dynamic = 'force-dynamic';

/**
 * POST /api/loans/sync
 * Sync loan data from Plaid with caching and staleness logic
 */
export async function POST(request: NextRequest) {
  try {
    const userExists = await ensureDefaultUser();
    if (!userExists) {
      return NextResponse.json({ error: 'System not properly initialized' }, { status: 503 });
    }

    const body = await request.json();
    const { loanId, forceRefresh = false } = body;

    if (!loanId) {
      return NextResponse.json({ error: 'Loan ID is required' }, { status: 400 });
    }

    // Get the loan and its account
    const loan = await prisma.loanDetails.findUnique({
      where: { id: loanId },
      include: {
        account: {
          include: {
            plaidItem: true
          }
        }
      }
    });

    if (!loan) {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
    }

    if (!loan.account.plaidItem || loan.account.plaidItem.accessToken === 'manual') {
      return NextResponse.json({ error: 'Loan is not connected to Plaid' }, { status: 400 });
    }

    // Check if data is stale and needs refresh
    if (!forceRefresh && !isDataStale(loan.lastPlaidSync)) {
      // Removed verbose debug logging
      return NextResponse.json({
        message: 'Loan data is fresh, no update needed',
        lastSync: loan.lastPlaidSync,
        isStale: false
      });
    }

    // Check cache first
    const cachedData = getCachedLoanData(loanId);
    if (!forceRefresh && cachedData) {
      // Removed verbose debug logging
      return NextResponse.json({
        message: 'Using cached loan data',
        data: cachedData,
        fromCache: true
      });
    }

    // Fetch fresh data from Plaid
    // Removed verbose debug logging
    const plaidApiCallStart = Date.now();
    let plaidApiCallError = null;

    try {
      const response = await plaidClient.liabilitiesGet({
        access_token: loan.account.plaidItem.accessToken,
        options: {
          account_ids: [loan.account.plaidId],
        },
      });

      // Log successful API call
      await logPlaidApiCall({
        prisma,
        endpoint: '/liabilities/get',
        responseStatus: 200,
        institutionId: loan.account.plaidItem.institutionId,
        accountId: loan.accountId,
        durationMs: Date.now() - plaidApiCallStart,
        userId: loan.userId,
        isForcedRefresh: forceRefresh
      });

      const liabilities = response.data.liabilities;
      if (!liabilities) {
        return NextResponse.json({
          message: 'No liability data available from Plaid',
          lastSync: loan.lastPlaidSync
        });
      }

      // Process the liability data
      const updates: any = {};
      const plaidFields: string[] = [];

             // Handle credit card liabilities
       const credit = liabilities.credit?.find((c: any) => c.account_id === loan.account.plaidId);
       if (credit) {
         if (credit.aprs && credit.aprs.length > 0) {
           updates.currentInterestRate = credit.aprs[0];
           updates.currentInterestRateSource = 'plaid';
           plaidFields.push('currentInterestRate');
         }

         if (credit.introductory_aprs && credit.introductory_aprs.length > 0) {
           updates.introductoryRate = credit.introductory_aprs[0];
           updates.introductoryRateSource = 'plaid';
           plaidFields.push('introductoryRate');
         }

         if (credit.introductory_apr_periods && credit.introductory_apr_periods.length > 0) {
           const introPeriod = credit.introductory_apr_periods[0];
           const expiryDate = new Date();
           expiryDate.setMonth(expiryDate.getMonth() + introPeriod);
           updates.introductoryRateExpiry = expiryDate;
           updates.introductoryRateExpirySource = 'plaid';
           plaidFields.push('introductoryRateExpiry');
         }
       }

      // Handle mortgage liabilities
      const mortgage = liabilities.mortgage?.find((m: any) => m.account_id === loan.account.plaidId);
      if (mortgage) {
        if (mortgage.interest_rate && mortgage.interest_rate.length > 0) {
          updates.currentInterestRate = mortgage.interest_rate[0];
          updates.currentInterestRateSource = 'plaid';
          plaidFields.push('currentInterestRate');
        }
      }

      // Handle student loan liabilities
      const student = liabilities.student?.find((s: any) => s.account_id === loan.account.plaidId);
      if (student) {
        if (student.interest_rate_percentage && student.interest_rate_percentage.length > 0) {
          updates.currentInterestRate = student.interest_rate_percentage[0];
          updates.currentInterestRateSource = 'plaid';
          plaidFields.push('currentInterestRate');
        }
      }

      // Update tracking fields
      updates.lastPlaidSync = new Date();
      updates.plaidDataFields = plaidFields;

      // Cache the data
      cacheLoanData(loanId, { updates, plaidFields });

      // Update the loan in database
      const updatedLoan = await prisma.loanDetails.update({
        where: { id: loanId },
        data: updates,
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

      return NextResponse.json({
        message: 'Loan data synced successfully',
        data: updatedLoan,
        plaidFields,
        fromCache: false,
        forceRefresh
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      plaidApiCallError = errorMessage;

      // Log failed API call
      await logPlaidApiCall({
        prisma,
        endpoint: '/liabilities/get',
        responseStatus: (error as any)?.response?.status || 500,
        institutionId: loan.account.plaidItem.institutionId,
        accountId: loan.accountId,
        durationMs: Date.now() - plaidApiCallStart,
        errorMessage,
        userId: loan.userId,
        isForcedRefresh: forceRefresh
      });

      throw error;
    }

  } catch (error) {
    console.error('Error syncing loan:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to sync loan' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/loans/sync
 * Check loan sync status and staleness
 */
export async function GET(request: NextRequest) {
  try {
    const userExists = await ensureDefaultUser();
    if (!userExists) {
      return NextResponse.json({ error: 'System not properly initialized' }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const loanId = searchParams.get('loanId');

    if (!loanId) {
      return NextResponse.json({ error: 'Loan ID is required' }, { status: 400 });
    }

    const loan = await prisma.loanDetails.findUnique({
      where: { id: loanId },
      select: {
        id: true,
        lastPlaidSync: true,
        plaidDataFields: true,
        account: {
          select: {
            name: true,
            plaidItem: {
              select: {
                institutionId: true,
                accessToken: true
              }
            }
          }
        }
      }
    });

    if (!loan) {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
    }

    const isStale = isDataStale(loan.lastPlaidSync);
    const hasPlaidConnection = loan.account.plaidItem && loan.account.plaidItem.accessToken !== 'manual';

    return NextResponse.json({
      loanId: loan.id,
      accountName: loan.account.name,
      lastPlaidSync: loan.lastPlaidSync,
      isStale,
      hasPlaidConnection,
      plaidDataFields: loan.plaidDataFields ? JSON.parse(loan.plaidDataFields) : [],
      staleWindow: LOAN_SYNC_CONFIG.DEFAULT_STALE_WINDOW
    });

  } catch (error) {
    console.error('Error checking loan sync status:', error);
    return NextResponse.json(
      { error: 'Failed to check loan sync status' },
      { status: 500 }
    );
  }
} 