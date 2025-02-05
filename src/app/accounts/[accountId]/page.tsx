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
import { use } from "react";

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

  const { data: history, isLoading } = useQuery<BalanceHistory[]>({
    queryKey: ["account-history", resolvedParams.accountId],
    queryFn: async () => {
      const response = await fetch(
        `/api/accounts/${resolvedParams.accountId}/history`
      );
      if (!response.ok) throw new Error("Failed to fetch account history");
      return response.json();
    },
  });

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

  const chartData = {
    labels: history.map((item) => format(new Date(item.date), "MMM d, yyyy")),
    datasets: [
      {
        label: "Current Balance",
        data: history.map((item) => item.current),
        borderColor: "rgb(59, 130, 246)",
        backgroundColor: "rgba(59, 130, 246, 0.5)",
        tension: 0.1,
      },
      ...(history.some((item) => item.available !== null)
        ? [
            {
              label: "Available Balance",
              data: history.map((item) => item.available),
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
          <h1 className="text-3xl font-bold mb-2">{history[0].account.name}</h1>
          <p className="text-gray-600">
            {history[0].account.type}
            {history[0].account.subtype && ` - ${history[0].account.subtype}`}
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
