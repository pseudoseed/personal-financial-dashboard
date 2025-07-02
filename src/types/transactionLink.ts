// Transaction linking system types

export type EntityType = 'loan' | 'subscription' | 'bill' | 'recurring_expense' | 'investment' | 'other';

export interface TransactionLink {
  id: string;
  transactionId: string;
  entityType: EntityType;
  entityId: string;
  metadata?: TransactionLinkMetadata;
  createdAt: Date;
  updatedAt: Date;
  transaction?: {
    id: string;
    name: string;
    amount: number;
    date: string;
    merchantName?: string;
    category?: string;
    account?: {
      id: string;
      name: string;
      type: string;
      plaidItem?: {
        institutionName?: string;
      };
    };
  };
}

// Base metadata interface
export interface BaseTransactionLinkMetadata {
  detectionMethod: 'manual' | 'automatic' | 'pattern';
  confidence?: number; // 0-1 confidence score
  notes?: string;
}

// Loan-specific metadata
export interface LoanPaymentMetadata extends BaseTransactionLinkMetadata {
  paymentDate: string;
  paymentAmount: number;
  paymentType: 'principal' | 'interest' | 'combined';
  loanBalanceAfter?: number;
  isScheduled: boolean;
  lateFee?: number;
  gracePeriodUsed?: boolean;
}

// Subscription-specific metadata
export interface SubscriptionPaymentMetadata extends BaseTransactionLinkMetadata {
  billingCycle: 'monthly' | 'quarterly' | 'yearly' | 'weekly';
  serviceName: string;
  planType?: string;
  renewalDate?: string;
  autoRenew?: boolean;
}

// Bill-specific metadata
export interface BillPaymentMetadata extends BaseTransactionLinkMetadata {
  billType: string;
  dueDate: string;
  lateFee?: number;
  serviceProvider: string;
  accountNumber?: string;
}

// Recurring expense metadata
export interface RecurringExpenseMetadata extends BaseTransactionLinkMetadata {
  expenseName: string;
  frequency: string;
  expectedAmount: number;
  category?: string;
}

// Investment metadata
export interface InvestmentMetadata extends BaseTransactionLinkMetadata {
  investmentType: 'dividend' | 'interest' | 'capital_gain' | 'contribution' | 'withdrawal';
  securityName?: string;
  shares?: number;
  pricePerShare?: number;
}

// Union type for all metadata types
export type TransactionLinkMetadata = 
  | LoanPaymentMetadata
  | SubscriptionPaymentMetadata
  | BillPaymentMetadata
  | RecurringExpenseMetadata
  | InvestmentMetadata;

// API request/response types
export interface CreateTransactionLinkRequest {
  transactionId: string;
  entityType: EntityType;
  entityId: string;
  metadata?: TransactionLinkMetadata;
}

export interface UpdateTransactionLinkRequest {
  metadata?: TransactionLinkMetadata;
}

export interface TransactionLinkResponse {
  data: TransactionLink;
  message: string;
}

export interface TransactionLinksResponse {
  data: TransactionLink[];
  total: number;
  page: number;
  limit: number;
}

// Query parameters for filtering
export interface TransactionLinkQueryParams {
  entityType?: EntityType;
  entityId?: string;
  transactionId?: string;
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

// Payment detection pattern types
export interface PaymentDetectionPattern {
  id: string;
  entityType: EntityType;
  entityId: string;
  merchantPattern: string;
  descriptionPattern?: string;
  amountPattern: 'exact' | 'range' | 'percentage' | 'variable';
  amountValue?: number;
  amountRange?: { min: number; max: number };
  frequency?: 'monthly' | 'weekly' | 'quarterly' | 'yearly';
  dayOfMonth?: number;
  dayOfWeek?: number;
  confidence: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Sensitive data masking
export interface MaskedTransactionLink extends Omit<TransactionLink, 'metadata'> {
  metadata?: MaskedTransactionLinkMetadata;
}

export type MaskedTransactionLinkMetadata = {
  [K in keyof TransactionLinkMetadata]: TransactionLinkMetadata[K] extends string 
    ? string 
    : TransactionLinkMetadata[K] extends number 
      ? number 
      : TransactionLinkMetadata[K] extends boolean 
        ? boolean 
        : TransactionLinkMetadata[K] extends object 
          ? MaskedTransactionLinkMetadata
          : TransactionLinkMetadata[K];
};

// Utility types for component props
export interface TransactionLinkerProps {
  transactionId: string;
  onLinkCreated: (link: TransactionLink) => void;
  onCancel: () => void;
  showSensitiveData?: boolean;
}

export interface EntityLinkListProps {
  entityType: EntityType;
  entityId: string;
  showSensitiveData?: boolean;
  onLinkUpdated?: (link: TransactionLink) => void;
  onLinkDeleted?: (linkId: string) => void;
}

export interface MetadataEditorProps {
  entityType: EntityType;
  metadata?: TransactionLinkMetadata;
  onMetadataChange: (metadata: TransactionLinkMetadata) => void;
  showSensitiveData?: boolean;
} 