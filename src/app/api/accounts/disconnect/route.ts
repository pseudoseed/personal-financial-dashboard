import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { plaidClient } from "@/lib/plaid";

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
    // Find all PlaidItems for this institution
    const plaidItems = await prisma.plaidItem.findMany({ where: { institutionId } });
    let removedCount = 0;
    for (const item of plaidItems) {
      try {
        // Call Plaid /item/remove
        await plaidClient.itemRemove({ access_token: item.accessToken });
        // Mark as disconnected
        await prisma.plaidItem.update({
          where: { id: item.id },
          data: { status: 'disconnected' },
        });
        removedCount++;
      } catch (err) {
        console.error(`[DISCONNECT] Failed to remove Plaid item ${item.id}:`, err);
      }
    }
    if (removedCount === 0) {
      return NextResponse.json(
        { error: "Institution not found or already disconnected" },
        { status: 404 }
      );
    }
    return NextResponse.json({ 
      success: true, 
      message: `Disconnected institution and marked ${removedCount} item(s) as disconnected` 
    });
  } catch (error) {
    console.error("Error disconnecting account:", error);
    return NextResponse.json(
      { error: "Failed to disconnect account" },
      { status: 500 }
    );
  }
}
