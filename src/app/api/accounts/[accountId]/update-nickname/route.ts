import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(
  request: Request,
  context: { params: { accountId: string } }
) {
  try {
    const { accountId } = await Promise.resolve(context.params);
    const { nickname } = await request.json();

    const account = await prisma.account.update({
      where: { id: accountId },
      data: { nickname },
      select: {
        id: true,
        nickname: true,
      },
    });

    return NextResponse.json(account);
  } catch (error) {
    console.error("Error updating account nickname:", error);
    return NextResponse.json(
      { error: "Failed to update account nickname" },
      { status: 500 }
    );
  }
}
