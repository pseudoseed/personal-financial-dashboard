import { prisma } from './db';

export interface EnhancedBillData {
  upcomingBills: UpcomingBill[];
  paymentHistory: PaymentHistory[];
  cashFlowForecast: CashFlowForecast;
  paymentInsights: PaymentInsight[];
}

export interface UpcomingBill {
  id: string;
  accountName: string;
  dueDate: string;
  amount: number;
  minPayment: number;
  isOverdue: boolean;
  daysUntilDue: number;
  paymentStatus: 'pending' | 'paid' | 'overdue';
  category: string;
}

export interface PaymentHistory {
  id: string;
  accountName: string;
  paymentDate: string;
  amount: number;
  originalAmount: number;
  status: 'completed' | 'pending' | 'failed';
  method: string;
}

export interface CashFlowForecast {
  next30Days: {
    income: number;
    expenses: number;
    netFlow: number;
    availableCash: number;
  };
  next90Days: {
    income: number;
    expenses: number;
    netFlow: number;
  };
  monthlyBreakdown: MonthlyBreakdown[];
}

export interface MonthlyBreakdown {
  month: string;
  income: number;
  expenses: number;
  netFlow: number;
}

export interface PaymentInsight {
  type: 'warning' | 'info' | 'success';
  title: string;
  description: string;
  action?: string;
}

export async function getEnhancedBillsData(userId: string): Promise<EnhancedBillData> {
  // Get accounts with bills data (credit and loan accounts)
  const billAccounts = await prisma.account.findMany({
    where: { userId, hidden: false, type: { in: ['credit', 'loan'] } },
    include: {
      balances: {
        orderBy: { date: 'desc' },
        take: 1,
      },
    },
  });

  // Get depository accounts for available cash calculation
  const depositoryAccounts = await prisma.account.findMany({
    where: { userId, hidden: false, type: 'depository' },
    include: {
      balances: {
        orderBy: { date: 'desc' },
        take: 1,
      },
    },
  });

  // Get recurring payments for income forecasting
  const recurringPayments = await prisma.recurringPayment.findMany({ where: { userId } });

  // Get recurring expenses for expense forecasting
  const recurringExpenses = await prisma.recurringExpense.findMany({ where: { userId } });

  // Calculate upcoming bills from bill accounts
  const upcomingBills = calculateUpcomingBills(billAccounts);
  
  // Calculate payment history (simulated for now)
  const paymentHistory = calculatePaymentHistory(billAccounts);
  
  // Calculate cash flow forecast using both account types
  const cashFlowForecast = calculateCashFlowForecast(
    billAccounts, 
    depositoryAccounts,
    recurringPayments, 
    recurringExpenses, 
    upcomingBills
  );
  
  // Generate payment insights
  const paymentInsights = generatePaymentInsights(upcomingBills, cashFlowForecast);

  return {
    upcomingBills,
    paymentHistory,
    cashFlowForecast,
    paymentInsights,
  };
}

