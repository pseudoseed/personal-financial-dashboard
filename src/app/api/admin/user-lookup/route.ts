import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');

    // Get all users with their account information
    const users = await prisma.user.findMany({
      include: {
        accounts: {
          include: {
            balances: {
              orderBy: { date: 'desc' },
              take: 1,
            },
            transactions: {
              select: { id: true },
            },
          },
        },
      },
    });

    // Filter users based on search term
    let filteredUsers = users;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredUsers = users.filter(user => 
        user.email.toLowerCase().includes(searchLower) ||
        (user.name && user.name.toLowerCase().includes(searchLower)) ||
        user.accounts.some(account => 
          account.name.toLowerCase().includes(searchLower)
        )
      );
    }

    // Transform user data
    const transformedUsers = filteredUsers.map(user => {
      const totalBalance = user.accounts.reduce((sum, account) => {
        const latestBalance = account.balances[0];
        return sum + (latestBalance?.current || 0);
      }, 0);

      const lastActivity = user.accounts.reduce((latest, account) => {
        const accountLastSync = account.lastSyncTime;
        if (!latest || (accountLastSync && accountLastSync > latest)) {
          return accountLastSync;
        }
        return latest;
      }, null as Date | null);

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt.toISOString(),
        lastActivity: lastActivity?.toISOString() || user.createdAt.toISOString(),
        accountCount: user.accounts.length,
        totalBalance,
        status: 'active', // Placeholder
      };
    });

    return NextResponse.json({
      users: transformedUsers,
      selectedUserAccounts: [], // Will be populated when a user is selected
      searchResults: transformedUsers,
    });
  } catch (error) {
    console.error("Error fetching user lookup data:", error || "Unknown error");
    return NextResponse.json(
      { error: "Failed to fetch user lookup data" },
      { status: 500 }
    );
  }
} 