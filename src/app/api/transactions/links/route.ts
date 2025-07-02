import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { ensureDefaultUser } from '@/lib/startupValidation';
import { 
  CreateTransactionLinkRequest, 
  TransactionLinkQueryParams,
  TransactionLinksResponse,
  EntityType,
  TransactionLink
} from '@/types/transactionLink';
import { maskSensitiveValue } from '@/lib/ui';

export const dynamic = 'force-dynamic';

/**
 * GET /api/transactions/links
 * Get transaction links with filtering and pagination
 */
export async function GET(request: NextRequest) {
  try {
    const userExists = await ensureDefaultUser();
    if (!userExists) {
      return NextResponse.json({ error: 'System not properly initialized' }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    
    // Parse query parameters
    const entityType = searchParams.get('entityType') as EntityType | null;
    const entityId = searchParams.get('entityId');
    const transactionId = searchParams.get('transactionId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100); // Max 100 per page
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const showSensitiveData = searchParams.get('showSensitiveData') !== 'false';

    // Build where clause
    const where: any = {};
    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;
    if (transactionId) where.transactionId = transactionId;

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Get total count
    const total = await prisma.transactionLink.count({ where });

    // Get transaction links with pagination
    const links = await prisma.transactionLink.findMany({
      where,
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
                  select: {
                    institutionName: true
                  }
                }
              }
            }
          }
        }
      },
      orderBy: { [sortBy]: sortOrder },
      skip,
      take: limit,
    });

    // Process and mask sensitive data if needed
    const processedLinks = links.map(link => {
      const processedLink = {
        ...link,
        entityType: link.entityType as EntityType,
        metadata: link.metadata as any,
        transaction: {
          ...link.transaction,
          date: link.transaction.date.toISOString()
        }
      };

      if (!showSensitiveData) {
        // Mask sensitive information
        processedLink.metadata = maskSensitiveValue(processedLink.metadata, showSensitiveData);
        if (processedLink.transaction.merchantName) {
          processedLink.transaction.merchantName = maskSensitiveValue(processedLink.transaction.merchantName, showSensitiveData);
        }
      }

      return processedLink;
    }) as TransactionLink[];

    const response: TransactionLinksResponse = {
      data: processedLinks,
      total,
      page,
      limit
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error fetching transaction links:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transaction links' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/transactions/links
 * Create a new transaction link
 */
export async function POST(request: NextRequest) {
  try {
    const userExists = await ensureDefaultUser();
    if (!userExists) {
      return NextResponse.json({ error: 'System not properly initialized' }, { status: 503 });
    }

    const body: CreateTransactionLinkRequest = await request.json();
    const { transactionId, entityType, entityId, metadata } = body;

    // Validate required fields
    if (!transactionId || !entityType || !entityId) {
      return NextResponse.json(
        { error: 'transactionId, entityType, and entityId are required' },
        { status: 400 }
      );
    }

    // Validate entity type
    const validEntityTypes: EntityType[] = ['loan', 'subscription', 'bill', 'recurring_expense', 'investment', 'other'];
    if (!validEntityTypes.includes(entityType)) {
      return NextResponse.json(
        { error: `Invalid entityType. Must be one of: ${validEntityTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Check if transaction exists
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId }
    });

    if (!transaction) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    // Check if link already exists
    const existingLink = await prisma.transactionLink.findFirst({
      where: {
        transactionId,
        entityType,
        entityId
      }
    });

    if (existingLink) {
      return NextResponse.json(
        { error: 'Transaction link already exists' },
        { status: 409 }
      );
    }

    // Validate entity exists based on type
    let entityExists = false;
    switch (entityType) {
      case 'loan':
        entityExists = await prisma.loanDetails.findUnique({ where: { id: entityId } }) !== null;
        break;
      case 'subscription':
        // Add subscription validation when subscription system is implemented
        entityExists = true; // Placeholder
        break;
      case 'bill':
        // Add bill validation when bill system is implemented
        entityExists = true; // Placeholder
        break;
      case 'recurring_expense':
        entityExists = await prisma.recurringExpense.findUnique({ where: { id: entityId } }) !== null;
        break;
      default:
        entityExists = true; // Allow other types for flexibility
    }

    if (!entityExists) {
      return NextResponse.json(
        { error: `${entityType} entity not found` },
        { status: 404 }
      );
    }

    // Create the transaction link
    const link = await prisma.transactionLink.create({
      data: {
        transactionId,
        entityType,
        entityId,
        metadata: metadata ? JSON.stringify(metadata) : JSON.stringify({}),
      },
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
                  select: {
                    institutionName: true
                  }
                }
              }
            }
          }
        }
      }
    });

    // Process the response
    const processedLink = {
      ...link,
      metadata: link.metadata ? JSON.parse(link.metadata as string) : undefined
    };

    return NextResponse.json({
      data: processedLink,
      message: 'Transaction link created successfully'
    });

  } catch (error) {
    console.error('Error creating transaction link:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create transaction link' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/transactions/links
 * Delete a transaction link
 */
export async function DELETE(request: NextRequest) {
  try {
    const userExists = await ensureDefaultUser();
    if (!userExists) {
      return NextResponse.json({ error: 'System not properly initialized' }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    
    // Parse query parameters
    const entityType = searchParams.get('entityType') as EntityType | null;
    const entityId = searchParams.get('entityId');
    const transactionId = searchParams.get('transactionId');

    // Validate required fields
    if (!entityType || !entityId || !transactionId) {
      return NextResponse.json(
        { error: 'entityType, entityId, and transactionId are required' },
        { status: 400 }
      );
    }

    // Validate entity type
    const validEntityTypes: EntityType[] = ['loan', 'subscription', 'bill', 'recurring_expense', 'investment', 'other'];
    if (!validEntityTypes.includes(entityType)) {
      return NextResponse.json(
        { error: `Invalid entityType. Must be one of: ${validEntityTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Find and delete the transaction link
    const deletedLink = await prisma.transactionLink.deleteMany({
      where: {
        transactionId,
        entityType,
        entityId
      }
    });

    if (deletedLink.count === 0) {
      return NextResponse.json(
        { error: 'Transaction link not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ 
      message: 'Transaction link deleted successfully',
      deletedCount: deletedLink.count
    });

  } catch (error) {
    console.error('Error deleting transaction link:', error);
    return NextResponse.json(
      { error: 'Failed to delete transaction link' },
      { status: 500 }
    );
  }
} 