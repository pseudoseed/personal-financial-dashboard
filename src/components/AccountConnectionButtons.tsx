"use client";

import React, { useState, useCallback } from "react";
import { usePlaidLink } from "react-plaid-link";
import { PlusIcon } from "@heroicons/react/24/solid";
import { Menu } from "@headlessui/react";
import { EllipsisHorizontalIcon } from "@heroicons/react/24/outline";
import { ManualAccountForm } from "./ManualAccountForm";
import { Button } from "@/components/ui/Button";
import { ChevronDownIcon } from "@heroicons/react/24/outline";

export function AccountConnectionButtons() {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [showManualForm, setShowManualForm] = useState(false);
  const [isConnectingCoinbase, setIsConnectingCoinbase] = useState(false);

  // Fetch Plaid link token on mount
  React.useEffect(() => {
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

  const onSuccess = useCallback(async (public_token: string) => {
    try {
      const response = await fetch("/api/plaid/exchange-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public_token }),
      });
      if (!response.ok) throw new Error("Failed to exchange token");
      // Optionally refetch accounts here if needed
    } catch (error) {
      console.error("Error linking account:", error);
    }
  }, []);

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

  // Mobile dropdown menu
  const MobileMenu = () => (
    <div className="sm:hidden">
      <Menu as="div" className="relative inline-block text-left">
        <Menu.Button as={Button} variant="ghost" size="sm" className="p-2">
          <EllipsisHorizontalIcon className="h-5 w-5" />
        </Menu.Button>
        <Menu.Items className="card absolute right-0 mt-2 w-56 origin-top-right rounded-lg bg-surface-0 border border-border shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50 dark:bg-surface-100">
          <div className="py-1">
            <Menu.Item>
              {({ active }) => (
                <button
                  onClick={() => setShowManualForm(true)}
                  className={`${
                    active ? "bg-surface-100 dark:bg-surface-200" : ""
                  } group flex w-full items-center px-4 py-3 text-sm text-foreground hover:bg-surface-50 dark:hover:bg-surface-200 transition-colors`}
                >
                  <PlusIcon className="mr-3 h-5 w-5 text-secondary-600 dark:text-secondary-400 group-hover:text-foreground" />
                  Add Account
                </button>
              )}
            </Menu.Item>
            <Menu.Item>
              {({ active }) => (
                <button
                  onClick={connectCoinbase}
                  disabled={isConnectingCoinbase}
                  className={`${
                    active ? "bg-surface-100 dark:bg-surface-200" : ""
                  } group flex w-full items-center px-4 py-3 text-sm text-foreground hover:bg-surface-50 dark:hover:bg-surface-200 transition-colors disabled:opacity-50`}
                >
                  {isConnectingCoinbase ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-foreground"></div>
                      Connecting...
                    </div>
                  ) : (
                    "Connect Coinbase"
                  )}
                </button>
              )}
            </Menu.Item>
          </div>
        </Menu.Items>
      </Menu>
    </div>
  );

  // Desktop buttons
  const DesktopButtons = () => (
    <div className="hidden sm:flex gap-2 items-center">
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setShowManualForm(true)}
        leftIcon={<PlusIcon className="w-5 h-5" />}
      >
        Add Account
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onClick={connectCoinbase}
        disabled={isConnectingCoinbase}
        loading={isConnectingCoinbase}
      >
        {isConnectingCoinbase ? "Connecting..." : "Connect Coinbase"}
      </Button>
    </div>
  );

  return (
    <div className="flex items-center gap-2">
      <MobileMenu />
      <DesktopButtons />
      <Button
        onClick={() => open()}
        disabled={!ready}
        className="bg-violet-500 hover:bg-violet-400 text-white"
        size="sm"
      >
        Connect Bank
      </Button>

      {/* Manual Account Form Dialog */}
      {showManualForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="card max-w-md w-full mx-2">
            <h2 className="text-xl font-semibold mb-4 text-foreground">Add Account</h2>
            <ManualAccountForm
              onSuccess={() => setShowManualForm(false)}
              onCancel={() => setShowManualForm(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
} 