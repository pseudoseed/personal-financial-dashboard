import { addDays, addWeeks, addMonths, addQuarters, addYears, startOfMonth, endOfMonth, format } from 'date-fns';

export interface RecurringPayment {
  id: string;
  name: string;
  amount: number;
  frequency: 'weekly' | 'bi-weekly' | 'monthly' | 'quarterly' | 'yearly';
  nextPaymentDate: Date;
  lastPaymentDate?: Date | null;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  paymentType: string;
  targetAccountId?: string | null;
  isActive: boolean;
  isConfirmed: boolean;
  confidence: number;
}

export function calculateNextPaymentDate(
  currentDate: Date,
  frequency: string,
  dayOfWeek?: number | null,
  dayOfMonth?: number | null,
  initialPayDate?: Date | null
): Date {
  let nextDate = new Date(currentDate);

  switch (frequency) {
    case 'weekly':
      // Always add 7 days from the current date
      nextDate = addWeeks(nextDate, 1);
      break;
    case 'bi-weekly':
      // Always add 14 days from the current date
      nextDate = addWeeks(nextDate, 2);
      break;
    case 'monthly':
      if (dayOfMonth !== null && dayOfMonth !== undefined) {
        nextDate = addMonths(nextDate, 1);
        nextDate.setDate(dayOfMonth);
      } else {
        nextDate = addMonths(nextDate, 1);
      }
      break;
    case 'quarterly':
      nextDate = addQuarters(nextDate, 1);
      break;
    case 'yearly':
      nextDate = addYears(nextDate, 1);
      break;
    default:
      throw new Error(`Unsupported frequency: ${frequency}`);
  }

  return nextDate;
}

export function getExpectedIncomeForMonth(
  recurringPayments: RecurringPayment[],
  targetMonth: Date = new Date()
): number {
  const monthStart = startOfMonth(targetMonth);
  const monthEnd = endOfMonth(targetMonth);
  const now = new Date();

  let totalExpectedIncome = 0;

  for (const payment of recurringPayments) {
    if (!payment.isActive) continue;

    let paymentDate = new Date(Math.max(payment.nextPaymentDate.getTime(), monthStart.getTime()));
    let iterations = 0;
    // If the payment date is before the target month, calculate forward to the target month
    while (paymentDate < monthStart) {
      if (iterations++ > 50) {
        console.error('Infinite loop detected in getExpectedIncomeForMonth pre-loop', { payment, paymentDate, monthStart });
        break;
      }
      paymentDate = calculateNextPaymentDate(
        paymentDate,
        payment.frequency,
        payment.dayOfWeek,
        payment.dayOfMonth
      );
    }
    iterations = 0;
    // Calculate all payment dates within the target month
    while (paymentDate <= monthEnd) {
      if (iterations++ > 50) {
        console.error('Infinite loop detected in getExpectedIncomeForMonth main loop', { payment, paymentDate, monthEnd });
        break;
      }
      if (paymentDate > now) {
        totalExpectedIncome += payment.amount;
      }
      paymentDate = calculateNextPaymentDate(
        paymentDate,
        payment.frequency,
        payment.dayOfWeek,
        payment.dayOfMonth
      );
    }
  }

  return totalExpectedIncome;
}

export function getRecurringPaymentsForMonth(
  recurringPayments: RecurringPayment[],
  targetMonth: Date = new Date()
): RecurringPayment[] {
  const monthStart = startOfMonth(targetMonth);
  const monthEnd = endOfMonth(targetMonth);
  const now = new Date();

  const paymentsInMonth: RecurringPayment[] = [];

  for (const payment of recurringPayments) {
    if (!payment.isActive) continue;

    // Start from the payment's next payment date or the beginning of the target month
    let paymentDate = new Date(Math.max(payment.nextPaymentDate.getTime(), monthStart.getTime()));

    // If the payment date is before the target month, calculate forward to the target month
    while (paymentDate < monthStart) {
      paymentDate = calculateNextPaymentDate(
        paymentDate,
        payment.frequency,
        payment.dayOfWeek,
        payment.dayOfMonth
      );
    }

    // Check if this payment has any dates within the target month
    let hasPaymentInMonth = false;
    let currentPaymentDate = new Date(paymentDate);

    while (currentPaymentDate <= monthEnd) {
      // Only count future payments (not past payments)
      if (currentPaymentDate > now) {
        hasPaymentInMonth = true;
        break;
      }
      
      // Calculate the next payment date
      currentPaymentDate = calculateNextPaymentDate(
        currentPaymentDate,
        payment.frequency,
        payment.dayOfWeek,
        payment.dayOfMonth
      );
    }

    if (hasPaymentInMonth) {
      paymentsInMonth.push(payment);
    }
  }

  return paymentsInMonth;
}

export function formatFrequency(frequency: string): string {
  switch (frequency) {
    case 'weekly': return 'Weekly';
    case 'bi-weekly': return 'Bi-weekly';
    case 'monthly': return 'Monthly';
    case 'quarterly': return 'Quarterly';
    case 'yearly': return 'Yearly';
    default: return frequency;
  }
}

export function formatPaymentType(paymentType: string): string {
  switch (paymentType) {
    case 'direct_deposit': return 'Direct Deposit';
    case 'paycheck': return 'Paycheck';
    case 'investment_dividend': return 'Investment Dividend';
    case 'other': return 'Other';
    default: return paymentType;
  }
}

export function getDayOfWeekName(dayOfWeek: number): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[dayOfWeek] || 'Unknown';
} 