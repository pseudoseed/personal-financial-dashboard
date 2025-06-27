import { prisma } from './db';
import { subYears, addMonths, addWeeks, addQuarters, addYears, differenceInDays } from 'date-fns';

// Helper: group transactions by merchant and amount (with tolerance)
function groupTransactions(transactions: any[]) {
  const groups: Record<string, any[]> = {};
  for (const tx of transactions) {
    const merchant = tx.merchantName || tx.name || 'Other';
    // Round to nearest dollar for grouping, but allow small variations
    const amountKey = Math.round(Math.abs(tx.amount));
    const key = `${merchant}__${amountKey}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(tx);
  }
  return groups;
}

// Helper: detect frequency with better pattern recognition
function detectFrequency(dates: Date[]): { frequency: string; confidence: number } | null {
  if (dates.length < 3) return null;
  
  dates.sort((a, b) => a.getTime() - b.getTime());
  const intervals = dates.slice(1).map((d, i) => differenceInDays(d, dates[i]));
  
  if (intervals.length === 0) return null;
  
  const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const variance = intervals.reduce((sum, interval) => sum + Math.pow(interval - avgInterval, 2), 0) / intervals.length;
  const standardDeviation = Math.sqrt(variance);
  
  // Calculate confidence based on consistency (lower variance = higher confidence)
  const baseConfidence = Math.max(50, 100 - (standardDeviation * 2));
  
  // Determine frequency based on average interval
  let frequency = '';
  if (avgInterval >= 25 && avgInterval <= 35) {
    frequency = 'monthly';
  } else if (avgInterval >= 6 && avgInterval <= 8) {
    frequency = 'weekly';
  } else if (avgInterval >= 85 && avgInterval <= 100) {
    frequency = 'quarterly';
  } else if (avgInterval >= 350 && avgInterval <= 380) {
    frequency = 'yearly';
  } else {
    return null; // No clear pattern
  }
  
  return { frequency, confidence: Math.min(100, baseConfidence) };
}

// Helper: calculate next due date
function calculateNextDueDate(lastDate: Date, frequency: string): Date {
  switch (frequency) {
    case 'weekly':
      return addWeeks(lastDate, 1);
    case 'monthly':
      return addMonths(lastDate, 1);
    case 'quarterly':
      return addQuarters(lastDate, 1);
    case 'yearly':
      return addYears(lastDate, 1);
    default:
      return lastDate;
  }
}

// Helper: check if this is likely a recurring expense (not a one-time payment)
function isLikelyRecurring(transactions: any[]): boolean {
  if (transactions.length < 3) return false;
  
  // Check for consistent merchant names
  const merchants = transactions.map(t => t.merchantName || t.name);
  const uniqueMerchants = new Set(merchants);
  
  // If there are too many different merchant names, it's probably not recurring
  if (uniqueMerchants.size > transactions.length * 0.3) {
    return false;
  }
  
  // Check for consistent amounts (within 10% variance)
  const amounts = transactions.map(t => Math.abs(t.amount));
  const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
  const variance = amounts.reduce((sum, amount) => sum + Math.pow(amount - avgAmount, 2), 0) / amounts.length;
  const coefficientOfVariation = Math.sqrt(variance) / avgAmount;
  
  // If amount varies too much, it's probably not recurring
  return coefficientOfVariation < 0.1;
}

export async function detectRecurringExpenses(_userId: string) {
  const userId = 'default';
  
  // Look at the last year of transactions
  const since = subYears(new Date(), 1);
  const transactions = await prisma.transaction.findMany({
    where: {
      account: { userId },
      date: { gte: since },
      amount: { lt: 0 }, // Only expenses (negative amounts)
    },
    orderBy: { date: 'desc' },
    include: {
      account: {
        select: {
          type: true,
          name: true,
        }
      }
    }
  });

  const groups = groupTransactions(transactions);
  const detected: any[] = [];

  for (const key in groups) {
    const txs = groups[key];
    if (txs.length < 3) continue; // Need at least 3 occurrences
    
    // Check if this looks like a recurring expense
    if (!isLikelyRecurring(txs)) continue;
    
    const dates = txs.map(t => t.date instanceof Date ? t.date : new Date(t.date));
    const frequencyResult = detectFrequency(dates);
    
    if (!frequencyResult) continue;
    
    const { frequency, confidence } = frequencyResult;
    
    // Calculate additional confidence factors
    let finalConfidence = confidence;
    
    // More occurrences = higher confidence
    finalConfidence += Math.min(20, (txs.length - 3) * 5);
    
    // Consistent merchant names = higher confidence
    const merchants = txs.map(t => t.merchantName || t.name);
    const uniqueMerchants = new Set(merchants);
    if (uniqueMerchants.size === 1) {
      finalConfidence += 10;
    }
    
    // Recent activity = higher confidence
    const mostRecent = Math.max(...dates.map(d => d.getTime()));
    const daysSinceLast = differenceInDays(new Date(), new Date(mostRecent));
    if (daysSinceLast < 90) {
      finalConfidence += 10;
    }
    
    finalConfidence = Math.min(100, finalConfidence);
    
    // Calculate next due date
    const lastTransactionDate = new Date(Math.max(...dates.map(d => d.getTime())));
    const nextDueDate = calculateNextDueDate(lastTransactionDate, frequency);
    
    // Check if this expense already exists
    const existingExpense = await prisma.recurringExpense.findFirst({
      where: {
        userId,
        merchantName: txs[0].merchantName || txs[0].name,
        amount: Math.abs(txs[0].amount),
        frequency,
      }
    });
    
    if (existingExpense) {
      continue;
    }
    
    const detectedExpense = {
      name: txs[0].name,
      merchantName: txs[0].merchantName || txs[0].name,
      category: txs[0].category || txs[0].categoryAi,
      amount: Math.abs(txs[0].amount),
      frequency,
      nextDueDate,
      lastTransactionDate,
      confidence: Math.round(finalConfidence),
      transactionIds: txs.map(t => t.id),
      isActive: true,
      isConfirmed: false,
    };
    
    detected.push(detectedExpense);
  }
  
  return detected;
}

// Helper: save detected expenses to database
export async function saveDetectedExpenses(_userId: string, detectedExpenses: any[]) {
  const userId = 'default';
  const savedExpenses = [];
  
  for (const expense of detectedExpenses) {
    try {
      const savedExpense = await prisma.recurringExpense.create({
        data: {
          userId,
          name: expense.name,
          merchantName: expense.merchantName,
          category: expense.category,
          amount: expense.amount,
          frequency: expense.frequency,
          nextDueDate: expense.nextDueDate,
          lastTransactionDate: expense.lastTransactionDate,
          confidence: expense.confidence,
          isActive: expense.isActive,
          isConfirmed: expense.isConfirmed,
        }
      });
      
      // Link transactions to the recurring expense
      if (expense.transactionIds && expense.transactionIds.length > 0) {
        await prisma.recurringExpenseTransaction.createMany({
          data: expense.transactionIds.map((txId: string) => ({
            recurringExpenseId: savedExpense.id,
            transactionId: txId,
          }))
        });
      }
      
      savedExpenses.push(savedExpense);
    } catch (error) {
      console.error(`Error saving expense ${expense.merchantName}:`, error);
    }
  }
  
  return savedExpenses;
} 