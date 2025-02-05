"use client";

import Link from "next/link";
import { ArrowDownIcon, ArrowUpIcon } from "@heroicons/react/20/solid";

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
}: AccountCardProps) {
  const isNegative = balance.current < 0;
  const isCredit = type.toLowerCase() === "credit";
  const utilization =
    isCredit && balance.limit
      ? (Math.abs(balance.current) / balance.limit) * 100
      : null;

  return (
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
  );
}
