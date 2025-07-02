import { prisma } from '@/lib/db';
import { Account, LoanType, DataSource } from '@/types/loan';

export interface LoanDetectionResult {
  accountId: string;
  accountName: string;
  suggestedLoanType: LoanType | null;
  confidence: number;
  reason: string;
  plaidData?: {
    apr?: number[];
    introductoryApr?: number[];
    lastStatementBalance?: number;
    minimumPaymentAmount?: number;
    nextPaymentDueDate?: string;
  };
}

export class LoanDetectionService {
  /**
   * Detect potential loans from Plaid accounts
   */
  static async detectLoansFromAccounts(userId: string): Promise<LoanDetectionResult[]> {
    const accounts = await prisma.account.findMany({
      where: { userId },
      include: {
        balances: {
          orderBy: { date: 'desc' },
          take: 1
        }
      }
    });

    const results: LoanDetectionResult[] = [];

    for (const account of accounts) {
      // Skip accounts that already have loan details
      const existingLoan = await prisma.loanDetails.findUnique({
        where: { accountId: account.id }
      });

      if (existingLoan) {
        continue;
      }

      const detection = this.analyzeAccountForLoan(account);
      if (detection.suggestedLoanType) {
        results.push(detection);
      }
    }

    return results;
  }

  /**
   * Analyze a single account to determine if it's a loan
   */
  private static analyzeAccountForLoan(account: any): LoanDetectionResult {
    const { type, subtype, name } = account;
    let suggestedLoanType: LoanType | null = null;
    let confidence = 0;
    let reason = '';

    // Credit card detection
    if (type === 'credit' || subtype === 'credit card') {
      suggestedLoanType = 'credit_card';
      confidence = 95;
      reason = 'Account type is credit card';
    }
    // Mortgage detection
    else if (subtype === 'mortgage' || name.toLowerCase().includes('mortgage')) {
      suggestedLoanType = 'mortgage';
      confidence = 90;
      reason = 'Account subtype or name indicates mortgage';
    }
    // Auto loan detection
    else if (subtype === 'auto' || name.toLowerCase().includes('auto') || name.toLowerCase().includes('car')) {
      suggestedLoanType = 'auto';
      confidence = 85;
      reason = 'Account subtype or name indicates auto loan';
    }
    // Student loan detection
    else if (subtype === 'student' || name.toLowerCase().includes('student') || name.toLowerCase().includes('education')) {
      suggestedLoanType = 'student';
      confidence = 85;
      reason = 'Account subtype or name indicates student loan';
    }
    // Personal loan detection
    else if (subtype === 'personal' || name.toLowerCase().includes('personal') || name.toLowerCase().includes('loan')) {
      suggestedLoanType = 'personal';
      confidence = 80;
      reason = 'Account subtype or name indicates personal loan';
    }
    // High balance credit accounts (potential loans)
    else if (type === 'credit' && account.balances?.[0]?.current > 1000) {
      suggestedLoanType = 'credit_card';
      confidence = 70;
      reason = 'High balance credit account, likely a credit card';
    }

    return {
      accountId: account.id,
      accountName: account.name,
      suggestedLoanType,
      confidence,
      reason,
      plaidData: this.extractPlaidLoanData(account)
    };
  }

  /**
   * Extract loan-related data from Plaid account
   */
  private static extractPlaidLoanData(account: any) {
    return {
      apr: account.apr,
      introductoryApr: account.introductoryApr,
      lastStatementBalance: account.lastStatementBalance,
      minimumPaymentAmount: account.minimumPaymentAmount,
      nextPaymentDueDate: account.nextPaymentDueDate
    };
  }

