import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { prisma } from '@/lib/db';
import type { PlaidApiCallLog } from '@prisma/client';
import React from 'react';

// Force dynamic rendering to prevent build-time database access
export const dynamic = 'force-dynamic';

// Plaid pricing structure
const PLAID_PRICING = {
  balance: { perCall: 0.10 },
  transactions: { perAccountPerMonth: 0.30 },
  recurringTransactions: { perAccountPerMonth: 0.15 },
  investments: { 
    holdings: { perAccountPerMonth: 0.18 },
    transactions: { perAccountPerMonth: 0.35 }
  },
  liabilities: { perAccountPerMonth: 0.20 },
  enrich: { perThousandTransactions: 4.00 }
};

interface MonthlyUsage {
  month: string;
  balanceCalls: number;
  transactionCalls: number;
  liabilityCalls: number;
  totalCost: number;
  uniqueAccounts: number;
  forcedRefreshes: number;
}

interface ApiCallStats {
  totalCalls: number;
  totalCost: number;
  callsByType: Record<string, number>;
  errorRate: number;
}

export default async function PlaidUsagePage() {
  // Get date 6 months ago
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  // Fetch logs from last 6 months
  const logs: PlaidApiCallLog[] = await prisma.plaidApiCallLog.findMany({
    where: {
      timestamp: {
        gte: sixMonthsAgo
      }
    },
    orderBy: { timestamp: 'desc' },
  });

  // Calculate monthly usage
  const monthlyUsage: MonthlyUsage[] = [];
  const currentDate = new Date();
  
  for (let i = 5; i >= 0; i--) {
    const monthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
    const monthKey = monthDate.toISOString().slice(0, 7); // YYYY-MM format
    
    const monthLogs = logs.filter(log => 
      log.timestamp.toISOString().slice(0, 7) === monthKey
    );

    const balanceCalls = monthLogs.filter(log => log.endpoint === '/accounts/balance/get').length;
    const transactionCalls = monthLogs.filter(log => log.endpoint === '/transactions/sync').length;
    const liabilityCalls = monthLogs.filter(log => log.endpoint === '/liabilities/get').length;
    const forcedRefreshes = monthLogs.filter(log => log.endpoint === '/liabilities/get' && log.errorMessage?.includes('force')).length;
    
    // Get unique accounts for this month
    const uniqueAccounts = new Set(
      monthLogs
        .filter(log => log.accountId)
        .map(log => log.accountId)
    ).size;

    // Calculate costs
    const balanceCost = balanceCalls * PLAID_PRICING.balance.perCall;
    const transactionCost = uniqueAccounts * PLAID_PRICING.transactions.perAccountPerMonth;
    const liabilityCost = uniqueAccounts * PLAID_PRICING.liabilities.perAccountPerMonth;
    const totalCost = balanceCost + transactionCost + liabilityCost;

    monthlyUsage.push({
      month: monthKey,
      balanceCalls,
      transactionCalls,
      liabilityCalls,
      totalCost,
      uniqueAccounts,
      forcedRefreshes
    });
  }

  // Calculate overall stats
  const totalCalls = logs.length;
  const balanceCalls = logs.filter(log => log.endpoint === '/accounts/balance/get').length;
  const transactionCalls = logs.filter(log => log.endpoint === '/transactions/sync').length;
  const liabilityCalls = logs.filter(log => log.endpoint === '/liabilities/get').length;
  const forcedRefreshes = logs.filter(log => log.endpoint === '/liabilities/get' && log.errorMessage?.includes('force')).length;
  const errorCalls = logs.filter(log => log.responseStatus >= 400).length;
  const errorRate = totalCalls > 0 ? (errorCalls / totalCalls) * 100 : 0;

  const callsByType = {
    'Balance': balanceCalls,
    'Transactions': transactionCalls,
    'Liabilities': liabilityCalls,
  };

  const totalCost = monthlyUsage.reduce((sum, month) => sum + month.totalCost, 0);

  return (
    <div className="max-w-7xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-8">Plaid API Usage & Cost Tracking</h1>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-600">Total API Calls</h3>
          <p className="text-3xl font-bold text-blue-600">{totalCalls.toLocaleString()}</p>
          <p className="text-sm text-gray-500">Last 6 months</p>
        </Card>
        
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-600">Total Cost</h3>
          <p className="text-3xl font-bold text-green-600">${totalCost.toFixed(2)}</p>
          <p className="text-sm text-gray-500">Last 6 months</p>
        </Card>
        
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-600">Error Rate</h3>
          <p className="text-3xl font-bold text-red-600">{errorRate.toFixed(1)}%</p>
          <p className="text-sm text-gray-500">{errorCalls} errors</p>
        </Card>
        
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-600">Avg Monthly Cost</h3>
          <p className="text-3xl font-bold text-purple-600">${(totalCost / 6).toFixed(2)}</p>
          <p className="text-sm text-gray-500">Per month</p>
        </Card>
      </div>

      {/* Monthly Usage Table */}
      <Card className="mb-8">
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-4">Monthly Usage Breakdown</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-4 py-2 text-left">Month</th>
                  <th className="px-4 py-2 text-left">Balance Calls</th>
                  <th className="px-4 py-2 text-left">Transaction Calls</th>
                  <th className="px-4 py-2 text-left">Unique Accounts</th>
                  <th className="px-4 py-2 text-left">Balance Cost</th>
                  <th className="px-4 py-2 text-left">Transaction Cost</th>
                  <th className="px-4 py-2 text-left">Total Cost</th>
                </tr>
              </thead>
              <tbody>
                {monthlyUsage.map((month) => (
                  <tr key={month.month} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{month.month}</td>
                    <td className="px-4 py-3">{month.balanceCalls.toLocaleString()}</td>
                    <td className="px-4 py-3">{month.transactionCalls.toLocaleString()}</td>
                    <td className="px-4 py-3">{month.uniqueAccounts}</td>
                    <td className="px-4 py-3">${(month.balanceCalls * PLAID_PRICING.balance.perCall).toFixed(2)}</td>
                    <td className="px-4 py-3">${(month.uniqueAccounts * PLAID_PRICING.transactions.perAccountPerMonth).toFixed(2)}</td>
                    <td className="px-4 py-3 font-semibold">${month.totalCost.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      {/* API Calls by Type Chart */}
      <Card className="mb-8">
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-4">API Calls by Type</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Object.entries(callsByType).map(([type, count]) => (
              <div key={type} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <span className="font-medium">{type}</span>
                <span className="text-2xl font-bold text-blue-600">{count.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Recent API Calls Table */}
      <Card>
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-4">Recent API Calls (Last 50)</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-4 py-2 text-left">Timestamp</th>
                  <th className="px-4 py-2 text-left">Endpoint</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-left">Institution</th>
                  <th className="px-4 py-2 text-left">Duration (ms)</th>
                  <th className="px-4 py-2 text-left">Error</th>
                </tr>
              </thead>
              <tbody>
                {logs.slice(0, 50).map((log) => (
                  <tr key={log.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-2 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-2">{log.endpoint}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-1 rounded text-xs ${
                        log.responseStatus >= 400 ? 'bg-red-100 text-red-800' : 
                        log.responseStatus >= 300 ? 'bg-yellow-100 text-yellow-800' : 
                        'bg-green-100 text-green-800'
                      }`}>
                        {log.responseStatus}
                      </span>
                    </td>
                    <td className="px-4 py-2">{log.institutionId || '-'}</td>
                    <td className="px-4 py-2">{log.durationMs ?? '-'}</td>
                    <td className="px-4 py-2 text-red-600 max-w-xs truncate">
                      {log.errorMessage || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Card>
    </div>
  );
} 