import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  try {
    const { accountId } = await params;

    // Check if account exists
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      include: {
        plaidItem: true,
      },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 }
      );
    }

    // Archive the account by setting archived flag to true
    const archivedAccount = await prisma.account.update({
      where: { id: accountId },
      data: {
        archived: true,
      },
      include: {
        plaidItem: {
          select: {
            institutionName: true,
            institutionLogo: true,
            status: true,
          },
        },
      },
    });

    return NextResponse.json({
      message: "Account archived successfully",
      account: archivedAccount,
    });
  } catch (error) {
    console.error("Error archiving account:", error);
    return NextResponse.json(
      { error: "Failed to archive account" },
      { status: 500 }
    );
  }
} 