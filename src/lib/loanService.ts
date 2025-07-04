import { prisma } from '@/lib/db';
import { 
  LoanDetails, 
  DataSource, 
  LoanCalculationResult, 
  PlaidLiabilityData,
  loanValidationSchema,
  type LoanType,
  type RateType
} from '@/types/loan';
import { maskSensitiveValue } from '@/lib/ui';
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

/**
 * Loan Service - Core business logic for loan tracking and calculations
 */
export class LoanService {
  private static instance: LoanService;
  
  public static getInstance(): LoanService {
    if (!LoanService.instance) {
      LoanService.instance = new LoanService();
    }
    return LoanService.instance;
  }

  /**
   * Create or update loan details with smart data source handling
   */
  async createOrUpdateLoan(
    accountId: string, 
    data: Partial<LoanDetails>,
    preserveManualEntries: boolean = true
  ): Promise<LoanDetails> {
    const existingLoan = await prisma.loanDetails.findUnique({
      where: { accountId }
    });

    if (existingLoan) {
      return this.updateLoan(existingLoan.id, data, preserveManualEntries);
    } else {
      return this.createLoan(accountId, data);
    }
  }

  /**
   * Create new loan details
   */
  async createLoan(accountId: string, data: Partial<LoanDetails>): Promise<LoanDetails> {
    const validatedData = this.validateLoanData(data);
    
    return await prisma.loanDetails.create({
      data: {
        accountId,
        userId: 'default', // TODO: Get from auth context
        ...validatedData,
        currentInterestRateSource: data.currentInterestRateSource || 'manual',
        introductoryRateSource: data.introductoryRateSource || 'manual',
        introductoryRateExpirySource: data.introductoryRateExpirySource || 'manual',
        paymentsPerMonthSource: data.paymentsPerMonthSource || 'manual',
        paymentsRemainingSource: data.paymentsRemainingSource || 'calculated',
        autoCalculatePayments: data.autoCalculatePayments ?? true,
        paymentsPerMonth: data.paymentsPerMonth || 1,
      }
    });
  }

  /**
   * Update loan details with manual entry protection
   */
  async updateLoan(
    loanId: string, 
    data: Partial<LoanDetails>, 
    preserveManualEntries: boolean = true
  ): Promise<LoanDetails> {
    const existingLoan = await prisma.loanDetails.findUnique({
      where: { id: loanId }
    });

    if (!existingLoan) {
      throw new Error('Loan not found');
    }

    const validatedData = this.validateLoanData(data);
    const updates: Partial<LoanDetails> = {};

    // Smart field updates with manual entry protection
    for (const [key, value] of Object.entries(validatedData)) {
      if (value !== undefined && this.shouldUpdateField(key, value, existingLoan, preserveManualEntries)) {
        (updates as any)[key] = value;
      }
    }

    return await prisma.loanDetails.update({
      where: { id: loanId },
      data: updates
    });
  }

  /**
   * Determine if a field should be updated based on data source and protection rules
   */
  private shouldUpdateField(
    fieldName: string, 
    newValue: any, 
    existingLoan: LoanDetails, 
    preserveManualEntries: boolean
  ): boolean {
    // Never update with null/undefined values
    if (newValue === null || newValue === undefined) {
      return false;
    }

    // Get the source field name
    const sourceField = `${fieldName}Source` as keyof LoanDetails;
    const currentSource = existingLoan[sourceField] as DataSource;

    // If preserving manual entries and current source is manual, don't overwrite
    if (preserveManualEntries && currentSource === 'manual') {
      return false;
    }

    // Allow updates for calculated fields or when explicitly requested
    return currentSource === 'calculated' || currentSource === 'plaid' || !preserveManualEntries;
  }

  /**
   * Calculate remaining payments based on balance and payment amount
   */
  calculateRemainingPayments(
    currentBalance: number,
    monthlyPayment: number,
    interestRate: number,
    paymentsPerMonth: number = 1
  ): number {
    if (monthlyPayment <= 0 || interestRate < 0) {
      return 0;
    }

    const monthlyRate = interestRate / 100 / 12;
    const paymentPerPeriod = monthlyPayment / paymentsPerMonth;
    
    if (monthlyRate === 0) {
      // No interest - simple division
      return Math.ceil(currentBalance / paymentPerPeriod);
    }

    // Amortization formula
    const remainingPayments = Math.log(paymentPerPeriod / (paymentPerPeriod - currentBalance * monthlyRate)) / Math.log(1 + monthlyRate);
    
    return Math.ceil(Math.max(0, remainingPayments));
  }

