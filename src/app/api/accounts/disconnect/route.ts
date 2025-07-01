import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const { institutionId } = await request.json();

    console.log(`[DISCONNECT] Received institutionId: ${institutionId}`);
    const foundItems = await prisma.plaidItem.findMany({ where: { institutionId } });
    console.log(`[DISCONNECT] Found Plaid items:`, foundItems.map(i => ({ id: i.id, institutionId: i.institutionId, itemId: i.itemId })));

    if (!institutionId) {
      return NextResponse.json(
        { error: "Institution ID is required" },
        { status: 400 }
      );
    }

    // Handle manual accounts differently
    if (institutionId === "manual") {
      // Find and delete all manual PlaidItems (this will cascade delete all associated manual accounts)
      const deletedItems = await prisma.plaidItem.deleteMany({
        where: { 
          accessToken: "manual",
          institutionId: "manual"
        },
      });

      if (deletedItems.count === 0) {
        return NextResponse.json(
          { error: "No manual accounts found" },
          { status: 404 }
        );
      }

      return NextResponse.json({ 
        success: true, 
        message: `Deleted ${deletedItems.count} manual account(s)` 
      });
    }

    // Handle regular institutions
    // Find and delete the PlaidItem (this will cascade delete all associated accounts)
    const deletedItem = await prisma.plaidItem.deleteMany({
      where: { institutionId },
    });

    if (deletedItem.count === 0) {
      return NextResponse.json(
        { error: "Institution not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      message: `Disconnected institution and deleted ${deletedItem.count} account(s)` 
    });
  } catch (error) {
    console.error("Error disconnecting account:", error);
    return NextResponse.json(
      { error: "Failed to disconnect account" },
      { status: 500 }
    );
  }
}
