"use client";

import { useState, useEffect } from 'react';
import { AdminToolCard } from '@/components/admin/AdminToolCard';
import { AdminDataTable } from '@/components/admin/AdminDataTable';
import { AdminActionButton } from '@/components/admin/AdminActionButton';
import { AdminStatusBadge } from '@/components/admin/AdminStatusBadge';
import { MetricCard } from '@/components/MetricCard';

interface OrphanedData {
  summary: {
    orphanedAccounts: number;
    orphanedTransactions: number;
    orphanedBalances: number;
    orphanedLoanDetails: number;
    totalOrphanedRecords: number;
  };
  orphanedAccounts: Array<{
    id: string;
    name: string;
    type: string;
    institution: string;
    createdAt: string;
  }>;
  orphanedTransactions: Array<{
    id: string;
    name: string;
    amount: number;
    date: string;
    accountId: string;
  }>;
  orphanedBalances: Array<{
    id: string;
    current: number;
    date: string;
    accountId: string;
  }>;
  orphanedLoanDetails: Array<{
    id: string;
    accountId: string;
    loanType: string;
    createdAt: string;
  }>;
}

export default function OrphanedDataPage() {
  const [data, setData] = useState<OrphanedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [cleaning, setCleaning] = useState(false);

  const fetchData = async () => {
    try {
      const response = await fetch('/api/admin/orphaned-data');
      if (response.ok) {
        const orphanedData = await response.json();
        setData(orphanedData);
      }
    } catch (error) {
      console.error('Error fetching orphaned data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleScan = async () => {
    setScanning(true);
    await fetchData();
    setScanning(false);
  };

  const handleCleanup = async (type: string) => {
    if (!confirm(`Are you sure you want to delete all orphaned ${type}? This action cannot be undone.`)) {
      return;
    }

    setCleaning(true);
    try {
      const response = await fetch('/api/admin/orphaned-data', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type }),
      });

      if (response.ok) {
        alert(`Successfully cleaned up orphaned ${type}`);
        await fetchData(); // Refresh data
      } else {
        const error = await response.json();
        alert(`Failed to clean up ${type}: ${error.error}`);
      }
    } catch (error) {
      alert(`Error cleaning up ${type}`);
      console.error('Cleanup error:', error);
    } finally {
      setCleaning(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto py-8 px-4">
        <div className="text-center">Loading orphaned data scan...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-7xl mx-auto py-8 px-4">
        <div className="text-center text-red-600">Failed to load orphaned data</div>
      </div>
    );
  }

  const accountColumns = [
    { key: 'name', label: 'Account Name', sortable: true },
    { key: 'type', label: 'Type', sortable: true },
    { key: 'institution', label: 'Institution', sortable: true },
    { key: 'createdAt', label: 'Created', sortable: true, render: (value: string) => new Date(value).toLocaleDateString() },
  ];

  const transactionColumns = [
    { key: 'name', label: 'Transaction Name', sortable: true },
    { key: 'amount', label: 'Amount', sortable: true, render: (value: number) => `$${value.toFixed(2)}` },
    { key: 'date', label: 'Date', sortable: true, render: (value: string) => new Date(value).toLocaleDateString() },
    { key: 'accountId', label: 'Account ID', sortable: true },
  ];

  const balanceColumns = [
    { key: 'current', label: 'Balance', sortable: true, render: (value: number) => `$${value.toFixed(2)}` },
    { key: 'date', label: 'Date', sortable: true, render: (value: string) => new Date(value).toLocaleDateString() },
    { key: 'accountId', label: 'Account ID', sortable: true },
  ];

  const loanColumns = [
    { key: 'loanType', label: 'Loan Type', sortable: true },
    { key: 'accountId', label: 'Account ID', sortable: true },
    { key: 'createdAt', label: 'Created', sortable: true, render: (value: string) => new Date(value).toLocaleDateString() },
  ];

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Orphaned Data Finder</h1>
        <AdminActionButton onClick={handleScan} loading={scanning}>
          Scan for Orphaned Data
        </AdminActionButton>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <MetricCard
          title="Total Orphaned"
          value={data.summary.totalOrphanedRecords.toString()}
          color={data.summary.totalOrphanedRecords > 0 ? "text-warning-600 dark:text-warning-400" : "text-success-600 dark:text-success-400"}
        />
        <MetricCard
          title="Orphaned Accounts"
          value={data.summary.orphanedAccounts.toString()}
          color={data.summary.orphanedAccounts > 0 ? "text-warning-600 dark:text-warning-400" : "text-success-600 dark:text-success-400"}
        />
        <MetricCard
          title="Orphaned Transactions"
          value={data.summary.orphanedTransactions.toString()}
          color={data.summary.orphanedTransactions > 0 ? "text-warning-600 dark:text-warning-400" : "text-success-600 dark:text-success-400"}
        />
        <MetricCard
          title="Orphaned Balances"
          value={data.summary.orphanedBalances.toString()}
          color={data.summary.orphanedBalances > 0 ? "text-warning-600 dark:text-warning-400" : "text-success-600 dark:text-success-400"}
        />
        <MetricCard
          title="Orphaned Loans"
          value={data.summary.orphanedLoanDetails.toString()}
          color={data.summary.orphanedLoanDetails > 0 ? "text-warning-600 dark:text-warning-400" : "text-success-600 dark:text-success-400"}
        />
      </div>

      {/* Orphaned Accounts */}
      {data.orphanedAccounts.length > 0 && (
        <AdminToolCard
          title="Orphaned Accounts"
          description="Accounts that exist without a corresponding PlaidItem"
          status="warning"
          actions={
            <AdminActionButton 
              onClick={() => handleCleanup('accounts')} 
              variant="danger" 
              loading={cleaning}
            >
              Clean Up Accounts
            </AdminActionButton>
          }
        >
          <AdminDataTable
            columns={accountColumns}
            data={data.orphanedAccounts}
            itemsPerPage={10}
          />
        </AdminToolCard>
      )}

      {/* Orphaned Transactions */}
      {data.orphanedTransactions.length > 0 && (
        <AdminToolCard
          title="Orphaned Transactions"
          description="Transactions that exist without a corresponding Account"
          status="warning"
          actions={
            <AdminActionButton 
              onClick={() => handleCleanup('transactions')} 
              variant="danger" 
              loading={cleaning}
            >
              Clean Up Transactions
            </AdminActionButton>
          }
        >
          <AdminDataTable
            columns={transactionColumns}
            data={data.orphanedTransactions}
            itemsPerPage={10}
          />
        </AdminToolCard>
      )}

      {/* Orphaned Balances */}
      {data.orphanedBalances.length > 0 && (
        <AdminToolCard
          title="Orphaned Balance Records"
          description="Balance records that exist without a corresponding Account"
          status="warning"
          actions={
            <AdminActionButton 
              onClick={() => handleCleanup('balances')} 
              variant="danger" 
              loading={cleaning}
            >
              Clean Up Balances
            </AdminActionButton>
          }
        >
          <AdminDataTable
            columns={balanceColumns}
            data={data.orphanedBalances}
            itemsPerPage={10}
          />
        </AdminToolCard>
      )}

      {/* Orphaned Loan Details */}
      {data.orphanedLoanDetails.length > 0 && (
        <AdminToolCard
          title="Orphaned Loan Details"
          description="Loan details that exist without a corresponding Account"
          status="warning"
          actions={
            <AdminActionButton 
              onClick={() => handleCleanup('loans')} 
              variant="danger" 
              loading={cleaning}
            >
              Clean Up Loans
            </AdminActionButton>
          }
        >
          <AdminDataTable
            columns={loanColumns}
            data={data.orphanedLoanDetails}
            itemsPerPage={10}
          />
        </AdminToolCard>
      )}

      {/* No Orphaned Data */}
      {data.summary.totalOrphanedRecords === 0 && (
        <AdminToolCard
          title="No Orphaned Data Found"
          description="All database records are properly linked"
          status="active"
        >
          <div className="text-center py-8">
            <div className="text-green-600 dark:text-green-400 text-6xl mb-4">✓</div>
            <p className="text-gray-600 dark:text-gray-400">
              Your database is clean! All records have proper relationships.
            </p>
          </div>
        </AdminToolCard>
      )}

      {/* Information */}
      <AdminToolCard
        title="About Orphaned Data"
        description="Understanding and managing orphaned records"
        status="info"
      >
        <div className="space-y-3">
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
            <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-1">What are orphaned records?</h4>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              Orphaned records are database entries that exist without proper relationships. 
              For example, a transaction record that references an account that no longer exists.
            </p>
          </div>
          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg">
            <h4 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-1">When do they occur?</h4>
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              Orphaned records can occur during data migrations, when accounts are deleted, 
              or when there are errors in the data synchronization process.
            </p>
          </div>
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
            <h4 className="font-semibold text-red-800 dark:text-red-200 mb-1">⚠️ Warning</h4>
            <p className="text-sm text-red-700 dark:text-red-300">
              Cleaning up orphaned data is irreversible. Make sure to backup your database 
              before performing cleanup operations.
            </p>
          </div>
        </div>
      </AdminToolCard>
    </div>
  );
} 