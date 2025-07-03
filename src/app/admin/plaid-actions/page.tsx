"use client";

import { useState, useEffect } from 'react';
import { AdminToolCard } from '@/components/admin/AdminToolCard';
import { AdminDataTable } from '@/components/admin/AdminDataTable';
import { AdminActionButton } from '@/components/admin/AdminActionButton';
import { AdminStatusBadge } from '@/components/admin/AdminStatusBadge';

interface PlaidItem {
  id: string;
  institutionName: string;
  institutionId: string;
  status: string;
  lastSync: string;
  accounts: Array<{ id: string; name: string; type: string }>;
}

interface PlaidActionResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

interface PlaidActionsData {
  items: PlaidItem[];
  recentActions: Array<{
    id: string;
    action: string;
    itemId: string;
    institutionName: string;
    success: boolean;
    timestamp: string;
    message: string;
  }>;
}

export default function PlaidActionsPage() {
  const [data, setData] = useState<PlaidActionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<string>('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionResult, setActionResult] = useState<PlaidActionResult | null>(null);

  const fetchData = async () => {
    try {
      const response = await fetch('/api/admin/plaid-actions');
      if (response.ok) {
        const plaidData = await response.json();
        setData(plaidData);
      }
    } catch (error) {
      console.error('Error fetching Plaid actions data:', error);
    } finally {
      setLoading(false);
    }
  };

  const performAction = async (action: string) => {
    if (!selectedItem) {
      alert('Please select a Plaid item first');
      return;
    }

    setActionLoading(true);
    setActionResult(null);

    try {
      const response = await fetch('/api/admin/plaid-actions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          itemId: selectedItem,
        }),
      });

      const result = await response.json();
      setActionResult(result);

      if (result.success) {
        // Refresh data after successful action
        await fetchData();
      }
    } catch (error) {
      setActionResult({
        success: false,
        message: 'Failed to perform action',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto py-8 px-4">
        <div className="text-center">Loading Plaid actions...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-7xl mx-auto py-8 px-4">
        <div className="text-center text-red-600">Failed to load Plaid actions data</div>
      </div>
    );
  }

  const itemColumns = [
    { key: 'institutionName', label: 'Institution', sortable: true },
    { key: 'status', label: 'Status', sortable: true, render: (value: string) => <AdminStatusBadge status={value as any} /> },
    { key: 'lastSync', label: 'Last Sync', sortable: true, render: (value: string) => new Date(value).toLocaleString() },
    { key: 'accounts', label: 'Accounts', sortable: false, render: (value: any[]) => `${value.length} accounts` },
  ];

  const actionColumns = [
    { key: 'action', label: 'Action', sortable: true },
    { key: 'institutionName', label: 'Institution', sortable: true },
    { key: 'success', label: 'Status', sortable: true, render: (value: boolean) => <AdminStatusBadge status={value ? 'success' : 'error'} text={value ? 'Success' : 'Failed'} /> },
    { key: 'timestamp', label: 'Timestamp', sortable: true, render: (value: string) => new Date(value).toLocaleString() },
    { key: 'message', label: 'Message', sortable: false },
  ];

  const selectedItemData = data.items.find(item => item.id === selectedItem);

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Manual Plaid Actions</h1>
        <AdminActionButton onClick={fetchData} loading={loading}>
          Refresh Data
        </AdminActionButton>
      </div>

      {/* Plaid Items Selection */}
      <AdminToolCard
        title="Select Plaid Item"
        description="Choose a Plaid item to perform actions on"
        status="info"
      >
        <div className="space-y-4">
          <select
            value={selectedItem}
            onChange={(e) => setSelectedItem(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="">Select a Plaid item...</option>
            {data.items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.institutionName} ({item.status})
              </option>
            ))}
          </select>

          {selectedItemData && (
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <h4 className="font-semibold mb-2">Selected Item Details:</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Institution:</span> {selectedItemData.institutionName}
                </div>
                <div>
                  <span className="font-medium">Status:</span> <AdminStatusBadge status={selectedItemData.status as any} size="sm" />
                </div>
                <div>
                  <span className="font-medium">Last Sync:</span> {new Date(selectedItemData.lastSync).toLocaleString()}
                </div>
                <div>
                  <span className="font-medium">Accounts:</span> {selectedItemData.accounts.length}
                </div>
              </div>
            </div>
          )}
        </div>
      </AdminToolCard>

      {/* Available Actions */}
      <AdminToolCard
        title="Available Actions"
        description="Manual Plaid API operations for troubleshooting"
        status="info"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
            <h4 className="font-semibold mb-2">Test Item Status</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Check if the Plaid item is still valid and accessible
            </p>
            <AdminActionButton
              onClick={() => performAction('test-status')}
              loading={actionLoading}
              disabled={!selectedItem}
              size="sm"
            >
              Test Status
            </AdminActionButton>
          </div>

          <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
            <h4 className="font-semibold mb-2">Refresh Token</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Force refresh the access token for this item
            </p>
            <AdminActionButton
              onClick={() => performAction('refresh-token')}
              loading={actionLoading}
              disabled={!selectedItem}
              variant="warning"
              size="sm"
            >
              Refresh Token
            </AdminActionButton>
          </div>

          <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
            <h4 className="font-semibold mb-2">Sync Accounts</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Manually sync account information from Plaid
            </p>
            <AdminActionButton
              onClick={() => performAction('sync-accounts')}
              loading={actionLoading}
              disabled={!selectedItem}
              variant="success"
              size="sm"
            >
              Sync Accounts
            </AdminActionButton>
          </div>

          <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
            <h4 className="font-semibold mb-2">Sync Balances</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Manually sync balance information for all accounts
            </p>
            <AdminActionButton
              onClick={() => performAction('sync-balances')}
              loading={actionLoading}
              disabled={!selectedItem}
              variant="success"
              size="sm"
            >
              Sync Balances
            </AdminActionButton>
          </div>

          <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
            <h4 className="font-semibold mb-2">Sync Transactions</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Manually sync recent transactions for all accounts
            </p>
            <AdminActionButton
              onClick={() => performAction('sync-transactions')}
              loading={actionLoading}
              disabled={!selectedItem}
              variant="success"
              size="sm"
            >
              Sync Transactions
            </AdminActionButton>
          </div>

          <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
            <h4 className="font-semibold mb-2">Disconnect Item</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Disconnect this Plaid item (revokes access token)
            </p>
            <AdminActionButton
              onClick={() => performAction('disconnect')}
              loading={actionLoading}
              disabled={!selectedItem}
              variant="danger"
              size="sm"
            >
              Disconnect
            </AdminActionButton>
          </div>
        </div>
      </AdminToolCard>

      {/* Action Result */}
      {actionResult && (
        <AdminToolCard
          title="Action Result"
          description="Result of the last performed action"
          status={actionResult.success ? "active" : "error"}
        >
          <div className={`p-4 rounded-lg ${
            actionResult.success 
              ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700' 
              : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700'
          }`}>
            <h4 className={`font-semibold mb-2 ${
              actionResult.success 
                ? 'text-green-800 dark:text-green-200' 
                : 'text-red-800 dark:text-red-200'
            }`}>
              {actionResult.success ? 'Success' : 'Error'}
            </h4>
            <p className={`text-sm ${
              actionResult.success 
                ? 'text-green-700 dark:text-green-300' 
                : 'text-red-700 dark:text-red-300'
            }`}>
              {actionResult.message}
            </p>
            {actionResult.error && (
              <p className="text-sm text-red-600 dark:text-red-400 mt-2">
                Error: {actionResult.error}
              </p>
            )}
            {actionResult.data && (
              <pre className="mt-2 text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-auto">
                {JSON.stringify(actionResult.data, null, 2)}
              </pre>
            )}
          </div>
        </AdminToolCard>
      )}

      {/* All Plaid Items */}
      <AdminToolCard
        title="All Plaid Items"
        description="Overview of all Plaid items in the system"
        status="info"
      >
        <AdminDataTable
          columns={itemColumns}
          data={data.items}
          itemsPerPage={10}
        />
      </AdminToolCard>

      {/* Recent Actions */}
      <AdminToolCard
        title="Recent Actions"
        description="History of recent manual Plaid actions"
        status="info"
      >
        <AdminDataTable
          columns={actionColumns}
          data={data.recentActions}
          itemsPerPage={10}
        />
      </AdminToolCard>

      {/* Information */}
      <AdminToolCard
        title="About Manual Plaid Actions"
        description="Understanding and using manual Plaid operations"
        status="info"
      >
        <div className="space-y-3">
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
            <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-1">When to use manual actions</h4>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              Manual Plaid actions are useful for troubleshooting connection issues, 
              testing API functionality, or performing maintenance tasks.
            </p>
          </div>
          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg">
            <h4 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-1">Token Management</h4>
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              Access tokens can expire or become invalid. Use the refresh token action 
              to update tokens and maintain connections.
            </p>
          </div>
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
            <h4 className="font-semibold text-red-800 dark:text-red-200 mb-1">⚠️ Warning</h4>
            <p className="text-sm text-red-700 dark:text-red-300">
              Manual actions can affect API usage and costs. Use with caution and 
              monitor your Plaid dashboard for usage patterns.
            </p>
          </div>
        </div>
      </AdminToolCard>
    </div>
  );
} 