import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(
  request: Request,
  context: { params: { accountId: string } }
) {
  try {
    // Ensure params are properly awaited
    const { accountId } = await Promise.resolve(context.params);

    const account = await prisma.account.findUnique({
      where: { id: accountId },
      select: { hidden: true },
    });

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    const updatedAccount = await prisma.account.update({
      where: { id: accountId },
      data: { hidden: !account.hidden },
      select: {
        id: true,
        hidden: true,
      },
    });

    return NextResponse.json(updatedAccount);
  } catch (error) {
    console.error("Error toggling account visibility:", error);
    return NextResponse.json(
      { error: "Failed to toggle account visibility" },
      { status: 500 }
    );
  }
}
