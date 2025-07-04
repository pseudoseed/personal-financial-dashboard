"use client";

import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import { useRouter } from "next/navigation";
import { 
  Cog6ToothIcon, 
  XMarkIcon,
  EyeIcon,
  EyeSlashIcon,
  SunIcon,
  MoonIcon,
  ArrowPathIcon,
  GlobeAltIcon,
  ChevronDownIcon,
  WrenchScrewdriverIcon,
  ExclamationTriangleIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
} from "@heroicons/react/24/outline";
import { useTheme, useSensitiveData } from "@/app/providers";
import { Button } from "@/components/ui/Button";
import { useDialogDismiss } from "@/lib/useDialogDismiss";

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Account {
  id: string;
  name: string;
  nickname?: string | null;
  mask?: string | null;
  type: string;
  subtype: string | null;
  lastSyncTime?: string | Date | null;
  institution?: string;
  nextMonthlyPayment?: number;
  minimumPaymentAmount?: number;
  lastStatementBalance?: number;
  plaidItem?: {
    institutionId: string;
    accessToken: string;
  };
}

interface SyncStatus {
  global?: string;
  details?: Array<{
    accountId: string;
    status: string;
    error?: string;
  }>;
}

interface MonthlyPaymentItemProps {
  account: Account;
  showSensitiveData: boolean;
  formatAccountDisplayName: (account: Account) => string;
  onUpdateMonthlyPayment: (accountId: string, monthlyPayment: number, statementBalance: number) => Promise<void>;
  isUpdating: boolean;
}

