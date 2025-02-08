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

    // Group records by day
    const recordsByDay: { [key: string]: typeof records } = {};
    records.forEach((record) => {
      const dayKey = format(record.date, "yyyy-MM-dd");
      if (!recordsByDay[dayKey]) {
        recordsByDay[dayKey] = [];
      }
      recordsByDay[dayKey].push(record);
    });

    // For each day with multiple records, keep only the most recent one
    const recordsToDelete = Object.values(recordsByDay)
      .filter((dayRecords) => dayRecords.length > 1)
      .flatMap((dayRecords) => dayRecords.slice(1))
      .map((record) => record.id);

    if (recordsToDelete.length === 0) {
      return NextResponse.json({
        message: "No duplicate daily records found",
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
      message: `Deleted ${result.count} duplicate daily records`,
      deletedCount: result.count,
    });
  } catch (error) {
    console.error("Error cleaning daily records:", error);
    return NextResponse.json(
      { error: "Failed to clean daily records" },
      { status: 500 }
    );
  }
}
