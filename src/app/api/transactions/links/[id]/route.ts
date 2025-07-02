import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { ensureDefaultUser } from '@/lib/startupValidation';
import { maskSensitiveValue } from '@/lib/ui';
import { TransactionLinkMetadata } from '@/types/transactionLink';

export const dynamic = 'force-dynamic';

/**
 * GET /api/transactions/links/[id]
 * Get a transaction link by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userExists = await ensureDefaultUser();
    if (!userExists) {
      return NextResponse.json({ error: 'System not properly initialized' }, { status: 503 });
    }
    const { id } = params;
    const { searchParams } = new URL(request.url);
    const showSensitiveData = searchParams.get('showSensitiveData') !== 'false';

    const link = await prisma.transactionLink.findUnique({
      where: { id },
      include: {
        transaction: {
          select: {
            id: true,
            name: true,
            amount: true,
            date: true,
            merchantName: true,
            category: true,
            account: {
              select: {
                id: true,
                name: true,
                type: true,
                plaidItem: {
                  select: { institutionName: true }
                }
              }
            }
          }
        }
      }
    });
    if (!link) {
      return NextResponse.json({ error: 'Transaction link not found' }, { status: 404 });
    }
    let processedLink = {
      ...link,
      metadata: link.metadata ? JSON.parse(link.metadata as string) : undefined
    };
    if (!showSensitiveData) {
      processedLink.metadata = maskSensitiveValue(processedLink.metadata);
      if (processedLink.transaction.merchantName) {
        processedLink.transaction.merchantName = maskSensitiveValue(processedLink.transaction.merchantName);
      }
    }
    return NextResponse.json({ data: processedLink });
  } catch (error) {
    console.error('Error fetching transaction link:', error);
    return NextResponse.json({ error: 'Failed to fetch transaction link' }, { status: 500 });
  }
}

/**
 * PUT /api/transactions/links/[id]
 * Update a transaction link's metadata
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userExists = await ensureDefaultUser();
    if (!userExists) {
      return NextResponse.json({ error: 'System not properly initialized' }, { status: 503 });
    }
    const { id } = params;
    const body = await request.json();
    const { metadata } = body;
    if (!metadata) {
      return NextResponse.json({ error: 'metadata is required' }, { status: 400 });
    }
    // Validate metadata type (optional: add more validation here)
    const updated = await prisma.transactionLink.update({
      where: { id },
      data: { metadata: JSON.stringify(metadata) }
    });
    return NextResponse.json({ data: { ...updated, metadata }, message: 'Transaction link updated' });
  } catch (error) {
    console.error('Error updating transaction link:', error);
    return NextResponse.json({ error: 'Failed to update transaction link' }, { status: 500 });
  }
}

/**
 * DELETE /api/transactions/links/[id]
 * Delete a transaction link
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userExists = await ensureDefaultUser();
    if (!userExists) {
      return NextResponse.json({ error: 'System not properly initialized' }, { status: 503 });
    }
    const { id } = params;
    await prisma.transactionLink.delete({ where: { id } });
    return NextResponse.json({ message: 'Transaction link deleted' });
  } catch (error) {
    console.error('Error deleting transaction link:', error);
    return NextResponse.json({ error: 'Failed to delete transaction link' }, { status: 500 });
  }
} 