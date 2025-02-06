import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  request: Request,
  context: { params: { accountId: string } }
) {
  try {
    // Ensure params are properly awaited
    const { accountId } = await Promise.resolve(context.params);

    const balances = await prisma.accountBalance.findMany({
      where: {
        accountId,
      },
      orderBy: {
        date: "desc",
      },
      include: {
        account: {
          select: {
            name: true,
            type: true,
            subtype: true,
          },
        },
      },
    });

    return NextResponse.json(balances);
  } catch (error) {
    console.error("Error fetching account history:", error);
    return NextResponse.json(
      { error: "Failed to fetch account history" },
      { status: 500 }
    );
  }
}
