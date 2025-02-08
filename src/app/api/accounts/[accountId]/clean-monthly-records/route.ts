import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { format } from "date-fns";

export async function POST(
  request: Request,
  { params }: { params: { accountId: string } }
) {
  try {
    // Get all balance records for the account
    const records = await prisma.accountBalance.findMany({
      where: { accountId: params.accountId },
      orderBy: { date: "desc" },
    });

    // Group records by month
    const recordsByMonth: { [key: string]: typeof records } = {};
    records.forEach((record) => {
      const monthKey = format(record.date, "yyyy-MM");
      if (!recordsByMonth[monthKey]) {
        recordsByMonth[monthKey] = [];
      }
      recordsByMonth[monthKey].push(record);
    });

    // For each month with multiple records, keep only the most recent one
    const recordsToDelete = Object.values(recordsByMonth)
      .filter((monthRecords) => monthRecords.length > 1)
      .flatMap((monthRecords) => monthRecords.slice(1))
      .map((record) => record.id);

    if (recordsToDelete.length === 0) {
      return NextResponse.json({
        message: "No duplicate monthly records found",
        deletedCount: 0,
      });
    }

    // Delete the extra records
    const result = await prisma.accountBalance.deleteMany({
      where: {
        id: { in: recordsToDelete },
      },
    });

    return NextResponse.json({
      message: `Deleted ${result.count} duplicate monthly records`,
      deletedCount: result.count,
    });
  } catch (error) {
    console.error("Error cleaning monthly records:", error);
    return NextResponse.json(
      { error: "Failed to clean monthly records" },
      { status: 500 }
    );
  }
}
