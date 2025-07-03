"use client";

import { useState, useEffect } from 'react';
import { AdminToolCard } from '@/components/admin/AdminToolCard';
import { AdminDataTable } from '@/components/admin/AdminDataTable';
import { AdminActionButton } from '@/components/admin/AdminActionButton';
import { AdminStatusBadge } from '@/components/admin/AdminStatusBadge';
import { MetricCard } from '@/components/MetricCard';

interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  lastActivity: string;
  accountCount: number;
  totalBalance: number;
  status: string;
}

interface Account {
  id: string;
  name: string;
  nickname?: string;
  type: string;
  institution: string;
  currentBalance: number;
  lastSyncTime: string;
  status: string;
  transactionCount: number;
}

interface UserLookupData {
  users: User[];
  selectedUserAccounts: Account[];
  searchResults: User[];
}

export default function UserLookupPage() {
  const [data, setData] = useState<UserLookupData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [searching, setSearching] = useState(false);

  const fetchData = async () => {
    try {
      const response = await fetch('/api/admin/user-lookup');
      if (response.ok) {
        const userData = await response.json();
        setData(userData);
      }
    } catch (error) {
      console.error('Error fetching user lookup data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      setData(prev => prev ? { ...prev, searchResults: prev.users } : null);
      return;
    }

    setSearching(true);
    try {
      const response = await fetch(`/api/admin/user-lookup?search=${encodeURIComponent(searchTerm)}`);
      if (response.ok) {
        const searchData = await response.json();
        setData(prev => prev ? { ...prev, searchResults: searchData.users } : null);
      }
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setSearching(false);
    }
  };

  const handleUserSelect = async (userId: string) => {
    setSelectedUserId(userId);
    try {
      const response = await fetch(`/api/admin/user-lookup/${userId}/accounts`);
      if (response.ok) {
        const accountData = await response.json();
        setData(prev => prev ? { ...prev, selectedUserAccounts: accountData.accounts } : null);
      }
    } catch (error) {
      console.error('Error fetching user accounts:', error);
    }
  };

  const handleAccountAction = async (accountId: string, action: string) => {
    if (!confirm(`Are you sure you want to ${action} this account?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/user-lookup/accounts/${accountId}/${action}`, {
        method: 'POST',
      });

      if (response.ok) {
        alert(`Successfully ${action}ed account`);
        // Refresh user accounts
        if (selectedUserId) {
          await handleUserSelect(selectedUserId);
        }
      } else {
        const error = await response.json();
        alert(`Failed to ${action} account: ${error.error}`);
      }
    } catch (error) {
      alert(`Error ${action}ing account`);
      console.error('Account action error:', error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    // Auto-search when search term changes
    const timeoutId = setTimeout(() => {
      handleSearch();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto py-8 px-4">
        <div className="text-center">Loading user lookup data...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-7xl mx-auto py-8 px-4">
        <div className="text-center text-red-600">Failed to load user lookup data</div>
      </div>
    );
  }

  const userColumns = [
    { key: 'email', label: 'Email', sortable: true },
    { key: 'name', label: 'Name', sortable: true },
    { key: 'status', label: 'Status', sortable: true, render: (value: string) => <AdminStatusBadge status={value as any} /> },
    { key: 'accountCount', label: 'Accounts', sortable: true },
    { key: 'totalBalance', label: 'Total Balance', sortable: true, render: (value: number) => `$${value.toLocaleString()}` },
    { key: 'lastActivity', label: 'Last Activity', sortable: true, render: (value: string) => new Date(value).toLocaleDateString() },
    { key: 'createdAt', label: 'Created', sortable: true, render: (value: string) => new Date(value).toLocaleDateString() },
  ];

  const accountColumns = [
    { key: 'name', label: 'Account Name', sortable: true },
    { key: 'nickname', label: 'Nickname', sortable: true },
    { key: 'type', label: 'Type', sortable: true },
    { key: 'institution', label: 'Institution', sortable: true },
    { key: 'currentBalance', label: 'Balance', sortable: true, render: (value: number) => `$${value.toLocaleString()}` },
    { key: 'status', label: 'Status', sortable: true, render: (value: string) => <AdminStatusBadge status={value as any} /> },
    { key: 'transactionCount', label: 'Transactions', sortable: true },
    { key: 'lastSyncTime', label: 'Last Sync', sortable: true, render: (value: string) => new Date(value).toLocaleString() },
    { key: 'actions', label: 'Actions', sortable: false, render: (value: any, row: any) => (
      <div className="flex gap-1">
        <AdminActionButton
          onClick={() => handleAccountAction(row.id, 'hide')}
          variant="warning"
          size="sm"
        >
          Hide
        </AdminActionButton>
        <AdminActionButton
          onClick={() => handleAccountAction(row.id, 'show')}
          variant="success"
          size="sm"
        >
          Show
        </AdminActionButton>
      </div>
    )},
  ];

  const selectedUser = data.users.find(user => user.id === selectedUserId);

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">User Account Lookup</h1>
        <AdminActionButton onClick={fetchData} loading={loading}>
          Refresh Data
        </AdminActionButton>
      </div>

      {/* Search */}
      <AdminToolCard
        title="Search Users"
        description="Find users by email, name, or institution"
        status="info"
      >
        <div className="space-y-4">
          <div className="flex gap-4">
            <input
              type="text"
              placeholder="Search by email, name, or institution..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <AdminActionButton onClick={handleSearch} loading={searching}>
              Search
            </AdminActionButton>
          </div>
          
          {searchTerm && (
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Found {data.searchResults.length} users matching "{searchTerm}"
            </div>
          )}
        </div>
      </AdminToolCard>

      {/* User Selection */}
      {selectedUser && (
        <AdminToolCard
          title="Selected User"
          description={`Account details for ${selectedUser.email}`}
          status="active"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <MetricCard
              title="Email"
              value={selectedUser.email}
              color="text-blue-600 dark:text-blue-400"
            />
            <MetricCard
              title="Name"
              value={selectedUser.name || 'N/A'}
              color="text-purple-600 dark:text-purple-400"
            />
            <MetricCard
              title="Accounts"
              value={selectedUser.accountCount.toString()}
              color="text-success-600 dark:text-success-400"
            />
            <MetricCard
              title="Total Balance"
              value={`$${selectedUser.totalBalance.toLocaleString()}`}
              color="text-green-600 dark:text-green-400"
            />
          </div>
        </AdminToolCard>
      )}

      {/* Users Table */}
      <AdminToolCard
        title="Users"
        description="All users in the system"
        status="info"
      >
        <AdminDataTable
          columns={userColumns}
          data={data.searchResults}
          itemsPerPage={10}
          searchable={false} // We have our own search
        />
        <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
          Click on a user row to view their accounts
        </div>
      </AdminToolCard>

      {/* User Accounts */}
      {selectedUser && data.selectedUserAccounts.length > 0 && (
        <AdminToolCard
          title="User Accounts"
          description={`Accounts for ${selectedUser.email}`}
          status="info"
        >
          <AdminDataTable
            columns={accountColumns}
            data={data.selectedUserAccounts}
            itemsPerPage={10}
          />
        </AdminToolCard>
      )}

      {/* No Accounts Selected */}
      {selectedUser && data.selectedUserAccounts.length === 0 && (
        <AdminToolCard
          title="No Accounts Found"
          description={`No accounts found for ${selectedUser.email}`}
          status="warning"
        >
          <div className="text-center py-8">
            <div className="text-yellow-600 dark:text-yellow-400 text-6xl mb-4">⚠️</div>
            <p className="text-gray-600 dark:text-gray-400">
              This user has no accounts in the system.
            </p>
          </div>
        </AdminToolCard>
      )}

      {/* Quick Actions */}
      <AdminToolCard
        title="Quick Actions"
        description="Common administrative tasks"
        status="info"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
            <h4 className="font-semibold mb-2">Export User Data</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Export all user data and accounts to CSV
            </p>
            <AdminActionButton
              onClick={() => alert('Export functionality coming soon')}
              variant="secondary"
              size="sm"
            >
              Export Data
            </AdminActionButton>
          </div>

          <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
            <h4 className="font-semibold mb-2">Bulk Account Actions</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Perform actions on multiple accounts at once
            </p>
            <AdminActionButton
              onClick={() => alert('Bulk actions coming soon')}
              variant="secondary"
              size="sm"
            >
              Bulk Actions
            </AdminActionButton>
          </div>

          <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
            <h4 className="font-semibold mb-2">User Analytics</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              View detailed analytics for selected user
            </p>
            <AdminActionButton
              onClick={() => alert('Analytics coming soon')}
              variant="secondary"
              size="sm"
            >
              View Analytics
            </AdminActionButton>
          </div>
        </div>
      </AdminToolCard>

      {/* Information */}
      <AdminToolCard
        title="About User Lookup"
        description="Understanding user account management"
        status="info"
      >
        <div className="space-y-3">
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
            <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-1">User Management</h4>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              This tool allows you to search for users, view their accounts, and perform 
              administrative actions on their financial data.
            </p>
          </div>
          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg">
            <h4 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-1">Account Visibility</h4>
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              You can hide or show accounts for users. Hidden accounts won't appear 
              in their dashboard but data is preserved.
            </p>
          </div>
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
            <h4 className="font-semibold text-red-800 dark:text-red-200 mb-1">⚠️ Privacy</h4>
            <p className="text-sm text-red-700 dark:text-red-300">
              This tool provides access to sensitive financial data. Use responsibly 
              and only for legitimate administrative purposes.
            </p>
          </div>
        </div>
      </AdminToolCard>
    </div>
  );
} 