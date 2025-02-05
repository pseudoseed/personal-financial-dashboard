"use client";

import { useCallback, useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import { useQuery } from "@tanstack/react-query";
import { AccountTypeChart } from "@/components/AccountTypeChart";
import { FinancialGroupChart } from "@/components/FinancialGroupChart";
import { DashboardSummary } from "@/components/DashboardSummary";
import { AccountCard } from "@/components/AccountCard";

interface Account {
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

export default function Home() {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRefreshingInstitutions, setIsRefreshingInstitutions] =
    useState(false);

  const { data: accounts, refetch: refetchAccounts } = useQuery<Account[]>({
    queryKey: ["accounts"],
    queryFn: async () => {
      const response = await fetch("/api/accounts");
      if (!response.ok) throw new Error("Failed to fetch accounts");
      return response.json();
    },
  });

  // Group accounts by institution
  const accountsByInstitution =
    accounts?.reduce((acc, account) => {
      if (!acc[account.institution]) {
        acc[account.institution] = [];
      }
      acc[account.institution].push(account);
      return acc;
    }, {} as Record<string, Account[]>) || {};

  const refreshInstitutions = async () => {
    try {
      setIsRefreshingInstitutions(true);
      const response = await fetch("/api/plaid/refresh-institutions", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to refresh institutions");
      }

      await refetchAccounts();
    } catch (error) {
      console.error("Error refreshing institutions:", error);
    } finally {
      setIsRefreshingInstitutions(false);
    }
  };

  const refreshBalances = async () => {
    try {
      setIsRefreshing(true);
      const response = await fetch("/api/accounts/refresh", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to refresh balances");
      }

      await refetchAccounts();
    } catch (error) {
      console.error("Error refreshing balances:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const onSuccess = useCallback(
    async (public_token: string) => {
      try {
        const response = await fetch("/api/plaid/exchange-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ public_token }),
        });

        if (!response.ok) throw new Error("Failed to exchange token");

        refetchAccounts();
      } catch (error) {
        console.error("Error linking account:", error);
      }
    },
    [refetchAccounts]
  );

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess,
  });

  useEffect(() => {
    const getToken = async () => {
      try {
        const response = await fetch("/api/plaid/create-link-token", {
          method: "POST",
        });
        if (!response.ok) throw new Error("Failed to create link token");
        const { link_token } = await response.json();
        setLinkToken(link_token);
      } catch (error) {
        console.error("Error getting link token:", error);
      }
    };

    if (!linkToken) getToken();
  }, [linkToken]);

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Financial Dashboard</h1>
          </div>
          <div className="space-x-4">
            <button
              onClick={refreshInstitutions}
              disabled={isRefreshingInstitutions || !accounts?.length}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 inline-flex items-center"
            >
              {isRefreshingInstitutions ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Refreshing Institutions...
                </>
              ) : (
                "Refresh Institutions"
              )}
            </button>
            <button
              onClick={refreshBalances}
              disabled={isRefreshing || !accounts?.length}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 inline-flex items-center"
            >
              {isRefreshing ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Refreshing...
                </>
              ) : (
                "Refresh Balances"
              )}
            </button>
            <button
              onClick={() => open()}
              disabled={!ready}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              Connect Account
            </button>
          </div>
        </div>

        {accounts?.length ? (
          <>
            <DashboardSummary accounts={accounts} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <AccountTypeChart accounts={accounts} />
              <FinancialGroupChart accounts={accounts} />
            </div>

            <div className="space-y-8">
              {Object.entries(accountsByInstitution).map(
                ([institution, institutionAccounts]) => (
                  <div
                    key={institution}
                    className="bg-white p-6 rounded-lg shadow-md"
                  >
                    <h2 className="text-xl font-semibold mb-4">
                      {institution}
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {institutionAccounts
                        .sort((a, b) => {
                          // Sort by type: checking > savings > investment > credit > loan
                          const typeOrder = {
                            depository: 1,
                            investment: 2,
                            credit: 3,
                            loan: 4,
                          };
                          return (
                            (typeOrder[
                              a.type.toLowerCase() as keyof typeof typeOrder
                            ] || 99) -
                            (typeOrder[
                              b.type.toLowerCase() as keyof typeof typeOrder
                            ] || 99)
                          );
                        })
                        .map((account) => (
                          <AccountCard key={account.id} {...account} />
                        ))}
                    </div>
                  </div>
                )
              )}
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
}
