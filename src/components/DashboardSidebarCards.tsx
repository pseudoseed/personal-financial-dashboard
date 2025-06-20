"use client";
import { ListStatCard } from '@/components/ListStatCard';
import { BillsVsCashCard } from '@/components/BillsVsCashCard';
import TopVendorsCard from '@/components/TopVendorsCard';

export default function DashboardSidebarCards({ accountStatusStats }: { accountStatusStats: { label: string; value: number }[] }) {
  return (
    <div className="space-y-6">
      <ListStatCard title="Account Status" stats={accountStatusStats} />
      <BillsVsCashCard />
    </div>
  );
} 