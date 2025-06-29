"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bar, Pie } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
  ArcElement,
} from "chart.js";
import { Cog6ToothIcon, ArrowPathIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { TransactionChartSettings } from "./TransactionChartSettings";
import type {
  TransactionChartSettings as Settings,
  TransactionChartData,
} from "@/types/transactionChart";
import {
  loadSettings,
  saveSettings,
  buildApiUrl,
} from "@/lib/transactionChartSettings";
import type { ChartData } from "chart.js";
import { useTheme } from "@/app/providers";
import { useSensitiveData } from "@/app/providers";
import { CategoryTransactionsList } from "./CategoryTransactionsList";

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

interface TransactionChartProps {}

export function TransactionChart({}: TransactionChartProps) {
  const { showSensitiveData } = useSensitiveData();
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const { darkMode } = useTheme();
  const queryClient = useQueryClient();
  const [useGranularCategories, setUseGranularCategories] = useState(true);

  // Fetch transaction data
  const { data, isLoading, error } = useQuery<TransactionChartData>({
    queryKey: ["transactionChart", settings],
    queryFn: async () => {
      const url = buildApiUrl(settings);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Failed to fetch transaction data");
      }
      return response.json();
    },
    enabled: true,
  });

  // Fetch vendor spend data
  const {
    data: vendorData,
    isLoading: isVendorsLoading,
    error: vendorError,
  } = useQuery({
    queryKey: ["vendorSpend", settings],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("period", settings.period);
      if (settings.selectedAccountIds.length > 0) {
        params.set("accountIds", settings.selectedAccountIds.join(","));
      }
      if (settings.startDate) {
        params.set("startDate", settings.startDate.toISOString().split('T')[0]);
      }
      if (settings.endDate) {
        params.set("endDate", settings.endDate.toISOString().split('T')[0]);
      }
      params.set("limit", "25");
      const url = `/api/transactions/vendors?${params.toString()}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Failed to fetch vendor data");
      }
      return response.json();
    },
    enabled: true,
  });

  const {
    data: allTxData,
    isLoading: isAllTxLoading,
    error: allTxError,
  } = useQuery({
    queryKey: ["allTransactionsForAI", settings],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("limit", "1000");
      if (settings.selectedAccountIds.length > 0) {
        params.set("accountIds", settings.selectedAccountIds.join(","));
      }
      if (settings.startDate) {
        params.set("startDate", settings.startDate.toISOString().split('T')[0]);
      }
      if (settings.endDate) {
        params.set("endDate", settings.endDate.toISOString().split('T')[0]);
      }
      if (settings.categories.length > 0) {
        params.set("categories", settings.categories.join(","));
      }
      if (settings.minAmount !== undefined) {
        params.set("minAmount", settings.minAmount.toString());
      }
      if (settings.maxAmount !== undefined) {
        params.set("maxAmount", settings.maxAmount.toString());
      }
      const url = `/api/transactions/for-ai?${params.toString()}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Failed to fetch transactions for AI");
      }
      return response.json();
    },
    enabled: true,
  });

  const [aiCategoryTotals, setAiCategoryTotals] = useState<
    Record<string, number>
  >({});
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiCompleted, setAiCompleted] = useState(false);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  const handleSettingsChange = (newSettings: Settings) => {
    setSettings(newSettings);
  };

  const formatCurrency = (amount: number) => {
    return showSensitiveData ? `$${amount.toLocaleString()}` : "••••••";
  };

  const triggerAICategorization = async () => {
    if (!allTxData || !allTxData.transactions) return;
    setAiLoading(true);
    setAiError(null);
    try {
      await fetch("/api/ai/categorize-transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactions: allTxData.transactions, force: true }),
      });
      await queryClient.invalidateQueries({
        queryKey: ["allTransactionsForAI"],
      });
    } catch (err) {
      setAiError("Failed to trigger AI categorization.");
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => {
    if (isAllTxLoading) {
      setAiLoading(true);
      return;
    }

    if (allTxData && allTxData.transactions) {
      const totals: Record<string, number> = {};
      allTxData.transactions.forEach((t: any) => {
        // Use the new AI category fields, fallback to Plaid category if AI not available
        const category = useGranularCategories 
          ? (t.categoryAiGranular || t.categoryAiGeneral || t.category || "Miscellaneous")
          : (t.categoryAiGeneral || t.categoryAiGranular || t.category || "Miscellaneous");
        totals[category] = (totals[category] || 0) + Math.abs(t.amount);
      });
      setAiCategoryTotals(totals);
    } else {
      setAiCategoryTotals({});
    }

    setAiLoading(false);
    setAiCompleted(true);

    if (allTxError) {
      setAiError("Failed to load transactions for AI categorization.");
    }
  }, [allTxData, isAllTxLoading, allTxError, useGranularCategories]);

  // Check if we need to trigger AI categorization
  useEffect(() => {
    if (allTxData && allTxData.transactions && !aiLoading && !aiCompleted) {
      // Check if any transactions have AI categories
      const hasAiCategories = allTxData.transactions.some((t: any) => 
        t.categoryAiGranular || t.categoryAiGeneral
      );
      
      if (!hasAiCategories && allTxData.transactions.length > 0) {
        triggerAICategorization();
      }
    }
  }, [allTxData, aiLoading, aiCompleted]);

  const chartColors = useMemo(
    () => [
      "#f472b6", "#60a5fa", "#a78bfa", "#34d399", "#fbbf24",
      "#f87171", "#38bdf8", "#facc15", "#a3e635",
    ],
    []
  );

  // Filtered AI category totals for spend only
  const spendCategories = [
    "Rent/Mortgage", "Home Maintenance", "Electricity", "Water/Sewer", "Gas Utility", "Internet", "Cell Phone", "Streaming Services", "Groceries", "Fast Food", "Restaurants", "Coffee Shops", "Alcohol/Bars", "Gas Station", "Public Transit", "Ride Sharing (Uber/Lyft)", "Car Payment", "Car Insurance", "Parking", "Flights", "Hotels", "Vacation Rental", "Online Shopping", "Clothing", "Electronics", "Beauty/Personal Care", "Gym/Fitness", "Medical Expenses", "Health Insurance", "Pharmacy", "Subscriptions", "Childcare", "Tuition", "Student Loans", "Books & Supplies", "Fees & Charges", "Gifts", "Donations", "Pets", "Hobbies", "Games"
  ];
  const filteredAiCategoryTotals = aiCategoryTotals;

  const aiPieData: ChartData<"pie"> = useMemo(() => {
    const sortedCategories = Object.entries(filteredAiCategoryTotals).sort(
      ([, a], [, b]) => b - a
    );
    const labels = sortedCategories.map(([name]) => name);
    const data = sortedCategories.map(([, total]) => total);
    return {
      labels,
      datasets: [
        {
          data,
          backgroundColor: chartColors,
        },
      ],
    };
  }, [filteredAiCategoryTotals, chartColors]);

  const vendorBarData: ChartData<"bar"> = useMemo(() => {
    if (!vendorData || !vendorData.vendors)
      return { labels: [], datasets: [] };

    const sortedVendors = [...vendorData.vendors].sort(
      (a: any, b: any) => b.total_spend - a.total_spend
    );
    return {
      labels: sortedVendors.map((v: any) => showSensitiveData ? v.vendor : "••••••••••"),
      datasets: [
        {
          label: "Spend",
          data: sortedVendors.map((v: any) => v.total),
          backgroundColor: sortedVendors.map((v: any, i: number) =>
            v.vendor === "Other"
              ? "#a1a1aa"
              : chartColors[i % chartColors.length]
          ),
        },
      ],
    };
  }, [vendorData, chartColors, showSensitiveData]);

  // Define a default font object for Chart.js
  const defaultFont = { size: 12, weight: 400, family: 'inherit' };

  const barChartOptions: ChartOptions<"bar"> = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top" as const,
        labels: {
          color: darkMode ? "#9ca3af" : "#374151",
          font: { ...defaultFont },
          boxWidth: 12,
          padding: 20,
        },
      },
      title: {
        display: false,
        color: darkMode ? "#9ca3af" : "#374151",
        font: { ...defaultFont },
      },
      tooltip: {
        backgroundColor: darkMode ? "#232323" : "#ffffff",
        titleColor: darkMode ? "#9ca3af" : "#374151",
        bodyColor: darkMode ? "#9ca3af" : "#374151",
        padding: 10,
        boxPadding: 4,
        titleFont: { ...defaultFont },
        bodyFont: { ...defaultFont },
        callbacks: {
          label: function (context) {
            const label = context.dataset.label || "";
            const value = context.raw as number;
            return `${label}: ${formatCurrency(value)}`;
          },
        },
      },
    },
    layout: {
      padding: {
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          color: darkMode ? "#9ca3af" : "#374151",
          font: { ...defaultFont },
          callback: function (value) {
            return formatCurrency(value as number);
          },
        },
        grid: {
          color: darkMode ? "rgba(229,231,235,0.15)" : "rgba(0,0,0,0.1)",
        },
      },
      x: {
        ticks: {
          color: darkMode ? "#9ca3af" : "#374151",
          font: { ...defaultFont },
        },
        grid: {
          color: darkMode ? "rgba(229,231,235,0.15)" : "rgba(0,0,0,0.1)",
          display: false,
        },
      },
    },
  }), [darkMode, showSensitiveData]);

  const pieChartOptions: ChartOptions<"pie"> = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    onClick: (event, elements) => {
      if (elements.length > 0 && aiPieData.labels) {
        const index = elements[0].index;
        const category = aiPieData.labels[index];
        if (typeof category === 'string') {
          setSelectedCategory(category);
        }
      }
    },
    plugins: {
      legend: {
        position: 'right' as const,
        labels: {
          color: darkMode ? "#9ca3af" : "#374151",
          font: { ...defaultFont },
          boxWidth: 12,
          padding: 15,
        },
        align: 'start',
      },
      tooltip: {
        backgroundColor: darkMode ? "#232323" : "#ffffff",
        titleColor: darkMode ? "#9ca3af" : "#374151",
        bodyColor: darkMode ? "#9ca3af" : "#374151",
        titleFont: { ...defaultFont },
        bodyFont: { ...defaultFont },
        padding: 10,
        boxPadding: 4,
        callbacks: {
          label: function (context) {
            let label = context.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed !== null) {
              if (showSensitiveData) {
                label += new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(context.parsed);
              } else {
                label += "••••••";
              }
            }
            return label;
          }
        }
      }
    }
  }), [darkMode, showSensitiveData, aiPieData.labels]);
  
  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error loading transaction data.</div>;
  if (!data) return <div>No data available.</div>;

  const chartData = {
    labels: data.data.map((item) => item.period),
    datasets: [
      ...(settings.showIncome
        ? [
            {
              label: "Income",
              data: data.data.map((item) => item.income),
              backgroundColor: "rgba(34, 197, 94, 0.7)",
            },
          ]
        : []),
      ...(settings.showExpenses
        ? [
            {
              label: "Expenses",
              data: data.data.map((item) => item.expenses),
              backgroundColor: "rgba(236, 72, 153, 0.7)",
            },
          ]
        : []),
    ],
  };

  const summary = data.summary;
  const selectedAccountsCount = settings.selectedAccountIds.length;
  const totalAccountsCount = data.accounts.length;

  return (
    <>
      {isSettingsOpen && (
        <TransactionChartSettings
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          settings={settings}
          onSettingsChange={handleSettingsChange}
          accounts={data?.accounts || []}
          categories={data?.categories || []}
        />
      )}
      <div className="bg-white p-6 rounded-lg shadow-md h-[400px] flex flex-col dark:bg-zinc-900 dark:text-gray-100">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold dark:text-gray-100">Transaction Overview</h2>
            <p className="text-sm dark:text-gray-100">
              Transaction analytics
              {selectedAccountsCount > 0 && (
                <span>
                  {" "}
                  • {selectedAccountsCount}/{totalAccountsCount} accounts
                </span>
              )}
            </p>
          </div>
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="text-gray-400 hover:text-gray-600 dark:text-gray-100 dark:hover:text-gray-100 transition-colors p-1 rounded"
          >
            <Cog6ToothIcon className="w-5 h-5" />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center">
            <p className="text-sm dark:text-gray-100">Total Income</p>
            <p className="text-lg font-semibold text-green-600 dark:text-green-400">
              {formatCurrency(summary.totalIncome)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm dark:text-gray-100">Total Expenses</p>
            <p className="text-lg font-semibold text-pink-500 dark:text-pink-400">
              {formatCurrency(summary.totalExpenses)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm dark:text-gray-100">Net</p>
            <p
              className={`text-lg font-semibold ${
                summary.netAmount >= 0 ? "text-green-600 dark:text-green-400" : "text-pink-500 dark:text-pink-400"
              }`}
            >
              {formatCurrency(summary.netAmount)}
            </p>
          </div>
        </div>
        <div className="flex-1 min-h-0">
          <Bar key={darkMode ? 'dark' : 'light'} options={barChartOptions} data={chartData} />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 mt-6">
        <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-md p-4 flex flex-col items-center h-[400px] dark:text-gray-100">
          <h3 className="text-md font-semibold mb-2 dark:text-gray-100">Top Vendors (by Spend)</h3>
          {isVendorsLoading ? (
            <div className="dark:text-gray-100">Loading...</div>
          ) : vendorError ? (
            <div className="dark:text-gray-100">Error loading vendors.</div>
          ) : (
            <div className="w-full flex-1 min-h-0">
              <Bar
                key={(darkMode ? 'dark' : 'light') + '-vendors'}
                options={barChartOptions}
                data={vendorBarData}
              />
            </div>
          )}
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-md p-4 flex flex-col items-center h-[400px] dark:text-gray-100">
          <div className="flex justify-between w-full items-center">
            <h3 className="text-md font-semibold mb-2 dark:text-gray-100">AI-Powered Categories</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={triggerAICategorization}
                disabled={aiLoading}
                className="p-1 rounded-md hover:bg-gray-100 dark:bg-zinc-800 disabled:opacity-50 text-gray-400 dark:text-gray-100"
                title="Refresh AI Categories"
              >
                <ArrowPathIcon
                  className={`h-4 w-4 ${aiLoading ? "animate-spin" : ""}`}
                />
              </button>
              <div className="flex gap-1 ml-2">
                <div className="border-l border-gray-300 dark:border-zinc-700 mx-1"></div>
                <button
                  className={`px-2 py-1 rounded text-xs font-medium border ${useGranularCategories ? 'bg-purple-600 text-white border-purple-600' : 'bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-zinc-700'}`}
                  onClick={() => setUseGranularCategories(true)}
                >
                  Granular
                </button>
                <button
                  className={`px-2 py-1 rounded text-xs font-medium border ${!useGranularCategories ? 'bg-purple-600 text-white border-purple-600' : 'bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-zinc-700'}`}
                  onClick={() => setUseGranularCategories(false)}
                >
                  General
                </button>
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Click any slice to view transactions below</p>
          {aiLoading && !aiCompleted ? (
            <div className="dark:text-gray-100">Categorizing...</div>
          ) : aiError ? (
            <div className="dark:text-gray-100">{aiError}</div>
          ) : Object.keys(filteredAiCategoryTotals).length === 0 ? (
            <div className="dark:text-gray-100">No spend data available for categorization.</div>
          ) : (
            <div className="w-full flex-1 min-h-0 cursor-pointer">
              <Pie key={darkMode ? 'dark' : 'light'} data={aiPieData} options={pieChartOptions} />
            </div>
          )}
        </div>
        
        {/* Category Transactions Card */}
        <div
          className={`transition-all duration-500 ease-in-out overflow-hidden ${
            selectedCategory
              ? "max-h-[1000px] opacity-100"
              : "max-h-0 opacity-0"
          }`}
        >
          {selectedCategory && (
            <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-md p-4 mt-6 dark:text-gray-100">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold dark:text-gray-100">
                  {selectedCategory} Transactions
                </h3>
                <button
                  onClick={() => setSelectedCategory("")}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  aria-label="Close transactions view"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>

              <CategoryTransactionsList
                category={selectedCategory}
                dateRange={{
                  startDate: settings.startDate,
                  endDate: settings.endDate,
                }}
                accountIds={settings.selectedAccountIds}
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
} 
