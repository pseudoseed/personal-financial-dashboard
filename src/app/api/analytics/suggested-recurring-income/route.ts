import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { differenceInDays } from "date-fns";

// Helper: naive recurring detection (amount, description, interval)
async function detectRecurringIncome() {
  // Get all transactions from depository accounts (checking/savings only)
  const transactions = await prisma.transaction.findMany({
    where: {
      account: {
        type: 'depository',
        subtype: {
          in: ['checking', 'savings'] // Only checking and savings accounts
        },
      },
    },
    orderBy: { date: "desc" },
    include: {
      account: true,
    },
  });

  // Filter to only income transactions based on invertTransactions flag
  const incomeTransactions = transactions.filter(tx => {
    const actualAmount = tx.account.invertTransactions ? -tx.amount : tx.amount;
    return actualAmount > 0; // This is income
  });

  // Get existing recurring payments
  const recurringPayments = await prisma.recurringPayment.findMany({
    where: { isActive: true },
  });

  // Group by name/description and amount
  const groups: Record<string, { name: string; amount: number; dates: Date[] }> = {};
  for (const tx of incomeTransactions) {
    const key = `${tx.name || tx.merchantName || "Unknown"}|${tx.amount}`;
    if (!groups[key]) {
      groups[key] = { name: tx.name || tx.merchantName || "Unknown", amount: tx.amount, dates: [] };
    }
    groups[key].dates.push(new Date(tx.date));
  }

  // Detect recurring patterns (at least 3 occurrences, regular interval)
  const suggestions = [];
  for (const group of Object.values(groups)) {
    if (group.dates.length < 3) continue;
    // Sort dates descending
    group.dates.sort((a, b) => b.getTime() - a.getTime());
    // Calculate intervals
    const intervals = [];
    for (let i = 1; i < group.dates.length; i++) {
      intervals.push(Math.abs(differenceInDays(group.dates[i - 1], group.dates[i])));
    }
    // Find the most common interval
    const intervalCounts: Record<number, number> = {};
    for (const int of intervals) intervalCounts[int] = (intervalCounts[int] || 0) + 1;
    const [mostCommonInterval, count] = Object.entries(intervalCounts).sort((a, b) => b[1] - a[1])[0] || [null, 0];
    if (!mostCommonInterval || count < 2) continue;
    // Map interval to frequency
    let frequency: string | null = null;
    if (Math.abs(Number(mostCommonInterval) - 14) <= 2) frequency = "bi-weekly";
    else if (Math.abs(Number(mostCommonInterval) - 7) <= 1) frequency = "weekly";
    else if (Math.abs(Number(mostCommonInterval) - 30) <= 3) frequency = "monthly";
    else if (Math.abs(Number(mostCommonInterval) - 90) <= 7) frequency = "quarterly";
    else if (Math.abs(Number(mostCommonInterval) - 365) <= 10) frequency = "yearly";
    if (!frequency) continue;
    // Check against existing recurring payments
    const alreadyExists = recurringPayments.some((rp: any) =>
      Math.abs(rp.amount - group.amount) < 1e-2 &&
      rp.name?.toLowerCase() === group.name.toLowerCase() &&
      rp.frequency === frequency
    );
    if (alreadyExists) continue;
    // Suggest
    suggestions.push({
      name: group.name,
      amount: group.amount,
      frequency,
      lastDate: group.dates[0],
      occurrences: group.dates.length,
    });
  }
  return suggestions;
}

export async function GET(request: NextRequest) {
  try {
    const suggestions = await detectRecurringIncome();
    return NextResponse.json(suggestions);
  } catch (error) {
    console.error("Error suggesting recurring income:", error);
    return NextResponse.json({ error: "Failed to suggest recurring income" }, { status: 500 });
  }
} 