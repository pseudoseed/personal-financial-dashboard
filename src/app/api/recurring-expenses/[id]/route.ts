import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// PUT: Update a recurring expense (confirm, edit, deactivate)
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = params.id;
    const data = await request.json();
    const updated = await prisma.recurringExpense.update({
      where: { id },
      data,
    });
    return NextResponse.json({ updated });
  } catch (error) {
    console.error('Error updating recurring expense:', error);
    return NextResponse.json({ error: 'Failed to update recurring expense' }, { status: 500 });
  }
}

// DELETE: Delete a recurring expense
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = params.id;
    await prisma.recurringExpense.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting recurring expense:', error);
    return NextResponse.json({ error: 'Failed to delete recurring expense' }, { status: 500 });
  }
} 