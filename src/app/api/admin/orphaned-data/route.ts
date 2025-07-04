import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    // Find orphaned accounts (accounts without valid PlaidItems)
    const orphanedAccounts = await prisma.$queryRaw`
      SELECT a.id, a.name, a.type, a.createdAt
      FROM "Account" a
      LEFT JOIN "PlaidItem" p ON a.itemId = p.id
      WHERE p.id IS NULL
    `;

    // Find orphaned transactions (transactions without valid accounts)
    const orphanedTransactions = await prisma.$queryRaw`
      SELECT t.id, t.name, t.amount, t.date, t.accountId
      FROM "Transaction" t
      LEFT JOIN "Account" a ON t.accountId = a.id
      WHERE a.id IS NULL
    `;

    // Find orphaned balance records (balances without valid accounts)
    const orphanedBalances = await prisma.$queryRaw`
      SELECT b.id, b.current, b.date, b.accountId
      FROM "AccountBalance" b
      LEFT JOIN "Account" a ON b.accountId = a.id
      WHERE a.id IS NULL
    `;

    // Find orphaned loan details (loan details without valid accounts)
    const orphanedLoanDetails = await prisma.$queryRaw`
      SELECT l.id, l.accountId, l.loanType, l.createdAt
      FROM "LoanDetails" l
      LEFT JOIN "Account" a ON l.accountId = a.id
      WHERE a.id IS NULL
    `;

    // Calculate summary
    const summary = {
      orphanedAccounts: Array.isArray(orphanedAccounts) ? orphanedAccounts.length : 0,
      orphanedTransactions: Array.isArray(orphanedTransactions) ? orphanedTransactions.length : 0,
      orphanedBalances: Array.isArray(orphanedBalances) ? orphanedBalances.length : 0,
      orphanedLoanDetails: Array.isArray(orphanedLoanDetails) ? orphanedLoanDetails.length : 0,
      totalOrphanedRecords: 0,
    };

    summary.totalOrphanedRecords = summary.orphanedAccounts + summary.orphanedTransactions + summary.orphanedBalances + summary.orphanedLoanDetails;

    return NextResponse.json({
      summary,
      orphanedAccounts: (Array.isArray(orphanedAccounts) ? orphanedAccounts : []).map((account: any) => ({
        ...account,
        institution: "Unknown Institution" // Orphaned accounts don't have PlaidItem, so no institution info
      })),
      orphanedTransactions: orphanedTransactions || [],
      orphanedBalances: orphanedBalances || [],
      orphanedLoanDetails: orphanedLoanDetails || [],
    });
  } catch (error) {
    // Safely handle null/undefined error values
    const errorMessage = error instanceof Error ? error.message : String(error || 'Unknown error');
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error("Error fetching orphaned data:", {
      message: errorMessage,
      stack: errorStack,
      timestamp: new Date().toISOString()
    });
    
    return NextResponse.json(
      { error: "Failed to fetch orphaned data" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { type } = await request.json();

    let deletedCount = 0;

    switch (type) {
      case 'accounts':
        const accountResult = await prisma.$executeRaw`
          DELETE FROM "Account" 
          WHERE itemId NOT IN (SELECT id FROM "PlaidItem")
        `;
        deletedCount = accountResult as number;
        break;

      case 'transactions':
        const transactionResult = await prisma.$executeRaw`
          DELETE FROM "Transaction" 
          WHERE accountId NOT IN (SELECT id FROM "Account")
        `;
        deletedCount = transactionResult as number;
        break;

      case 'balances':
        const balanceResult = await prisma.$executeRaw`
          DELETE FROM "AccountBalance" 
          WHERE accountId NOT IN (SELECT id FROM "Account")
        `;
        deletedCount = balanceResult as number;
        break;

      case 'loans':
        const loanResult = await prisma.$executeRaw`
          DELETE FROM "LoanDetails" 
          WHERE accountId NOT IN (SELECT id FROM "Account")
        `;
        deletedCount = loanResult as number;
        break;

      default:
        return NextResponse.json(
          { error: "Invalid cleanup type" },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      message: `Successfully cleaned up ${deletedCount} orphaned ${type}`,
      deletedCount,
    });
  } catch (error) {
    // Safely handle null/undefined error values
    const errorMessage = error instanceof Error ? error.message : String(error || 'Unknown error');
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error("Error cleaning up orphaned data:", {
      message: errorMessage,
      stack: errorStack,
      timestamp: new Date().toISOString()
    });
    
    return NextResponse.json(
      { error: "Failed to clean up orphaned data" },
      { status: 500 }
    );
  }
} 