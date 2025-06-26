import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const recurringPayment = await prisma.recurringPayment.findUnique({
      where: { id: params.id },
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

    if (!recurringPayment) {
      return NextResponse.json(
        { error: "Recurring payment not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(recurringPayment);
  } catch (error) {
    console.error("Error fetching recurring payment:", error);
    return NextResponse.json(
      { error: "Failed to fetch recurring payment" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
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
      isActive,
      isConfirmed,
      confidence,
    } = body;

    const updateData: any = {};

    if (name !== undefined) updateData.name = name;
    if (amount !== undefined) updateData.amount = parseFloat(amount);
    if (frequency !== undefined) updateData.frequency = frequency;
    if (nextPaymentDate !== undefined) updateData.nextPaymentDate = new Date(nextPaymentDate);
    if (lastPaymentDate !== undefined) updateData.lastPaymentDate = lastPaymentDate ? new Date(lastPaymentDate) : null;
    if (dayOfWeek !== undefined) updateData.dayOfWeek = dayOfWeek !== null ? parseInt(dayOfWeek) : null;
    if (dayOfMonth !== undefined) updateData.dayOfMonth = dayOfMonth !== null ? parseInt(dayOfMonth) : null;
    if (paymentType !== undefined) updateData.paymentType = paymentType;
    if (targetAccountId !== undefined) updateData.targetAccountId = targetAccountId || null;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (isConfirmed !== undefined) updateData.isConfirmed = isConfirmed;
    if (confidence !== undefined) updateData.confidence = parseInt(confidence);

    const recurringPayment = await prisma.recurringPayment.update({
      where: { id: params.id },
      data: updateData,
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
    console.error("Error updating recurring payment:", error);
    return NextResponse.json(
      { error: "Failed to update recurring payment" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.recurringPayment.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting recurring payment:", error);
    return NextResponse.json(
      { error: "Failed to delete recurring payment" },
      { status: 500 }
    );
  }
} 