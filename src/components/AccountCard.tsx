"use client";

import { useState, useRef } from "react";
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
import { useNotifications } from "@/components/ui/Notification";

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
  const { addNotification } = useNotifications();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [nickname, setNickname] = useState(account.nickname || "");
  const [isUpdating, setIsUpdating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const displayBalance = (amount: number | null) => {
    if (amount === null) return "N/A";
    return showSensitiveData ? formatBalance(amount) : "••••••";
  };

  const accountTypeInfo = getAccountTypeInfo(account.type, account.subtype);
  const Icon = accountTypeInfo.icon;
  const isCredit = account.type === "credit";
  const isNegative = account.balance.current < 0;

  // Check if this is a manual account
  const isManualAccount = account.plaidItem?.accessToken === 'manual' || 
                         account.plaidItem?.provider === 'manual';

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
    
    if (isManualAccount) {
      // For manual accounts, open the edit form instead of refreshing
      handleStartEditing(e);
      return;
    }
    
    // For Plaid/Coinbase accounts, use the targeted refresh API
    setIsRefreshing(true);
    try {
      const response = await fetch("/api/accounts/refresh", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          accountId: account.id,
          manual: true 
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to refresh account");
      }

      const data = await response.json();
      
      // Show success notification
      addNotification({
        type: "success",
        title: "Account Refreshed",
        message: `Successfully refreshed ${account.name}`,
      });

      // Refresh the accounts data
      if (onRefresh) {
        await onRefresh();
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to refresh account";
      addNotification({
        type: "error",
        title: "Refresh Failed",
        message: errorMessage,
      });
      console.error("Error refreshing account:", error);
    } finally {
      setIsRefreshing(false);
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

  const handleNicknameUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (nickname.trim() === account.nickname) {
      setIsEditing(false);
      return;
    }

    setIsUpdating(true);
    try {
      const response = await fetch(`/api/accounts/${account.id}/update-nickname`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: nickname.trim() }),
      });

      if (response.ok) {
        addNotification({
          type: "success",
          title: "Nickname updated",
          message: "Account nickname has been updated successfully.",
        });
        queryClient.invalidateQueries({ queryKey: ["accounts"] });
        setIsEditing(false);
      } else {
        throw new Error("Failed to update nickname");
      }
    } catch (error) {
      addNotification({
        type: "error",
        title: "Update failed",
        message: "Failed to update account nickname. Please try again.",
      });
    } finally {
      setIsUpdating(false);
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
      <div
        className="card flex flex-col justify-between min-h-[210px]"
        onClick={(e) => {
          // Prevent navigation if editing nickname
          if (isEditing) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
      >
        {/* Card Header */}
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2 min-w-0">
            {showSensitiveData && account.institutionLogo ? (
              <img
                src={account.institutionLogo}
                alt={account.institution || "Bank logo"}
                className="h-5 w-5 object-contain"
              />
            ) : (
              <BanknotesIcon className="h-5 w-5 text-gray-400" />
            )}
            <span className="text-xs text-secondary-500 dark:text-secondary-400">
              {showSensitiveData ? `****${account.mask}` : "••••"}
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
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleRefresh} 
              disabled={isRefreshing} 
              className="p-1"
              title={isManualAccount ? "Edit balance" : "Refresh balance"}
            >
              {isManualAccount ? (
                <PencilIcon className="h-4 w-4" />
              ) : (
                <ArrowPathIcon className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              )}
            </Button>
          </div>
        </div>

        {/* Account Name and Edit */}
        <div className="my-1">
          {isEditing ? (
            <form onSubmit={handleNicknameUpdate} className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Enter nickname"
                className="w-full px-2 py-1 text-sm border border-border rounded focus:outline-none"
                autoFocus
                ref={inputRef}
              />
              <Button type="submit" size="sm" variant="primary" className="px-2 py-1 text-xs" disabled={isUpdating}>
                {isUpdating ? "Saving..." : "Save"}
              </Button>
              <Button 
                type="button" 
                size="sm" 
                variant="secondary" 
                className="px-2 py-1 text-xs"
                onClick={() => {
                  setNickname(account.nickname || "");
                  setIsEditing(false);
                }}
              >
                Cancel
              </Button>
            </form>
          ) : (
            <div className="flex items-center gap-1">
              <h3 className="text-xl font-semibold text-surface-600 dark:text-gray-200">
                {showSensitiveData ? (nickname || account.name) : "••••••••••"}
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

          {isCredit && account.lastStatementBalance !== undefined && account.lastStatementBalance !== null && (
            <div className="flex justify-between items-baseline">
              <span className="text-secondary-500 dark:text-secondary-400 text-xs">Statement Balance</span>
              <span className="font-medium text-secondary-600 dark:text-secondary-400 text-sm">
                {displayBalance(account.lastStatementBalance)}
              </span>
            </div>
          )}

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
        <div className="mt-4 pt-3 border-t border-gray-200 dark:border-zinc-700">
          {/* Credit Utilization */}
          {utilizationPercentage !== null && (
            <div className="mb-3">
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
          
          {/* Last Updated Info */}
          <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
            <span>
              Last updated: {account.lastUpdated 
                ? new Date(account.lastUpdated).toLocaleDateString() 
                : "Never"}
            </span>
            {account.lastUpdated && (
              <span>
                {new Date(account.lastUpdated).toLocaleTimeString()}
              </span>
            )}
          </div>
          
          {/* Show warning if data is stale (more than 24 hours old) */}
          {account.lastUpdated && (() => {
            const lastUpdate = new Date(account.lastUpdated);
            const now = new Date();
            const hoursSinceUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);
            const daysSinceUpdate = hoursSinceUpdate / 24;
            
            if (isManualAccount) {
              // For manual accounts, show notice if not updated in over a week
              if (daysSinceUpdate > 7) {
                return (
                  <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-md">
                    <div className="flex items-center text-xs text-blue-700 dark:text-blue-300">
                      <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                      Manual account - please review and update balance
                    </div>
                  </div>
                );
              }
              return null; // Don't show any notice for recent manual updates
            } else {
              // For Plaid/Coinbase accounts, show notice if more than 24 hours old
              if (hoursSinceUpdate > 24) {
                return (
                  <div className="mt-2 p-2 bg-orange-50 dark:bg-orange-900/20 rounded-md">
                    <div className="flex items-center text-xs text-orange-700 dark:text-orange-300">
                      <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      Data may be outdated - refresh to update
                    </div>
                  </div>
                );
              }
              return null;
            }
          })()}
        </div>
      </div>
    </Link>
  );
}
