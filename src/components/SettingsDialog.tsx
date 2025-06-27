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
}

interface SyncStatus {
  global?: string;
  details?: Array<{
    accountId: string;
    status: string;
    error?: string;
  }>;
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

  // Use the dialog dismiss hook - Settings dialog doesn't require input
  const dialogRef = useDialogDismiss({
    isOpen,
    onClose,
    allowEscape: true,
    allowClickOutside: true,
    requireInput: false,
  });

  const allAccounts = accounts.filter(account => account.institution !== 'Coinbase');
  const newAccounts = allAccounts.filter(account => !account.lastSyncTime);
  const creditCardAccounts = allAccounts.filter(account => account.type === 'credit');

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
    
    const institution = account.institution || 'Manual';
    const name = (account.nickname || account.name || '').replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
    const last4 = account.mask || account.name?.match(/\d{4}$/)?.[0] || '----';
    
    const accountNameLower = account.name.toLowerCase();
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
        className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-zinc-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
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
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Sync your accounts to keep your transaction data up to date. You can sync new accounts for a full history, or sync all accounts for the latest updates.</p>
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
                <span className="text-xs text-gray-500 mt-1">Pulls full transaction history for accounts that have never been synced.</span>
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
                  <span className="ml-2 text-xs text-gray-200 dark:text-gray-300">({allAccounts.length} to sync)</span>
                </button>
                <span className="text-xs text-gray-500 mt-1">Pulls new and updated transactions for all accounts since their last sync.</span>
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
                    {accounts.map((account) => {
                      const institution = maskInstitutionName(account.institution || 'Unknown');
                      const type = account.type ? (account.type.charAt(0).toUpperCase() + account.type.slice(1)) : "Unknown";
                      const last4 = maskAccountNumber(account.mask || null);
                      const formattedName = showSensitiveData ? `${institution} - ${type} (${last4})` : "••••••••••";
                      
                      return (
                        <tr key={account.id}>
                          <td className="px-2 py-1 whitespace-nowrap">{formattedName}</td>
                          <td className="px-2 py-1 whitespace-nowrap">{maskLastSyncTime(account.lastSyncTime || null)}</td>
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
                
                <Button
                  onClick={handleForceResync}
                  disabled={isForceSyncing || allAccounts.length === 0}
                  className="w-full justify-center bg-red-600 hover:bg-red-700 text-white dark:bg-red-700 dark:hover:bg-red-800"
                >
                  {isForceSyncing ? (
                    <ArrowPathIcon className="w-5 h-5 mr-2 animate-spin" />
                  ) : (
                    <WrenchScrewdriverIcon className="w-5 h-5 mr-2" />
                  )}
                  Force Full Re-sync All Accounts
                </Button>
                {forceSyncStatus && (
                  <div className="text-xs text-center text-gray-600 dark:text-gray-400 mt-2 p-2 bg-gray-200 dark:bg-zinc-800 rounded">
                    {forceSyncStatus}
                  </div>
                )}
              </div>
            )}
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