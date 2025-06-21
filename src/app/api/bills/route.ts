import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
  try {
    // Use raw SQL to get all account data including liability fields
    const accounts = await prisma.$queryRaw`
      SELECT * FROM Account
    `;

    // Get balances separately
    const balances = await prisma.$queryRaw`
      SELECT * FROM AccountBalance
    `;

    console.log("All accounts fetched for bills endpoint:", JSON.stringify(accounts, null, 2));
    console.log("All balances fetched:", JSON.stringify(balances, null, 2));

    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 30);

    let totalBillsDueThisMonth = 0;
    let availableCash = 0;

    for (const account of accounts as any[]) {
      // Find balances for this account
      const accountBalances = (balances as any[]).filter(b => b.accountId === account.id);
      
      // Calculate bills due
      if (account.type === "credit" || account.type === "loan") {
        console.log(`Processing ${account.type} account: ${account.name}`);
        console.log(`  - lastStatementBalance: ${account.lastStatementBalance}`);
        console.log(`  - minimumPaymentAmount: ${account.minimumPaymentAmount}`);
        console.log(`  - nextPaymentDueDate:`, account.nextPaymentDueDate, typeof account.nextPaymentDueDate);
        console.log(`  - nextMonthlyPayment: ${account.nextMonthlyPayment}`);
        
        if (account.nextPaymentDueDate) {
          // Ensure nextPaymentDueDate is a Date object
          const dueDate = new Date(account.nextPaymentDueDate);
          console.log(`  - Parsed dueDate:`, dueDate, dueDate instanceof Date);
          if (dueDate >= startDate && dueDate <= endDate) {
            // Use statement balance instead of minimum payment
            const paymentAmount = account.lastStatementBalance || 0;
            totalBillsDueThisMonth += paymentAmount;
            console.log(`  - Adding statement balance: ${paymentAmount}`);
          }
        }
      }

      // Calculate available cash
      if (account.type === "depository" && accountBalances.length > 0) {
        const cash = accountBalances[0]?.available || 0;
        availableCash += cash;
        console.log(`Adding cash from ${account.name}: ${cash}`);
      }
    }

    console.log(`Final totals - Bills due: ${totalBillsDueThisMonth}, Available cash: ${availableCash}`);

    return NextResponse.json({
      totalBillsDueThisMonth,
      availableCash,
    });
  } catch (error) {
    console.error("Error fetching bills data:", error);
    return NextResponse.json(
      { error: "Failed to fetch bills data" },
      { status: 500 }
    );
  }
} 