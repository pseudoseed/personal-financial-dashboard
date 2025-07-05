"use client";

import { useState, useEffect } from 'react';
import { AdminToolCard } from '@/components/admin/AdminToolCard';
import { AdminDataTable } from '@/components/admin/AdminDataTable';
import { AdminActionButton } from '@/components/admin/AdminActionButton';
import { AdminStatusBadge } from '@/components/admin/AdminStatusBadge';
import { MetricCard } from '@/components/MetricCard';

interface BillingData {
  summary: {
    totalCalls: number;
    totalCost: number;
    perCallCost: number;
    monthlyCost: number;
    activeItems: number;
    disconnectedItems: number;
    activeAccountCount: number;
    lastUpdated: string;
  };
  monthlyBilling: {
    breakdown: {
      transactions: number;
      liabilities: number;
      investments: number;
      investmentHoldings: number;
    };
    total: number;
    accountCount: number;
  };
  dailyUsage: Array<{
    date: string;
    calls: number;
    cost: number;
    endpoints: string[];
  }>;
  endpointBreakdown: Array<{
    endpoint: string;
    calls: number;
    cost: number;
    percentage: number;
  }>;
  items: Array<{
    id: string;
    institutionName: string;
    status: string;
    lastSync: string;
    callsToday: number;
    costToday: number;
    accountCount: number;
  }>;
}

