"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import { usePlaidLink } from "react-plaid-link";
import { useQueryClient } from "@tanstack/react-query";
import { PlusIcon } from "@heroicons/react/24/solid";
import { Menu } from "@headlessui/react";
import { EllipsisHorizontalIcon } from "@heroicons/react/24/outline";
import { ManualAccountForm } from "./ManualAccountForm";
import { Button } from "@/components/ui/Button";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { useDialogDismiss } from "@/lib/useDialogDismiss";
import { Account } from "@/types/account";
import { Modal } from "@/components/ui/Modal";
import { BriefcaseIcon, CreditCardIcon, BanknotesIcon, Squares2X2Icon, InformationCircleIcon, ExclamationTriangleIcon, CurrencyDollarIcon, PencilIcon } from "@heroicons/react/24/outline";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/Tooltip";
import { useNotifications } from "@/components/ui/Notification";

interface AccountTypeOption {
  id: string;
  label: string;
  description: string;
  products: {
    enableLiabilities: boolean;
    enableInvestments: boolean;
  };
  costPerMonth: number;
}

const ACCOUNT_TYPE_OPTIONS: AccountTypeOption[] = [
  {
    id: "checking-savings",
    label: "Checking & Savings Only",
    description: "Basic bank accounts for daily transactions",
    products: { enableLiabilities: false, enableInvestments: false },
    costPerMonth: 0.30,
  },
  {
    id: "credit-cards",
    label: "Credit Cards",
    description: "Credit cards with liability information",
    products: { enableLiabilities: true, enableInvestments: false },
    costPerMonth: 0.50,
  },
  {
    id: "investments",
    label: "Investment Accounts",
    description: "Investment accounts with holdings data",
    products: { enableLiabilities: false, enableInvestments: true },
    costPerMonth: 0.48,
  },
  {
    id: "all-accounts",
    label: "All Account Types",
    description: "Complete financial data access",
    products: { enableLiabilities: true, enableInvestments: true },
    costPerMonth: 0.68,
  },
];

// Helper function to check if an account is Plaid-connected
const isPlaidAccount = (account: any) => {
  return account.plaidItem && 
         account.plaidItem.accessToken && 
         account.plaidItem.accessToken !== 'manual' &&
         account.plaidItem.provider === 'plaid';
};

// Cost optimization helper
const calculateMonthlyCost = (accounts: Account[]) => {
  const plaidAccounts = accounts.filter(isPlaidAccount);
  
  if (plaidAccounts.length === 0) {
    return { total: 0, breakdown: [], note: "No Plaid accounts found" };
  }

  const breakdown = plaidAccounts.map(account => {
    let cost = 0.30; // Base Transactions cost
    const products = ['Transactions'];
    
    if (account.type === 'credit' || account.type === 'loan') {
      cost += 0.20; // Liabilities
      products.push('Liabilities');
    }
    
    if (account.type === 'investment') {
      cost += 0.18; // Investments
      products.push('Investments');
    }
    
    return {
      name: account.name,
      type: account.type,
      cost,
      products
    };
  });
  
  const total = breakdown.reduce((sum, item) => sum + item.cost, 0);
  
  return {
    total,
    breakdown,
    note: `${plaidAccounts.length} Plaid accounts • ${accounts.length - plaidAccounts.length} other accounts (no cost)`
  };
};

