"use client";

import React, { useRef } from "react";
import { 
  BanknotesIcon, 
  ChartBarIcon, 
  CreditCardIcon, 
  BriefcaseIcon,
  PlusIcon,
  CurrencyDollarIcon,
  ArrowTrendingUpIcon,
  ShieldCheckIcon
} from "@heroicons/react/24/outline";
import { AccountConnectionButtons } from "./AccountConnectionButtons";
import { 
  EmptyStateMetricCard, 
  EmptyStateChartCard, 
  EmptyStateAccountCard,
  OnboardingCard 
} from "./LoadingStates";
import { AuthenticationAlerts } from "./AuthenticationAlerts";

export function EmptyStateDashboard() {
  const connectionButtonsRef = useRef<{ triggerAccountTypeSelector: (type: string) => void }>(null);

  const handleQuickAction = (accountType: string) => {
    // For now, we'll just show a message that directs users to the main connection buttons
    // In a future enhancement, we could add a ref to the AccountConnectionButtons component
    console.log(`Quick action triggered for: ${accountType}`);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-surface-900 dark:text-surface-100 mb-2">
          Financial Dashboard
        </h1>
        <p className="text-surface-600 dark:text-surface-400">
          Your complete financial overview
        </p>
      </div>

      {/* Authentication Alerts */}
      <AuthenticationAlerts />

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-3 space-y-8">
          {/* Welcome Section */}
          <OnboardingCard
            title="Welcome to Your Financial Dashboard"
            description="Connect your accounts to start tracking your finances in one place. Get insights into your spending, track your net worth, and monitor your financial goals."
            icon={<PlusIcon className="h-6 w-6" />}
          >
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <AccountConnectionButtons />
            </div>
          </OnboardingCard>

          {/* Placeholder Metrics */}
          <div>
            <h2 className="text-xl font-semibold text-surface-900 dark:text-surface-100 mb-4">
              Financial Overview
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <EmptyStateMetricCard
                title="Total Net Worth"
                value="$0.00"
                description="Sum of all your assets and liabilities"
                icon={<CurrencyDollarIcon className="h-5 w-5" />}
              />
              <EmptyStateMetricCard
                title="Monthly Spending"
                value="$0.00"
                description="Total spending this month"
                icon={<ArrowTrendingUpIcon className="h-5 w-5" />}
              />
              <EmptyStateMetricCard
                title="Credit Utilization"
                value="0%"
                description="Percentage of available credit used"
                icon={<CreditCardIcon className="h-5 w-5" />}
              />
              <EmptyStateMetricCard
                title="Investment Value"
                value="$0.00"
                description="Total value of investment accounts"
                icon={<BriefcaseIcon className="h-5 w-5" />}
              />
            </div>
          </div>

          {/* Placeholder Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <EmptyStateChartCard
              title="Net Worth Trend"
              description="Track your net worth over time"
              height="h-64"
            />
            <EmptyStateChartCard
              title="Spending by Category"
              description="See where your money goes"
              height="h-64"
            />
          </div>

          {/* Placeholder Accounts */}
          <div>
            <h2 className="text-xl font-semibold text-surface-900 dark:text-surface-100 mb-4">
              Your Accounts
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <EmptyStateAccountCard />
              <EmptyStateAccountCard />
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          {/* Quick Actions */}
          <OnboardingCard
            title="Quick Actions"
            description="Get started with these common tasks"
            icon={<PlusIcon className="h-6 w-6" />}
          >
            <div className="space-y-3">
              <button 
                onClick={() => handleQuickAction("checking-savings")}
                className="w-full text-left p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <BanknotesIcon className="h-5 w-5 text-blue-600" />
                  <div>
                    <div className="font-medium text-sm text-gray-900 dark:text-white">
                      Connect Bank Account
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Link checking & savings
                    </div>
                  </div>
                </div>
              </button>
              <button 
                onClick={() => handleQuickAction("credit-cards")}
                className="w-full text-left p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <CreditCardIcon className="h-5 w-5 text-purple-600" />
                  <div>
                    <div className="font-medium text-sm text-gray-900 dark:text-white">
                      Add Credit Card
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Track spending & balances
                    </div>
                  </div>
                </div>
              </button>
              <button 
                onClick={() => handleQuickAction("investments")}
                className="w-full text-left p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <BriefcaseIcon className="h-5 w-5 text-green-600" />
                  <div>
                    <div className="font-medium text-sm text-gray-900 dark:text-white">
                      Connect Investments
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Track 401k, IRA, brokerage
                    </div>
                  </div>
                </div>
              </button>
            </div>
          </OnboardingCard>

          {/* Features Preview */}
          <OnboardingCard
            title="What You'll Get"
            description="Powerful features to help you manage your finances"
            icon={<ShieldCheckIcon className="h-6 w-6" />}
          >
            <div className="space-y-3 text-left">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-blue-600 rounded-full mt-2 flex-shrink-0"></div>
                <div>
                  <div className="font-medium text-sm text-gray-900 dark:text-white">
                    Real-time Balance Tracking
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Automatic updates from your banks
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-green-600 rounded-full mt-2 flex-shrink-0"></div>
                <div>
                  <div className="font-medium text-sm text-gray-900 dark:text-white">
                    Smart Transaction Categorization
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    AI-powered spending insights
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-purple-600 rounded-full mt-2 flex-shrink-0"></div>
                <div>
                  <div className="font-medium text-sm text-gray-900 dark:text-white">
                    Financial Analytics
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Charts, trends, and reports
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-orange-600 rounded-full mt-2 flex-shrink-0"></div>
                <div>
                  <div className="font-medium text-sm text-gray-900 dark:text-white">
                    Anomaly Detection
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Get alerted to unusual activity
                  </div>
                </div>
              </div>
            </div>
          </OnboardingCard>

          {/* Stats Placeholder */}
          <div className="card opacity-60">
            <h3 className="text-lg font-semibold text-gray-400 dark:text-gray-500 mb-4">
              Account Status
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400 dark:text-gray-500">Connected Accounts</span>
                <span className="text-sm font-medium text-gray-300 dark:text-gray-600">0</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400 dark:text-gray-500">Manual Accounts</span>
                <span className="text-sm font-medium text-gray-300 dark:text-gray-600">0</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400 dark:text-gray-500">Total Accounts</span>
                <span className="text-sm font-medium text-gray-300 dark:text-gray-600">0</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 