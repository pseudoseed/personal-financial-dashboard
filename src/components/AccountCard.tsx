"use client";

import { useState } from "react";
import Link from "next/link";
import { useSensitiveData } from "@/app/providers";
import { getRelativeTime } from "@/lib/ui";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  EyeIcon,
  EyeSlashIcon,
  ArrowPathIcon,
  PencilIcon,
  ArrowTopRightOnSquareIcon,
  ClockIcon,
  PencilSquareIcon,
  BanknotesIcon,
  CreditCardIcon,
  HomeIcon,
  ChartBarIcon,
  WalletIcon,
  QuestionMarkCircleIcon,
} from "@heroicons/react/24/outline";
import { Account } from "@/types/account";
import { getAccountTypeInfo } from "@/lib/accountTypes";
import { formatBalance } from "@/lib/formatters";
import { useQueryClient } from "@tanstack/react-query";

interface AccountCardProps {
  account: Account;
  onRefresh?: () => void;
  onDisconnect?: () => void;
  onToggleVisibility?: () => void;
  isHidden?: boolean;
}

export function AccountCard({ 
  account, 
  onRefresh,
  onDisconnect,
  onToggleVisibility,
  isHidden = false
}: AccountCardProps) {
  const { showSensitiveData } = useSensitiveData();
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [nickname, setNickname] = useState(account.nickname || "");
  const [isUpdating, setIsUpdating] = useState(false);

  const displayBalance = (amount: number | null) => {
    if (amount === null) return "N/A";
    return showSensitiveData ? formatBalance(amount) : "••••••";
  };

  const accountTypeInfo = getAccountTypeInfo(account.type, account.subtype);
  const Icon = accountTypeInfo.icon;
  const isCredit = account.type === "credit";
  const isNegative = account.balance.current < 0;

  // Calculate credit utilization
  const utilizationPercentage = isCredit && account.balance.limit
    ? Math.round((Math.abs(account.balance.current) / account.balance.limit) * 100)
    : null;

  // Calculate last balance change
  const lastChange = account.balances?.[0] 
    ? account.balance.current - account.balances[0].current
    : null;

  // Get last updated info
  const lastUpdatedInfo = account.lastSyncTime ? {
    text: getRelativeTime(account.lastSyncTime),
    isOld: new Date().getTime() - new Date(account.lastSyncTime).getTime() > 24 * 60 * 60 * 1000 // 24 hours
  } : null;

  const handleRefresh = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onRefresh) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    }
  };

  const handleToggleVisibility = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onToggleVisibility) {
      onToggleVisibility();
    }
  };

  const handleStartEditing = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsEditing(true);
  };

  const handleSaveNickname = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      const response = await fetch(`/api/accounts/${account.id}/update-nickname`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname }),
      });
      
      if (response.ok) {
        setIsEditing(false);
        // Optionally refresh the page or update the account data
        window.location.reload();
      }
    } catch (error) {
      console.error("Error updating nickname:", error);
    }
  };

  const handleCancelEdit = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setNickname(account.nickname || "");
    setIsEditing(false);
  };

  const toggleVisibility = async () => {
    setIsUpdating(true);
    try {
      const response = await fetch(`/api/accounts/${account.id}/toggle-visibility`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Failed to toggle visibility status');
      }
      if (onRefresh) onRefresh();
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Link href={`/accounts/${account.id}`} passHref>
      <div className="card flex flex-col justify-between min-h-[210px]">
        {/* Card Header */}
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2 min-w-0">
            <Icon className="h-5 w-5 text-secondary-500 dark:text-secondary-400 flex-shrink-0" />
            <span className="text-xs text-secondary-500 dark:text-secondary-400">
              ****{account.mask}
            </span>
          </div>
          <div className="flex items-center -mr-2 -mt-1">
            <button
              onClick={toggleVisibility}
              disabled={isUpdating}
              className="p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors"
              title={account.hidden ? "Show Account" : "Hide Account"}
            >
              {isUpdating ? (
                <ArrowPathIcon className="w-4 h-4 animate-spin" />
              ) : account.hidden ? (
                <EyeSlashIcon className="w-4 h-4" />
              ) : (
                <EyeIcon className="w-4 h-4" />
              )}
            </button>
            <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={isRefreshing} className="p-1">
              <ArrowPathIcon className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Account Name and Edit */}
        <div className="my-1">
          {isEditing ? (
            <form onSubmit={handleSaveNickname} className="flex items-center gap-1">
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="w-full px-2 py-1 text-sm border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
              <Button type="submit" size="sm" variant="primary" className="px-2 py-1 text-xs">Save</Button>
              <Button type="button" size="sm" variant="ghost" onClick={handleCancelEdit} className="px-2 py-1 text-xs">Cancel</Button>
            </form>
          ) : (
            <div className="flex items-center gap-1">
              <h3 className="text-xl font-semibold text-surface-600 dark:text-gray-200">
                {nickname || account.name}
              </h3>
              <Button variant="ghost" size="sm" onClick={handleStartEditing} className="p-1">
                <PencilIcon className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Balances */}
        <div className="space-y-1 text-sm">
          <div className="flex justify-between items-baseline">
            <span className="text-secondary-500 dark:text-secondary-400 text-xs">Current Balance</span>
            <span className="font-semibold text-xl text-success-600 dark:text-success-400">
              {displayBalance(account.balance.current)}
            </span>
          </div>

          {isCredit ? (
            <>
              {account.balance.available !== null && (
                <div className="flex justify-between items-baseline">
                  <span className="text-secondary-500 dark:text-secondary-400 text-xs">Available Credit</span>
                  <span className="font-medium text-secondary-600 dark:text-secondary-400 text-sm">
                    {displayBalance(account.balance.available ?? null)}
                  </span>
                </div>
              )}
            </>
          ) : (
            <>
              {account.balance.available !== null && (
                <div className="flex justify-between items-baseline">
                  <span className="text-secondary-500 dark:text-secondary-400 text-xs">Available</span>
                  <span className="font-medium text-secondary-600 dark:text-secondary-400 text-sm">
                    {displayBalance(account.balance.available ?? null)}
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer - Last Updated and Utilization */}
        <div className="mt-auto pt-2">
          {utilizationPercentage !== null && (
            <div>
              <div className="flex justify-between text-xs text-secondary-500 dark:text-secondary-400 mb-1">
                <span>Credit Utilization</span>
                <span>{utilizationPercentage}%</span>
              </div>
              <div className="w-full bg-surface-200 dark:bg-surface-dark-300 rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full ${
                    utilizationPercentage < 30
                      ? "bg-success-500"
                      : utilizationPercentage < 70
                      ? "bg-warning-500"
                      : "bg-error-500"
                  }`}
                  style={{ width: `${utilizationPercentage}%` }}
                ></div>
              </div>
            </div>
          )}

          {lastUpdatedInfo && (
            <div className="flex items-center gap-1 text-xs text-secondary-500 dark:text-secondary-400 mt-2">
              <ClockIcon className="h-3 w-3" />
              <span>Updated {lastUpdatedInfo.text}</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
