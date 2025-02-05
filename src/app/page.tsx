"use client";

import { useCallback, useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import { useQuery } from "@tanstack/react-query";

interface Account {
  id: string;
  name: string;
  type: string;
  subtype: string | null;
  mask: string | null;
  institution: string;
  balance: {
    current: number;
    available: number | null;
    limit: number | null;
  };
}

export default function Home() {
  const [linkToken, setLinkToken] = useState<string | null>(null);

  const { data: accounts, refetch: refetchAccounts } = useQuery<Account[]>({
    queryKey: ["accounts"],
    queryFn: async () => {
      const response = await fetch("/api/accounts");
      if (!response.ok) throw new Error("Failed to fetch accounts");
      return response.json();
    },
  });

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
    <main className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Financial Dashboard</h1>
          <button
            onClick={() => open()}
            disabled={!ready}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            Connect Account
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {accounts?.map((account) => (
            <div key={account.id} className="p-6 bg-white rounded-lg shadow-md">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold">{account.name}</h3>
                  <p className="text-sm text-gray-600">
                    {account.type} {account.subtype && `- ${account.subtype}`}
                  </p>
                  {account.mask && (
                    <p className="text-sm text-gray-600">****{account.mask}</p>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-2xl font-bold">
                  ${account.balance.current.toFixed(2)}
                </p>
                {account.balance.available && (
                  <p className="text-sm text-gray-600">
                    Available: ${account.balance.available.toFixed(2)}
                  </p>
                )}
                {account.balance.limit && (
                  <p className="text-sm text-gray-600">
                    Limit: ${account.balance.limit.toFixed(2)}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