  /**
   * Create loan details from detection result
   */
  static async createLoanFromDetection(
    detection: LoanDetectionResult,
    userId: string,
    additionalData?: {
      currentInterestRate?: number;
      introductoryRate?: number;
      introductoryRateExpiry?: Date;
      paymentsPerMonth?: number;
      loanTerm?: number;
    }
  ) {
    const plaidData = detection.plaidData;
    
    // Determine interest rate from Plaid data or manual entry
    let currentInterestRate = additionalData?.currentInterestRate;
    if (!currentInterestRate && plaidData?.apr?.[0]) {
      currentInterestRate = plaidData.apr[0];
    }

    // Determine introductory rate from Plaid data or manual entry
    let introductoryRate = additionalData?.introductoryRate;
    if (!introductoryRate && plaidData?.introductoryApr?.[0]) {
      introductoryRate = plaidData.introductoryApr[0];
    }

    // Calculate introductory rate expiry if we have introductory APR
    let introductoryRateExpiry = additionalData?.introductoryRateExpiry;
    if (!introductoryRateExpiry && plaidData?.introductoryApr?.[0]) {
      // Default to 12 months from now if we don't have specific expiry
      const expiryDate = new Date();
      expiryDate.setMonth(expiryDate.getMonth() + 12);
      introductoryRateExpiry = expiryDate;
    }

    const loanData = {
      accountId: detection.accountId,
      userId,
      currentInterestRate,
      currentInterestRateSource: currentInterestRate ? 'plaid' : 'manual' as DataSource,
      introductoryRate,
      introductoryRateSource: introductoryRate ? 'plaid' : 'manual' as DataSource,
      introductoryRateExpiry,
      introductoryRateExpirySource: introductoryRateExpiry ? 'plaid' : 'manual' as DataSource,
      rateType: introductoryRate ? 'introductory' : 'fixed' as any,
      paymentsPerMonth: additionalData?.paymentsPerMonth || 1,
      paymentsPerMonthSource: 'manual' as DataSource,
      paymentsRemaining: null,
      paymentsRemainingSource: 'user_provided' as DataSource,
      autoCalculatePayments: true,
      loanType: detection.suggestedLoanType,
      loanTerm: additionalData?.loanTerm || null,
      gracePeriod: null,
      lastPlaidSync: new Date(),
      plaidDataFields: (() => {
        const fields = this.getPlaidDataFields(plaidData);
        return fields.length > 0 ? fields.join(',') : null;
      })()
    };

    return await prisma.loanDetails.create({
      data: loanData,
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
  }

  /**
   * Get list of fields that came from Plaid
   */
  private static getPlaidDataFields(plaidData: any): string[] {
    const fields: string[] = [];
    
    if (plaidData?.apr) fields.push('apr');
    if (plaidData?.introductoryApr) fields.push('introductoryApr');
    if (plaidData?.lastStatementBalance) fields.push('lastStatementBalance');
    if (plaidData?.minimumPaymentAmount) fields.push('minimumPaymentAmount');
    if (plaidData?.nextPaymentDueDate) fields.push('nextPaymentDueDate');
    
    return fields;
  }

  /**
   * Sync loan data from Plaid while preserving manual entries
   */
  static async syncLoanFromPlaid(loanId: string, plaidData: any) {
    const loan = await prisma.loanDetails.findUnique({
      where: { id: loanId }
    });

    if (!loan) {
      throw new Error('Loan not found');
    }

    const updates: any = {};
    const plaidDataFields: string[] = [];

    // Update APR if available and not manually set
    if (plaidData.apr?.[0] && loan.currentInterestRateSource !== 'manual') {
      updates.currentInterestRate = plaidData.apr[0];
      updates.currentInterestRateSource = 'plaid';
      plaidDataFields.push('apr');
    }

    // Update introductory APR if available and not manually set
    if (plaidData.introductoryApr?.[0] && loan.introductoryRateSource !== 'manual') {
      updates.introductoryRate = plaidData.introductoryApr[0];
      updates.introductoryRateSource = 'plaid';
      plaidDataFields.push('introductoryApr');
    }

    // Update other fields if available
    if (plaidData.lastStatementBalance) {
      plaidDataFields.push('lastStatementBalance');
    }
    if (plaidData.minimumPaymentAmount) {
      plaidDataFields.push('minimumPaymentAmount');
    }
    if (plaidData.nextPaymentDueDate) {
      plaidDataFields.push('nextPaymentDueDate');
    }

    if (Object.keys(updates).length > 0) {
      updates.lastPlaidSync = new Date();
      updates.plaidDataFields = plaidDataFields.length > 0 ? plaidDataFields.join(',') : null;

      return await prisma.loanDetails.update({
        where: { id: loanId },
        data: updates
      });
    }

    return loan;
  }
} 