"use client";

import { useQuery } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
  TooltipItem,
} from "chart.js";
import { format } from "date-fns";
import { useState, useRef, useEffect } from "react";
import {
  PencilIcon,
  CheckIcon,
  XMarkIcon,
  TrashIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  BuildingLibraryIcon,
  ArrowDownTrayIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/solid";
import { TransactionList } from "@/components/TransactionList";
import {
  Account,
  PlaidItem,
  Transaction,
  TransactionDownloadLog,
} from "@prisma/client";
import { formatBalance } from "@/lib/formatters";
import { useSensitiveData } from "@/app/providers";
import { Switch } from '@headlessui/react';
import { InstitutionLogo } from './InstitutionLogo';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface BalanceHistory {
  id: string;
  date: string;
  current: number;
  available: number | null;
  limit: number | null;
  account: {
    name: string;
    nickname: string | null;
    type: string;
    subtype: string | null;
  };
}

interface AccountDetailsProps {
  account: Account & {
    plaidItem: PlaidItem;
    transactions: Transaction[];
    downloadLogs: TransactionDownloadLog[];
  };
}

export function AccountDetails({ account }: AccountDetailsProps) {
  const { showSensitiveData } = useSensitiveData();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [newNickname, setNewNickname] = useState("");
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);
  const [isTransactionsExpanded, setIsTransactionsExpanded] = useState(false);
  const [isInverting, setIsInverting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [localInvertTransactions, setLocalInvertTransactions] = useState(account.invertTransactions);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isEmergencyFund, setIsEmergencyFund] = useState<boolean | null>(null);
  const [isEmergencyLoading, setIsEmergencyLoading] = useState(false);
  const [emergencyError, setEmergencyError] = useState<string | null>(null);

  const displayBalance = (amount: number | null) => {
    if (amount === null) return "-";
    return showSensitiveData ? formatBalance(amount) : "••••••";
  };

  const {
    data: history,
    isLoading,
    refetch,
  } = useQuery<BalanceHistory[]>({
    queryKey: ["account-history", account.id],
    queryFn: async () => {
      const response = await fetch(`/api/accounts/${account.id}/history`);
      if (!response.ok) throw new Error("Failed to fetch account history");
      return response.json();
    },
  });

  useEffect(() => {
    if (history?.length) {
      setNewNickname(history[0].account.nickname || "");
    }
  }, [history]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  useEffect(() => {
    setLocalInvertTransactions(account.invertTransactions);
  }, [account.invertTransactions]);

  // Fetch emergency fund status
  useEffect(() => {
    setIsEmergencyLoading(true);
    fetch(`/api/accounts/${account.id}/toggle-emergency-fund`)
      .then(res => res.json())
      .then(data => setIsEmergencyFund(data.included))
      .catch(() => setEmergencyError('Failed to load emergency fund status'))
      .finally(() => setIsEmergencyLoading(false));
  }, [account.id]);

  const handleStartEditing = () => {
    setIsEditing(true);
  };

  const handleSaveNickname = async () => {
    try {
      const response = await fetch(
        `/api/accounts/${account.id}/update-nickname`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ nickname: newNickname.trim() || null }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to update nickname");
      }

      setIsEditing(false);
      refetch();
    } catch (error) {
      console.error("Error updating nickname:", error);
    }
  };

  const handleCancelEditing = () => {
    setNewNickname(history?.[0].account.nickname || "");
    setIsEditing(false);
  };

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      await handleSaveNickname();
    }
  };

  const handleDeleteBalance = async (balanceId: string) => {
    if (!confirm("Are you sure you want to delete this record?")) {
      return;
    }

    try {
      const response = await fetch(
        `/api/accounts/${account.id}/history/${balanceId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to delete balance record");
      }

      refetch();
    } catch (error) {
      console.error("Error deleting balance record:", error);
    }
  };

  const handleBackfill = async () => {
    if (
      !confirm(
        "Are you sure you want to backfill missing monthly data?  This will create monthly balances for all months in the account's history that are missing and going back to 2022-12-01 using the oldest balance amount as the starting point.  This is to ensure net worth is calculated correctly."
      )
    ) {
      return;
    }

    try {
      const response = await fetch(`/api/accounts/${account.id}/backfill`, {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to backfill data");
      }

      const result = await response.json();
      alert(result.message);
      refetch();
    } catch (error) {
      console.error("Error backfilling data:", error);
      alert(error instanceof Error ? error.message : "Failed to backfill data");
    }
  };

  const handleCleanMonthlyRecords = async () => {
    if (
      !confirm(
        "Are you sure you want to delete duplicate monthly records? This will keep only the most recent record for each month."
      )
    ) {
      return;
    }

    try {
      const response = await fetch(
        `/api/accounts/${account.id}/clean-monthly-records`,
        {
          method: "POST",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to clean monthly records");
      }

      const result = await response.json();
      alert(result.message);
      refetch();
    } catch (error) {
      console.error("Error cleaning monthly records:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Failed to clean monthly records"
      );
    }
  };

  const handleCleanDailyRecords = async () => {
    if (
      !confirm(
        "Are you sure you want to delete duplicate daily records? This will keep only the most recent record for each day."
      )
    ) {
      return;
    }

    try {
      const response = await fetch(
        `/api/accounts/${account.id}/clean-daily-records`,
        {
          method: "POST",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to clean daily records");
      }

      const result = await response.json();
      alert(result.message);
      refetch();
    } catch (error) {
      console.error("Error cleaning daily records:", error);
      alert(
        error instanceof Error ? error.message : "Failed to clean daily records"
      );
    }
  };

  const handleToggleInversion = async () => {
    setIsInverting(true);
    const prevValue = localInvertTransactions;
    setLocalInvertTransactions(!prevValue);
    try {
      const response = await fetch(`/api/accounts/${account.id}/toggle-inversion`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Failed to toggle inversion status');
      }
      await queryClient.invalidateQueries({ queryKey: ["account-history", account.id] });
      await queryClient.invalidateQueries({ queryKey: ["accounts"] });
      await queryClient.invalidateQueries({ queryKey: ["accountsWithHistory"] });
    } catch (error) {
      console.error('Error toggling inversion status:', error);
      setLocalInvertTransactions(prevValue);
      alert('Failed to toggle transaction sign inversion. Please try again.');
    } finally {
      setIsInverting(false);
    }
  };

  const handleDownload = async () => {
    setIsDownloading(true);

    try {
      const response = await fetch(`/api/accounts/${account.id}/transactions`, {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to sync transactions");
      }

      await queryClient.invalidateQueries({ queryKey: ["account-history", account.id] });
      await queryClient.invalidateQueries({ queryKey: ["accounts"] });
      await queryClient.invalidateQueries({ queryKey: ["accountsWithHistory"] });
      await queryClient.invalidateQueries({ queryKey: ["transactions"] });
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "An error occurred during sync.");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleToggleEmergencyFund = async () => {
    setIsEmergencyLoading(true);
    setEmergencyError(null);
    try {
      const response = await fetch(`/api/accounts/${account.id}/toggle-emergency-fund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ included: !isEmergencyFund }),
      });
      if (!response.ok) throw new Error('Failed to update emergency fund status');
      setIsEmergencyFund(!isEmergencyFund);
    } catch (err) {
      setEmergencyError('Failed to update emergency fund status');
    } finally {
      setIsEmergencyLoading(false);
    }
  };

  // Filter history to only the latest entry per day
  const filteredHistory = history ? Object.values(
    [...history].reduce((acc, item) => {
      const dateKey = new Date(item.date).toISOString().split('T')[0];
      if (!acc[dateKey] || new Date(item.date) > new Date(acc[dateKey].date)) {
        acc[dateKey] = item;
      }
      return acc;
    }, {} as Record<string, typeof history[0]>)) : [];

  // Reverse the data for the chart to show progression over time
  const chartData = {
    labels: [...filteredHistory]
      .reverse()
      .map((item) => format(new Date(item.date), "MMM d, yyyy")),
    datasets: !showSensitiveData
      ? [
          {
            label: "Balance History",
            data: new Array(filteredHistory.length).fill(0),
            borderColor: "rgb(156, 163, 175)",
            backgroundColor: "rgba(156, 163, 175, 0.5)",
            tension: 0.1,
          },
        ]
      : [
          {
            label: "Current Balance",
            data: [...filteredHistory].reverse().map((item) => item.current),
            borderColor: "rgb(59, 130, 246)",
            backgroundColor: "rgba(59, 130, 246, 0.5)",
            tension: 0.1,
          },
          ...(filteredHistory.some((item) => item.available !== null)
            ? [
                {
                  label: "Available Balance",
                  data: [...filteredHistory].reverse().map((item) => item.available),
                  borderColor: "rgb(34, 197, 94)",
                  backgroundColor: "rgba(34, 197, 94, 0.5)",
                  tension: 0.1,
                },
              ]
            : []),
        ],
  };

  const chartOptions: ChartOptions<"line"> = {
    responsive: true,
    plugins: {
      legend: {
        position: "top" as const,
        labels: {
          color: !showSensitiveData ? "#6b7280" : "#374151",
          usePointStyle: true,
        },
      },
      title: {
        display: true,
        text: "Balance History",
      },
      tooltip: {
        callbacks: {
          label: function (tooltipItem: TooltipItem<"line">) {
            if (!showSensitiveData) return "••••••";
            const label = tooltipItem.dataset.label || "";
            const value = tooltipItem.raw as number;
            return `${label}: $${value.toLocaleString()}`;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: false,
        ticks: {
          callback: function (value) {
            if (!showSensitiveData) return "••••••";
            return `$${value.toLocaleString()}`;
          },
          color: !showSensitiveData ? "#6b7280" : "#374151",
        },
        grid: {
          color: !showSensitiveData ? "#374151" : "#e5e7eb",
        },
      },
      x: {
        ticks: {
          color: !showSensitiveData ? "#6b7280" : "#374151",
        },
        grid: {
          color: !showSensitiveData ? "#374151" : "#e5e7eb",
        },
      },
    },
  };

  // Determine if dark mode is active for chart colors
  const isDarkMode = typeof window !== 'undefined' && document.documentElement.classList.contains('dark');
  
  // Update chart colors for dark mode
  if (isDarkMode) {
    chartOptions.plugins!.legend!.labels!.color = "rgb(156, 163, 175)"; // dark:text-gray-400
    chartOptions.scales!.y!.ticks!.color = "rgb(156, 163, 175)"; // dark:text-gray-400
    chartOptions.scales!.x!.ticks!.color = "rgb(156, 163, 175)"; // dark:text-gray-400
  }

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-[400px] bg-gray-100 rounded"></div>
        </div>
      </div>
    );
  }

  if (!history?.length) {
    return (
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Grid container for top cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Institution and Account Info Card */}
          <div className="card flex flex-col">
            <div className="flex items-start gap-4">
              {showSensitiveData && account.plaidItem.institutionLogo ? (
                <InstitutionLogo
                  src={account.plaidItem.institutionLogo}
                  alt={account.plaidItem.institutionName || "Bank logo"}
                  className="w-12 h-12 object-contain"
                  fallbackIcon={<BuildingLibraryIcon className="w-12 h-12 text-gray-400" />}
                />
              ) : (
                <BuildingLibraryIcon className="w-12 h-12 text-gray-400" />
              )}
              <div className="flex-grow">
                <div className="text-sm text-surface-600 dark:text-gray-400">
                  {showSensitiveData ? account.plaidItem.institutionName : "••••••••••"}
                </div>
                <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-dark-900">
                  {showSensitiveData ? account.name : "••••••••••"}
                </h1>
                <div className="flex items-center text-surface-600 dark:text-gray-400">
                  <span className="mr-2">{showSensitiveData ? (account.nickname || "No nickname") : "••••••••••"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Account Settings Card */}
          <div className="card flex flex-col">
            <h2 className="text-lg font-semibold text-surface-600 dark:text-gray-200 mb-4">
              Account Settings
            </h2>
            <div className="space-y-3">
              <button
                onClick={handleDownload}
                disabled={isDownloading}
                className="w-full px-4 py-3 bg-primary-600 dark:bg-primary-500 text-white rounded hover:bg-primary-700 dark:hover:bg-primary-400 transition-colors touch-manipulation disabled:opacity-50"
                style={{ minHeight: '44px' }}
              >
                {isDownloading ? (
                  <ArrowPathIcon className="w-5 h-5 animate-spin" />
                ) : (
                  <ArrowDownTrayIcon className="w-5 h-5" />
                )}
                <span className="ml-2">
                  {isDownloading ? "Downloading..." : "Download Transactions"}
                </span>
              </button>
              
              <button
                onClick={handleToggleInversion}
                disabled={isInverting}
                className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 text-surface-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors touch-manipulation disabled:opacity-50"
                style={{ minHeight: '44px' }}
              >
                {isInverting ? (
                  <ArrowPathIcon className="w-5 h-5 animate-spin" />
                ) : (
                  <ArrowPathIcon className="w-5 h-5" />
                )}
                <span className="ml-2">
                  {isInverting ? "Updating..." : `Toggle Transaction Sign (${localInvertTransactions ? "Inverted" : "Normal"})`}
                </span>
              </button>
              <div className="flex justify-between items-center py-3">
                <div>
                  <span className="font-medium text-surface-700 dark:text-gray-300">Include in Emergency Fund</span>
                  <p className="text-sm text-surface-600 dark:text-gray-400">
                    {account.type === 'depository' && account.subtype && ['checking', 'savings', 'money market', 'paypal', 'cash management', 'ebt', 'prepaid'].includes(account.subtype.toLowerCase())
                      ? "Include this account's balance in emergency fund calculations."
                      : "Only truly liquid accounts (checking, savings, money market, PayPal, etc.) can be included in emergency fund calculations. CDs and other time-locked accounts are excluded."
                    }
                  </p>
                </div>
                <button
                  onClick={handleToggleEmergencyFund}
                  disabled={isEmergencyLoading || isEmergencyFund === null || !(account.type === 'depository' && account.subtype && ['checking', 'savings', 'money market', 'paypal', 'cash management', 'ebt', 'prepaid'].includes(account.subtype.toLowerCase()))}
                  className={`relative inline-flex flex-shrink-0 h-7 w-12 border-2 border-transparent rounded-full transition-colors ease-in-out duration-200 focus:outline-none ${
                    !(account.type === 'depository' && account.subtype && ['checking', 'savings', 'money market', 'paypal', 'cash management', 'ebt', 'prepaid'].includes(account.subtype.toLowerCase()))
                      ? "bg-gray-300 dark:bg-gray-600 cursor-not-allowed opacity-50"
                      : isEmergencyFund 
                        ? "bg-primary-600 cursor-pointer" 
                        : "bg-gray-200 dark:bg-gray-700 cursor-pointer"
                  }`}
                  title={!(account.type === 'depository' && account.subtype && ['checking', 'savings', 'money market', 'paypal', 'cash management', 'ebt', 'prepaid'].includes(account.subtype.toLowerCase())) ? "Only truly liquid accounts can be included in emergency fund" : undefined}
                >
                  <span
                    aria-hidden="true"
                    className={`inline-block h-6 w-6 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200 ${
                      isEmergencyFund
                        ? "translate-x-5"
                        : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
              {emergencyError && <div className="text-xs text-red-500 mt-1">{emergencyError}</div>}
            </div>
          </div>
        </div>

        {/* No History Message */}
        <div className="card">
          <div className="text-center py-12">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-gray-100 dark:bg-gray-800 mb-4">
              <svg
                className="h-6 w-6 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No Balance History Found
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
              This account doesn't have any balance history yet. You can either refresh the account data or manually add an initial balance.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={handleDownload}
                disabled={isDownloading}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
              >
                {isDownloading ? (
                  <ArrowPathIcon className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <ArrowDownTrayIcon className="w-4 h-4 mr-2" />
                )}
                {isDownloading ? "Downloading..." : "Download Transactions"}
              </button>
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                <ArrowPathIcon className="w-4 h-4 mr-2" />
                Refresh Page
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Grid container for top cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Institution and Account Info Card */}
        <div className="card flex flex-col">
          <div className="flex items-start gap-4">
            {showSensitiveData && account.plaidItem.institutionLogo ? (
              <InstitutionLogo
                src={account.plaidItem.institutionLogo}
                alt={account.plaidItem.institutionName || "Bank logo"}
                className="w-12 h-12 object-contain"
                fallbackIcon={<BuildingLibraryIcon className="w-12 h-12 text-gray-400" />}
              />
            ) : (
              <BuildingLibraryIcon className="w-12 h-12 text-gray-400" />
            )}
            <div className="flex-grow">
              <div className="text-sm text-surface-600 dark:text-gray-400">
                {showSensitiveData ? account.plaidItem.institutionName : "••••••••••"}
              </div>
              <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-dark-900">
                {showSensitiveData ? account.name : "••••••••••"}
              </h1>
              <div className="flex items-center text-surface-600 dark:text-gray-400">
                {isEditing ? (
                  <div className="flex items-center">
                    <input
                      type="text"
                      value={newNickname}
                      onChange={(e) => setNewNickname(e.target.value)}
                      onKeyDown={handleKeyDown}
                      ref={inputRef}
                      className="bg-gray-100 dark:bg-zinc-800 border-b-2 border-primary-500 focus:outline-none"
                    />
                  </div>
                ) : (
                  <div className="flex items-center">
                    <span className="mr-2">{showSensitiveData ? (newNickname || "No nickname") : "••••••••••"}</span>
                  </div>
                )}
                <div className="flex">
                  {isEditing ? (
                    <>
                      <button onClick={handleSaveNickname} className="p-1">
                        <CheckIcon className="h-5 w-5 text-green-500" />
                      </button>
                      <button onClick={handleCancelEditing} className="p-1">
                        <XMarkIcon className="h-5 w-5 text-red-500" />
                      </button>
                    </>
                  ) : (
                    <button onClick={handleStartEditing} className="p-1">
                      <PencilIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-zinc-700 flex-grow">
            <div className="text-sm space-y-1">
              <p>
                Current Balance:{" "}
                <span className="font-semibold text-surface-900 dark:text-surface-dark-900">
                  {displayBalance(history?.[0]?.current)}
                </span>
              </p>
              {account.type === 'loan' && account.nextMonthlyPayment && (
                <p>
                  Monthly Payment:{" "}
                  <span className="font-semibold text-surface-900 dark:text-surface-dark-900">
                    {displayBalance(account.nextMonthlyPayment)}
                  </span>
                </p>
              )}
              <p>
                Statement Balance:{" "}
                <span className="font-semibold text-surface-900 dark:text-surface-dark-900">
                  {displayBalance(account.lastStatementBalance || 0)}
                </span>
              </p>
              <p>
                Available Balance:{" "}
                <span className="font-semibold text-surface-900 dark:text-surface-dark-900">
                  {displayBalance(history?.[0]?.available)}
                </span>
              </p>
              {history?.[0]?.limit && (
                <p>
                  Credit Limit:{" "}
                  <span className="font-semibold text-surface-900 dark:text-surface-dark-900">
                    {displayBalance(history?.[0]?.limit)}
                  </span>
                </p>
              )}
            </div>
            {account.mask && (
              <div className="text-sm text-surface-600 dark:text-gray-400 mt-4 pt-4 border-t border-gray-200 dark:border-zinc-700">
                Account ending in {showSensitiveData ? account.mask : "••••"}
              </div>
            )}
          </div>
        </div>
        
        {/* Account Settings Section Card */}
        <div className="card">
          <h3 className="text-lg font-semibold text-surface-600 dark:text-gray-200 mb-4">Account Settings</h3>
          <div className="divide-y divide-gray-200 dark:divide-zinc-700">
            <div className="flex justify-between items-center py-3">
              <div>
                <span className="font-medium text-surface-700 dark:text-gray-300">Invert Transaction Signs</span>
                <p className="text-sm text-surface-600 dark:text-gray-400">Flip positive/negative amounts for this account.</p>
              </div>
              <button
                onClick={handleToggleInversion}
                disabled={isInverting}
                className={`relative inline-flex flex-shrink-0 h-7 w-12 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none ${
                  localInvertTransactions ? "bg-primary-600" : "bg-gray-200 dark:bg-gray-700"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`inline-block h-6 w-6 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200 ${
                    localInvertTransactions
                      ? "translate-x-5"
                      : "translate-x-1"
                  }`}
                />
              </button>
            </div>
            <div className="flex justify-between items-center py-3">
              <div>
                <span className="font-medium text-surface-700 dark:text-gray-300">Sync Transactions</span>
                <p className="text-sm text-surface-600 dark:text-gray-400">Pull the latest transactions for this account.</p>
              </div>
              <button
                onClick={handleDownload}
                disabled={isDownloading}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-primary-600 dark:bg-primary-500 text-white rounded-md hover:bg-primary-700 dark:hover:bg-primary-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
              >
                <ArrowDownTrayIcon className="w-4 h-4" />
                {isDownloading ? "Syncing..." : "Sync"}
              </button>
            </div>
            <div className="flex justify-between items-center py-3">
              <div>
                <span className="font-medium text-surface-700 dark:text-gray-300">Include in Emergency Fund</span>
                <p className="text-sm text-surface-600 dark:text-gray-400">
                  {account.type === 'depository' && account.subtype && ['checking', 'savings', 'money market', 'paypal', 'cash management', 'ebt', 'prepaid'].includes(account.subtype.toLowerCase())
                    ? "Include this account's balance in emergency fund calculations."
                    : "Only truly liquid accounts (checking, savings, money market, PayPal, etc.) can be included in emergency fund calculations. CDs and other time-locked accounts are excluded."
                  }
                </p>
              </div>
              <button
                onClick={handleToggleEmergencyFund}
                disabled={isEmergencyLoading || isEmergencyFund === null || !(account.type === 'depository' && account.subtype && ['checking', 'savings', 'money market', 'paypal', 'cash management', 'ebt', 'prepaid'].includes(account.subtype.toLowerCase()))}
                className={`relative inline-flex flex-shrink-0 h-7 w-12 border-2 border-transparent rounded-full transition-colors ease-in-out duration-200 focus:outline-none ${
                  !(account.type === 'depository' && account.subtype && ['checking', 'savings', 'money market', 'paypal', 'cash management', 'ebt', 'prepaid'].includes(account.subtype.toLowerCase()))
                    ? "bg-gray-300 dark:bg-gray-600 cursor-not-allowed opacity-50"
                    : isEmergencyFund 
                      ? "bg-primary-600 cursor-pointer" 
                      : "bg-gray-200 dark:bg-gray-700 cursor-pointer"
                }`}
                title={!(account.type === 'depository' && account.subtype && ['checking', 'savings', 'money market', 'paypal', 'cash management', 'ebt', 'prepaid'].includes(account.subtype.toLowerCase())) ? "Only truly liquid accounts can be included in emergency fund" : undefined}
              >
                <span
                  aria-hidden="true"
                  className={`inline-block h-6 w-6 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200 ${
                    isEmergencyFund
                      ? "translate-x-5"
                      : "translate-x-1"
                  }`}
                />
              </button>
            </div>
            {emergencyError && (
              <div className="py-2">
                <div className="text-xs text-red-500">{emergencyError}</div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Balance History Section */}
      <div className="card">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-surface-600 dark:text-gray-200">
            Balance History
          </h2>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleBackfill}
              className="px-4 py-3 bg-primary-600 dark:bg-primary-500 text-white rounded hover:bg-primary-700 dark:hover:bg-primary-400 transition-colors touch-manipulation"
              style={{ minHeight: '44px' }}
              title="Fill in missing monthly data points"
            >
              Backfill Data
            </button>
            <button
              onClick={handleCleanDailyRecords}
              className="px-4 py-3 text-sm bg-gray-100 dark:bg-gray-700 text-surface-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors touch-manipulation"
              style={{ minHeight: '44px' }}
              title="Keep only the most recent record for each day"
            >
              Clean Daily
            </button>
            <button
              onClick={handleCleanMonthlyRecords}
              className="px-4 py-3 text-sm bg-gray-100 dark:bg-gray-700 text-surface-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors touch-manipulation"
              style={{ minHeight: '44px' }}
              title="Keep only the most recent record for each month"
            >
              Clean Monthly
            </button>
          </div>
        </div>

        <Line options={chartOptions} data={chartData} />

        <div className="mt-6">
          <div
            className="flex justify-between items-center px-6 py-4 bg-gray-50 dark:bg-[rgb(46,46,46)] border-y border-gray-200 dark:border-zinc-700 cursor-pointer touch-manipulation hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors"
            onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
            style={{ minHeight: '44px' }}
          >
            <h3 className="text-sm font-medium text-surface-600 dark:text-gray-400">
              Balance History Records
            </h3>
            {isHistoryExpanded ? (
              <ChevronUpIcon className="w-6 h-6 text-surface-600 dark:text-gray-400" />
            ) : (
              <ChevronDownIcon className="w-6 h-6 text-surface-600 dark:text-gray-400" />
            )}
          </div>

          {isHistoryExpanded && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-700">
                <thead className="bg-gray-50 dark:bg-[rgb(46,46,46)]">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-surface-600 dark:text-gray-400 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-surface-600 dark:text-gray-400 uppercase tracking-wider">
                      Current Balance
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-surface-600 dark:text-gray-400 uppercase tracking-wider">
                      Available Balance
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-surface-600 dark:text-gray-400 uppercase tracking-wider">
                      Credit Limit
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-surface-600 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-zinc-900 divide-y divide-gray-200 dark:divide-zinc-700">
                  {filteredHistory.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800">
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-surface-600 dark:text-gray-400">
                        {new Date(item.date).toLocaleDateString()}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-surface-900 dark:text-surface-dark-900 font-semibold">
                        {displayBalance(item.current)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-surface-600 dark:text-gray-400">
                        {displayBalance(item.available)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-surface-600 dark:text-gray-400">
                        {displayBalance(item.limit)}
                      </td>
                      <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteBalance(item.id);
                          }}
                          className="text-pink-500 hover:text-pink-600 dark:text-pink-400 dark:hover:text-pink-300 transition-colors touch-manipulation p-2 rounded"
                          style={{ minHeight: '44px', minWidth: '44px' }}
                          title="Delete record"
                        >
                          <TrashIcon className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <TransactionList
        accountId={account.id}
        initialTransactions={account.transactions}
        downloadLogs={account.downloadLogs}
      />
    </div>
  );
}
