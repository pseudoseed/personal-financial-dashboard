import { prisma } from './db';
import { Account } from '@prisma/client';

export type SnapshotType = 'all' | 'daily' | 'weekly' | 'monthly';

export interface InvestmentPerformanceData {
  snapshotType: SnapshotType;
  portfolioValue: number;
  changePercent: number;
  changeAmount: number;
  assetAllocation: AssetAllocation[];
  historicalData: HistoricalDataPoint[];
  topPerformers: TopPerformer[];
}

export interface AssetAllocation {
  category: string;
  value: number;
  percentage: number;
}

export interface HistoricalDataPoint {
  date: string;
  value: number;
}

export interface TopPerformer {
  accountName: string;
  changePercent: number;
  value: number;
}

export async function calculateInvestmentPerformance(snapshotType: SnapshotType = 'weekly'): Promise<InvestmentPerformanceData> {
  const userId = 'default';
  // Get investment accounts
  const accounts = await prisma.account.findMany({
    where: { 
      userId, 
      hidden: false,
      type: { in: ['investment', 'brokerage', '401k', 'ira'] }
    },
    include: {
      balances: {
        orderBy: { date: 'desc' },
        take: 100, // Get more data for historical analysis
      },
    },
  });

  // Calculate current portfolio value
  const currentValue = accounts.reduce((total, account) => {
    const balance = account.balances[0]?.current || 0;
    return total + balance;
  }, 0);

  // Calculate historical data based on snapshot type
  let historicalData: HistoricalDataPoint[];
  if (snapshotType === 'all') {
    // Return every balance update, sorted by timestamp
    // Flatten all balances, keep accountId for uniqueness, then sort
    const allBalances = accounts.flatMap(account =>
      account.balances.map(balance => ({
        date: balance.date.toISOString(),
        value: balance.current,
        accountId: account.id,
      }))
    );
    // Sort by date ascending
    allBalances.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    // Remove duplicates (same timestamp for same account)
    // For portfolio, sum all account balances at each unique timestamp
    const groupedByTimestamp: {[key: string]: number} = {};
    allBalances.forEach(({date, value}) => {
      groupedByTimestamp[date] = (groupedByTimestamp[date] || 0) + value;
    });
    historicalData = Object.entries(groupedByTimestamp).map(([date, value]) => ({ date, value }));
    // Sort by date ascending
    historicalData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  } else {
    historicalData = calculateHistoricalData(accounts, snapshotType);
  }
  
  // Calculate change metrics
  const previousValue = historicalData.length > 1 ? historicalData[historicalData.length - 2].value : currentValue;
  const changeAmount = currentValue - previousValue;
  const changePercent = previousValue > 0 ? (changeAmount / previousValue) * 100 : 0;

  // Calculate asset allocation
  const assetAllocation = calculateAssetAllocation(accounts);

  // Calculate top performers
  const topPerformers = calculateTopPerformers(accounts, historicalData);

  return {
    snapshotType,
    portfolioValue: currentValue,
    changePercent,
    changeAmount,
    assetAllocation,
    historicalData,
    topPerformers,
  };
}

function calculateHistoricalData(accounts: (Account & { balances: any[] })[], snapshotType: SnapshotType): HistoricalDataPoint[] {
  if (accounts.length === 0) return [];

  // Get all balance dates and sort them
  const allDates = new Set<string>();
  accounts.forEach(account => {
    account.balances.forEach(balance => {
      allDates.add(balance.date.toISOString().split('T')[0]);
    });
  });

  const sortedDates = Array.from(allDates).sort().reverse();
  
  // Group by snapshot type
  const groupedDates = groupDatesBySnapshotType(sortedDates, snapshotType);
  
  // Calculate portfolio value for each date
  return groupedDates.map(date => {
    const portfolioValue = accounts.reduce((total, account) => {
      const balance = account.balances.find(b => 
        b.date.toISOString().split('T')[0] <= date
      );
      return total + (balance?.current || 0);
    }, 0);

    return {
      date,
      value: portfolioValue,
    };
  }).filter(point => point.value > 0); // Only include points with data
}

function groupDatesBySnapshotType(dates: string[], snapshotType: SnapshotType): string[] {
  if (dates.length === 0) return [];

  const grouped: string[] = [];
  let currentDate = new Date(dates[0]);
  
  switch (snapshotType) {
    case 'daily':
      const dailyResult = dates.slice(0, 30); // Last 30 days
      return dailyResult;
      
    case 'weekly':
      // Group by week (Sunday to Saturday)
      for (let i = 0; i < 12; i++) { // Last 12 weeks
        const weekStart = new Date(currentDate);
        weekStart.setDate(currentDate.getDate() - (currentDate.getDay() + 7 * i));
        
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        
        // Find the latest date in this week
        const weekDate = dates.find(date => {
          const d = new Date(date);
          return d >= weekStart && d <= weekEnd;
        });
        
        if (weekDate) {
          grouped.push(weekDate);
        }
      }
      return grouped.reverse();
      
    case 'monthly':
      // Group by month
      for (let i = 0; i < 12; i++) { // Last 12 months
        const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
        const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() - i + 1, 0);
        
        // Find the latest date in this month
        const monthDate = dates.find(date => {
          const d = new Date(date);
          return d >= monthStart && d <= monthEnd;
        });
        
        if (monthDate) {
          grouped.push(monthDate);
        }
      }
      return grouped.reverse();
  }
}

function calculateAssetAllocation(accounts: (Account & { balances: any[] })[]): AssetAllocation[] {
  const totalValue = accounts.reduce((total, account) => {
    const balance = account.balances[0]?.current || 0;
    return total + balance;
  }, 0);

  if (totalValue === 0) return [];

  // Group by account type/subtype
  const allocationMap = new Map<string, number>();
  
  accounts.forEach(account => {
    const balance = account.balances[0]?.current || 0;
    const category = account.subtype || account.type;
    
    const currentValue = allocationMap.get(category) || 0;
    allocationMap.set(category, currentValue + balance);
  });

  return Array.from(allocationMap.entries())
    .map(([category, value]) => ({
      category: category.charAt(0).toUpperCase() + category.slice(1),
      value,
      percentage: (value / totalValue) * 100,
    }))
    .sort((a, b) => b.value - a.value);
}

function calculateTopPerformers(
  accounts: (Account & { balances: any[] })[],
  historicalData: HistoricalDataPoint[]
): TopPerformer[] {
  if (historicalData.length < 2) return [];

  const currentValue = historicalData[0].value;
  const previousValue = historicalData[1].value;
  
  return accounts
    .map(account => {
      const currentBalance = account.balances[0]?.current || 0;
      const previousBalance = account.balances[1]?.current || currentBalance;
      
      const changePercent = previousBalance > 0 
        ? ((currentBalance - previousBalance) / previousBalance) * 100 
        : 0;

      return {
        accountName: account.nickname || account.name,
        changePercent,
        value: currentBalance,
      };
    })
    .filter(performer => performer.value > 0)
    .sort((a, b) => b.changePercent - a.changePercent)
    .slice(0, 5); // Top 5 performers
} 