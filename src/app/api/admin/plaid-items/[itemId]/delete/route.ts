import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function DELETE(
  request: Request,
  { params }: { params: { itemId: string } }
) {
  try {
    const { itemId } = params;

    // Get the item details before deletion for the response
    const item = await prisma.plaidItem.findUnique({
      where: { id: itemId },
      include: { accounts: true },
    });

    if (!item) {
      return NextResponse.json(
        { error: "PlaidItem not found" },
        { status: 404 }
      );
    }

    // Delete the PlaidItem (this will cascade delete all associated accounts and data)
    await prisma.plaidItem.delete({
      where: { id: itemId },
    });

    return NextResponse.json({
      success: true,
      message: `Permanently deleted PlaidItem for ${item.institutionName || item.institutionId}`,
      deletedAccounts: item.accounts.length,
    });
  } catch (error) {
    console.error("Error deleting PlaidItem:", error || "Unknown error");
    return NextResponse.json(
      { error: "Failed to delete PlaidItem" },
      { status: 500 }
    );
  }
} 