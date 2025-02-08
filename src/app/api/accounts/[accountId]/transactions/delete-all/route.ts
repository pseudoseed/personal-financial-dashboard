import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ accountId: string }> }
) {
  const { accountId } = await params;

  try {
    // Delete all transactions and logs in a transaction
    const result = await prisma.$transaction([
      // Delete all transactions
      prisma.transaction.deleteMany({
        where: { accountId },
      }),
      // Delete all download logs
      prisma.transactionDownloadLog.deleteMany({
        where: { accountId },
      }),
    ]);

    return NextResponse.json({
      message: `Deleted ${result[0].count} transactions and ${result[1].count} download logs`,
      transactionsDeleted: result[0].count,
      logsDeleted: result[1].count,
    });
  } catch (error) {
    console.error("Error deleting transactions:", error);
    return NextResponse.json(
      { error: "Failed to delete transactions" },
      { status: 500 }
    );
  }
}