  /**
   * Calculate interest charges for a given period
   */
  calculateInterestCharges(
    balance: number,
    interestRate: number,
    days: number
  ): number {
    if (balance <= 0 || interestRate <= 0) {
      return 0;
    }

    const dailyRate = interestRate / 100 / 365;
    return balance * dailyRate * days;
  }

  /**
   * Calculate optimal payment to avoid interest
   */
  calculateOptimalPayment(
    balance: number,
    interestRate: number,
    daysUntilDue: number
  ): number {
    if (balance <= 0 || interestRate <= 0 || daysUntilDue <= 0) {
      return balance;
    }

    const dailyRate = interestRate / 100 / 365;
    const interestAccrued = balance * dailyRate * daysUntilDue;
    
    return balance + interestAccrued;
  }

  /**
   * Get comprehensive loan calculations
   */
  async getLoanCalculations(loanId: string): Promise<LoanCalculationResult> {
    const loan = await prisma.loanDetails.findUnique({
      where: { id: loanId },
      include: { account: true }
    });

    if (!loan || !loan.account) {
      throw new Error('Loan or account not found');
    }

    const currentBalance = loan.account.balances?.[0]?.current || 0;
    const monthlyPayment = loan.account.nextMonthlyPayment || 0;
    const interestRate = loan.currentInterestRate || 0;

    const remainingPayments = this.calculateRemainingPayments(
      currentBalance,
      monthlyPayment,
      interestRate,
      loan.paymentsPerMonth
    );

    const totalInterest = this.calculateTotalInterest(
      currentBalance,
      interestRate,
      remainingPayments,
      monthlyPayment
    );

    const payoffDate = this.calculatePayoffDate(remainingPayments, loan.paymentsPerMonth);
    const optimalPayment = this.calculateOptimalPayment(
      currentBalance,
      interestRate,
      30 // Assume 30 days until next due
    );

    const interestSavings = Math.max(0, totalInterest - (optimalPayment - currentBalance));

    return {
      remainingPayments,
      totalInterest,
      payoffDate,
      monthlyPayment,
      optimalPayment,
      interestSavings
    };
  }

  /**
   * Calculate total interest over loan term
   */
  private calculateTotalInterest(
    balance: number,
    interestRate: number,
    payments: number,
    monthlyPayment: number
  ): number {
    if (balance <= 0 || interestRate <= 0 || payments <= 0) {
      return 0;
    }

    const monthlyRate = interestRate / 100 / 12;
    let remainingBalance = balance;
    let totalInterest = 0;

    for (let i = 0; i < payments; i++) {
      const interest = remainingBalance * monthlyRate;
      const principal = monthlyPayment - interest;
      remainingBalance = Math.max(0, remainingBalance - principal);
      totalInterest += interest;
    }

    return totalInterest;
  }

  /**
   * Calculate payoff date based on remaining payments
   */
  private calculatePayoffDate(remainingPayments: number, paymentsPerMonth: number): Date {
    const monthsToPayoff = remainingPayments / paymentsPerMonth;
    const daysToPayoff = monthsToPayoff * 30; // Approximate
    
    const payoffDate = new Date();
    payoffDate.setDate(payoffDate.getDate() + daysToPayoff);
    
    return payoffDate;
  }

