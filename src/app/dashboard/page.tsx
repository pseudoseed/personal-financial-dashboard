import { Suspense } from "react";
import { DashboardMetrics } from "@/components/DashboardMetrics";
import { ListStatCard } from "@/components/ListStatCard";
import { prisma } from "@/lib/db";
import { Account } from "@/types/account";
import { BillsVsCashCard } from "@/components/BillsVsCashCard";
import TopVendorsCard from '@/components/TopVendorsCard';
import DashboardSidebarCards from '@/components/DashboardSidebarCards';
import { QuickInsights } from "@/components/QuickInsights";

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
        invertTransactions: account.invertTransactions,
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
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-1">
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
          <TopVendorsCard />
        </div>

        {/* Right Column - Quick Actions and Insights */}
        <div className="space-y-6">
          <DashboardSidebarCards accountStatusStats={accountStatusStats} />
          <QuickInsights />
        </div>
      </div>
    </>
  );
} 