"use client";

import { useCallback, useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import { useQuery } from "@tanstack/react-query";
import { AccountTypeChart } from "@/components/AccountTypeChart";
import { FinancialGroupChart } from "@/components/FinancialGroupChart";
import { DashboardSummary } from "@/components/DashboardSummary";
import { AccountCard } from "@/components/AccountCard";
import { ManualAccountForm } from "@/components/ManualAccountForm";
import {
  EyeIcon,
  EyeSlashIcon,
  LockOpenIcon,
  LockClosedIcon,
  PlusIcon,
  ArrowPathIcon,
  XCircleIcon,
} from "@heroicons/react/24/solid";

interface Account {
  id: string;
  name: string;
  nickname: string | null;
  type: string;
  subtype: string | null;
  mask: string | null;
  hidden: boolean;
  institution: string;
  institutionLogo: string | null;
  balance: {
    current: number;
    available: number | null;
    limit: number | null;
  };
  plaidItem?: {
    institutionId: string;
  };
}

export default function Home() {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRefreshingInstitutions, setIsRefreshingInstitutions] =
    useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [isMasked, setIsMasked] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const [isConnectingCoinbase, setIsConnectingCoinbase] = useState(false);
  const [refreshingInstitutions, setRefreshingInstitutions] = useState<
    Record<string, boolean>
  >({});
  const [disconnectingInstitutions, setDisconnectingInstitutions] = useState<
    Record<string, boolean>
  >({});

  const { data: accounts, refetch } = useQuery<Account[]>({
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

  const visibleAccounts =
    accounts?.filter((account) => !account.hidden || showHidden) || [];
  const hiddenAccounts = accounts?.filter((account) => account.hidden) || [];

  const refreshInstitutions = async () => {
    try {
      setIsRefreshingInstitutions(true);
      const response = await fetch("/api/plaid/refresh-institutions", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to refresh institutions");
      }

      await refetch();
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

      await refetch();
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
        refetch();
      } catch (error) {
        console.error("Error linking account:", error);
      }
    },
    [refetch]
  );

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess,
  });

  const connectCoinbase = async () => {
    try {
      setIsConnectingCoinbase(true);
      const response = await fetch("/api/crypto/oauth");
      if (!response.ok) throw new Error("Failed to get Coinbase auth URL");
      const { authUrl } = await response.json();
      window.location.href = authUrl;
    } catch (error) {
      console.error("Error connecting to Coinbase:", error);
    } finally {
      setIsConnectingCoinbase(false);
    }
  };

  const refreshInstitution = async (institutionId: string) => {
    try {
      setRefreshingInstitutions((prev) => ({ ...prev, [institutionId]: true }));
      const response = await fetch("/api/accounts/refresh", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ institutionId }),
      });

      if (!response.ok) {
        throw new Error("Failed to refresh institution");
      }

      await refetch();
    } catch (error) {
      console.error("Error refreshing institution:", error);
    } finally {
      setRefreshingInstitutions((prev) => ({
        ...prev,
        [institutionId]: false,
      }));
    }
  };

  const disconnectInstitution = async (institutionId: string) => {
    if (
      !confirm(
        "Are you sure you want to disconnect this institution? This will remove all associated accounts."
      )
    ) {
      return;
    }

    try {
      setDisconnectingInstitutions((prev) => ({
        ...prev,
        [institutionId]: true,
      }));
      const response = await fetch("/api/accounts/disconnect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ institutionId }),
      });

      if (!response.ok) {
        throw new Error("Failed to disconnect institution");
      }

      await refetch();
    } catch (error) {
      console.error("Error disconnecting institution:", error);
    } finally {
      setDisconnectingInstitutions((prev) => ({
        ...prev,
        [institutionId]: false,
      }));
    }
  };

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

  if (!accounts) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Financial Dashboard</h1>
          <div className="flex items-center gap-4">
            <button
              onClick={refreshBalances}
              disabled={isRefreshing}
              className="text-gray-600 hover:text-gray-800 disabled:opacity-50"
              title="Refresh all balances"
            >
              <svg
                className={`w-6 h-6 ${isRefreshing ? "animate-spin" : ""}`}
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
            <button
              onClick={refreshInstitutions}
              disabled={isRefreshingInstitutions}
              className="text-gray-600 hover:text-gray-800 disabled:opacity-50"
              title="Refresh institutions"
            >
              <svg
                className={`w-6 h-6 ${
                  isRefreshingInstitutions ? "animate-spin" : ""
                }`}
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                />
              </svg>
            </button>
            <button
              onClick={() => setIsMasked(!isMasked)}
              className="text-gray-600 hover:text-gray-800"
              title={
                isMasked
                  ? "Show sensitive information"
                  : "Hide sensitive information"
              }
            >
              {isMasked ? (
                <LockClosedIcon className="w-6 h-6" />
              ) : (
                <LockOpenIcon className="w-6 h-6" />
              )}
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => setShowManualForm(true)}
                className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
              >
                <PlusIcon className="w-5 h-5" />
                Add Manual Account
              </button>
              <button
                onClick={connectCoinbase}
                disabled={isConnectingCoinbase}
                className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                {isConnectingCoinbase ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
                    Connecting...
                  </div>
                ) : (
                  "Connect Coinbase"
                )}
              </button>
              <button
                onClick={() => open()}
                disabled={!ready}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Connect Bank
              </button>
            </div>
          </div>
        </div>

        {/* Manual Account Form Dialog */}
        {showManualForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h2 className="text-xl font-semibold mb-4">Add Manual Account</h2>
              <ManualAccountForm
                onSuccess={() => {
                  setShowManualForm(false);
                  refetch();
                }}
                onCancel={() => setShowManualForm(false)}
              />
            </div>
          </div>
        )}

        {accounts?.length ? (
          <>
            <DashboardSummary accounts={visibleAccounts} isMasked={isMasked} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <AccountTypeChart
                accounts={visibleAccounts}
                isMasked={isMasked}
              />
              <FinancialGroupChart
                accounts={visibleAccounts}
                isMasked={isMasked}
              />
            </div>

            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">Accounts</h2>
              <button
                onClick={() => setShowHidden(!showHidden)}
                className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:text-gray-900 transition-colors"
              >
                {showHidden ? (
                  <>
                    <EyeSlashIcon className="w-5 h-5" />
                    <span>Hide hidden accounts</span>
                  </>
                ) : (
                  <>
                    <EyeIcon className="w-5 h-5" />
                    <span>Show hidden accounts</span>
                  </>
                )}
              </button>
            </div>

            <div className="space-y-8">
              {Object.entries(accountsByInstitution).map(
                ([institution, institutionAccounts]) => {
                  // Get the institutionId from the first account
                  const institutionId =
                    institutionAccounts[0]?.plaidItem?.institutionId;
                  const isRefreshing = institutionId
                    ? refreshingInstitutions[institutionId]
                    : false;
                  const institutionLogo =
                    institutionAccounts[0]?.institutionLogo;

                  return (
                    <div
                      key={institution}
                      className="bg-white p-6 rounded-lg shadow-md"
                    >
                      <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-2">
                          {institutionLogo && (
                            <img
                              src={institutionLogo}
                              alt={institution}
                              className="w-6 h-6 object-contain"
                            />
                          )}
                          <h2 className="text-lg font-semibold">
                            {institution}
                          </h2>
                          <div className="flex flex-col ml-2">
                            {(() => {
                              const assets = institutionAccounts
                                .filter(
                                  (account) =>
                                    !["credit", "loan"].includes(
                                      account.type.toLowerCase()
                                    )
                                )
                                .reduce(
                                  (sum, account) =>
                                    sum + account.balance.current,
                                  0
                                );

                              const liabilities = institutionAccounts
                                .filter((account) =>
                                  ["credit", "loan"].includes(
                                    account.type.toLowerCase()
                                  )
                                )
                                .reduce(
                                  (sum, account) =>
                                    sum + Math.abs(account.balance.current),
                                  0
                                );

                              return isMasked ? (
                                <span className="text-lg text-gray-600">
                                  ••••••
                                </span>
                              ) : (
                                <>
                                  {assets > 0 && (
                                    <span className="text-lg text-green-600">
                                      +$
                                      {assets.toLocaleString(undefined, {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      })}
                                    </span>
                                  )}
                                  {liabilities > 0 && (
                                    <span className="text-lg text-red-600">
                                      -$
                                      {liabilities.toLocaleString(undefined, {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      })}
                                    </span>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {institutionId && (
                            <>
                              <button
                                onClick={() =>
                                  refreshInstitution(institutionId)
                                }
                                disabled={isRefreshing}
                                className="text-gray-600 hover:text-gray-800 disabled:opacity-50"
                                title="Refresh institution"
                              >
                                <ArrowPathIcon
                                  className={`w-5 h-5 ${
                                    isRefreshing ? "animate-spin" : ""
                                  }`}
                                />
                              </button>
                              <button
                                onClick={() =>
                                  disconnectInstitution(institutionId)
                                }
                                disabled={
                                  disconnectingInstitutions[institutionId]
                                }
                                className="text-gray-600 hover:text-red-600 disabled:opacity-50"
                                title="Disconnect institution"
                              >
                                <XCircleIcon className="w-5 h-5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
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
                            const typeComparison =
                              (typeOrder[
                                a.type.toLowerCase() as keyof typeof typeOrder
                              ] || 99) -
                              (typeOrder[
                                b.type.toLowerCase() as keyof typeof typeOrder
                              ] || 99);

                            // If same type, sort by balance (largest to smallest)
                            if (typeComparison === 0) {
                              const aBalance = ["credit", "loan"].includes(
                                a.type.toLowerCase()
                              )
                                ? -Math.abs(a.balance.current) // Negative for liabilities
                                : a.balance.current;
                              const bBalance = ["credit", "loan"].includes(
                                b.type.toLowerCase()
                              )
                                ? -Math.abs(b.balance.current) // Negative for liabilities
                                : b.balance.current;
                              return bBalance - aBalance; // Descending order
                            }

                            return typeComparison;
                          })
                          .filter((account) => !account.hidden || showHidden)
                          .map((account) => (
                            <AccountCard
                              key={account.id}
                              {...account}
                              onBalanceUpdate={refetch}
                              isMasked={isMasked}
                            />
                          ))}
                      </div>
                    </div>
                  );
                }
              )}
            </div>

            {hiddenAccounts.length > 0 && showHidden && (
              <>
                <h2 className="text-xl font-semibold mb-4 text-gray-700">
                  Hidden Accounts
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {hiddenAccounts.map((account) => (
                    <AccountCard
                      key={account.id}
                      {...account}
                      onBalanceUpdate={refetch}
                      isMasked={isMasked}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        ) : null}
      </div>
    </main>
  );
}