  /**
   * Update loan from Plaid liability data with protection and caching
   */
  async updateFromPlaidData(
    loanId: string, 
    plaidData: PlaidLiabilityData,
    forceRefresh: boolean = false
  ): Promise<LoanDetails> {
    const loan = await prisma.loanDetails.findUnique({
      where: { id: loanId }
    });

    if (!loan) {
      throw new Error('Loan not found');
    }

    // Check if data is stale and needs refresh
    if (!forceRefresh && this.isDataFresh(loan)) {
      // Removed verbose debug logging
      return loan;
    }

    const updates: Partial<LoanDetails> = {};
    const plaidFields: string[] = [];

    // Extract APR data
    if (plaidData.apr && plaidData.apr.length > 0) {
      updates.currentInterestRate = plaidData.apr[0];
      updates.currentInterestRateSource = 'plaid';
      plaidFields.push('currentInterestRate');
    }

    // Extract introductory APR data
    if (plaidData.introductoryApr && plaidData.introductoryApr.length > 0) {
      updates.introductoryRate = plaidData.introductoryApr[0];
      updates.introductoryRateSource = 'plaid';
      plaidFields.push('introductoryRate');
    }

    // Extract introductory APR period
    if (plaidData.introductoryAprPeriod && plaidData.introductoryAprPeriod.length > 0) {
      const introPeriod = plaidData.introductoryAprPeriod[0];
      const expiryDate = new Date();
      expiryDate.setMonth(expiryDate.getMonth() + introPeriod);
      updates.introductoryRateExpiry = expiryDate;
      updates.introductoryRateExpirySource = 'plaid';
      plaidFields.push('introductoryRateExpiry');
    }

    // Update tracking fields
    updates.lastPlaidSync = new Date();
    updates.plaidDataFields = plaidFields;

    // Cache the updated data
    this.cacheLoanData(loanId, plaidData);

    return await this.updateLoan(loanId, updates, true);
  }

  /**
   * Check if loan data is fresh (within stale window)
   */
  private isDataFresh(loan: LoanDetails): boolean {
    if (!loan.lastPlaidSync) {
      return false; // No sync data, consider stale
    }

    const staleWindow = LOAN_SYNC_CONFIG.DEFAULT_STALE_WINDOW;
    const now = new Date();
    const lastSync = new Date(loan.lastPlaidSync);
    const timeSinceSync = now.getTime() - lastSync.getTime();

    return timeSinceSync < staleWindow;
  }

  /**
   * Check if loan data is stale and needs refresh
   */
  isDataStale(loanId: string): Promise<boolean> {
    return prisma.loanDetails.findUnique({
      where: { id: loanId },
      select: { lastPlaidSync: true }
    }).then(loan => {
      if (!loan || !loan.lastPlaidSync) {
        return true; // No sync data, consider stale
      }

      const staleWindow = LOAN_SYNC_CONFIG.DEFAULT_STALE_WINDOW;
      const now = new Date();
      const lastSync = new Date(loan.lastPlaidSync);
      const timeSinceSync = now.getTime() - lastSync.getTime();

      return timeSinceSync >= staleWindow;
    });
  }

  /**
   * Cache loan data for future reference
   */
  private cacheLoanData(loanId: string, data: any): void {
    loanSyncCache.set(loanId, {
      timestamp: Date.now(),
      data
    });
  }

