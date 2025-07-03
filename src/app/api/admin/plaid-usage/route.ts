import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    // Fetch counts
    const activeCount = await prisma.plaidItem.count({ 
      where: { status: 'active' } 
    });
    
    const disconnectedCount = await prisma.plaidItem.count({ 
      where: { status: 'disconnected' } 
    });

    // Fetch disconnected items with accounts
    const disconnectedItems = await prisma.plaidItem.findMany({
      where: { status: 'disconnected' },
      include: { accounts: true },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json({
      activeCount,
      disconnectedCount,
      disconnectedItems: disconnectedItems.map(item => ({
        id: item.id,
        institutionName: item.institutionName,
        institutionId: item.institutionId,
        accounts: item.accounts,
        updatedAt: item.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Error fetching admin data:", error || "Unknown error");
    return NextResponse.json(
      { error: "Failed to fetch admin data" },
      { status: 500 }
    );
  }
} 