function calculateUpcomingBills(accounts: any[]): UpcomingBill[] {
  const bills: UpcomingBill[] = [];
  const now = new Date();

  accounts.forEach(account => {
    // Use statement balance and due date if available
    const statementBalance = account.lastStatementBalance;
    const statementDueDate = account.nextPaymentDueDate;
    let amount = 0;
    let dueDate: string | null = null;
    let minPayment = account.minimumPaymentAmount || 0;

    // Determine the appropriate amount based on account type
    if (account.type === 'loan') {
      // For loans (including mortgages), use monthly payment amount
      if (typeof account.nextMonthlyPayment === 'number' && account.nextMonthlyPayment > 0) {
        amount = account.nextMonthlyPayment;
      } else if (typeof account.minimumPaymentAmount === 'number' && account.minimumPaymentAmount > 0) {
        amount = account.minimumPaymentAmount;
      } else if (typeof statementBalance === 'number' && statementBalance > 0) {
        // Fallback to statement balance if no monthly payment is set
        amount = statementBalance;
      }
    } else if (account.type === 'credit') {
      // For credit cards, use monthly payment override if set, otherwise use statement balance
      if (typeof account.nextMonthlyPayment === 'number' && account.nextMonthlyPayment > 0) {
        amount = account.nextMonthlyPayment;
      } else if (typeof statementBalance === 'number' && statementBalance > 0) {
        amount = statementBalance;
      }
    }

    // Set due date
    if (statementDueDate) {
      dueDate = new Date(statementDueDate).toISOString().split('T')[0];
    } else if (account.balances && account.balances.length > 0) {
      // Fallback to previous logic for due date
      const fallbackDue = new Date(now);
      fallbackDue.setDate(fallbackDue.getDate() + 15 + Math.floor(Math.random() * 10));
      dueDate = fallbackDue.toISOString().split('T')[0];
      if (!minPayment && amount > 0) {
        minPayment = Math.max(amount * 0.02, 25); // 2% or $25 minimum
      }
    }

    if (amount > 0 && dueDate) {
      const due = new Date(dueDate);
      bills.push({
        id: `${account.id}-${dueDate}`,
        accountName: account.nickname || account.name,
        dueDate,
        amount,
        minPayment,
        isOverdue: due < now,
        daysUntilDue: Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
        paymentStatus: due < now ? 'overdue' : 'pending',
        category: account.type === 'credit' ? 'Credit Card' : 'Loan',
      });
    }
  });

  return bills.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
}

function calculatePaymentHistory(accounts: any[]): PaymentHistory[] {
  const history: PaymentHistory[] = [];
  const now = new Date();
  
  // Simulate payment history for the last 6 months
  for (let i = 0; i < 6; i++) {
    const paymentDate = new Date(now);
    paymentDate.setMonth(paymentDate.getMonth() - i);
    
    accounts.forEach(account => {
      if (account.balances && account.balances.length > 0) {
        const balance = account.balances[0];
        const amount = (balance.current || 0) * 0.8; // Assume 80% payment rate
        
        if (amount > 0) {
          history.push({
            id: `${account.id}-${paymentDate.toISOString().split('T')[0]}`,
            accountName: account.nickname || account.name,
            paymentDate: paymentDate.toISOString().split('T')[0],
            amount,
            originalAmount: balance.current || 0,
            status: 'completed',
            method: 'Automatic',
          });
        }
      }
    });
  }

  return history.sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime());
}

function calculateCashFlowForecast(
  billAccounts: any[],
  depositoryAccounts: any[],
  recurringPayments: any[],
  recurringExpenses: any[],
  upcomingBills: UpcomingBill[]
): CashFlowForecast {
  const now = new Date();
  
  // Calculate next 30 days
  const next30Days = {
    income: calculateIncome(recurringPayments, 30),
    expenses: calculateExpenses(recurringExpenses, upcomingBills, 30),
    netFlow: 0,
    availableCash: calculateAvailableCash(depositoryAccounts),
  };
  next30Days.netFlow = next30Days.income - next30Days.expenses;
  
  // Calculate next 90 days
  const next90Days = {
    income: calculateIncome(recurringPayments, 90),
    expenses: calculateExpenses(recurringExpenses, upcomingBills, 90),
    netFlow: 0,
  };
  next90Days.netFlow = next90Days.income - next90Days.expenses;
  
  // Calculate monthly breakdown
  const monthlyBreakdown = calculateMonthlyBreakdown(
    recurringPayments, 
    recurringExpenses, 
    upcomingBills
  );

  return {
    next30Days,
    next90Days,
    monthlyBreakdown,
  };
}

function calculateIncome(recurringPayments: any[], days: number): number {
  return recurringPayments.reduce((total, payment) => {
    const frequency = payment.frequency || 'monthly';
    const amount = payment.amount || 0;
    
    switch (frequency) {
      case 'weekly':
        return total + (amount * Math.ceil(days / 7));
      case 'biweekly':
        return total + (amount * Math.ceil(days / 14));
      case 'monthly':
        return total + (amount * Math.ceil(days / 30));
      default:
        return total + amount;
    }
  }, 0);
}