  /**
   * Get cached loan data if available and fresh
   */
  private getCachedLoanData(loanId: string): any | null {
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

  /**
   * Force refresh loan data from Plaid (bypasses cache and staleness checks)
   */
  async forceRefreshFromPlaid(
    loanId: string,
    plaidData: PlaidLiabilityData
  ): Promise<LoanDetails> {
    // Removed verbose debug logging
    return this.updateFromPlaidData(loanId, plaidData, true);
  }

  /**
   * Get loan summary for dashboard
   */
  async getLoanSummary(userId: string = 'default'): Promise<{
    totalDebt: number;
    averageInterestRate: number;
    totalMonthlyPayments: number;
    totalInterestProjected: number;
    activeAlerts: number;
    loansCount: number;
    nextPaymentDue?: Date;
    introRateExpiringSoon: boolean;
  }> {
    const loans = await prisma.loanDetails.findMany({
      where: { userId },
      include: { 
        account: { 
          include: { balances: { orderBy: { date: 'desc' }, take: 1 } } 
        },
        alerts: { where: { isActive: true, isDismissed: false } }
      }
    });

    let totalDebt = 0;
    let totalInterestRate = 0;
    let totalMonthlyPayments = 0;
    let totalInterestProjected = 0;
    let activeLoans = 0;
    let nextPaymentDue: Date | undefined;
    let introRateExpiringSoon = false;

    for (const loan of loans) {
      const balance = loan.account.balances?.[0]?.current || 0;
      const hasLoanData = loan.currentInterestRate || loan.introductoryRate || loan.paymentsRemaining || loan.loanType;
      
      if (balance > 0 || hasLoanData) {
        totalDebt += balance;
        totalInterestRate += loan.currentInterestRate || 0;
        totalMonthlyPayments += loan.account.nextMonthlyPayment || 0;
        activeLoans++;

        // Calculate projected interest if balance > 0
        if (balance > 0) {
          try {
            const calculations = await this.getLoanCalculations(loan.id);
            totalInterestProjected += calculations.totalInterest;
          } catch (error) {
            console.warn(`Failed to calculate interest for loan ${loan.id}:`, error);
          }
        }

        // Check for intro rate expiring soon
        if (loan.introductoryRateExpiry) {
          const daysUntilExpiry = Math.ceil(
            (loan.introductoryRateExpiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          );
          if (daysUntilExpiry <= 30) {
            introRateExpiringSoon = true;
          }
        }
      }
    }

    const activeAlerts = loans.reduce((sum: number, loan: any) => sum + loan.alerts.length, 0);

    return {
      totalDebt,
      averageInterestRate: activeLoans > 0 ? totalInterestRate / activeLoans : 0,
      totalMonthlyPayments,
      totalInterestProjected,
      activeAlerts,
      loansCount: activeLoans,
      nextPaymentDue,
      introRateExpiringSoon
    };
  }

  /**
   * Validate loan data against schema
   */
  private validateLoanData(data: Partial<LoanDetails>): Partial<LoanDetails> {
    const validated: Partial<LoanDetails> = {};

    if (data.currentInterestRate !== undefined && data.currentInterestRate !== null) {
      if (!loanValidationSchema.currentInterestRate(data.currentInterestRate)) {
        throw new Error('Invalid current interest rate');
      }
      validated.currentInterestRate = data.currentInterestRate;
    }

    if (data.introductoryRate !== undefined && data.introductoryRate !== null) {
      if (!loanValidationSchema.introductoryRate(data.introductoryRate)) {
        throw new Error('Invalid introductory rate');
      }
      validated.introductoryRate = data.introductoryRate;
    }

    if (data.paymentsPerMonth !== undefined) {
      if (!loanValidationSchema.paymentsPerMonth(data.paymentsPerMonth)) {
        throw new Error('Invalid payments per month');
      }
      validated.paymentsPerMonth = data.paymentsPerMonth;
    }

    if (data.paymentsRemaining !== undefined && data.paymentsRemaining !== null) {
      if (!loanValidationSchema.paymentsRemaining(data.paymentsRemaining)) {
        throw new Error('Invalid payments remaining');
      }
      validated.paymentsRemaining = data.paymentsRemaining;
    }

    if (data.loanTerm !== undefined && data.loanTerm !== null) {
      if (!loanValidationSchema.loanTerm(data.loanTerm)) {
        throw new Error('Invalid loan term');
      }
      validated.loanTerm = data.loanTerm;
    }

    if (data.gracePeriod !== undefined && data.gracePeriod !== null) {
      if (!loanValidationSchema.gracePeriod(data.gracePeriod)) {
        throw new Error('Invalid grace period');
      }
      validated.gracePeriod = data.gracePeriod;
    }

    // Allow new fields to pass through
    if (data.originalAmount !== undefined) {
      validated.originalAmount = data.originalAmount;
    }
    if (data.currentBalance !== undefined) {
      validated.currentBalance = data.currentBalance;
    }
    if (data.startDate !== undefined) {
      validated.startDate = data.startDate;
    }
    if (data.paymentsMade !== undefined) {
      validated.paymentsMade = data.paymentsMade;
    }

    return validated;
  }

  /**
   * Mask sensitive loan data if needed
   */
  maskLoanData(loan: LoanDetails, showSensitiveData: boolean = true): LoanDetails {
    if (showSensitiveData) {
      return loan;
    }

    return {
      ...loan,
      currentInterestRate: maskSensitiveValue(loan.currentInterestRate, false),
      introductoryRate: maskSensitiveValue(loan.introductoryRate, false),
      paymentsRemaining: maskSensitiveValue(loan.paymentsRemaining, false),
    } as LoanDetails;
  }
}

// Export singleton instance
export const loanService = LoanService.getInstance(); 