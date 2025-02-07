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
} from "chart.js";
import { format } from "date-fns";
import Link from "next/link";
import { use, useState, useRef, useEffect } from "react";
import { PencilIcon, CheckIcon, XMarkIcon } from "@heroicons/react/24/solid";

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

export default function AccountPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const resolvedParams = use(params);
  const [isEditing, setIsEditing] = useState(false);
  const [newNickname, setNewNickname] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    data: history,
    isLoading,
    refetch,
  } = useQuery<BalanceHistory[]>({
    queryKey: ["account-history", resolvedParams.accountId],
    queryFn: async () => {
      const response = await fetch(
        `/api/accounts/${resolvedParams.accountId}/history`
      );
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
        `/api/accounts/${resolvedParams.accountId}/update-nickname`,
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

  if (isLoading) {
    return (
      <div className="min-h-screen p-8">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="h-[400px] bg-gray-100 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!history?.length) {
    return (
      <div className="min-h-screen p-8">
        <div className="max-w-7xl mx-auto">
          <p>No history found for this account.</p>
        </div>
      </div>
    );
  }

  // Reverse the data for the chart to show progression over time
  const chartData = {
    labels: [...history]
      .reverse()
      .map((item) => format(new Date(item.date), "MMM d, yyyy")),
    datasets: [
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

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: "top" as const,
      },
      title: {
        display: true,
        text: "Balance History",
      },
    },
    scales: {
      y: {
        beginAtZero: false,
      },
    },
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <Link
            href="/"
            className="text-blue-600 hover:text-blue-800 mb-4 inline-block"
          >
            ← Back to Dashboard
          </Link>
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
          <p className="text-gray-600 mt-1">
            {history?.[0].account.type}
            {history?.[0].account.subtype && ` - ${history[0].account.subtype}`}
          </p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md mb-8">
          <Line options={chartOptions} data={chartData} />
        </div>

        <div className="bg-white rounded-lg shadow-md overflow-hidden">
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
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {history.map((item) => (
                <tr key={item.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {format(new Date(item.date), "MMM d, yyyy h:mm a")}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${item.current.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item.available ? `$${item.available.toFixed(2)}` : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
