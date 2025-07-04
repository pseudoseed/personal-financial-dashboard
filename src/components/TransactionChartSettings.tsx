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
import { useTheme, useSensitiveData } from "@/app/providers";
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

// Add helper for last month
function getLastMonth() {
  const now = new Date();
  const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const month = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0); // last day of last month
  return { startDate, endDate };
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
  const { showSensitiveData } = useSensitiveData();
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

  useEffect(() => {
    // On mount, restore date range from localStorage
    const savedRange = localStorage.getItem('transactionChartDateRange');
    if (savedRange) {
      try {
        const { startDate, endDate } = JSON.parse(savedRange);
        if (startDate && endDate) {
          setLocalSettings(prev => ({ ...prev, startDate: new Date(startDate), endDate: new Date(endDate) }));
          setCustomStartDate(formatDateForInput(new Date(startDate)));
          setCustomEndDate(formatDateForInput(new Date(endDate)));
        }
      } catch {}
    }
  }, [isOpen]);

  useEffect(() => {
    // Save date range to localStorage when it changes
    if (localSettings.startDate && localSettings.endDate) {
      localStorage.setItem('transactionChartDateRange', JSON.stringify({
        startDate: localSettings.startDate,
        endDate: localSettings.endDate,
      }));
    }
  }, [localSettings.startDate, localSettings.endDate]);

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
    { label: "This Week", action: () => {
      setLocalSettings(prev => ({ ...prev, period: 'weekly', ...getThisWeek() }));
      setCustomStartDate(formatDateForInput(getThisWeek().startDate));
      setCustomEndDate(formatDateForInput(getThisWeek().endDate));
    } },
    { label: "This Month", action: () => {
      setLocalSettings(prev => ({ ...prev, period: 'monthly', ...getThisMonth() }));
      setCustomStartDate(formatDateForInput(getThisMonth().startDate));
      setCustomEndDate(formatDateForInput(getThisMonth().endDate));
    } },
    { label: "Last Month", action: () => {
      const range = getLastMonth();
      setLocalSettings(prev => ({ ...prev, startDate: range.startDate, endDate: range.endDate }));
      setCustomStartDate(formatDateForInput(range.startDate));
      setCustomEndDate(formatDateForInput(range.endDate));
    } },
    { label: "This Quarter", action: () => {
      const range = getThisQuarter();
      setLocalSettings(prev => ({ ...prev, startDate: range.startDate, endDate: range.endDate }));
      setCustomStartDate(formatDateForInput(range.startDate));
      setCustomEndDate(formatDateForInput(range.endDate));
    } },
    { label: "Last Quarter", action: () => {
      const range = getLastQuarter();
      setLocalSettings(prev => ({ ...prev, startDate: range.startDate, endDate: range.endDate }));
      setCustomStartDate(formatDateForInput(range.startDate));
      setCustomEndDate(formatDateForInput(range.endDate));
    } },
    { label: "Fiscal Year", action: () => {
      const range = getFiscalYear();
      setLocalSettings(prev => ({ ...prev, startDate: range.startDate, endDate: range.endDate }));
      setCustomStartDate(formatDateForInput(range.startDate));
      setCustomEndDate(formatDateForInput(range.endDate));
    } },
    { label: "Year to Date", action: () => {
      const range = getYearToDate();
      setLocalSettings(prev => ({ ...prev, startDate: range.startDate, endDate: range.endDate }));
      setCustomStartDate(formatDateForInput(range.startDate));
      setCustomEndDate(formatDateForInput(range.endDate));
    } },
    { label: "Today", action: () => {
      const today = new Date();
      setLocalSettings(prev => ({ ...prev, period: 'daily', startDate: today, endDate: today }));
      setCustomStartDate(formatDateForInput(today));
      setCustomEndDate(formatDateForInput(today));
    } },
  ];

  function getInstitutionName(account: Account): string {
    if (!showSensitiveData) {
      return "••••••••••";
    }
    if (account.plaidItem && typeof (account.plaidItem as any).institutionName === 'string') {
      return (account.plaidItem as any).institutionName;
    }
    return 'Unknown Institution';
  }

  // Helper function to format account display name (same as settings dialog)
  function formatAccountDisplayName(account: Account): string {
    if (!showSensitiveData) {
      return "••••••••••";
    }
    
    const institution = getInstitutionName(account);
    const name = (account.nickname || account.name || '').replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
    
    // Use mask if available, otherwise fallback to regex
    const last4 = account.mask || account.name?.match(/\d{4}$/)?.[0] || '----';
    
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

  const filteredAccounts = showSensitiveData 
    ? (accounts || []).filter(account =>
        account.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        getInstitutionName(account).toLowerCase().includes(searchTerm.toLowerCase())
      )
    : (accounts || []); // Show all accounts when sensitive data is hidden

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
                {dateFilters.map((filter, index) => {
                  let isSelected = false;
                  if (localSettings.startDate && localSettings.endDate) {
                    switch (filter.label) {
                      case "This Week":
                        isSelected = formatDateForInput(localSettings.startDate) === formatDateForInput(getThisWeek().startDate) && formatDateForInput(localSettings.endDate) === formatDateForInput(getThisWeek().endDate);
                        break;
                      case "This Month":
                        isSelected = formatDateForInput(localSettings.startDate) === formatDateForInput(getThisMonth().startDate) && formatDateForInput(localSettings.endDate) === formatDateForInput(getThisMonth().endDate);
                        break;
                      case "Last Month":
                        const lastMonth = getLastMonth();
                        isSelected = formatDateForInput(localSettings.startDate) === formatDateForInput(lastMonth.startDate) && formatDateForInput(localSettings.endDate) === formatDateForInput(lastMonth.endDate);
                        break;
                      case "This Quarter":
                        isSelected = formatDateForInput(localSettings.startDate) === formatDateForInput(getThisQuarter().startDate) && formatDateForInput(localSettings.endDate) === formatDateForInput(getThisQuarter().endDate);
                        break;
                      case "Last Quarter":
                        isSelected = formatDateForInput(localSettings.startDate) === formatDateForInput(getLastQuarter().startDate) && formatDateForInput(localSettings.endDate) === formatDateForInput(getLastQuarter().endDate);
                        break;
                      case "Fiscal Year":
                        isSelected = formatDateForInput(localSettings.startDate) === formatDateForInput(getFiscalYear().startDate) && formatDateForInput(localSettings.endDate) === formatDateForInput(getFiscalYear().endDate);
                        break;
                      case "Year to Date":
                        isSelected = formatDateForInput(localSettings.startDate) === formatDateForInput(getYearToDate().startDate) && formatDateForInput(localSettings.endDate) === formatDateForInput(getYearToDate().endDate);
                        break;
                      case "Today":
                        isSelected = formatDateForInput(localSettings.startDate) === formatDateForInput(new Date()) && formatDateForInput(localSettings.endDate) === formatDateForInput(new Date());
                        break;
                      default:
                        isSelected = false;
                    }
                  }
                  return (
                    <button
                      key={index}
                      type="button"
                      onClick={filter.action}
                      className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                        isSelected
                          ? 'bg-purple-600 text-white border-purple-600 dark:bg-purple-700 dark:text-white dark:border-purple-700'
                          : 'border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-zinc-700'
                      }`}
                    >
                      {filter.label}
                    </button>
                  );
                })}
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
                  className="block w-full rounded-md border-gray-300 dark:border-zinc-700 shadow-sm focus:outline-none bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 text-sm"
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
                  className="block w-full rounded-md border-gray-300 dark:border-zinc-700 shadow-sm focus:outline-none bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 text-sm"
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
                  className="rounded border-gray-300 dark:border-zinc-700 text-purple-600 focus:outline-none"
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
                  className="rounded border-gray-300 dark:border-zinc-700 text-purple-600 focus:outline-none"
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
              placeholder={showSensitiveData ? "Search accounts..." : "Search disabled when sensitive data is hidden"}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              disabled={!showSensitiveData}
              className="block w-full rounded-md border-gray-300 dark:border-zinc-700 shadow-sm focus:outline-none bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 mb-3 disabled:opacity-50 disabled:cursor-not-allowed"
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
                          className="rounded border-gray-300 dark:border-zinc-700 text-purple-600 focus:outline-none"
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
                    className={`px-3 py-2 text-sm rounded-full border transition-colors touch-manipulation ${
                      localSettings.categories.includes(category)
                        ? 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900 dark:text-purple-200 dark:border-purple-700'
                        : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200 dark:bg-zinc-800 dark:text-gray-300 dark:border-zinc-700 dark:hover:bg-zinc-700'
                    }`}
                    style={{ minHeight: '44px' }}
                  >
                    {category}
                    {localSettings.categories.includes(category) && (
                      <XMarkIconSolid className="w-4 h-4 ml-1 inline" />
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
                className="block w-full rounded-md border-gray-300 dark:border-zinc-700 shadow-sm focus:outline-none bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100"
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
                className="block w-full rounded-md border-gray-300 dark:border-zinc-700 shadow-sm focus:outline-none bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center p-6 border-t border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 sticky bottom-0 z-10" style={{ boxShadow: '0 -2px 8px rgba(0,0,0,0.03)' }}>
          <button
            type="button"
            onClick={handleReset}
            className="px-4 py-3 text-sm border border-gray-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors touch-manipulation"
            style={{ minHeight: '44px' }}
          >
            Reset to Defaults
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-3 text-sm border border-gray-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors touch-manipulation"
              style={{ minHeight: '44px' }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-3 text-sm bg-purple-600 dark:bg-purple-500 text-white rounded hover:bg-purple-700 dark:hover:bg-purple-400 transition-colors touch-manipulation"
              style={{ minHeight: '44px' }}
            >
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 