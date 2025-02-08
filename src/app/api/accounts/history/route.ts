import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { Account } from "@/types/account";

export async function GET() {
  try {
    // Get all accounts with their latest balance
    const accounts = await prisma.account.findMany({
      include: {
        plaidItem: {
          select: {
            institutionId: true,
            institutionName: true,
            institutionLogo: true,
          },
        },
        balances: {
          orderBy: {
            date: "asc",
          },
        },
      },
    });

    // Format accounts with their balances
    const formattedAccounts: Account[] = accounts
      .filter((account) => account.balances.length > 0)
      .map((account) => {
        // Group balances by month and take the latest for each month
        const monthlyBalances = account.balances.reduce((acc, balance) => {
          const monthKey = balance.date.toISOString().substring(0, 7); // YYYY-MM
          if (
            !acc[monthKey] ||
            new Date(balance.date) > new Date(acc[monthKey].date)
          ) {
            acc[monthKey] = {
              date: balance.date.toISOString(),
              current: balance.current,
              available: balance.available,
              limit: balance.limit,
            };
          }
          return acc;
        }, {} as Record<string, { date: string; current: number; available: number | null; limit: number | null }>);

        // Convert monthly balances back to array and sort by date
        const sortedBalances = Object.values(monthlyBalances).sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );

        return {
          id: account.id,
          name: account.name,
          nickname: account.nickname,
          type: account.type,
          subtype: account.subtype,
          mask: account.mask,
          hidden: account.hidden,
          institution:
            account.plaidItem.institutionName ||
            account.plaidItem.institutionId,
          institutionLogo: account.plaidItem.institutionLogo,
          balance: {
            current: sortedBalances[sortedBalances.length - 1]?.current || 0,
            available:
              sortedBalances[sortedBalances.length - 1]?.available || null,
            limit: sortedBalances[sortedBalances.length - 1]?.limit || null,
          },
          balances: sortedBalances,
          plaidItem: {
            institutionId: account.plaidItem.institutionId,
          },
        };
      });

    if (formattedAccounts.length === 0) {
      console.warn("No accounts with balances found");
    }

    console.log("Formatted accounts:", formattedAccounts.length);
    formattedAccounts.forEach((account) => {
      account.balances?.forEach((balance) => {
        console.log(`  ${balance.date}: ${balance.current}`);
      });
    });

    return NextResponse.json(formattedAccounts);
  } catch (error) {
    console.error("Error fetching account history:", error);
    return NextResponse.json(
      { error: "Failed to fetch account history" },
      { status: 500 }
    );
  }
}
