import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// TODO: Replace with real user session logic
const getUserId = async (req: NextRequest) => {
  // For now, create or get default user
  const defaultUser = await prisma.user.upsert({
    where: { email: 'default@example.com' },
    update: {},
    create: {
      email: 'default@example.com',
      name: 'Default User',
    },
  });
  return defaultUser.id;
};

export async function GET(req: NextRequest, { params }: { params: Promise<{ accountId: string }> }) {
  try {
    const userId = await getUserId(req);
    const { accountId } = await params;

    // Verify the account exists
    const account = await prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    const efAccount = await prisma.emergencyFundAccount.findFirst({
      where: { userId, accountId },
    });

    return NextResponse.json({ included: !!efAccount });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : JSON.stringify(error);
    console.error('Error checking emergency fund status:', errMsg);
    return NextResponse.json({ error: 'Failed to check emergency fund status', details: errMsg }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ accountId: string }> }) {
  try {
    const userId = await getUserId(req);
    const { accountId } = await params;
    const { included } = await req.json();

    // Verify the account exists
    const account = await prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    if (included) {
      // Add to emergency fund (create if not exists)
      await prisma.emergencyFundAccount.create({
        data: { userId, accountId },
      }).catch(async (error: any) => {
        if (error.code === 'P2002') {
          // Unique constraint violation - record already exists
          return;
        }
        throw error;
      });
    } else {
      await prisma.emergencyFundAccount.deleteMany({
        where: { userId, accountId },
      });
    }

    return NextResponse.json({ success: true, included });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : JSON.stringify(error);
    console.error('Error toggling emergency fund:', errMsg);
    return NextResponse.json({ error: 'Failed to toggle emergency fund', details: errMsg }, { status: 500 });
  }
} 