import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserId } from '@/lib/userManagement';

// TODO: Replace with real user session logic
const getUserId = async (req: NextRequest) => {
  // Get the current user ID
  return await getCurrentUserId();
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

    // Only allow truly liquid depository accounts to be included in emergency fund
    const liquidSubtypes = ['checking', 'savings', 'money market', 'paypal', 'cash management', 'ebt', 'prepaid'];
    if (included && (account.type !== 'depository' || !account.subtype || !liquidSubtypes.includes(account.subtype.toLowerCase()))) {
      return NextResponse.json({ 
        error: 'Only truly liquid accounts can be included in emergency fund',
        details: `Account type '${account.type}' with subtype '${account.subtype}' is not eligible for emergency fund. Only checking, savings, money market, PayPal, cash management, EBT, and prepaid accounts are included.`
      }, { status: 400 });
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