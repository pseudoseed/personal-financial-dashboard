export interface AccountBalance {
  date: string;
  current: number;
  available?: number | null;
  limit?: number | null;
}

export interface Account {
  id: string;
  name: string;
  nickname?: string | null;
  type: string;
  subtype: string | null;
  mask?: string | null;
  hidden?: boolean;
  institution?: string;
  institutionLogo?: string | null;
  balance: {
    current: number;
    available?: number | null;
    limit?: number | null;
  };
  balances?: AccountBalance[];
  plaidItem?: {
    institutionId: string;
    accessToken?: string;
    provider?: string;
    status?: string;
  };
  url?: string | null;
  lastUpdated?: string | null;
  plaidSyncCursor?: string | null;
  lastSyncTime?: Date | null;
  
  // Liability specific fields
  lastStatementBalance?: number | null;
  minimumPaymentAmount?: number | null;
  nextPaymentDueDate?: Date | null;
  lastPaymentDate?: Date | null;
  lastPaymentAmount?: number | null;
  nextMonthlyPayment?: number | null;
  originationDate?: Date | null;
  originationPrincipalAmount?: number | null;
  invertTransactions: boolean;
}
