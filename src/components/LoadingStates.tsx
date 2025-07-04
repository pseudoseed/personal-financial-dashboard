"use client";

import React from "react";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded ${className}`}
    />
  );
}

export function AccountCardSkeleton() {
  return (
    <div className="card flex flex-col justify-between min-h-[210px]">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5" />
          <Skeleton className="h-3 w-16" />
        </div>
        <div className="flex items-center gap-1">
          <Skeleton className="h-6 w-6" />
          <Skeleton className="h-6 w-6" />
        </div>
      </div>

      {/* Account Info */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-6 w-24" />
      </div>

      {/* Balance */}
      <div className="space-y-1">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-8 w-28" />
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Skeleton className="h-8 flex-1" />
        <Skeleton className="h-8 w-8" />
      </div>
    </div>
  );
}

export function TransactionRowSkeleton() {
  return (
    <tr className="animate-pulse">
      <td className="px-6 py-4 whitespace-nowrap">
        <Skeleton className="h-4 w-20" />
      </td>
      <td className="px-6 py-4">
        <div className="space-y-1">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-16" />
        </div>
      </td>
      <td className="px-6 py-4">
        <Skeleton className="h-4 w-24" />
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right">
        <Skeleton className="h-4 w-20 ml-auto" />
      </td>
    </tr>
  );
}

export function TransactionTableSkeleton({ rowCount = 10 }: { rowCount?: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-700">
        <thead className="bg-gray-50 dark:bg-[rgb(46,46,46)]">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-surface-600 dark:text-gray-400 uppercase tracking-wider">
              Date
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-surface-600 dark:text-gray-400 uppercase tracking-wider">
              Description
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-surface-600 dark:text-gray-400 uppercase tracking-wider">
              Category
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-surface-600 dark:text-gray-400 uppercase tracking-wider">
              Amount
            </th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-zinc-900 divide-y divide-gray-200 dark:divide-zinc-700">
          {Array.from({ length: rowCount }).map((_, index) => (
            <TransactionRowSkeleton key={index} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="card">
      <div className="flex justify-between items-center mb-6">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-8 w-24" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-64 w-full" />
        <div className="flex justify-center gap-4">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-16" />
        </div>
      </div>
    </div>
  );
}

export function MetricCardSkeleton() {
  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-20" />
        </div>
        <Skeleton className="h-10 w-10" />
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, index) => (
          <MetricCardSkeleton key={index} />
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>

      {/* Recent Transactions */}
      <div className="card">
        <div className="flex justify-between items-center mb-6">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-8 w-24" />
        </div>
        <TransactionTableSkeleton rowCount={5} />
      </div>
    </div>
  );
}

export function PaginationSkeleton() {
  return (
    <div className="flex items-center justify-between px-6 py-3 bg-gray-50 dark:bg-[rgb(46,46,46)] border-t border-gray-200 dark:border-zinc-700">
      <Skeleton className="h-4 w-32" />
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 w-8" />
        <Skeleton className="h-8 w-8" />
        <Skeleton className="h-8 w-8" />
        <Skeleton className="h-8 w-8" />
        <Skeleton className="h-8 w-8" />
      </div>
    </div>
  );
}

export function AccountDetailsSkeleton() {
  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Grid container for top cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Institution and Account Info Card */}
        <div className="card flex flex-col">
          <div className="flex items-start gap-4">
            <Skeleton className="w-12 h-12" />
            <div className="flex-grow">
              <Skeleton className="h-4 w-32 mb-2" />
              <Skeleton className="h-8 w-48 mb-2" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
        </div>

        {/* Account Settings Card */}
        <div className="card flex flex-col">
          <Skeleton className="h-6 w-32 mb-4" />
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      </div>

      {/* Balance History Card */}
      <div className="card">
        <div className="flex justify-between items-center mb-6">
          <Skeleton className="h-6 w-32" />
          <div className="flex gap-2">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-20" />
            <Skeleton className="h-10 w-24" />
          </div>
        </div>
        <Skeleton className="h-[400px] w-full" />
      </div>
    </div>
  );
}

export function TransactionListSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="card p-4">
          <div className="flex justify-between items-center">
            <div className="flex-1">
              <Skeleton className="h-4 w-32 mb-2" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-6 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function LoadingSpinner({ size = "md", className = "" }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-8 w-8",
  };

  return (
    <div className={`animate-spin ${sizeClasses[size]} ${className}`}>
      <svg
        className="w-full h-full"
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
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    </div>
  );
}

interface LoadingOverlayProps {
  isLoading: boolean;
  children: React.ReactNode;
  message?: string;
}

export function LoadingOverlay({ isLoading, children, message = "Loading..." }: LoadingOverlayProps) {
  if (!isLoading) return <>{children}</>;

  return (
    <div className="relative">
      {children}
      <div className="absolute inset-0 bg-white/80 dark:bg-gray-900/80 flex items-center justify-center z-50">
        <div className="text-center">
          <LoadingSpinner size="lg" className="mx-auto mb-2" />
          <p className="text-sm text-gray-600 dark:text-gray-400">{message}</p>
        </div>
      </div>
    </div>
  );
}

// Empty State Placeholder Components
export function EmptyStateMetricCard({ title, value, description, icon }: {
  title: string;
  value: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="card opacity-60">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="text-gray-400 dark:text-gray-500">
              {icon}
            </div>
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
              {title}
            </span>
          </div>
          <div className="text-2xl font-bold text-gray-300 dark:text-gray-600">
            {value}
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}

export function EmptyStateChartCard({ title, description, height = "h-64" }: {
  title: string;
  description: string;
  height?: string;
}) {
  return (
    <div className="card opacity-60">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-400 dark:text-gray-500">
            {title}
          </h3>
          <p className="text-sm text-gray-400 dark:text-gray-500">
            {description}
          </p>
        </div>
      </div>
      <div className={`${height} w-full bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center`}>
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <p className="text-sm text-gray-400 dark:text-gray-500">
            Connect accounts to see your data
          </p>
        </div>
      </div>
    </div>
  );
}

export function EmptyStateAccountCard() {
  return (
    <div className="card opacity-60 min-h-[210px] flex flex-col justify-between">
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-6 h-6 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <div className="w-6 h-6 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
        <div className="h-6 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
      </div>

      <div className="space-y-1">
        <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
        <div className="h-8 w-28 bg-gray-200 dark:bg-gray-700 rounded"></div>
      </div>

      <div className="flex gap-2">
        <div className="h-8 flex-1 bg-gray-200 dark:bg-gray-700 rounded"></div>
        <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
      </div>
    </div>
  );
}

export function OnboardingCard({ title, description, icon, children }: {
  title: string;
  description: string;
  icon: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="card border-2 border-dashed border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
      <div className="text-center">
        <div className="w-12 h-12 mx-auto mb-4 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
          <div className="text-blue-600 dark:text-blue-400">
            {icon}
          </div>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          {title}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
          {description}
        </p>
        {children}
      </div>
    </div>
  );
} 