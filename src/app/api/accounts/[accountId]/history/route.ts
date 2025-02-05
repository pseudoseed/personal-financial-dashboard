import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  request: Request,
  { params }: { params: { accountId: string } }
) {
  try {
    const balances = await prisma.accountBalance.findMany({
      where: {
        accountId: params.accountId,
      },
      orderBy: {
        date: "asc",
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
