import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from '@/lib/userManagement';

export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    
    const recurringPayments = await prisma.recurringPayment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(recurringPayments);
  } catch (error) {
    console.error("Error fetching recurring payments:", error);
    return NextResponse.json(
      { error: "Failed to fetch recurring payments" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    const body = await request.json();
    const {
      name,
      amount,
      frequency,
      nextPaymentDate,
      lastPaymentDate,
      dayOfWeek,
      dayOfMonth,
      paymentType,
      targetAccountId,
      isActive = true,
      isConfirmed = false,
      confidence = 100,
    } = body;

    // Validate required fields
    if (!name || !amount || !frequency || !nextPaymentDate || !paymentType) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate frequency-specific fields
    if ((frequency === 'weekly' || frequency === 'bi-weekly') && dayOfWeek === undefined) {
      return NextResponse.json(
        { error: "dayOfWeek is required for weekly and bi-weekly payments" },
        { status: 400 }
      );
    }

    if (frequency === 'monthly' && dayOfMonth === undefined) {
      return NextResponse.json(
        { error: "dayOfMonth is required for monthly payments" },
        { status: 400 }
      );
    }

    const recurringPayment = await prisma.recurringPayment.create({
      data: {
        userId,
        name,
        amount: parseFloat(amount),
        frequency,
        nextPaymentDate: new Date(nextPaymentDate),
        lastPaymentDate: lastPaymentDate ? new Date(lastPaymentDate) : null,
        dayOfWeek: dayOfWeek !== undefined ? parseInt(dayOfWeek) : null,
        dayOfMonth: dayOfMonth !== undefined ? parseInt(dayOfMonth) : null,
        paymentType,
        targetAccountId: targetAccountId || null,
        isActive,
        isConfirmed,
        confidence: parseInt(confidence),
      },
      include: {
        targetAccount: {
          select: {
            id: true,
            name: true,
            nickname: true,
          },
        },
      },
    });

    return NextResponse.json(recurringPayment);
  } catch (error) {
    console.error("Error creating recurring payment:", error);
    return NextResponse.json(
      { error: "Failed to create recurring payment" },
      { status: 500 }
    );
  }
} 