import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getExpectedIncomeForMonth } from "@/lib/recurringPaymentUtils";

export async function GET() {
  try {
    // Get all credit and loan accounts for bills calculation
    const accounts = await prisma.account.findMany({
      where: { 
        type: { in: ['credit', 'loan'] }
      },
      select: {
        id: true,
        name: true,
        type: true,
        lastStatementBalance: true,
        minimumPaymentAmount: true,
        nextPaymentDueDate: true,
      },
    });

    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 30);

    let totalBillsDueNext30Days = 0;
    let availableCash = 0;

    console.log(`[Bills API] Looking for bills due between ${startDate.toISOString()} and ${endDate.toISOString()}`);

    for (const account of accounts) {
      if (account.lastStatementBalance && account.minimumPaymentAmount) {
        const dueDate = account.nextPaymentDueDate ? new Date(account.nextPaymentDueDate) : null;

        if (dueDate) {
          console.log(`[Bills API] Account ${account.name}: Due date ${dueDate.toISOString()}, Statement balance: ${account.lastStatementBalance}, Min payment: ${account.minimumPaymentAmount}`);
          
          // Check if payment is due in the next 30 days
          if (dueDate >= startDate && dueDate <= endDate) {
            const paymentAmount = Math.max(account.lastStatementBalance, account.minimumPaymentAmount);
            totalBillsDueNext30Days += paymentAmount;
            console.log(`[Bills API] ✅ Including ${account.name}: $${paymentAmount} due on ${dueDate.toISOString()}`);
          } else {
            console.log(`[Bills API] ❌ Excluding ${account.name}: Due date ${dueDate.toISOString()} is outside 30-day window`);
          }
        } else {
          console.log(`[Bills API] ⚠️ Account ${account.name}: No due date available`);
        }
      } else {
        console.log(`[Bills API] ⚠️ Account ${account.name}: Missing statement balance or minimum payment amount`);
      }
    }

    console.log(`[Bills API] Total bills due in next 30 days: $${totalBillsDueNext30Days}`);

    // Get available cash from depository accounts
    const cashAccounts = await prisma.account.findMany({
      where: { type: 'depository' },
      include: {
        balances: {
          orderBy: { date: 'desc' },
          take: 1,
        },
      },
    });

    for (const account of cashAccounts) {
      if (account.balances.length > 0 && account.balances[0].available && account.balances[0].available > 0) {
        const cash = account.balances[0].available;
        availableCash += cash;
        console.log(`[Bills API] Available cash from ${account.name}: $${cash}`);
      }
    }

    console.log(`[Bills API] Total available cash: $${availableCash}`);

    // Get recurring payments for expected income calculation
    const recurringPayments = await prisma.recurringPayment.findMany({
      where: { 
        userId: "default",
        isActive: true 
      },
      select: {
        id: true,
        name: true,
        amount: true,
        frequency: true,
        nextPaymentDate: true,
        lastPaymentDate: true,
        dayOfWeek: true,
        dayOfMonth: true,
        paymentType: true,
        targetAccountId: true,
        isActive: true,
        isConfirmed: true,
        confidence: true,
      },
    });

    const expectedIncome = getExpectedIncomeForMonth(
      recurringPayments.map(payment => ({
        ...payment,
        frequency: payment.frequency as 'weekly' | 'bi-weekly' | 'monthly' | 'quarterly' | 'yearly'
      })),
      now
    );
    console.log(`[Bills API] Expected income from recurring payments: $${expectedIncome}`);

    const accountData = accounts.map(account => ({
      id: account.id,
      name: account.name,
      type: account.type,
      balances: [],
      lastStatementBalance: account.lastStatementBalance,
      minimumPaymentAmount: account.minimumPaymentAmount,
      nextPaymentDueDate: account.nextPaymentDueDate?.toISOString(),
      pendingTransactions: [],
    }));

    return NextResponse.json({
      totalBillsDueThisMonth: totalBillsDueNext30Days, // Keep old field name for backward compatibility
      totalBillsDueNext30Days, // New field name for clarity
      availableCash,
      expectedIncome, // New field for recurring payments
      accounts: accountData,
    });
  } catch (error) {
    console.error("Error fetching bills data:", error);
    return NextResponse.json(
      { error: "Failed to fetch bills data" },
      { status: 500 }
    );
  }
} 