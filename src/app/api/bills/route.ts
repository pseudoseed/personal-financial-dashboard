import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserId } from '@/lib/userManagement';

export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    
    // Get all credit and loan accounts with their latest balances
    const accounts = await prisma.account.findMany({
      where: {
        userId,
        hidden: false,
        type: { in: ['credit', 'loan'] }
      },
      include: {
        balances: {
          orderBy: { date: 'desc' },
          take: 1,
        },
      },
    });

    // Transform accounts into bills format
    const bills = accounts.map(account => {
      const balance = account.balances[0];
      const currentBalance = balance?.current || 0;
      
      // Calculate due date (simplified - in real app this would come from the institution)
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 15); // Assume due in 15 days
      
      return {
        id: account.id,
        accountName: account.nickname || account.name,
        accountType: account.type,
        currentBalance: Math.abs(currentBalance),
        minimumPayment: Math.max(Math.abs(currentBalance) * 0.02, 25), // 2% or $25 minimum
        dueDate: dueDate.toISOString().split('T')[0],
        isOverdue: dueDate < new Date(),
        daysUntilDue: Math.ceil((dueDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)),
        lastStatementBalance: account.lastStatementBalance,
        nextPaymentDueDate: account.nextPaymentDueDate,
        minimumPaymentAmount: account.minimumPaymentAmount,
      };
    });

    // Calculate summary
    const totalBalance = bills.reduce((sum, bill) => sum + bill.currentBalance, 0);
    const totalMinimumPayment = bills.reduce((sum, bill) => sum + bill.minimumPayment, 0);
    const overdueBills = bills.filter(bill => bill.isOverdue);
    const upcomingBills = bills.filter(bill => !bill.isOverdue && bill.daysUntilDue <= 7);

    return NextResponse.json({
      bills,
      summary: {
        totalBalance,
        totalMinimumPayment,
        overdueCount: overdueBills.length,
        upcomingCount: upcomingBills.length,
        totalBills: bills.length,
      }
    });
  } catch (error) {
    console.error('Error fetching bills:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bills' },
      { status: 500 }
    );
  }
} 