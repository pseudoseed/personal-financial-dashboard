"use client";

import { useState, useEffect } from "react";
import type { TransactionChartSettings } from "@/types/transactionChart";
import type { Account } from "@/types/transactionChart";
import { defaultSettings } from "@/lib/transactionChartSettings";
import { 
  Cog6ToothIcon, 
  XMarkIcon,
  XMarkIcon as XMarkIconSolid,
  CalendarIcon
} from "@heroicons/react/24/outline";
import { useTheme } from "@/app/providers";
import {
  getThisWeek,
  getThisMonth,
  getThisQuarter,
  getLastQuarter,
  getFiscalYear,
  getYearToDate,
  formatDateForInput,
  formatDateRange,
  isValidDateRange,
  type DateRange
} from "@/lib/dateUtils";

interface TransactionChartSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  settings: TransactionChartSettings;
  onSettingsChange: (settings: TransactionChartSettings) => void;
  accounts: Account[];
  categories: string[];
}

function setAccessibleColors(enabled: boolean) {
  if (enabled) {
    document.documentElement.classList.add('accessible-colors');
  } else {
    document.documentElement.classList.remove('accessible-colors');
  }
}

export function TransactionChartSettings({
  isOpen,
  onClose,
  settings,
  onSettingsChange,
  accounts,
  categories,
}: TransactionChartSettingsProps) {
  const [localSettings, setLocalSettings] = useState<TransactionChartSettings>(settings);
  const [searchTerm, setSearchTerm] = useState("");
  const { darkMode, setDarkMode } = useTheme();
  const [accessibleColors, setAccessibleColorsState] = useState(false);
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");

  useEffect(() => {
    setLocalSettings(settings);
    // Initialize custom date inputs from settings
    if (settings.startDate) {
      setCustomStartDate(formatDateForInput(settings.startDate));
    } else {
      setCustomStartDate("");
    }
    if (settings.endDate) {
      setCustomEndDate(formatDateForInput(settings.endDate));
    } else {
      setCustomEndDate("");
    }
  }, [settings]);

  useEffect(() => {
    setAccessibleColors(accessibleColors);
  }, [accessibleColors]);

  const handleSave = () => {
    onSettingsChange(localSettings);
    onClose();
  };

  const handleCancel = () => {
    setLocalSettings(settings);
    onClose();
  };

  const handleReset = () => {
    setLocalSettings(defaultSettings);
    setCustomStartDate("");
    setCustomEndDate("");
  };

  // Date range functions
  const applyDateRange = (dateRange: DateRange) => {
    setLocalSettings(prev => ({
      ...prev,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
    }));
    setCustomStartDate(formatDateForInput(dateRange.startDate));
    setCustomEndDate(formatDateForInput(dateRange.endDate));
  };

  const clearDateRange = () => {
    setLocalSettings(prev => ({
      ...prev,
      startDate: undefined,
      endDate: undefined,
    }));
    setCustomStartDate("");
    setCustomEndDate("");
  };

  const handleCustomDateChange = () => {
    if (customStartDate && customEndDate) {
      const startDate = new Date(customStartDate);
      const endDate = new Date(customEndDate);
      
      if (isValidDateRange(startDate, endDate)) {
        setLocalSettings(prev => ({
          ...prev,
          startDate,
          endDate,
        }));
      }
    } else {
      // Clear dates if either is empty
      setLocalSettings(prev => ({
        ...prev,
        startDate: undefined,
        endDate: undefined,
      }));
    }
  };

  // Prebuilt date filters
  const dateFilters = [
    { label: "This Week", action: () => applyDateRange(getThisWeek()) },
    { label: "This Month", action: () => applyDateRange(getThisMonth()) },
    { label: "This Quarter", action: () => applyDateRange(getThisQuarter()) },
    { label: "Last Quarter", action: () => applyDateRange(getLastQuarter()) },
    { label: "Fiscal Year", action: () => applyDateRange(getFiscalYear()) },
    { label: "Year to Date", action: () => applyDateRange(getYearToDate()) },
  ];

  function getInstitutionName(account: Account): string {
    if (account.plaidItem && typeof (account.plaidItem as any).institutionName === 'string') {
      return (account.plaidItem as any).institutionName;
    }
    return 'Unknown Institution';
  }

  // Helper function to format account display name (same as settings dialog)
  function formatAccountDisplayName(account: Account): string {
    const institution = getInstitutionName(account);
    const name = (account.nickname || account.name || '').replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
    
    // Extract last 4 digits from account name since mask isn't available in this type
    const last4 = account.name?.match(/\d{4}$/)?.[0] || '----';
    
    // For credit cards, try to extract card name from account name
    // Note: subtype isn't available in this Account type, so we'll check the name for credit card indicators
    const accountNameLower = account.name.toLowerCase();
    const isCreditCard = account.type.toLowerCase() === 'credit' || 
                        accountNameLower.includes('credit') || 
                        accountNameLower.includes('card');
    
    if (isCreditCard) {
      // Common credit card name patterns - avoiding generic color terms
      const cardNamePatterns = [
        /freedom/i,
        /sapphire/i,
        /preferred/i,
        /reserve/i,
        /unlimited/i,
        /cash back/i,
        /rewards/i,
        /signature/i,
        /platinum/i,
        /gold/i,
        /elite/i,
        /premium/i,
        /standard/i,
        /classic/i,
        /business/i,
        /corporate/i,
        /student/i,
        /secured/i
      ];
      
      let cardName = '';
      
      // Find matching card name pattern
      for (const pattern of cardNamePatterns) {
        if (pattern.test(accountNameLower)) {
          const match = account.name.match(pattern);
          if (match) {
            cardName = match[0].replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
            break;
          }
        }
      }
      
      // If no specific card name found, use a generic label
      if (!cardName) {
        cardName = 'Credit Card';
      }
      
      return `${institution} - ${cardName} (${last4})`;
    }
    
    // For other account types, use the account name
    return `${institution} - ${name} (${last4})`;
  }

  const filteredAccounts = accounts.filter(account =>
    account.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    getInstitutionName(account).toLowerCase().includes(searchTerm.toLowerCase())
  );

  const groupedAccounts = filteredAccounts.reduce((groups, account) => {
    const institutionName = getInstitutionName(account);
    if (!groups[institutionName]) {
      groups[institutionName] = [];
    }
    groups[institutionName].push(account);
    return groups;
  }, {} as Record<string, Account[]>);

  const toggleAccount = (accountId: string) => {
    setLocalSettings(prev => ({
      ...prev,
      selectedAccountIds: prev.selectedAccountIds.includes(accountId)
        ? prev.selectedAccountIds.filter(id => id !== accountId)
        : [...prev.selectedAccountIds, accountId],
    }));
  };

  const selectAllAccounts = () => {
    setLocalSettings(prev => ({
      ...prev,
      selectedAccountIds: accounts.map(account => account.id),
    }));
  };

  const selectNoAccounts = () => {
    setLocalSettings(prev => ({
      ...prev,
      selectedAccountIds: [],
    }));
  };

  const toggleCategory = (category: string) => {
    setLocalSettings(prev => ({
      ...prev,
      categories: prev.categories.includes(category)
        ? prev.categories.filter(c => c !== category)
        : [...prev.categories, category],
    }));
  };

  const selectedAccountsCount = localSettings.selectedAccountIds.length;
  const totalAccountsCount = accounts.length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto m-4 border border-gray-200 dark:border-zinc-800">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-zinc-800">
          <h2 className="text-lg font-semibold flex items-center gap-2 text-gray-900 dark:text-white">
            <Cog6ToothIcon className="w-5 h-5" />
            Transaction Chart Settings
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-8">
          {/* Date Range Selection */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <CalendarIcon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                Date Range
              </label>
            </div>
            
            {/* Prebuilt Filters */}
            <div className="mb-4">
              <div className="flex flex-wrap gap-2 mb-3">
                {dateFilters.map((filter, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={filter.action}
                    className="px-3 py-1 text-xs rounded-full border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors"
                  >
                    {filter.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={clearDateRange}
                  className="px-3 py-1 text-xs rounded-full border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors"
                >
                  Clear
                </button>
              </div>
              
              {/* Current Date Range Display */}
              {localSettings.startDate && localSettings.endDate && (
                <div className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-zinc-800 rounded-md p-2 border border-gray-200 dark:border-zinc-700">
                  <span className="font-medium">Current Range:</span> {formatDateRange({ startDate: localSettings.startDate, endDate: localSettings.endDate })}
                </div>
              )}
            </div>

            {/* Custom Date Inputs */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => {
                    setCustomStartDate(e.target.value);
                    if (e.target.value && customEndDate) {
                      const startDate = new Date(e.target.value);
                      const endDate = new Date(customEndDate);
                      if (isValidDateRange(startDate, endDate)) {
                        setLocalSettings(prev => ({
                          ...prev,
                          startDate,
                          endDate,
                        }));
                      }
                    }
                  }}
                  className="block w-full rounded-md border-gray-300 dark:border-zinc-700 shadow-sm focus:border-purple-500 focus:ring-purple-500 bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => {
                    setCustomEndDate(e.target.value);
                    if (customStartDate && e.target.value) {
                      const startDate = new Date(customStartDate);
                      const endDate = new Date(e.target.value);
                      if (isValidDateRange(startDate, endDate)) {
                        setLocalSettings(prev => ({
                          ...prev,
                          startDate,
                          endDate,
                        }));
                      }
                    }
                  }}
                  className="block w-full rounded-md border-gray-300 dark:border-zinc-700 shadow-sm focus:border-purple-500 focus:ring-purple-500 bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Transaction Type Filters */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
              Transaction Types
            </label>
            <div className="flex gap-4">
              <label className="flex items-center space-x-2 text-gray-700 dark:text-gray-200">
                <input
                  type="checkbox"
                  checked={localSettings.showIncome}
                  onChange={(e) =>
                    setLocalSettings(prev => ({ ...prev, showIncome: e.target.checked }))
                  }
                  className="rounded border-gray-300 dark:border-zinc-700 text-purple-600 focus:ring-purple-500"
                />
                <span className="text-sm">Income</span>
              </label>
              <label className="flex items-center space-x-2 text-gray-700 dark:text-gray-200">
                <input
                  type="checkbox"
                  checked={localSettings.showExpenses}
                  onChange={(e) =>
                    setLocalSettings(prev => ({ ...prev, showExpenses: e.target.checked }))
                  }
                  className="rounded border-gray-300 dark:border-zinc-700 text-purple-600 focus:ring-purple-500"
                />
                <span className="text-sm">Expenses</span>
              </label>
            </div>
          </div>

          <hr className="border-gray-200 dark:border-zinc-800" />

          {/* Account Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                Accounts ({selectedAccountsCount}/{totalAccountsCount})
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={selectAllAccounts}
                  className="px-3 py-1 text-sm border border-gray-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={selectNoAccounts}
                  className="px-3 py-1 text-sm border border-gray-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors"
                >
                  Select None
                </button>
              </div>
            </div>

            <input
              type="text"
              placeholder="Search accounts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full rounded-md border-gray-300 dark:border-zinc-700 shadow-sm focus:border-purple-500 focus:ring-purple-500 bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 mb-3"
            />

            <div className="max-h-48 overflow-y-auto space-y-2 bg-gray-100 dark:bg-zinc-800 rounded-lg p-2 border border-gray-200 dark:border-zinc-700">
              {Object.entries(groupedAccounts).map(([institution, institutionAccounts]) => (
                <div key={institution} className="space-y-1">
                  <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                    {institution}
                  </div>
                  {institutionAccounts.map((account) => {
                    const formattedName = formatAccountDisplayName(account);
                    return (
                      <div
                        key={account.id}
                        className="flex items-center space-x-2 p-2 rounded hover:bg-gray-200 dark:hover:bg-zinc-700"
                      >
                        <input
                          type="checkbox"
                          checked={localSettings.selectedAccountIds.includes(account.id)}
                          onChange={() => toggleAccount(account.id)}
                          className="rounded border-gray-300 dark:border-zinc-700 text-purple-600 focus:ring-purple-500"
                        />
                        <label className="flex-1 text-sm cursor-pointer text-gray-900 dark:text-gray-200">
                          {formattedName}
                        </label>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          <hr className="border-gray-200 dark:border-zinc-800" />

          {/* Category Filters */}
          {categories.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Categories
              </label>
              <div className="flex flex-wrap gap-2">
                {categories.slice(0, 20).map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => toggleCategory(category)}
                    className={`px-2 py-1 text-xs rounded-full border transition-colors ${
                      localSettings.categories.includes(category)
                        ? 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900 dark:text-purple-200 dark:border-purple-700'
                        : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200 dark:bg-zinc-800 dark:text-gray-300 dark:border-zinc-700 dark:hover:bg-zinc-700'
                    }`}
                  >
                    {category}
                    {localSettings.categories.includes(category) && (
                      <XMarkIconSolid className="w-3 h-3 ml-1 inline" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          <hr className="border-gray-200 dark:border-zinc-800" />

          {/* Amount Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Minimum Amount
              </label>
              <input
                type="number"
                placeholder="0.00"
                value={localSettings.minAmount || ""}
                onChange={(e) =>
                  setLocalSettings(prev => ({
                    ...prev,
                    minAmount: e.target.value ? parseFloat(e.target.value) : undefined,
                  }))
                }
                className="block w-full rounded-md border-gray-300 dark:border-zinc-700 shadow-sm focus:border-purple-500 focus:ring-purple-500 bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Maximum Amount
              </label>
              <input
                type="number"
                placeholder="0.00"
                value={localSettings.maxAmount || ""}
                onChange={(e) =>
                  setLocalSettings(prev => ({
                    ...prev,
                    maxAmount: e.target.value ? parseFloat(e.target.value) : undefined,
                  }))
                }
                className="block w-full rounded-md border-gray-300 dark:border-zinc-700 shadow-sm focus:border-purple-500 focus:ring-purple-500 bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center p-6 border-t border-gray-200 dark:border-zinc-800">
          <button
            type="button"
            onClick={handleReset}
            className="px-4 py-2 text-sm border border-gray-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors"
          >
            Reset to Defaults
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 text-sm border border-gray-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 text-sm bg-purple-600 dark:bg-purple-500 text-white rounded hover:bg-purple-700 dark:hover:bg-purple-400 transition-colors"
            >
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 