export default function BillingAuditPage() {
  const [data, setData] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const response = await fetch('/api/admin/billing-audit');
      if (response.ok) {
        const billingData = await response.json();
        setData(billingData);
      }
    } catch (error) {
      console.error('Error fetching billing data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto py-8 px-4">
        <div className="text-center">Loading billing audit data...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-7xl mx-auto py-8 px-4">
        <div className="text-center text-red-600">Failed to load billing audit data</div>
      </div>
    );
  }

  const summaryColumns = [
    { key: 'metric', label: 'Metric', sortable: false },
    { key: 'value', label: 'Value', sortable: false },
    { key: 'status', label: 'Status', sortable: false },
  ];

  const summaryData = [
    { metric: 'Total API Calls', value: data.summary.totalCalls.toLocaleString(), status: 'active' },
    { metric: 'Total Estimated Cost', value: `$${data.summary.totalCost.toFixed(2)}`, status: 'info' },
    { metric: 'Per-Call Cost', value: `$${data.summary.perCallCost.toFixed(2)}`, status: 'info' },
    { metric: 'Monthly Cost', value: `$${data.summary.monthlyCost.toFixed(2)}`, status: 'info' },
    { metric: 'Active Items', value: data.summary.activeItems.toString(), status: 'success' },
    { metric: 'Active Accounts', value: data.summary.activeAccountCount.toString(), status: 'success' },
    { metric: 'Disconnected Items', value: data.summary.disconnectedItems.toString(), status: 'warning' },
  ];

  const dailyUsageColumns = [
    { key: 'date', label: 'Date', sortable: true },
    { key: 'calls', label: 'API Calls', sortable: true },
    { key: 'cost', label: 'Cost', sortable: true, render: (value: number) => `$${value.toFixed(2)}` },
    { key: 'endpoints', label: 'Endpoints Used', sortable: false, render: (value: string[]) => value.join(', ') },
  ];

  const endpointColumns = [
    { key: 'endpoint', label: 'Endpoint', sortable: true },
    { key: 'calls', label: 'Calls', sortable: true },
    { key: 'cost', label: 'Cost', sortable: true, render: (value: number) => `$${value.toFixed(2)}` },
    { key: 'percentage', label: 'Percentage', sortable: true, render: (value: number) => `${value.toFixed(1)}%` },
  ];

  const monthlyBillingColumns = [
    { key: 'feature', label: 'Feature', sortable: true },
    { key: 'rate', label: 'Rate', sortable: true },
    { key: 'cost', label: 'Monthly Cost', sortable: true, render: (value: number) => `$${value.toFixed(2)}` },
    { key: 'description', label: 'Description', sortable: false },
  ];

  const monthlyBillingData = [
    { 
      feature: 'Transactions', 
      rate: '$0.30/account/month', 
      cost: data.monthlyBilling.breakdown.transactions,
      description: 'Transaction sync for all connected accounts'
    },
    { 
      feature: 'Liabilities', 
      rate: '$0.20/account/month', 
      cost: data.monthlyBilling.breakdown.liabilities,
      description: 'Credit card and loan account liability data'
    },
    { 
      feature: 'Investment Transactions', 
      rate: '$0.35/account/month', 
      cost: data.monthlyBilling.breakdown.investments,
      description: 'Investment transaction data'
    },
    { 
      feature: 'Investment Holdings', 
      rate: '$0.18/account/month', 
      cost: data.monthlyBilling.breakdown.investmentHoldings,
      description: 'Investment holdings and portfolio data'
    },
  ];

  const itemColumns = [
    { key: 'institutionName', label: 'Institution', sortable: true },
    { key: 'status', label: 'Status', sortable: true, render: (value: string) => <AdminStatusBadge status={value as any} /> },
    { key: 'accountCount', label: 'Accounts', sortable: true },
    { key: 'lastSync', label: 'Last Sync', sortable: true },
    { key: 'callsToday', label: 'Calls Today', sortable: true },
    { key: 'costToday', label: 'Cost Today', sortable: true, render: (value: number) => `$${value.toFixed(2)}` },
  ];

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Plaid Billing Audit</h1>
        <AdminActionButton onClick={handleRefresh} loading={refreshing}>
          Refresh Data
        </AdminActionButton>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <MetricCard
          title="Total API Calls"
          value={data.summary.totalCalls.toLocaleString()}
          color="text-purple-600 dark:text-purple-400"
        />
        <MetricCard
          title="Total Estimated Cost"
          value={`$${data.summary.totalCost.toFixed(2)}`}
          color="text-blue-600 dark:text-blue-400"
        />
        <MetricCard
          title="Per-Call Cost"
          value={`$${data.summary.perCallCost.toFixed(2)}`}
          color="text-green-600 dark:text-green-400"
        />
        <MetricCard
          title="Monthly Cost"
          value={`$${data.summary.monthlyCost.toFixed(2)}`}
          color="text-orange-600 dark:text-orange-400"
        />
        <MetricCard
          title="Active Items"
          value={data.summary.activeItems.toString()}
          color="text-success-600 dark:text-success-400"
        />
        <MetricCard
          title="Active Accounts"
          value={data.summary.activeAccountCount.toString()}
          color="text-indigo-600 dark:text-indigo-400"
        />
        <MetricCard
          title="Disconnected Items"
          value={data.summary.disconnectedItems.toString()}
          color="text-warning-600 dark:text-warning-400"
        />
      </div>

      {/* Monthly Billing Breakdown */}
      <AdminToolCard
        title="Monthly Billing Breakdown"
        description={`Monthly costs based on ${data.monthlyBilling.accountCount} active accounts`}
        status="info"
      >
        <AdminDataTable
          columns={monthlyBillingColumns}
          data={monthlyBillingData}
          itemsPerPage={10}
        />
      </AdminToolCard>

      {/* Daily Usage Chart */}
      <AdminToolCard
        title="Daily API Usage (Per-Call Billing)"
        description="API calls and per-call costs by day"
        status="info"
      >
        <AdminDataTable
          columns={dailyUsageColumns}
          data={data.dailyUsage}
          itemsPerPage={7}
        />
      </AdminToolCard>

      {/* Endpoint Breakdown */}
      <AdminToolCard
        title="Endpoint Breakdown (Per-Call Billing)"
        description="API usage by endpoint - only balance calls are charged"
        status="info"
      >
        <AdminDataTable
          columns={endpointColumns}
          data={data.endpointBreakdown}
          itemsPerPage={10}
        />
      </AdminToolCard>

      {/* Institution Usage */}
      <AdminToolCard
        title="Institution Usage"
        description="API usage by institution (per-call costs only)"
        status="info"
      >
        <AdminDataTable
          columns={itemColumns}
          data={data.items}
          itemsPerPage={10}
        />
      </AdminToolCard>

      {/* Cost Optimization Tips */}
      <AdminToolCard
        title="Cost Optimization Tips"
        description="Recommendations to reduce API costs"
        status="info"
      >
        <div className="space-y-3">
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
            <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-1">Smart Caching</h4>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              The system uses intelligent caching to reduce API calls. Balance data is cached for 4 hours, 
              and transaction data uses cursor-based incremental updates.
            </p>
          </div>
          <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg">
            <h4 className="font-semibold text-green-800 dark:text-green-200 mb-1">Token Management</h4>
            <p className="text-sm text-green-700 dark:text-green-300">
              Disconnected Plaid items are properly cleaned up to prevent orphaned API usage. 
              This reduces costs from unused connections.
            </p>
          </div>
          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg">
            <h4 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-1">Rate Limiting</h4>
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              Manual sync operations are rate-limited to 5 per day to prevent abuse and control costs.
            </p>
          </div>
          <div className="p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-lg">
            <h4 className="font-semibold text-purple-800 dark:text-purple-200 mb-1">Monthly Billing</h4>
            <p className="text-sm text-purple-700 dark:text-purple-300">
              Most costs are monthly per-account charges. Reducing the number of connected accounts 
              will directly reduce monthly costs.
            </p>
          </div>
        </div>
      </AdminToolCard>
    </div>
  );
} 