function MonthlyPaymentItem({ 
  account, 
  showSensitiveData, 
  formatAccountDisplayName, 
  onUpdateMonthlyPayment, 
  isUpdating 
}: MonthlyPaymentItemProps) {
  const [monthlyPayment, setMonthlyPayment] = useState(account.nextMonthlyPayment || account.minimumPaymentAmount || 0);
  const [statementBalance, setStatementBalance] = useState(account.lastStatementBalance || 0);
  const [isEditing, setIsEditing] = useState(false);

  const isCreditCard = account.type === 'credit';
  const balanceLabel = isCreditCard ? 'Statement balance' : 'Full balance';
  const paymentLabel = isCreditCard ? 'Monthly payment' : 'Monthly payment';

  const handleReset = () => {
    // Reset to original values from the database
    setMonthlyPayment(account.minimumPaymentAmount || 0);
    setStatementBalance(account.lastStatementBalance || 0);
  };

  return (
    <div className="p-3 bg-white dark:bg-zinc-800 rounded-lg border border-gray-200 dark:border-zinc-700">
      <div className="flex items-center justify-between mb-2">
        <div>
          <span className="font-medium text-gray-900 dark:text-white">
            {formatAccountDisplayName(account)}
          </span>
          <span className="ml-2 text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
            {isCreditCard ? 'Credit Card' : 'Loan'}
          </span>
        </div>
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300"
        >
          {isEditing ? 'Cancel' : 'Edit'}
        </button>
      </div>
      
      {isEditing ? (
        <div className="space-y-3">
          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
              {paymentLabel} (used in cash flow)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.01"
                min="0"
                value={monthlyPayment}
                onChange={(e) => setMonthlyPayment(parseFloat(e.target.value) || 0)}
                className="flex-1 px-3 py-1 text-sm border border-gray-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-700 text-gray-900 dark:text-white"
                placeholder="Monthly payment amount"
              />
            </div>
          </div>
          
          {isCreditCard && (
            <div className="space-y-2">
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                Statement balance (fallback if no monthly payment)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={statementBalance}
                  onChange={(e) => setStatementBalance(parseFloat(e.target.value) || 0)}
                  className="flex-1 px-3 py-1 text-sm border border-gray-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-700 text-gray-900 dark:text-white"
                  placeholder="Statement balance"
                />
              </div>
            </div>
          )}
          
          <div className="flex gap-2">
            <button
              onClick={handleReset}
              className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 border border-gray-300 dark:border-zinc-600 rounded hover:bg-gray-100 dark:hover:bg-zinc-700"
              title="Reset to original values"
            >
              Reset
            </button>
            <button
              onClick={() => {
                onUpdateMonthlyPayment(account.id, monthlyPayment, statementBalance);
                setIsEditing(false);
              }}
              disabled={isUpdating}
              className="flex-1 px-3 py-1 text-sm bg-purple-600 dark:bg-purple-500 text-white rounded hover:bg-purple-700 dark:hover:bg-purple-400 disabled:opacity-50"
            >
              {isUpdating ? 'Saving...' : 'Save'}
            </button>
          </div>
          
          {isCreditCard && account.minimumPaymentAmount && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Bank minimum payment: {showSensitiveData ? `$${account.minimumPaymentAmount.toLocaleString()}` : '••••••'}
            </p>
          )}
        </div>
      ) : (
        <div className="text-sm text-gray-600 dark:text-gray-400">
          <div className="flex justify-between">
            <span>{paymentLabel}:</span>
            <span className="font-medium">
              {showSensitiveData ? `$${monthlyPayment.toLocaleString()}` : '••••••'}
            </span>
          </div>
          {account.lastStatementBalance && (
            <div className="flex justify-between mt-1">
              <span>{balanceLabel}:</span>
              <span>
                {showSensitiveData ? `$${account.lastStatementBalance.toLocaleString()}` : '••••••'}
              </span>
            </div>
          )}
          {isCreditCard && account.minimumPaymentAmount && (
            <div className="flex justify-between mt-1">
              <span>Minimum payment:</span>
              <span>
                {showSensitiveData ? `$${account.minimumPaymentAmount.toLocaleString()}` : '••••••'}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function SettingsDialog({ isOpen, onClose }: SettingsDialogProps) {
  const router = useRouter();
  const { darkMode, setDarkMode } = useTheme();
  const { showSensitiveData, toggleSensitiveData } = useSensitiveData();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({});
  const [cooldown, setCooldown] = useState(false);
  const [cooldownMsg, setCooldownMsg] = useState("");
  const [isMounted, setIsMounted] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [fixAmountsStatus, setFixAmountsStatus] = useState<string>("");
  const [isFixingAmounts, setIsFixingAmounts] = useState(false);
  const [forceSyncStatus, setForceSyncStatus] = useState<string>("");
  const [isForceSyncing, setIsForceSyncing] = useState(false);
  const [monthlyPaymentStatus, setMonthlyPaymentStatus] = useState<string>("");
  const [isUpdatingMonthlyPayment, setIsUpdatingMonthlyPayment] = useState<string | null>(null);

  // Use the dialog dismiss hook - Settings dialog doesn't require input
  const dialogRef = useDialogDismiss({
    isOpen,
    onClose,
    allowEscape: true,
    allowClickOutside: true,
    requireInput: false,
  });

  // Helper: Only include active, Plaid-connected accounts
  const eligibleAccounts = accounts.filter(account => {
    const isManual = account.plaidItem?.accessToken === 'manual' || (account.plaidItem && 'provider' in account.plaidItem && account.plaidItem.provider === 'manual');
    const isDisconnected = account.plaidItem && 'status' in account.plaidItem && account.plaidItem.status === 'disconnected';
    return !isManual && !isDisconnected;
  });

  // For sync buttons
  const syncableAccounts = eligibleAccounts;
  const newAccounts = syncableAccounts.filter(account => !account.lastSyncTime);
  const allAccounts = eligibleAccounts;
  const creditCardAccounts = allAccounts.filter(account => account.type === 'credit');
  const loanAccounts = allAccounts.filter(account => account.type === 'loan');
  const billAccounts = allAccounts.filter(account => ['credit', 'loan'].includes(account.type));

  // Helper functions to mask sensitive data
  const maskAccountName = (name: string) => showSensitiveData ? name : "••••••••••";
  const maskInstitutionName = (institution: string) => showSensitiveData ? institution : "••••••••••";
  const maskAccountNumber = (mask: string | null) => showSensitiveData ? mask : "••••";
  const maskLastSyncTime = (lastSyncTime: string | Date | null) => {
    if (!showSensitiveData) return "••••••••••";
    if (!lastSyncTime) return "Never";
    const date = new Date(lastSyncTime);
    return date.toLocaleString();
  };

  const formatAccountDisplayName = (account: Account): string => {
    if (!showSensitiveData) {
      return "••••••••••";
    }
    const institution = (account.plaidItem && 'institutionName' in account.plaidItem && (account.plaidItem as any).institutionName)
      ? (account.plaidItem as any).institutionName
      : (account.institution || account.plaidItem?.institutionId || 'Plaid');
    const name = (account.nickname || account.name || '').replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
    const last4 = account.mask || account.name?.match(/\d{4}$/)?.[0] || '----';
    const accountNameLower = account.name?.toLowerCase() || '';
    const isCreditCard = account.type.toLowerCase() === 'credit' || 
                        accountNameLower.includes('credit') || 
                        accountNameLower.includes('card');
    if (isCreditCard) {
      const cardNamePatterns = [
        /freedom/i, /sapphire/i, /preferred/i, /reserve/i, /unlimited/i,
        /cash back/i, /rewards/i, /signature/i, /platinum/i, /gold/i,
        /elite/i, /premium/i, /standard/i, /classic/i, /business/i,
        /corporate/i, /student/i, /secured/i
      ];
      let cardName = '';
      for (const pattern of cardNamePatterns) {
        if (pattern.test(accountNameLower)) {
          const match = account.name.match(pattern);
          if (match) {
            cardName = match[0].replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
            break;
          }
        }
      }
      if (!cardName) {
        cardName = 'Credit Card';
      }
      return `${institution} - ${cardName} (${last4})`;
    }
    return `${institution} - ${name} (${last4})`;
  };

  const fetchAccounts = async () => {
    try {
      const response = await fetch('/api/accounts');
      const data = await response.json();
      setAccounts(data || []);
    } catch (error) {
        console.error('Failed to fetch accounts:', error);
    }
  };

  const startCooldown = () => {
    setCooldown(true);
    setCooldownMsg("Please wait 30 seconds before syncing again...");
    setTimeout(() => {
      setCooldown(false);
      setCooldownMsg("");
    }, 30000);
  };

  const handleFixAmounts = async () => {
    if (creditCardAccounts.length === 0) {
      setFixAmountsStatus("No credit card accounts found to fix");
      return;
    }

    setIsFixingAmounts(true);
    setFixAmountsStatus("Fixing transaction amounts...");

    try {
      let totalUpdated = 0;
      let errors: string[] = [];

      for (const account of creditCardAccounts) {
        try {
          const response = await fetch(`/api/accounts/${account.id}/fix-amounts`, {
            method: 'POST',
          });
          const data = await response.json();
          
          if (response.ok) {
            totalUpdated += data.updatedCount || 0;
          } else {
            errors.push(`${account.name}: ${data.error || 'Unknown error'}`);
          }
        } catch (error) {
          errors.push(`${account.name}: Network error`);
        }
      }

      if (errors.length === 0) {
        setFixAmountsStatus(`Successfully fixed amounts for ${totalUpdated} transactions across ${creditCardAccounts.length} credit card accounts`);
      } else {
        setFixAmountsStatus(`Fixed ${totalUpdated} transactions. Errors: ${errors.join(', ')}`);
      }
    } catch (error) {
      setFixAmountsStatus("Failed to fix transaction amounts");
    } finally {
      setIsFixingAmounts(false);
    }
  };

  const handleForceResync = async () => {
    if (!window.confirm("Are you sure you want to perform a full re-sync? This will re-download all available transaction history from your banks to update amounts and other data, but will preserve your categories. This can take several minutes and cannot be undone.")) {
      return;
    }

    setIsForceSyncing(true);
    setForceSyncStatus("Starting full transaction re-sync for all accounts...");

    try {
      const response = await fetch('/api/accounts/force-resync', {
        method: 'POST',
      });
      const data = await response.json();
      
      if (response.ok) {
        const successCount = data.results?.filter((r: any) => r.status === 'success').length || 0;
        const errorCount = data.results?.filter((r: any) => r.status === 'error').length || 0;
        setForceSyncStatus(`Re-sync complete. ${successCount} accounts succeeded, ${errorCount} failed.`);
      } else {
        setForceSyncStatus(`Error: ${data.error || 'An unknown error occurred.'}`);
      }
    } catch (error) {
      setForceSyncStatus("A network error occurred during the re-sync.");
    } finally {
      setIsForceSyncing(false);
      // Refresh account data after sync
      fetchAccounts();
    }
  };

  const handleUpdateMonthlyPayment = async (accountId: string, monthlyPayment: number, statementBalance: number) => {
    setIsUpdatingMonthlyPayment(accountId);
    setMonthlyPaymentStatus("");

    try {
      const response = await fetch(`/api/accounts/${accountId}/update-monthly-payment`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monthlyPayment, statementBalance }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setMonthlyPaymentStatus(`Monthly payment updated successfully for ${data.account.nickname || data.account.name}`);
        // Refresh account data
        fetchAccounts();
      } else {
        setMonthlyPaymentStatus(`Error: ${data.error || 'Failed to update monthly payment'}`);
      }
    } catch (error) {
      setMonthlyPaymentStatus("A network error occurred while updating the monthly payment.");
    } finally {
      setIsUpdatingMonthlyPayment(null);
    }
  };

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchAccounts();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const dialogContent = (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div 
        ref={dialogRef}
        className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-zinc-700 flex-shrink-0">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Appearance Section */}
          <div className="mb-8 p-4 rounded-lg bg-gray-100 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800">
            <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">Appearance</h3>
            <div className="flex items-center justify-between">
              <span className="text-base text-gray-900 dark:text-white">Dark Mode</span>
              <button
                onClick={() => setDarkMode(!darkMode)}
                aria-label="Toggle dark mode"
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors touch-manipulation ${
                  darkMode ? 'bg-purple-600 dark:bg-purple-500' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                    darkMode ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Plaid Sync Section */}
          <div className="mb-8 p-4 rounded-lg bg-gray-100 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800">
            <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">Plaid Sync</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Sync your Plaid-connected accounts to keep your transaction data up to date. Manual accounts cannot be synced. You can sync new accounts for a full history, or sync all accounts for the latest updates.</p>
            
            {/* Authentication Status Check */}
            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200">Authentication Status</h4>
                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                    Check if your connected accounts need re-authentication
                  </p>
                </div>
                <button
                  onClick={async () => {
                    try {
                      const response = await fetch('/api/accounts/auth-status');
                      const data = await response.json();
                      // Removed verbose debug logging
                      alert(`Authentication Status:\n${data.summary.total} total institutions\n${data.summary.valid} valid\n${data.summary.needsReauth} need re-authentication\n${data.summary.errors} errors`);
                    } catch (error) {
                      console.error('Error checking auth status:', error);
                      alert('Error checking authentication status');
                    }
                  }}
                  className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                >
                  Check Status
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-4 mb-4">
              <div className="flex flex-col gap-1">
                <button
                  onClick={async () => {
                    if (cooldown) return;
                    setSyncStatus({ global: 'Syncing new accounts...' });
                    startCooldown();
                    try {
                      const response = await fetch('/api/accounts', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ firstTime: true }),
                      });
                      const data = await response.json();
                      setSyncStatus({ global: data.message || 'Sync complete', details: data.results });
                      setTimeout(fetchAccounts, 1000);
                    } catch (error) {
                      setSyncStatus({ global: 'Sync failed' });
                    }
                  }}
                  className="w-full px-4 py-2 text-sm font-medium bg-purple-600 dark:bg-purple-500 text-white rounded-lg hover:bg-purple-700 dark:hover:bg-purple-400 disabled:opacity-50 flex items-center justify-center gap-2"
                  disabled={newAccounts.length === 0 || cooldown}
                  title={newAccounts.length === 0 ? 'No new accounts to sync' : cooldown ? cooldownMsg : ''}
                  aria-disabled={newAccounts.length === 0 || cooldown}
                >
                  <ArrowPathIcon className="w-5 h-5" />
                  Sync New Accounts
                  <span className="ml-2 text-xs text-gray-200 dark:text-gray-300">({newAccounts.length} to sync)</span>
                </button>
                <span className="text-xs text-gray-500 mt-1">Pulls full transaction history for Plaid-connected accounts that have never been synced.</span>
              </div>
              <div className="flex flex-col gap-1">
                <button
                  onClick={async () => {
                    if (cooldown) return;
                    setSyncStatus({ global: 'Syncing all accounts...' });
                    startCooldown();
                    try {
                      const response = await fetch('/api/accounts', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ firstTime: false }),
                      });
                      const data = await response.json();
                      setSyncStatus({ global: data.message || 'Sync complete', details: data.results });
                      setTimeout(fetchAccounts, 1000);
                    } catch (error) {
                      setSyncStatus({ global: 'Sync failed' });
                    }
                  }}
                  className="w-full px-4 py-2 text-sm font-medium bg-gray-700 dark:bg-gray-800 text-white rounded-lg hover:bg-gray-800 dark:hover:bg-gray-600 disabled:opacity-50 flex items-center justify-center gap-2"
                  disabled={cooldown}
                  title={cooldown ? cooldownMsg : ''}
                  aria-disabled={cooldown}
                >
                  <ArrowPathIcon className="w-5 h-5" />
                  Sync All Accounts
                  <span className="ml-2 text-xs text-gray-200 dark:text-gray-300">({syncableAccounts.length} to sync)</span>
                </button>
                <span className="text-xs text-gray-500 mt-1">Pulls new and updated transactions for all Plaid-connected accounts since their last sync.</span>
              </div>
            </div>
            {/* Sync status and progress */}
            {syncStatus.global && (
              <div className="flex items-center gap-2 text-sm text-gray-900 dark:text-white mb-2">
                {syncStatus.global.toLowerCase().includes('syncing') && (
                  <svg className="animate-spin h-4 w-4 text-purple-500" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                )}
                <span className={`rounded px-2 py-1 text-xs font-semibold ${syncStatus.global.toLowerCase().includes('syncing') ? 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300' : syncStatus.global.toLowerCase().includes('complete') ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' : 'bg-pink-100 dark:bg-pink-900 text-pink-700 dark:text-pink-300'}`}>{syncStatus.global}</span>
              </div>
            )}
            {syncStatus.details && Array.isArray(syncStatus.details) && (
              <ul className="text-xs text-gray-700 dark:text-gray-300 max-h-32 overflow-y-auto mb-2">
                {syncStatus.details
                  .filter(result => result.status !== 'success')
                  .map((result, idx) => (
                    <li key={idx} className={'text-pink-500 dark:text-pink-400'}>
                      {result.accountId}: {result.status} {result.error ? `- ${result.error}` : ''}
                    </li>
                  ))
                }
              </ul>
            )}
            <div className="text-xs text-gray-500 mt-2">
              Syncing is happening in the background. You can check back here in a few minutes for updated status.
            </div>
            {accounts.some(account => account.plaidItem?.accessToken === 'manual') && (
              <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  <strong>Note:</strong> Manual accounts are excluded from sync operations since they don't connect to Plaid.
                </p>
              </div>
            )}
            {/* Last sync times table */}
            <div className="mt-6">
              <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Last Sync Times</h4>
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs text-left">
                  <thead>
                    <tr>
                      <th className="px-2 py-1 font-semibold text-gray-600 dark:text-gray-400">Account</th>
                      <th className="px-2 py-1 font-semibold text-gray-600 dark:text-gray-400">Last Sync</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-700 dark:text-gray-300">
                    {eligibleAccounts.length === 0 ? (
                      <tr>
                        <td colSpan={2} className="px-2 py-4 text-center text-gray-400 dark:text-gray-500 italic">
                          No eligible Plaid-connected accounts to sync.
                        </td>
                      </tr>
                    ) : eligibleAccounts.map((account) => {
                      // Use institution name if available, else fallback
                      const institutionName = (account.plaidItem && 'institutionName' in account.plaidItem && (account.plaidItem as any).institutionName)
                        ? (account.plaidItem as any).institutionName
                        : (account.institution || account.plaidItem?.institutionId || 'Plaid');
                      const type = account.type ? (account.type.charAt(0).toUpperCase() + account.type.slice(1)) : "Unknown";
                      const last4 = maskAccountNumber(account.mask || null);
                      const formattedName = showSensitiveData 
                        ? `${institutionName} - ${(account.nickname || account.name || '').replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase())} (${last4})`
                        : "••••••••••";
                      return (
                        <tr key={account.id}>
                          <td className="px-2 py-1 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span>{formattedName}</span>
                            </div>
                          </td>
                          <td className="px-2 py-1 whitespace-nowrap">
                            {maskLastSyncTime(account.lastSyncTime || null)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Display Preferences Section */}
          <div className="mb-8 p-4 rounded-lg bg-gray-100 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800">
            <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">Display Preferences</h3>
            <div className="flex items-center justify-between mb-4">
              <span className="text-base text-gray-900 dark:text-white">Show Sensitive Data</span>
              <button
                onClick={toggleSensitiveData}
                aria-label="Toggle sensitive data visibility"
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors touch-manipulation ${
                  showSensitiveData ? 'bg-purple-600 dark:bg-purple-500' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                    showSensitiveData ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Account Management Section */}
          <div className="mb-8 p-4 rounded-lg bg-gray-100 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800">
            <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">Account Management</h3>
            <div className="flex flex-col gap-3">
              <Button
                onClick={() => {
                  onClose();
                  router.push('/dashboard/accounts');
                }}
                className="w-full justify-start"
                variant="secondary"
              >
                <GlobeAltIcon className="w-5 h-5 mr-2" />
                Manage Accounts
              </Button>
              <Button
                onClick={() => {
                  onClose();
                  router.push('/dashboard/transactions');
                }}
                className="w-full justify-start"
                variant="secondary"
              >
                <ArrowPathIcon className="w-5 h-5 mr-2" />
                Transaction History
              </Button>
            </div>
          </div>

          {/* Advanced Settings Section */}
          <div className="mb-8 p-4 rounded-lg bg-gray-100 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800">
            <button 
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center justify-between w-full text-left"
            >
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Advanced Settings
              </h3>
              <ChevronDownIcon className={`w-5 h-5 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
            </button>
            
            {showAdvanced && (
              <div className="mt-4 space-y-4">
                <div className="p-3 bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-lg flex items-start gap-3">
                  <ExclamationTriangleIcon className="w-6 h-6 text-yellow-600 dark:text-yellow-400 mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-yellow-800 dark:text-yellow-200">Use with caution.</h4>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300">
                      These tools can modify your data. A full re-sync will download all available history from Plaid to update your existing transactions.
                    </p>
                  </div>
                </div>

                {/* Monthly Payment Management Subsection */}
                {billAccounts.length > 0 && (
                  <div className="border border-gray-200 dark:border-zinc-700 rounded-lg p-4 bg-white dark:bg-zinc-800">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-gray-900 dark:text-white">Monthly Payment Management</h4>
                      <button
                        onClick={() => {
                          // Reset all accounts to their original values
                          billAccounts.forEach(account => {
                            handleUpdateMonthlyPayment(
                              account.id, 
                              account.minimumPaymentAmount || 0, 
                              account.lastStatementBalance || 0
                            );
                          });
                        }}
                        className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 px-2 py-1 rounded border border-gray-300 dark:border-zinc-600 hover:bg-gray-100 dark:hover:bg-zinc-700"
                        title="Reset all accounts to original values"
                      >
                        Reset All
                      </button>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      Set monthly payment amounts for credit cards and loans. These amounts are used in cash flow calculations instead of the full balance or statement balance.
                    </p>
                    
                    <div className="space-y-3">
                      {billAccounts.map((account) => (
                        <MonthlyPaymentItem
                          key={account.id}
                          account={account}
                          showSensitiveData={showSensitiveData}
                          formatAccountDisplayName={formatAccountDisplayName}
                          onUpdateMonthlyPayment={handleUpdateMonthlyPayment}
                          isUpdating={isUpdatingMonthlyPayment === account.id}
                        />
                      ))}
                    </div>
                    
                    {monthlyPaymentStatus && (
                      <div className="mt-3 p-2 text-sm rounded bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300">
                        {monthlyPaymentStatus}
                      </div>
                    )}
                  </div>
                )}
                
                <div className="space-y-3">
                  <div className="flex flex-row items-center justify-center gap-x-4 flex-wrap">
                    <Button
                      onClick={() => {
                        onClose();
                        router.push('/admin');
                      }}
                      size="md"
                      className="bg-purple-600 hover:bg-purple-700 text-white dark:bg-purple-700 dark:hover:bg-purple-800"
                    >
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Admin Panel
                    </Button>
                    <Button
                      onClick={handleForceResync}
                      disabled={isForceSyncing || allAccounts.length === 0}
                      size="md"
                      className="justify-center bg-red-600 hover:bg-red-700 text-white dark:bg-red-700 dark:hover:bg-red-800"
                    >
                      {isForceSyncing ? (
                        <ArrowPathIcon className="w-5 h-5 mr-2 animate-spin" />
                      ) : (
                        <WrenchScrewdriverIcon className="w-5 h-5 mr-2" />
                      )}
                      Force Full Re-sync All Accounts
                    </Button>
                  </div>
                </div>
                {forceSyncStatus && (
                  <div className="text-xs text-center text-gray-600 dark:text-gray-400 mt-2 p-2 bg-gray-200 dark:bg-zinc-800 rounded">
                    {forceSyncStatus}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* About Section */}
          <div className="p-4 rounded-lg bg-gray-100 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800">
            <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">About</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Personal Financial Dashboard v1.0.0
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Built with Next.js, Prisma, and Plaid
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  if (!isMounted) {
    return null;
  }

  return ReactDOM.createPortal(
    dialogContent,
    document.getElementById("dialog-root") as HTMLElement
  );
} 