export interface TransactionChartSettings {
  // Account selection
  selectedAccountIds: string[];
  includeAllAccounts: boolean;
  
  // Transaction filtering
  showIncome: boolean;
  showExpenses: boolean;
  categories: string[];
  minAmount?: number;
  maxAmount?: number;
  
  // Time settings
  period: 'daily' | 'weekly' | 'monthly';
  startDate?: Date;
  endDate?: Date;
  
  // Display options
  groupByCategory: boolean;
  showAccountBreakdown: boolean;
}

export interface TransactionDataPoint {
  period: string;
  income: number;
  expenses: number;
  net: number;
}

export interface TransactionChartData {
  data: TransactionDataPoint[];
  accounts: Array<{
    id: string;
    name: string;
    type: string;
    nickname?: string | null;
    mask?: string | null;
    plaidItem: {
      institutionName: string | null;
    };
  }>;
  categories: string[];
  summary: {
    totalIncome: number;
    totalExpenses: number;
    netAmount: number;
    transactionCount: number;
  };
}

export interface Account {
  id: string;
  name: string;
  type: string;
  nickname?: string | null;
  plaidItem: {
    institutionName: string | null;
  };
} 