import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Plaid API costs based on actual billing structure
// Most endpoints are free ($0.00), only specific features are billed
const PLAID_COSTS = {
  // Free endpoints (no charge)
  '/item/get': 0.00,
  '/item/remove': 0.00,
  '/link_token/create': 0.00,
  '/item/public_token/exchange': 0.00,
  '/item/access_token/invalidate': 0.00,
  '/item/access_token/update_version': 0.00,
  '/institutions/get_by_id': 0.00,
  '/accounts/get': 0.00,
  
  // Per-call billing
  '/accounts/balance/get': 0.10, // $0.10 per call
  
  // Per-account/month billing (calculated separately)
  '/transactions/sync': 0.00, // $0.30 per connected account/month (calculated in monthly billing)
  '/transactions/get': 0.00, // $0.30 per connected account/month (calculated in monthly billing)
  '/liabilities/get': 0.00, // $0.20 per connected account/month (calculated in monthly billing)
  '/investments/transactions/get': 0.00, // $0.35 per connected account/month (calculated in monthly billing)
  '/investments/holdings/get': 0.00, // $0.18 per connected account/month (calculated in monthly billing)
};

// Monthly billing rates per connected account
const MONTHLY_BILLING_RATES = {
  transactions: 0.30, // $0.30 per connected account/month
  liabilities: 0.20,  // $0.20 per connected account/month
  investments: 0.35,  // $0.35 per connected account/month (transactions)
  investmentHoldings: 0.18, // $0.18 per connected account/month (holdings)
};

export async function GET() {
  try {
    // Get Plaid API call logs
    const apiLogs = await prisma.plaidApiCallLog.findMany({
      orderBy: { timestamp: 'desc' },
      take: 1000, // Last 1000 calls for analysis
    });

    // Get Plaid items with proper filtering
    const allItems = await prisma.plaidItem.findMany({
      include: {
        accounts: {
          where: {
            archived: false, // Exclude archived accounts
          },
        },
      },
    });

    // Debug: Log status values to understand what we're working with
    console.log('[BILLING AUDIT] PlaidItem status breakdown:');
    const statusCounts = allItems.reduce((acc, item) => {
      const status = item.status || 'null/undefined';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    console.log('[BILLING AUDIT] Status counts:', statusCounts);

    // Filter items by status and count active vs disconnected
    // Consider items with null/undefined status as potentially disconnected
    const activeItems = allItems.filter(item => 
      item.status === 'active' || item.status === null || item.status === undefined
    ).length;
    const disconnectedItems = allItems.filter(item => item.status === 'disconnected').length;

    // Calculate daily usage for per-call billing
    const dailyUsage = new Map<string, { calls: number; cost: number; endpoints: Set<string> }>();
    
    apiLogs.forEach(log => {
      const date = log.timestamp.toISOString().split('T')[0];
      const cost = PLAID_COSTS[log.endpoint as keyof typeof PLAID_COSTS] || 0.00;
      
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

    // Calculate endpoint breakdown for per-call billing
    const endpointStats = new Map<string, { calls: number; cost: number }>();
    
    apiLogs.forEach(log => {
      const cost = PLAID_COSTS[log.endpoint as keyof typeof PLAID_COSTS] || 0.00;
      
      if (!endpointStats.has(log.endpoint)) {
        endpointStats.set(log.endpoint, { calls: 0, cost: 0 });
      }
      
      const stats = endpointStats.get(log.endpoint)!;
      stats.calls += 1;
      stats.cost += cost;
    });

    const totalCalls = apiLogs.length;
    const perCallCost = Array.from(endpointStats.values()).reduce((sum, stats) => sum + stats.cost, 0);

    const endpointBreakdown = Array.from(endpointStats.entries())
      .map(([endpoint, stats]) => ({
        endpoint,
        calls: stats.calls,
        cost: stats.cost,
        percentage: totalCalls > 0 ? (stats.calls / totalCalls) * 100 : 0,
      }))
      .sort((a, b) => b.calls - a.calls);

    // Calculate monthly billing based on active accounts
    const activeAccounts = allItems
      .filter(item => item.status === 'active' || item.status === null || item.status === undefined)
      .flatMap(item => item.accounts);

    const monthlyBillingBreakdown = {
      transactions: 0,
      liabilities: 0,
      investments: 0,
      investmentHoldings: 0,
    };

    // Count accounts by type for monthly billing
    activeAccounts.forEach(account => {
      // All Plaid accounts get Transactions billing
      monthlyBillingBreakdown.transactions += MONTHLY_BILLING_RATES.transactions;
      
      // Credit and loan accounts get Liabilities billing
      if (account.type === 'credit' || account.type === 'loan') {
        monthlyBillingBreakdown.liabilities += MONTHLY_BILLING_RATES.liabilities;
      }
      
      // Investment accounts get both Investments and Investment Holdings billing
      if (account.type === 'investment') {
        monthlyBillingBreakdown.investments += MONTHLY_BILLING_RATES.investments;
        monthlyBillingBreakdown.investmentHoldings += MONTHLY_BILLING_RATES.investmentHoldings;
      }
    });

    const totalMonthlyCost = Object.values(monthlyBillingBreakdown).reduce((sum, cost) => sum + cost, 0);
    const totalCost = perCallCost + totalMonthlyCost;

    // Get institution usage - include both active and disconnected items for transparency
    const itemsWithUsage = allItems.map(item => {
      // Count only non-archived accounts
      const activeAccountCount = item.accounts.length;
      const lastSync = item.updatedAt;
      
      // Calculate calls today for this institution
      const today = new Date().toISOString().split('T')[0];
      const callsToday = apiLogs.filter(log => 
        log.institutionId === item.institutionId && 
        log.timestamp.toISOString().split('T')[0] === today
      ).length;
      
      // Calculate cost today (per-call only, monthly billing is separate)
      const costToday = apiLogs
        .filter(log => 
          log.institutionId === item.institutionId && 
          log.timestamp.toISOString().split('T')[0] === today
        )
        .reduce((sum, log) => sum + (PLAID_COSTS[log.endpoint as keyof typeof PLAID_COSTS] || 0.00), 0);

      // Determine display status
      let displayStatus = item.status || 'unknown';
      if (displayStatus === 'unknown' || displayStatus === 'null/undefined') {
        displayStatus = 'active'; // Default to active for items without explicit status
      }

      return {
        id: item.id,
        institutionName: item.institutionName || item.institutionId,
        status: displayStatus,
        lastSync: lastSync.toISOString(),
        callsToday,
        costToday,
        accountCount: activeAccountCount,
      };
    });

    return NextResponse.json({
      summary: {
        totalCalls,
        totalCost,
        perCallCost,
        monthlyCost: totalMonthlyCost,
        activeItems,
        disconnectedItems,
        activeAccountCount: activeAccounts.length,
        lastUpdated: new Date().toISOString(),
      },
      monthlyBilling: {
        breakdown: monthlyBillingBreakdown,
        total: totalMonthlyCost,
        accountCount: activeAccounts.length,
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