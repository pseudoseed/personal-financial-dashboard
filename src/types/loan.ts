// Loan tracking system types

export type DataSource = 'plaid' | 'manual' | 'calculated' | 'user_provided';
export type RateType = 'fixed' | 'variable' | 'introductory';
export type LoanType = 'mortgage' | 'auto' | 'personal' | 'student' | 'credit_card';
export type AlertType = 'intro_rate_expiring' | 'high_interest' | 'payment_due' | 'balance_high';
export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';

// Core loan details interface
export interface LoanDetails {
  id: string;
  accountId: string;
  userId: string;
  
  // New fields
  originalAmount?: number | null;
  currentBalance?: number | null;
  startDate?: Date | string | null;
  paymentsMade?: number | null;
  balanceOverride?: boolean | null;
  overrideDate?: Date | string | null;
  
  // Interest Rate Information
  currentInterestRate?: number | null;
  currentInterestRateSource: DataSource;
  introductoryRate?: number | null;
  introductoryRateSource: DataSource;
  introductoryRateExpiry?: Date | null;
  introductoryRateExpirySource: DataSource;
  rateType?: RateType | null;
  
  // Payment Tracking
  paymentsPerMonth: number;
  paymentsPerMonthSource: DataSource;
  paymentsRemaining?: number | null;
  paymentsRemainingSource: DataSource;
  paymentsRemainingDate?: Date | null;
  
  // Auto-calculation Settings
  autoCalculatePayments: boolean;
  lastCalculationDate?: Date | null;
  
  // Additional Loan Info
  loanType?: LoanType | null;
  loanTerm?: number | null;
  gracePeriod?: number | null;
  
  // Data Source Tracking
  lastPlaidSync?: Date | null;
  plaidDataFields?: string[] | null;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  
  // Relations
  account?: Account;
  paymentHistory?: LoanPaymentHistory[];
  alerts?: LoanAlert[];
}

// Payment history interface
export interface LoanPaymentHistory {
  id: string;
  loanId: string;
  paymentDate: Date;
  amount: number;
  isScheduled: boolean;
  notes?: string | null;
  createdAt: Date;
}

// Alert interface
export interface LoanAlert {
  id: string;
  loanId: string;
  alertType: AlertType;
  title: string;
  message: string;
  severity: AlertSeverity;
  isActive: boolean;
  isDismissed: boolean;
  dismissedAt?: Date | null;
  createdAt: Date;
}

// API request/response interfaces
export interface CreateLoanRequest {
  accountId: string;
  currentInterestRate?: number;
  introductoryRate?: number;
  introductoryRateExpiry?: Date;
  rateType?: RateType;
  paymentsPerMonth?: number;
  paymentsRemaining?: number;
  autoCalculatePayments?: boolean;
  loanType?: LoanType;
  loanTerm?: number;
  gracePeriod?: number;
  originalAmount?: number;
  currentBalance?: number;
  startDate?: Date;
  paymentsMade?: number;
}

export interface UpdateLoanRequest {
  currentInterestRate?: number;
  currentInterestRateSource?: DataSource;
  introductoryRate?: number;
  introductoryRateSource?: DataSource;
  introductoryRateExpiry?: Date;
  introductoryRateExpirySource?: DataSource;
  rateType?: RateType;
  paymentsPerMonth?: number;
  paymentsPerMonthSource?: DataSource;
  paymentsRemaining?: number;
  paymentsRemainingSource?: DataSource;
  autoCalculatePayments?: boolean;
  loanType?: LoanType;
  loanTerm?: number;
  gracePeriod?: number;
  preserveManualEntries?: boolean;
  originalAmount?: number;
  currentBalance?: number;
  startDate?: Date;
  paymentsMade?: number;
}

export interface LoanPaymentRequest {
  paymentDate: Date;
  amount: number;
  isScheduled?: boolean;
  notes?: string;
}

export interface LoanCalculationResult {
  remainingPayments: number;
  totalInterest: number;
  payoffDate: Date;
  monthlyPayment: number;
  optimalPayment: number;
  interestSavings: number;
}

export interface LoanAlertRequest {
  alertType: AlertType;
  title: string;
  message: string;
  severity: AlertSeverity;
}

// Plaid liability data interface
export interface PlaidLiabilityData {
  apr?: number[];
  introductoryApr?: number[];
  introductoryAprPeriod?: number[];
  balanceSubjectToRate?: number[];
  interestChargeAmount?: number[];
  lastPaymentAmount?: number;
  lastPaymentDate?: string;
  lastStatementBalance?: number;
  lastStatementIssueDate?: string;
  minimumPaymentAmount?: number;
  nextPaymentDueDate?: string;
  nextMonthlyPayment?: number;
  originationDate?: string;
  originationPrincipalAmount?: number;
  outstandingInterestAmount?: number;
  paymentReferenceNumber?: string;
  sequenceNumber?: string;
  ytdInterestPaid?: number;
  ytdPrincipalPaid?: number;
}

// Loan summary interface for dashboard
export interface LoanSummary {
  totalDebt: number;
  averageInterestRate: number;
  totalMonthlyPayments: number;
  totalInterestProjected: number;
  activeAlerts: number;
  loansCount: number;
  nextPaymentDue?: Date;
  introRateExpiringSoon?: boolean;
}

// Validation schemas
export const loanValidationSchema = {
  currentInterestRate: (value: number) => value >= 0 && value <= 100,
  introductoryRate: (value: number) => value >= 0 && value <= 100,
  paymentsPerMonth: (value: number) => value >= 1 && value <= 31,
  paymentsRemaining: (value: number) => value >= 0,
  loanTerm: (value: number) => value >= 1 && value <= 600, // 50 years max
  gracePeriod: (value: number) => value >= 0 && value <= 90,
};

// Utility types for API responses
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Account interface (for reference)
export interface Account {
  id: string;
  name: string;
  type: string;
  subtype?: string | null;
  balance: {
    current: number;
    available?: number | null;
    limit?: number | null;
  };
  // ... other account fields
} 