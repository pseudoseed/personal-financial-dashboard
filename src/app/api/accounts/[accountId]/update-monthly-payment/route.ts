import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserId } from '@/lib/userManagement';

export async function PUT(
  request: NextRequest,
  { params }: { params: { accountId: string } }
) {
  try {
    const userId = await getCurrentUserId();
    const { accountId } = params;
    const body = await request.json();
    const { monthlyPayment, statementBalance } = body;

    // Validate input
    if (monthlyPayment === undefined || monthlyPayment === null) {
      return NextResponse.json(
        { error: 'Monthly payment amount is required' },
        { status: 400 }
      );
    }

    if (typeof monthlyPayment !== 'number' || monthlyPayment < 0) {
      return NextResponse.json(
        { error: 'Monthly payment amount must be a non-negative number' },
        { status: 400 }
      );
    }

    // Validate statement balance if provided
    if (statementBalance !== undefined && statementBalance !== null) {
      if (typeof statementBalance !== 'number' || statementBalance < 0) {
        return NextResponse.json(
          { error: 'Statement balance must be a non-negative number' },
          { status: 400 }
        );
      }
    }

    // Verify the account belongs to the user
    const account = await prisma.account.findFirst({
      where: {
        id: accountId,
        userId: userId,
      },
    });

    if (!account) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }

    // Update the account with monthly payment and optionally statement balance
    const updateData: any = {
      nextMonthlyPayment: monthlyPayment,
    };

    // Only update statement balance if it was provided
    if (statementBalance !== undefined && statementBalance !== null) {
      updateData.lastStatementBalance = statementBalance;
    }

    const updatedAccount = await prisma.account.update({
      where: { id: accountId },
      data: updateData,
    });

    return NextResponse.json({
      message: 'Account updated successfully',
      account: {
        id: updatedAccount.id,
        name: updatedAccount.name,
        nickname: updatedAccount.nickname,
        nextMonthlyPayment: updatedAccount.nextMonthlyPayment,
        lastStatementBalance: updatedAccount.lastStatementBalance,
      },
    });
  } catch (error) {
    console.error('Error updating account monthly payment:', error);
    return NextResponse.json(
      { error: 'Failed to update account' },
      { status: 500 }
    );
  }
} 