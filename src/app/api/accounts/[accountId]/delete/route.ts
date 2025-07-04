import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function DELETE(
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
        transactions: true,
        balances: true,
      },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 }
      );
    }

    // For manual accounts, we can permanently delete
    // For Plaid accounts, we archive them to preserve history for reconnection
    if (account.plaidItem?.accessToken === "manual") {
      // Permanently delete manual account and all its data
      await prisma.account.delete({
        where: { id: accountId },
      });

      return NextResponse.json({
        message: "Manual account permanently deleted",
      });
    } else {
      // Archive Plaid account to preserve history
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
        message: "Plaid account archived. History preserved for potential reconnection.",
        account: archivedAccount,
      });
    }
  } catch (error) {
    console.error("Error deleting account:", error);
    return NextResponse.json(
      { error: "Failed to delete account" },
      { status: 500 }
    );
  }
} 