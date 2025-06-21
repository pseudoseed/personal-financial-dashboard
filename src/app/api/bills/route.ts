import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    // Get all accounts with their latest balance and liability data
    const accounts = await prisma.account.findMany({
      include: {
        balances: {
          orderBy: {
            date: "desc",
          },
          take: 1,
        },
        transactions: {
          where: {
            pending: true,
          },
          orderBy: {
            date: "desc",
          },
          take: 10, // Get last 10 pending transactions
        },
      },
    });

    console.log(`Found ${accounts.length} accounts for bills calculation`);

    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 30);

    let totalBillsDueThisMonth = 0;
    let availableCash = 0;

    for (const account of accounts) {
      // Calculate bills due for credit/loan accounts
      if (account.type === "credit" || account.type === "loan") {
        console.log(`Processing ${account.type} account: ${account.name}`);
        console.log(`  - lastStatementBalance: ${account.lastStatementBalance}`);
        console.log(`  - minimumPaymentAmount: ${account.minimumPaymentAmount}`);
        console.log(`  - nextPaymentDueDate:`, account.nextPaymentDueDate);
        
        if (account.nextPaymentDueDate) {
          const dueDate = new Date(account.nextPaymentDueDate);
          console.log(`  - Parsed dueDate:`, dueDate);
          
          if (dueDate >= startDate && dueDate <= endDate) {
            // Use statement balance instead of minimum payment
            const paymentAmount = account.lastStatementBalance || 0;
            totalBillsDueThisMonth += paymentAmount;
            console.log(`  - Adding statement balance: ${paymentAmount}`);
          }
        }
      }

      // Calculate available cash for depository accounts
      if (account.type === "depository" && account.balances.length > 0) {
        const cash = account.balances[0]?.available || 0;
        availableCash += cash;
        console.log(`Adding cash from ${account.name}: ${cash}`);
      }
    }

    console.log(`Final totals - Bills due: ${totalBillsDueThisMonth}, Available cash: ${availableCash}`);

    const accountData = accounts.map(account => ({
      id: account.id,
      name: account.name,
      type: account.type,
      balances: account.balances.map(balance => ({
        available: balance.available,
        current: balance.current,
      })),
      lastStatementBalance: account.lastStatementBalance,
      minimumPaymentAmount: account.minimumPaymentAmount,
      nextPaymentDueDate: account.nextPaymentDueDate?.toISOString(),
      pendingTransactions: account.transactions.map(tx => ({
        id: tx.id,
        name: tx.name,
        amount: tx.amount,
        date: tx.date.toISOString(),
        merchantName: tx.merchantName,
      })),
    }));

    return NextResponse.json({
      totalBillsDueThisMonth,
      availableCash,
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