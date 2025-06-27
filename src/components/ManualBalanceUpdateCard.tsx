"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Account } from "@/types/account";
import { useNotifications } from "@/components/ui/Notification";
import { CurrencyDollarIcon, ArrowPathIcon } from "@heroicons/react/24/outline";

interface BalanceUpdate {
  accountId: string;
  newBalance: string;
}

export function ManualBalanceUpdateCard() {
  const [updates, setUpdates] = useState<Record<string, string>>({});
  const [isUpdating, setIsUpdating] = useState(false);
  const { addNotification } = useNotifications();
  const queryClient = useQueryClient();

  const { data: accountsData, isLoading } = useQuery<Account[]>({
    queryKey: ["accounts"],
    queryFn: async () => {
      const response = await fetch("/api/accounts");
      if (!response.ok) throw new Error("Failed to fetch accounts");
      return response.json();
    },
  });

  // Filter to only manual accounts
  const manualAccounts = accountsData?.filter((account: Account) => 
    account.plaidItem?.accessToken === "manual"
  ) || [];

  if (isLoading) {
    return (
      <div className="card p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-100 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (manualAccounts.length === 0) {
    return (
      <div className="card p-6">
        <div className="text-red-600">
          <h3>Debug: Manual Balance Update Card</h3>
          <p>No manual accounts found. Total accounts: {accountsData?.length || 0}</p>
        </div>
      </div>
    );
  }

  const handleBalanceChange = (accountId: string, value: string) => {
    setUpdates(prev => ({
      ...prev,
      [accountId]: value,
    }));
  };

  const handleSubmit = async () => {
    // Filter to only accounts that have new values
    const updatesToSubmit: BalanceUpdate[] = Object.entries(updates)
      .filter(([_, value]) => value.trim() !== "")
      .map(([accountId, value]) => ({
        accountId,
        newBalance: value,
      }));

    if (updatesToSubmit.length === 0) {
      addNotification({
        type: "warning",
        title: "No changes to update",
        message: "Please enter new balance values to update.",
      });
      return;
    }

    setIsUpdating(true);
    try {
      const response = await fetch("/api/accounts/manual/batch-update-balances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates: updatesToSubmit }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        const { successful, failed } = result.summary;
        
        if (successful > 0) {
          addNotification({
            type: "success",
            title: "Balances updated",
            message: `Successfully updated ${successful} balance${successful > 1 ? 's' : ''}${failed > 0 ? ` (${failed} failed)` : ''}.`,
          });
          
          // Clear the form
          setUpdates({});
          
          // Refresh the accounts data
          queryClient.invalidateQueries({ queryKey: ["accounts"] });
          queryClient.invalidateQueries({ queryKey: ["accountsWithHistory"] });
        } else {
          addNotification({
            type: "error",
            title: "Update failed",
            message: "No balances were updated successfully.",
          });
        }

        // Show detailed results if there were failures
        if (failed > 0) {
          const failedResults = result.results.filter((r: any) => !r.success);
          console.error("Failed updates:", failedResults);
        }
      } else {
        throw new Error(result.error || "Failed to update balances");
      }
    } catch (error) {
      console.error("Error updating balances:", error);
      addNotification({
        type: "error",
        title: "Update failed",
        message: error instanceof Error ? error.message : "Failed to update balances. Please try again.",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const hasChanges = Object.values(updates).some(value => value.trim() !== "");

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <CurrencyDollarIcon className="h-6 w-6 text-blue-600" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Manual Account Balances
          </h2>
        </div>
        <button
          onClick={handleSubmit}
          disabled={!hasChanges || isUpdating}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isUpdating ? (
            <>
              <ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" />
              Updating...
            </>
          ) : (
            "Update Balances"
          )}
        </button>
      </div>

      <div className="space-y-4">
        <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Update balances for your manual accounts. Only accounts with new values will be updated.
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Account Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Current Balance
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  New Balance
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {manualAccounts.map((account) => (
                <tr key={account.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    {account.nickname || account.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    ${account.balance?.current?.toLocaleString() || '0'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Enter new balance"
                      value={updates[account.id] || ""}
                      onChange={(e) => handleBalanceChange(account.id, e.target.value)}
                      className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {hasChanges && (
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
            <div className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Ready to update:</strong> {Object.values(updates).filter(v => v.trim() !== "").length} account{Object.values(updates).filter(v => v.trim() !== "").length !== 1 ? 's' : ''} will be updated.
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 