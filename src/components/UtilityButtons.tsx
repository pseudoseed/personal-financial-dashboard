"use client";

import React, { useState } from "react";
import { Menu } from "@headlessui/react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { 
  WrenchScrewdriverIcon,
  SunIcon, 
  MoonIcon, 
  EyeIcon, 
  EyeSlashIcon,
  ArrowPathIcon,
  GlobeAltIcon,
  Cog6ToothIcon,
  UserCircleIcon,
  DocumentTextIcon
} from "@heroicons/react/24/outline";
import { useTheme, useSensitiveData } from "@/app/providers";
import { Button } from "@/components/ui/Button";
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from "@/components/ui/Tooltip";
import { SettingsDialog } from "@/components/SettingsDialog";

interface UtilityButtonsProps {
  onRefresh?: () => void;
  onGlobeClick?: () => void;
  onSettingsClick?: () => void;
}

export function UtilityButtons({ 
  onRefresh, 
  onGlobeClick, 
  onSettingsClick 
}: UtilityButtonsProps) {
  const { darkMode, setDarkMode } = useTheme();
  const { showSensitiveData, toggleSensitiveData } = useSensitiveData();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isRefreshingData, setIsRefreshingData] = useState(false);
  const [isRefreshingInstitutions, setIsRefreshingInstitutions] = useState(false);
  const [isSyncingTransactions, setIsSyncingTransactions] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [transactionSyncError, setTransactionSyncError] = useState<string | null>(null);

  // Refresh data functionality
  const handleRefreshData = async () => {
    if (onRefresh) {
      onRefresh();
      return;
    }

    try {
      setIsRefreshingData(true);
      setRefreshError(null);
      
      const response = await fetch("/api/accounts/refresh", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          manual: true,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to refresh balances");
      }

      // Invalidate relevant queries instead of refreshing the page
      await queryClient.invalidateQueries({ queryKey: ["accounts"] });
      await queryClient.invalidateQueries({ queryKey: ["accountsWithHistory"] });
      await queryClient.invalidateQueries({ queryKey: ["account-history"] });
    } catch (error) {
      console.error("Error refreshing balances:", error);
      setRefreshError(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setIsRefreshingData(false);
      // Clear error after 5 seconds
      setTimeout(() => setRefreshError(null), 5000);
    }
  };

  // Transaction sync functionality
  const handleTransactionSync = async () => {
    try {
      setIsSyncingTransactions(true);
      setTransactionSyncError(null);
      
      const response = await fetch("/api/transactions/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          manual: true,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to sync transactions");
      }

      // Invalidate relevant queries
      await queryClient.invalidateQueries({ queryKey: ["transactions"] });
      await queryClient.invalidateQueries({ queryKey: ["transactions-by-category"] });
      await queryClient.invalidateQueries({ queryKey: ["transactions-for-ai"] });
    } catch (error) {
      console.error("Error syncing transactions:", error);
      setTransactionSyncError(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setIsSyncingTransactions(false);
      // Clear error after 5 seconds
      setTimeout(() => setTransactionSyncError(null), 5000);
    }
  };

  // Refresh institutions functionality
  const handleRefreshInstitutions = async () => {
    if (onGlobeClick) {
      onGlobeClick();
      return;
    }

    try {
      setIsRefreshingInstitutions(true);
      const response = await fetch("/api/plaid/refresh-institutions", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to refresh institution data");
      }

      // Invalidate relevant queries instead of refreshing the page
      await queryClient.invalidateQueries({ queryKey: ["accounts"] });
      await queryClient.invalidateQueries({ queryKey: ["accountsWithHistory"] });
    } catch (error) {
      console.error("Error refreshing institutions:", error);
      // You could add a toast notification here
    } finally {
      setIsRefreshingInstitutions(false);
    }
  };

  // Settings functionality
  const handleSettingsClick = onSettingsClick || (() => {
    setIsSettingsOpen(true);
  });

  const utilityButtons = [
    {
      icon: <ArrowPathIcon className={`h-5 w-5 ${isRefreshingData ? "animate-spin" : ""}`} />,
      label: refreshError ? `Refresh (${refreshError})` : "Refresh Balances",
      onClick: handleRefreshData,
      show: true,
      disabled: isRefreshingData,
      className: refreshError ? "text-red-500" : ""
    },
    {
      icon: <DocumentTextIcon className={`h-5 w-5 ${isSyncingTransactions ? "animate-spin" : ""}`} />,
      label: transactionSyncError ? `Sync TX (${transactionSyncError})` : "Sync Transactions",
      onClick: handleTransactionSync,
      show: true,
      disabled: isSyncingTransactions,
      className: transactionSyncError ? "text-red-500" : ""
    },
    {
      icon: <GlobeAltIcon className={`h-5 w-5 ${isRefreshingInstitutions ? "animate-spin" : ""}`} />,
      label: "Refresh Institution Data",
      onClick: handleRefreshInstitutions,
      show: true,
      disabled: isRefreshingInstitutions
    },
    {
      icon: darkMode ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />,
      label: darkMode ? "Enable light mode" : "Enable dark mode",
      onClick: () => setDarkMode(!darkMode),
      show: true
    },
    {
      icon: showSensitiveData ? <EyeIcon className="h-5 w-5" /> : <EyeSlashIcon className="h-5 w-5" />,
      label: showSensitiveData ? "Hide sensitive data" : "Show sensitive data",
      onClick: toggleSensitiveData,
      show: true
    },
    {
      icon: <Cog6ToothIcon className="h-5 w-5" />,
      label: "Settings",
      onClick: handleSettingsClick,
      show: true
    }
  ].filter(button => button.show);

  // For mobile, we'll use a dropdown menu with a toolbox icon
  const MobileMenu = () => (
    <div className="md:hidden">
      <Menu as="div" className="relative inline-block text-left">
        <Menu.Button as={Button} variant="ghost" size="sm" className="p-2">
          <WrenchScrewdriverIcon className="h-5 w-5" />
        </Menu.Button>
        <Menu.Items className="card absolute right-0 mt-2 w-48 origin-top-right z-50">
          <div className="px-1 py-1">
            {utilityButtons.map((button, index) => (
              <Menu.Item key={index}>
                {({ active }) => (
                  <button
                    onClick={button.onClick}
                    disabled={button.disabled}
                    className={`${
                      active ? "bg-surface-100 dark:bg-surface-200" : ""
                    } ${
                      button.disabled ? "opacity-50 cursor-not-allowed" : ""
                    } group flex w-full items-center px-4 py-3 text-sm text-foreground hover:bg-surface-50 dark:hover:bg-surface-200 transition-colors`}
                  >
                    <span className="mr-3 text-secondary-600 dark:text-secondary-400 group-hover:text-foreground">
                      {button.icon}
                    </span>
                    {button.label}
                  </button>
                )}
              </Menu.Item>
            ))}
          </div>
        </Menu.Items>
      </Menu>
    </div>
  );

  // For desktop, we'll show all buttons
  const DesktopButtons = () => (
    <div className="hidden md:flex items-center gap-1">
      <TooltipProvider>
        {utilityButtons.map((button, index) => (
          <Tooltip key={index}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="p-2 h-auto"
                onClick={button.onClick}
                disabled={button.disabled}
                aria-label={button.label}
              >
                {button.icon}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{button.label}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </TooltipProvider>
    </div>
  );

  return (
    <>
      <MobileMenu />
      <DesktopButtons />
      <SettingsDialog 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
      />
    </>
  );
} 