function calculateExpenses(recurringExpenses: any[], upcomingBills: UpcomingBill[], days: number): number {
  const recurringTotal = recurringExpenses.reduce((total, expense) => {
    const frequency = expense.frequency || 'monthly';
    const amount = expense.amount || 0;
    
    switch (frequency) {
      case 'weekly':
        return total + (amount * Math.ceil(days / 7));
      case 'biweekly':
        return total + (amount * Math.ceil(days / 14));
      case 'monthly':
        return total + (amount * Math.ceil(days / 30));
      default:
        return total + amount;
    }
  }, 0);
  
  const billsTotal = upcomingBills
    .filter(bill => {
      const dueDate = new Date(bill.dueDate);
      const now = new Date();
      const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return daysUntilDue <= days;
    })
    .reduce((total, bill) => total + bill.amount, 0);
  
  return recurringTotal + billsTotal;
}

function calculateAvailableCash(depositoryAccounts: any[]): number {
  const availableCash = depositoryAccounts
    .reduce((total, account) => {
      const balance = account.balances?.[0]?.current || 0;
      return total + balance;
    }, 0);
  
  return availableCash;
}

function calculateMonthlyBreakdown(
  recurringPayments: any[],
  recurringExpenses: any[],
  upcomingBills: UpcomingBill[]
): MonthlyBreakdown[] {
  const breakdown: MonthlyBreakdown[] = [];
  const now = new Date();
  
  for (let i = 0; i < 6; i++) {
    const month = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const monthKey = month.toISOString().slice(0, 7); // YYYY-MM format
    
    const income = calculateIncome(recurringPayments, 30);
    const expenses = calculateExpenses(recurringExpenses, upcomingBills, 30);
    
    breakdown.push({
      month: monthKey,
      income,
      expenses,
      netFlow: income - expenses,
    });
  }
  
  return breakdown;
}

function generatePaymentInsights(upcomingBills: UpcomingBill[], cashFlow: CashFlowForecast): PaymentInsight[] {
  const insights: PaymentInsight[] = [];
  
  // Check for overdue bills
  const overdueBills = upcomingBills.filter(bill => bill.isOverdue);
  if (overdueBills.length > 0) {
    insights.push({
      type: 'warning',
      title: 'Overdue Payments',
      description: `You have ${overdueBills.length} overdue payment${overdueBills.length > 1 ? 's' : ''}. Consider paying these immediately to avoid late fees.`,
      action: 'Review overdue bills',
    });
  }
  
  // Check for upcoming bills in next 7 days
  const urgentBills = upcomingBills.filter(bill => bill.daysUntilDue <= 7 && !bill.isOverdue);
  if (urgentBills.length > 0) {
    insights.push({
      type: 'info',
      title: 'Upcoming Payments',
      description: `You have ${urgentBills.length} payment${urgentBills.length > 1 ? 's' : ''} due in the next 7 days.`,
      action: 'Schedule payments',
    });
  }
  
  // Check cash flow
  if (cashFlow.next30Days.netFlow < 0) {
    insights.push({
      type: 'warning',
      title: 'Negative Cash Flow',
      description: `Your expenses exceed income by ${Math.abs(cashFlow.next30Days.netFlow).toFixed(2)} over the next 30 days.`,
      action: 'Review expenses',
    });
  } else if (cashFlow.next30Days.netFlow > 0) {
    insights.push({
      type: 'success',
      title: 'Positive Cash Flow',
      description: `You're projected to have ${cashFlow.next30Days.netFlow.toFixed(2)} in surplus over the next 30 days.`,
    });
  }
  
  // Check available cash vs upcoming expenses
  if (cashFlow.next30Days.availableCash < cashFlow.next30Days.expenses) {
    insights.push({
      type: 'warning',
      title: 'Insufficient Cash',
      description: `Your available cash (${cashFlow.next30Days.availableCash.toFixed(2)}) may not cover upcoming expenses (${cashFlow.next30Days.expenses.toFixed(2)}).`,
      action: 'Increase savings',
    });
  }
  
  return insights;
} 