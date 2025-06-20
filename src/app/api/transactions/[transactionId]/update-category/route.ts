import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/db';

export async function PUT(
  req: NextRequest,
  { params }: { params: { transactionId: string } }
) {
  try {
    const { category } = await req.json();
    const { transactionId } = params;

    if (!category || typeof category !== 'string') {
      return NextResponse.json({ error: 'Category is required and must be a string' }, { status: 400 });
    }

    // Update the transaction's AI category
    const updatedTransaction = await prisma.transaction.update({
      where: { id: transactionId },
      data: { categoryAi: category },
      select: { id: true, name: true, categoryAi: true }
    });

    return NextResponse.json({ 
      success: true, 
      transaction: updatedTransaction,
      message: 'Category updated successfully' 
    });
  } catch (error) {
    console.error('Error updating transaction category:', error);
    return NextResponse.json({ 
      error: 'Failed to update transaction category',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 