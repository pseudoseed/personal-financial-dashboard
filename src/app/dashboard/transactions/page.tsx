"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TransactionChart } from "@/components/TransactionChart";
import { Account } from "@/types/account";

export default function TransactionsPage() {
  const [isMasked, setIsMasked] = useState(false);

  const { data: accountsData, isLoading: isLoadingAccounts } = useQuery<
    Account[]
  >({
    queryKey: ["accounts"],
    queryFn: async () => {
      const response = await fetch("/api/accounts");
      if (!response.ok) throw new Error("Failed to fetch accounts");
      return response.json();
    },
  });

  if (isLoadingAccounts) {
    return (
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-6">
            {/* Transaction chart skeleton */}
            <div className="h-[400px] bg-gray-200 dark:bg-zinc-800 rounded-lg"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {accountsData?.length ? (
          <TransactionChart />
        ) : (
          <div className="text-center py-12">
            <h2 className="text-2xl font-semibold text-gray-600 mb-4">
              No accounts found
            </h2>
            <p className="text-gray-500 mb-6">
              Connect your first account to view transactions and analytics
            </p>
          </div>
        )}
      </div>
    </div>
  );
} 