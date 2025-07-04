import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  try {
    const { accountId } = await params;

    // Check if account exists and get its details
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

    // Only allow restoration of manual accounts
    if (account.plaidItem?.accessToken !== "manual") {
      return NextResponse.json(
        { error: "Only manual accounts can be restored. Plaid accounts should be reconnected instead." },
        { status: 400 }
      );
    }

    // Check if account is actually archived
    if (!account.archived) {
      return NextResponse.json(
        { error: "Account is not archived" },
        { status: 400 }
      );
    }

    // Restore the account by setting archived flag to false
    const restoredAccount = await prisma.account.update({
      where: { id: accountId },
      data: {
        archived: false,
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
      message: "Account restored successfully",
      account: restoredAccount,
    });
  } catch (error) {
    console.error("Error restoring account:", error);
    return NextResponse.json(
      { error: "Failed to restore account" },
      { status: 500 }
    );
  }
} 