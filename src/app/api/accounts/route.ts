import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const accounts = await prisma.account.findMany({
      include: {
        plaidItem: true,
        balances: {
          orderBy: {
            date: "desc",
          },
          take: 1,
        },
      },
    });

    const formattedAccounts = accounts.map((account) => ({
      id: account.id,
      name: account.name,
      type: account.type,
      subtype: account.subtype,
      mask: account.mask,
      institution: account.plaidItem.institutionId,
      balance: account.balances[0],
    }));

    return NextResponse.json(formattedAccounts);
  } catch (error) {
    console.error("Error fetching accounts:", error);
    return NextResponse.json(
      { error: "Failed to fetch accounts" },
      { status: 500 }
    );
  }
}
