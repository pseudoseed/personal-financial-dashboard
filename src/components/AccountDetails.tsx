"use client";

import { useQuery } from "@tanstack/react-query";
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
  LockOpenIcon,
  LockClosedIcon,
  TrashIcon,
} from "@heroicons/react/24/solid";
import { TransactionList } from "@/components/TransactionList";
import {
  Account,
  PlaidItem,
  Transaction,
  TransactionDownloadLog,
} from "@prisma/client";

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
  const [isEditing, setIsEditing] = useState(false);
  const [newNickname, setNewNickname] = useState("");
  const [isMasked, setIsMasked] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const formatBalance = (amount: number | null) => {
    if (amount === null) return "-";
    return isMasked ? "••••••" : `$${amount.toFixed(2)}`;
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
    if (!confirm("Are you sure you want to backfill missing monthly data?")) {
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
      <div className="max-w-7xl mx-auto">
        <p>No history found for this account.</p>
      </div>
    );
  }

  // Reverse the data for the chart to show progression over time
  const chartData = {
    labels: [...history]
      .reverse()
      .map((item) => format(new Date(item.date), "MMM d, yyyy")),
    datasets: isMasked
      ? [
          {
            label: "Balance History",
            data: new Array(history.length).fill(0),
            borderColor: "rgb(156, 163, 175)",
            backgroundColor: "rgba(156, 163, 175, 0.5)",
            tension: 0.1,
          },
        ]
      : [
          {
            label: "Current Balance",
            data: [...history].reverse().map((item) => item.current),
            borderColor: "rgb(59, 130, 246)",
            backgroundColor: "rgba(59, 130, 246, 0.5)",
            tension: 0.1,
          },
          ...(history.some((item) => item.available !== null)
            ? [
                {
                  label: "Available Balance",
                  data: [...history].reverse().map((item) => item.available),
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
      },
      title: {
        display: true,
        text: "Balance History",
      },
      tooltip: {
        callbacks: {
          label: function (tooltipItem: TooltipItem<"line">) {
            if (isMasked) return "••••••";
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
            if (isMasked) return "••••••";
            return `$${value.toLocaleString()}`;
          },
        },
      },
    },
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-2">
          {isEditing ? (
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={newNickname}
                onChange={(e) => setNewNickname(e.target.value)}
                onKeyDown={handleKeyDown}
                className="text-3xl font-bold px-2 py-1 border rounded"
                placeholder={history?.[0].account.name}
              />
              <button
                onClick={handleSaveNickname}
                className="p-2 text-green-600 hover:text-green-700"
                title="Save nickname"
              >
                <CheckIcon className="w-6 h-6" />
              </button>
              <button
                onClick={handleCancelEditing}
                className="p-2 text-red-600 hover:text-red-700"
                title="Cancel"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold">
                {history?.[0].account.nickname || history?.[0].account.name}
                {history?.[0].account.nickname && (
                  <span className="text-gray-500 text-lg ml-2">
                    ({history[0].account.name})
                  </span>
                )}
              </h1>
              <button
                onClick={handleStartEditing}
                className="p-2 text-gray-400 hover:text-gray-600"
                title="Edit nickname"
              >
                <PencilIcon className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMasked(!isMasked)}
            className="p-2 text-gray-600 hover:text-gray-800"
            title={
              isMasked
                ? "Show sensitive information"
                : "Hide sensitive information"
            }
          >
            {isMasked ? (
              <LockClosedIcon className="w-5 h-5" />
            ) : (
              <LockOpenIcon className="w-5 h-5" />
            )}
          </button>
          <button
            onClick={handleBackfill}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            title="Fill in missing monthly data points"
          >
            Backfill Data
          </button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md">
        <Line options={chartOptions} data={chartData} />
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900">
              Balance History
            </h2>
            <div className="flex gap-2">
              <button
                onClick={handleCleanDailyRecords}
                className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                title="Keep only the most recent record for each day"
              >
                Clean Daily Records
              </button>
              <button
                onClick={handleCleanMonthlyRecords}
                className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                title="Keep only the most recent record for each month"
              >
                Clean Monthly Records
              </button>
            </div>
          </div>
        </div>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Current Balance
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Available Balance
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {history.map((item) => (
              <tr key={item.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {format(new Date(item.date), "MMM d, yyyy h:mm a")}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatBalance(item.current)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatBalance(item.available)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  <button
                    onClick={() => handleDeleteBalance(item.id)}
                    className="text-red-600 hover:text-red-800 transition-colors"
                    title="Delete record"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <TransactionList
        accountId={account.id}
        initialTransactions={account.transactions}
        downloadLogs={account.downloadLogs}
      />
    </div>
  );
}
