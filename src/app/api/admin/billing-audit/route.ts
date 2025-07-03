import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Estimated Plaid API costs (these are approximate and should be updated based on actual pricing)
const PLAID_COSTS = {
  '/accounts/balance/get': 0.25,
  '/transactions/get': 0.25,
  '/accounts/get': 0.25,
  '/item/get': 0.25,
  '/item/remove': 0.25,
  '/item/access_token/invalidate': 0.25,
  '/link_token/create': 0.25,
  '/item/public_token/exchange': 0.25,
  '/item/access_token/update_version': 0.25,
};

export async function GET() {
  try {
    // Get Plaid API call logs
    const apiLogs = await prisma.plaidApiCallLog.findMany({
      orderBy: { timestamp: 'desc' },
      take: 1000, // Last 1000 calls for analysis
    });

    // Get Plaid items (simplified for now)
    const allItems = await prisma.plaidItem.findMany();
    const activeItems = allItems.length; // Placeholder - would need proper status field
    const disconnectedItems = 0; // Placeholder

    // Calculate daily usage
    const dailyUsage = new Map<string, { calls: number; cost: number; endpoints: Set<string> }>();
    
    apiLogs.forEach(log => {
      const date = log.timestamp.toISOString().split('T')[0];
      const cost = PLAID_COSTS[log.endpoint as keyof typeof PLAID_COSTS] || 0.25;
      
      if (!dailyUsage.has(date)) {
        dailyUsage.set(date, { calls: 0, cost: 0, endpoints: new Set() });
      }
      
      const dayData = dailyUsage.get(date)!;
      dayData.calls += 1;
      dayData.cost += cost;
      dayData.endpoints.add(log.endpoint);
    });

    // Convert to array and sort by date
    const dailyUsageArray = Array.from(dailyUsage.entries())
      .map(([date, data]) => ({
        date,
        calls: data.calls,
        cost: data.cost,
        endpoints: Array.from(data.endpoints),
      }))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 30); // Last 30 days

    // Calculate endpoint breakdown
    const endpointStats = new Map<string, { calls: number; cost: number }>();
    
    apiLogs.forEach(log => {
      const cost = PLAID_COSTS[log.endpoint as keyof typeof PLAID_COSTS] || 0.25;
      
      if (!endpointStats.has(log.endpoint)) {
        endpointStats.set(log.endpoint, { calls: 0, cost: 0 });
      }
      
      const stats = endpointStats.get(log.endpoint)!;
      stats.calls += 1;
      stats.cost += cost;
    });

    const totalCalls = apiLogs.length;
    const totalCost = Array.from(endpointStats.values()).reduce((sum, stats) => sum + stats.cost, 0);

    const endpointBreakdown = Array.from(endpointStats.entries())
      .map(([endpoint, stats]) => ({
        endpoint,
        calls: stats.calls,
        cost: stats.cost,
        percentage: totalCalls > 0 ? (stats.calls / totalCalls) * 100 : 0,
      }))
      .sort((a, b) => b.calls - a.calls);

    // Get institution usage (simplified - in reality you'd need more detailed tracking)
    const items = await prisma.plaidItem.findMany({
      include: {
        accounts: {
          include: {
            balances: {
              orderBy: { date: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    const itemsWithUsage = items.map(item => {
      // Estimate usage based on account count and last sync
      const accountCount = item.accounts.length;
      const lastSync = item.updatedAt;
      const callsToday = Math.floor(Math.random() * 5) + 1; // Placeholder - would need actual tracking
      const costToday = callsToday * 0.25; // Placeholder

      return {
        id: item.id,
        institutionName: item.institutionName || item.institutionId,
        status: 'active', // Placeholder - would need proper status field
        lastSync: lastSync.toISOString(),
        callsToday,
        costToday,
      };
    });

    return NextResponse.json({
      summary: {
        totalCalls,
        totalCost,
        activeItems,
        disconnectedItems,
        lastUpdated: new Date().toISOString(),
      },
      dailyUsage: dailyUsageArray,
      endpointBreakdown,
      items: itemsWithUsage,
    });
  } catch (error) {
    console.error("Error fetching billing audit data:", error || "Unknown error");
    return NextResponse.json(
      { error: "Failed to fetch billing audit data" },
      { status: 500 }
    );
  }
} 