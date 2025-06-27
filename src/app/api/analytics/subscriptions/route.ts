import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { detectRecurringExpenses } from "@/lib/recurringExpenseDetection";
import { getCurrentUserId } from "@/lib/userManagement";

// GET: Fetch existing subscriptions and detect new ones
export async function GET() {
  try {
    const userId = await getCurrentUserId();
    
    // Get existing confirmed subscriptions (recurring expenses)
    const existingSubscriptions = await prisma.recurringExpense.findMany({
      where: { 
        userId,
        isConfirmed: true,
        isActive: true
      },
      orderBy: { amount: 'desc' },
      include: {
        transactions: {
          include: {
            transaction: {
              select: {
                date: true,
                amount: true,
                merchantName: true
              }
            }
          },
          orderBy: {
            transaction: {
              date: 'desc'
            }
          },
          take: 1
        }
      }
    });

    // Detect new potential subscriptions
    const detectedExpenses = await detectRecurringExpenses(userId);
    
    // Filter detected expenses to only show subscription-like patterns
    const suggestedSubscriptions = detectedExpenses.filter(expense => {
      // Filter for subscription-like merchants and patterns
      const merchantName = expense.merchantName.toLowerCase();
      const isSubscriptionLike = 
        // Streaming services
        merchantName.includes('netflix') || 
        merchantName.includes('spotify') || 
        merchantName.includes('hulu') || 
        merchantName.includes('disney') ||
        merchantName.includes('amazon prime') ||
        merchantName.includes('youtube') ||
        merchantName.includes('apple') ||
        merchantName.includes('google') ||
        merchantName.includes('microsoft') ||
        merchantName.includes('adobe') ||
        merchantName.includes('dropbox') ||
        merchantName.includes('zoom') ||
        merchantName.includes('slack') ||
        merchantName.includes('github') ||
        merchantName.includes('figma') ||
        merchantName.includes('notion') ||
        merchantName.includes('canva') ||
        // Membership services
        merchantName.includes('costco') ||
        merchantName.includes('sams club') ||
        merchantName.includes('gym') ||
        merchantName.includes('fitness') ||
        merchantName.includes('planet fitness') ||
        merchantName.includes('la fitness') ||
        // Software and services
        merchantName.includes('subscription') ||
        merchantName.includes('monthly') ||
        merchantName.includes('recurring') ||
        // High confidence patterns that look like subscriptions
        (expense.confidence >= 80 && expense.frequency === 'monthly');

      return isSubscriptionLike;
    });

    // Calculate summary statistics
    const totalMonthlyCost = existingSubscriptions
      .filter(sub => sub.frequency === 'monthly')
      .reduce((sum, sub) => sum + sub.amount, 0);

    const totalYearlyCost = existingSubscriptions
      .filter(sub => sub.frequency === 'yearly')
      .reduce((sum, sub) => sum + sub.amount, 0);

    const totalWeeklyCost = existingSubscriptions
      .filter(sub => sub.frequency === 'weekly')
      .reduce((sum, sub) => sum + sub.amount, 0);

    const totalQuarterlyCost = existingSubscriptions
      .filter(sub => sub.frequency === 'quarterly')
      .reduce((sum, sub) => sum + sub.amount, 0);

    // Calculate annual equivalent for all subscriptions
    const annualEquivalent = 
      totalMonthlyCost * 12 + 
      totalYearlyCost + 
      totalWeeklyCost * 52 + 
      totalQuarterlyCost * 4;

    return NextResponse.json({
      existingSubscriptions,
      suggestedSubscriptions,
      summary: {
        totalSubscriptions: existingSubscriptions.length,
        totalMonthlyCost,
        totalYearlyCost,
        totalWeeklyCost,
        totalQuarterlyCost,
        annualEquivalent,
        suggestedCount: suggestedSubscriptions.length
      }
    });
  } catch (error) {
    if (error && typeof error === 'object') {
      console.error('Error fetching subscriptions:', error);
    } else {
      console.error('Error fetching subscriptions:', String(error));
    }
    return NextResponse.json(
      { error: 'Failed to fetch subscriptions' },
      { status: 500 }
    );
  }
} 