export function AccountConnectionButtons() {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [showManualForm, setShowManualForm] = useState(false);
  const [showAccountTypeSelector, setShowAccountTypeSelector] = useState(false);
  const [isConnectingCoinbase, setIsConnectingCoinbase] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [selectedAccountType, setSelectedAccountType] = useState<AccountTypeOption | null>(null);
  const queryClient = useQueryClient();
  const { addNotification } = useNotifications();

  // Use the dialog dismiss hook - Manual account form requires input, so prevent dismissal
  const dialogRef = useDialogDismiss({
    isOpen: showManualForm,
    onClose: () => setShowManualForm(false),
    allowEscape: false,
    allowClickOutside: false,
    requireInput: true,
  });

  // Handle mounting state for portal
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const createLinkToken = async (accountType: AccountTypeOption) => {
    try {
      const response = await fetch("/api/plaid/create-link-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(accountType.products),
      });
      if (!response.ok) throw new Error("Failed to create link token");
      const { link_token } = await response.json();
      setLinkToken(link_token);
      setSelectedAccountType(accountType);
    } catch (error) {
      console.error("Error getting link token:", error);
    }
  };

  const onSuccess = useCallback(async (public_token: string) => {
    try {
      const response = await fetch("/api/plaid/exchange-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public_token }),
      });
      if (!response.ok) throw new Error("Failed to exchange token");
      
      const result = await response.json();
      
      // Invalidate the accounts query to refresh the dashboard
      await queryClient.invalidateQueries({ queryKey: ["accounts"] });
      
      setShowAccountTypeSelector(false);
      setSelectedAccountType(null);
      
      // Show success notification
      addNotification({
        type: "success",
        title: "Account Connected Successfully!",
        message: "Your account has been connected and is now visible on your dashboard."
      });
      
      // Show merge message if duplicates were handled
      if (result.mergeMessage) {
        addNotification({
          type: "info",
          title: "Duplicate Accounts Merged",
          message: result.mergeMessage,
          duration: 8000, // Show for longer since it's important info
        });
      }
    } catch (error) {
      console.error("Error linking account:", error);
      addNotification({
        type: "error",
        title: "Connection Failed",
        message: "There was an error connecting your account. Please try again."
      });
    }
  }, [queryClient, addNotification]);

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

  // Open Plaid Link when ready
  useEffect(() => {
    if (ready && linkToken && selectedAccountType) {
      open();
    }
  }, [ready, linkToken, selectedAccountType, open]);

  const AccountTypeSelector = () => {
    if (!isMounted) return null;

    const options = [
      {
        id: "checking-savings",
        label: "Checking & Savings Only",
        description: "Basic bank accounts for daily transactions.",
        examples: "Examples: Ally Savings, Marcus by Goldman Sachs, Capital One 360",
        icon: <BanknotesIcon className="h-7 w-7 text-blue-500" />,
        price: "$0.30/month",
        note: "Use for banks that separate checking/savings from credit cards",
      },
      {
        id: "credit-cards",
        label: "Credit Cards",
        description: "Credit cards with liability information.",
        examples: "Examples: Amex Platinum, Citi Double Cash, Discover It",
        icon: <CreditCardIcon className="h-7 w-7 text-purple-500" />,
        price: "$0.50/month",
        note: "Use for standalone credit card issuers",
      },
      {
        id: "investments",
        label: "Investment Accounts",
        description: "Investment accounts with holdings data.",
        examples: "Examples: Robinhood, E*TRADE, Fidelity IRA, Vanguard",
        icon: <BriefcaseIcon className="h-7 w-7 text-green-500" />,
        price: "$0.48/month",
        note: "Use for standalone investment platforms",
      },
      {
        id: "all-accounts",
        label: (
          <span className="flex items-center gap-1">
            All Account Types
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span tabIndex={0} className="outline-none">
                    <InformationCircleIcon className="h-5 w-5 text-gray-400 hover:text-blue-500 cursor-pointer" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  <div className="space-y-2">
                    <p className="font-medium">Required for banks with unified logins</p>
                    <p className="text-sm">Use this for banks like Chase, Bank of America, Wells Fargo, or any institution where checking, savings, and credit cards are all under one login.</p>
                    <p className="text-sm font-medium text-orange-400">⚠️ Don't use separate connections for these banks - it will create duplicates!</p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </span>
        ),
        description: "Complete financial data access for institutions with multiple account types under one login.",
        examples: "Use for: Chase, Bank of America, Wells Fargo, Fidelity, or any bank/brokerage with checking, credit, and investments in one login.",
        icon: <Squares2X2Icon className="h-7 w-7 text-yellow-500" />,
        price: "$0.68/month",
        note: "⚠️ Required for banks with unified logins to avoid duplicates",
        warning: true,
      },
    ];

    return ReactDOM.createPortal(
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" aria-modal="true" role="dialog" tabIndex={-1}>
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl max-w-lg w-full mx-2 sm:mx-4 p-4 sm:p-8 relative animate-fadeIn overflow-y-auto max-h-[90vh]">
          <h2 className="text-2xl font-bold mb-3 text-gray-900 dark:text-white">Choose Account Type</h2>
          <p className="text-base text-gray-600 dark:text-gray-300 mb-7">Select the type of accounts you want to connect. This affects the data we can access and your monthly costs.</p>
          
          {/* Warning about unified logins */}
          <div className="mb-6 p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
            <div className="flex items-start gap-3">
              <ExclamationTriangleIcon className="h-5 w-5 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-medium text-orange-800 dark:text-orange-200 mb-1">
                  Important: Avoid Duplicate Accounts
                </h3>
                <p className="text-sm text-orange-700 dark:text-orange-300">
                  If your bank has checking, savings, and credit cards under one login (like Chase, Bank of America, Wells Fargo), 
                  use "All Account Types" to connect everything at once. Using separate connections will create duplicates.
                </p>
              </div>
            </div>
          </div>
          
          <div className="space-y-4">
            {options.map((option) => (
              <button
                key={typeof option.label === 'string' ? option.id : option.id + '-btn'}
                onClick={() => {
                  setShowAccountTypeSelector(false);
                  createLinkToken(ACCOUNT_TYPE_OPTIONS.find(o => o.id === (typeof option.label === 'string' ? option.id : option.id))!);
                }}
                className={`flex items-center w-full text-left bg-white dark:bg-gray-800 border rounded-xl px-4 sm:px-5 py-3 sm:py-4 shadow-sm hover:border-primary-500 focus:border-primary-500 transition group ${
                  option.warning 
                    ? 'border-orange-200 dark:border-orange-700 hover:border-orange-500' 
                    : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                <div className="mr-3 sm:mr-4 flex-shrink-0">
                  {option.icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">{option.label}</span>
                    <span className="text-sm sm:text-base font-medium text-blue-600 dark:text-blue-400 ml-2">{option.price}</span>
                  </div>
                  <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 mt-1">{option.description}</div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">{option.examples}</div>
                  {option.note && (
                    <div className={`text-xs mt-1 ${option.warning ? 'text-orange-600 dark:text-orange-400 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
                      {option.note}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowAccountTypeSelector(false)}
            className="mt-7 w-full text-center text-base text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 focus:outline-none"
          >
            Cancel
          </button>
          <div className="mt-4 text-xs text-gray-400 dark:text-gray-500 text-center">
            Pricing shown is based on Plaid's pay-as-you-go plan and may change. Check your Plaid dashboard for the latest rates.
          </div>
        </div>
      </div>,
      typeof window !== "undefined" ? document.body : (null as any)
    );
  };

  return (
    <>
      <div className="flex items-center space-x-2">
        <Menu as="div" className="relative">
          <Menu.Button as={Button} variant="primary" size="sm">
            <PlusIcon className="h-4 w-4 mr-2" />
            Add Account
            <ChevronDownIcon className="h-4 w-4 ml-2" />
          </Menu.Button>
          <Menu.Items className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 z-10">
            <div className="py-1">
              <Menu.Item>
                {({ active }) => (
                  <button
                    onClick={() => setShowAccountTypeSelector(true)}
                    className={`${
                      active
                        ? "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white"
                        : "text-gray-700 dark:text-gray-300"
                    } flex w-full items-center px-4 py-2 text-sm`}
                  >
                    <BanknotesIcon className="h-4 w-4 mr-3" />
                    Connect Bank Account
                  </button>
                )}
              </Menu.Item>
              <Menu.Item>
                {({ active }) => (
                  <button
                    onClick={connectCoinbase}
                    disabled={isConnectingCoinbase}
                    className={`${
                      active
                        ? "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white"
                        : "text-gray-700 dark:text-gray-300"
                    } flex w-full items-center px-4 py-2 text-sm ${
                      isConnectingCoinbase ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                  >
                    <CurrencyDollarIcon className="h-4 w-4 mr-3" />
                    {isConnectingCoinbase ? "Connecting..." : "Connect Coinbase"}
                  </button>
                )}
              </Menu.Item>
              <Menu.Item>
                {({ active }) => (
                  <button
                    onClick={() => setShowManualForm(true)}
                    className={`${
                      active
                        ? "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white"
                        : "text-gray-700 dark:text-gray-300"
                    } flex w-full items-center px-4 py-2 text-sm`}
                  >
                    <PencilIcon className="h-4 w-4 mr-3" />
                    Add Manual Account
                  </button>
                )}
              </Menu.Item>
            </div>
          </Menu.Items>
        </Menu>
      </div>

      {/* Manual Account Modal */}
      <Modal isOpen={showManualForm} onClose={() => setShowManualForm(false)} title="Add Account">
        <ManualAccountForm
          onSuccess={() => {
            // Invalidate the accounts query to refresh the dashboard
            queryClient.invalidateQueries({ queryKey: ["accounts"] });
            setShowManualForm(false);
            addNotification({
              type: "success",
              title: "Account Connected Successfully!",
              message: "Your account has been connected and is now visible on your dashboard."
            });
          }}
          onCancel={() => setShowManualForm(false)}
        />
      </Modal>

      {showAccountTypeSelector && <AccountTypeSelector />}
    </>
  );
} 