import { Suspense } from "react";
import { DashboardMetrics } from "@/components/DashboardMetrics";
import { ListStatCard } from "@/components/ListStatCard";
import { prisma } from "@/lib/db";
import { Account } from "@/types/account";

async function getAccounts(): Promise<Account[]> {
  try {
    const accounts = await prisma.account.findMany({
      where: {
        hidden: false,
      },
      include: {
        plaidItem: {
          select: {
            institutionId: true,
            institutionName: true,
            institutionLogo: true,
          },
        },
        balances: {
          orderBy: {
            date: "desc",
          },
          take: 1,
        },
      },
    });

    return accounts.map((account): Account => {
      const latestBalance = account.balances[0] || { current: 0, available: null, limit: null };
      
      return {
        id: account.id,
        name: account.name,
        nickname: account.nickname,
        type: account.type,
        subtype: account.subtype,
        mask: account.mask,
        hidden: account.hidden,
        institution: account.plaidItem?.institutionName || undefined,
        institutionLogo: account.plaidItem?.institutionLogo,
        balance: {
          current: latestBalance.current,
          available: latestBalance.available ?? null,
          limit: latestBalance.limit ?? null,
        },
        url: account.url,
        lastSyncTime: account.lastSyncTime,
        plaidItem: account.plaidItem ? { institutionId: account.plaidItem.institutionId } : undefined,
      };
    });
  } catch (error) {
    console.error("Error fetching accounts:", error);
    return [];
  }
}

export default async function DashboardPage() {
  const accounts = await getAccounts();
  const connectedAccounts = accounts.filter(a => a.institution);
  const manualAccounts = accounts.filter(a => !a.institution);

  const accountStatusStats = [
    { label: "Connected Accounts", value: connectedAccounts.length },
    { label: "Manual Accounts", value: manualAccounts.length },
    { label: "Total Accounts", value: accounts.length },
  ];

  return (
    <>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-1">
          Financial Dashboard
        </h1>
        <p className="text-secondary-500 dark:text-secondary-400">
          Track your accounts, transactions, and financial health
        </p>
      </div>

      {/* Main Dashboard Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Column - Metrics and Summary */}
        <div className="lg:col-span-3 space-y-6">
          <Suspense fallback={<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="card min-h-[120px] animate-pulse" />
              ))}
            </div>}>
            <DashboardMetrics accounts={accounts} />
          </Suspense>
        </div>

        {/* Right Column - Quick Actions */}
        <div className="space-y-6">
          <ListStatCard title="Account Status" stats={accountStatusStats} />

          {/* Quick Stats */}
          <div className="card p-4">
            <h3 className="text-xl font-semibold text-surface-600 dark:text-gray-200 mb-3">
              Quick Stats
            </h3>
            <div className="space-y-3">
              <div className="p-3 bg-success-50 dark:bg-success-900/20 rounded-lg">
                <p className="text-xs font-medium text-success-700 dark:text-success-300 mb-1">
                  Total Assets
                </p>
                <p className="text-lg font-bold text-success-700 dark:text-success-300">
                  $0.00
                </p>
              </div>
              
              <div className="p-3 bg-warning-50 dark:bg-warning-900/20 rounded-lg">
                <p className="text-xs font-medium text-warning-700 dark:text-warning-300 mb-1">
                  Monthly Change
                </p>
                <p className="text-lg font-bold text-warning-700 dark:text-warning-300">
                  +0.00%
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
} 