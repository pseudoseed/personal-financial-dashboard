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

    // Find all unique months across all accounts
    const allMonths = new Set<string>();
    accounts.forEach((account) => {
      account.balances.forEach((balance) => {
        const monthKey = balance.date.toISOString().substring(0, 7); // YYYY-MM
        allMonths.add(monthKey);
      });
    });

    // Sort months chronologically
    const sortedMonths = Array.from(allMonths).sort();

    // Format accounts with their balances
    const formattedAccounts: Account[] = accounts
      .filter((account) => account.balances.length > 0)
      .map((account) => {
        // First, group balances by month and take the latest for each month
        const accountMonthlyBalances = account.balances.reduce(
          (acc, balance) => {
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
          },
          {} as Record<
            string,
            {
              date: string;
              current: number;
              available: number | null;
              limit: number | null;
            }
          >
        );

        // Fill in missing months with the most recent previous balance
        const filledBalances: Record<
          string,
          {
            date: string;
            current: number;
            available: number | null;
            limit: number | null;
          }
        > = {};

        let lastBalance: {
          date: string;
          current: number;
          available: number | null;
          limit: number | null;
        } | null = null;

        // Get the date of the first balance for this account
        const firstBalanceDate =
          account.balances.length > 0
            ? new Date(account.balances[0].date)
            : new Date();

        // Only include months that are on or after the account's first balance date
        sortedMonths.forEach((month) => {
          const monthDate = new Date(`${month}-01T00:00:00Z`);

          // Skip months before the account's first balance
          if (monthDate < firstBalanceDate) {
            return;
          }

          if (accountMonthlyBalances[month]) {
            // We have a real balance for this month
            lastBalance = accountMonthlyBalances[month];
            filledBalances[month] = lastBalance;
          } else if (lastBalance) {
            // Use the most recent previous balance with the current month's date
            filledBalances[month] = {
              ...lastBalance,
              date: new Date(`${month}-01T12:00:00Z`).toISOString(),
            };
          }
        });

        // Convert filled balances back to array and sort by date
        const sortedBalances = Object.values(filledBalances).sort(
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

    console.log(
      "Formatted accounts with filled balances:",
      formattedAccounts.length
    );

    // Log a sample of filled balances for verification
    if (formattedAccounts.length > 0) {
      const sampleAccount = formattedAccounts[0];
      console.log(
        `Sample account "${sampleAccount.name}" has ${sampleAccount.balances?.length} monthly balances`
      );
    }

    return NextResponse.json(formattedAccounts);
  } catch (error) {
    console.error("Error fetching account history:", error);
    return NextResponse.json(
      { error: "Failed to fetch account history" },
      { status: 500 }
    );
  }
}
