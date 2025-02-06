"use client";

import Link from "next/link";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/solid";
import { useState } from "react";

interface AccountCardProps {
  id: string;
  name: string;
  type: string;
  subtype: string | null;
  mask: string | null;
  institution: string;
  institutionLogo: string | null;
  balance: {
    current: number;
    available: number | null;
    limit: number | null;
  };
  onBalanceUpdate?: () => void;
}

export function AccountCard({
  id,
  name,
  type,
  subtype,
  mask,
  balance,
  institution,
  institutionLogo,
  onBalanceUpdate,
}: AccountCardProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastChange, setLastChange] = useState<number | null>(null);

  const isNegative = balance.current < 0;
  const isCredit = type.toLowerCase() === "credit";
  const utilization =
    isCredit && balance.limit
      ? (Math.abs(balance.current) / balance.limit) * 100
      : null;

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      const response = await fetch(`/api/accounts/${id}/refresh`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to refresh account");
      }

      const data = await response.json();
      setLastChange(data.change);

      // Call the parent's update function if provided
      if (onBalanceUpdate) {
        onBalanceUpdate();
      }
    } catch (error) {
      console.error("Error refreshing account:", error);
    } finally {
      setIsRefreshing(false);
      // Clear the change indicator after 5 seconds
      setTimeout(() => setLastChange(null), 5000);
    }
  };

  return (
    <div className="relative">
      <Link
        href={`/accounts/${id}`}
        className="block transition-transform hover:scale-102"
      >
        <div className="p-4 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow">
          <div className="flex justify-between items-start mb-2">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                {institutionLogo && (
                  <img
                    src={institutionLogo}
                    alt={institution}
                    className="w-6 h-6 object-contain"
                  />
                )}
                <h3 className="text-lg font-semibold truncate">{name}</h3>
              </div>
              <p className="text-sm text-gray-600">
                {type} {subtype && `- ${subtype}`}
              </p>
              {mask && <p className="text-sm text-gray-600">****{mask}</p>}
            </div>
            <div className="text-right">
              <p
                className={`text-xl font-bold ${
                  isNegative ? "text-red-600" : "text-gray-900"
                }`}
              >
                $
                {Math.abs(balance.current).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
              {balance.available !== null && (
                <p className="text-sm text-gray-600">
                  Available: $
                  {balance.available.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              )}
              {lastChange !== null && (
                <p
                  className={`text-sm ${
                    lastChange >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {lastChange >= 0 ? "+" : ""}$
                  {lastChange.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              )}
            </div>
          </div>

          {isCredit && balance.limit && (
            <div className="mt-2">
              <div className="flex justify-between text-xs text-gray-600 mb-1">
                <span>Credit Used</span>
                <span>{utilization?.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    utilization && utilization > 70
                      ? "bg-red-500"
                      : "bg-green-500"
                  }`}
                  style={{ width: `${Math.min(utilization || 0, 100)}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-600 mt-1">
                Limit: ${balance.limit.toLocaleString()}
              </p>
            </div>
          )}
        </div>
      </Link>
      <button
        onClick={(e) => {
          e.preventDefault();
          handleRefresh();
        }}
        disabled={isRefreshing}
        className="absolute top-2 right-2 p-1 rounded-full hover:bg-gray-100 transition-colors"
      >
        <ArrowPathIcon
          className={`w-5 h-5 text-gray-500 ${
            isRefreshing ? "animate-spin" : ""
          }`}
        />
      </button>
    </div>
  );
}
