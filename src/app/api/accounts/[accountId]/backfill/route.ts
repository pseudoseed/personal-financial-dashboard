import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { startOfMonth, eachMonthOfInterval, isSameMonth } from "date-fns";

export async function POST(
  request: Request,
  context: { params: { accountId: string } }
) {
  try {
    const { accountId } = await Promise.resolve(context.params);

    // Get the account's existing balances
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      include: {
        balances: {
          orderBy: {
            date: "asc",
          },
        },
      },
    });

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    if (account.balances.length === 0) {
      return NextResponse.json(
        { error: "No existing balances to backfill from" },
        { status: 400 }
      );
    }

    // Get the oldest balance amount to use for backfilling
    const oldestBalance = account.balances[0];
    const oldestAmount = oldestBalance.current;
    const oldestAvailable = oldestBalance.available;
    const oldestLimit = oldestBalance.limit;

    // Define the date range
    const startDate = new Date("2022-12-01");
    const endDate = new Date();

    // Get all months in the range
    const allMonths = eachMonthOfInterval({ start: startDate, end: endDate });

    // Create a set of existing balance months for efficient lookup
    const existingMonths = new Set(
      account.balances.map((balance) =>
        startOfMonth(new Date(balance.date)).toISOString()
      )
    );

    // Create missing monthly balances
    const createdBalances = [];
    for (const month of allMonths) {
      const monthStart = startOfMonth(month);

      // Skip if we already have a balance for this month
      if (existingMonths.has(monthStart.toISOString())) {
        continue;
      }

      // Create new balance record
      const newBalance = await prisma.accountBalance.create({
        data: {
          accountId,
          date: monthStart,
          current: oldestAmount,
          available: oldestAvailable,
          limit: oldestLimit,
        },
      });

      createdBalances.push(newBalance);
    }

    return NextResponse.json({
      success: true,
      created: createdBalances.length,
      message: `Created ${createdBalances.length} backfilled balance records`,
    });
  } catch (error) {
    console.error("Error backfilling account balances:", error);
    return NextResponse.json(
      { error: "Failed to backfill account balances" },
      { status: 500 }
    );
  }
}
