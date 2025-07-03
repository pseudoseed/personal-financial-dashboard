import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(
  request: Request,
  { params }: { params: { accountId: string; action: string } }
) {
  try {
    const { accountId, action } = params;

    if (!['hide', 'show'].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Must be 'hide' or 'show'" },
        { status: 400 }
      );
    }

    // Update account visibility
    await prisma.account.update({
      where: { id: accountId },
      data: {
        hidden: action === 'hide',
      },
    });

    return NextResponse.json({
      success: true,
      message: `Account ${action}d successfully`,
    });
  } catch (error) {
    console.error("Error performing account action:", error || "Unknown error");
    return NextResponse.json(
      { error: "Failed to perform account action" },
      { status: 500 }
    );
  }
} 