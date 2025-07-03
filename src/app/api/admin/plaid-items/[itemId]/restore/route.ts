import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(
  request: Request,
  { params }: { params: { itemId: string } }
) {
  try {
    const { itemId } = params;

    // Update the PlaidItem status to active
    const updatedItem = await prisma.plaidItem.update({
      where: { id: itemId },
      data: { status: 'active' },
      include: { accounts: true },
    });

    return NextResponse.json({
      success: true,
      message: `Restored PlaidItem for ${updatedItem.institutionName || updatedItem.institutionId}`,
      item: updatedItem,
    });
  } catch (error) {
    console.error("Error restoring PlaidItem:", error || "Unknown error");
    return NextResponse.json(
      { error: "Failed to restore PlaidItem" },
      { status: 500 }
    );
  }
} 