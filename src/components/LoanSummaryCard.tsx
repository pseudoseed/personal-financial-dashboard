import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { formatCurrency, formatPercentage, cn, badgeVariants } from '@/lib/ui';
import { 
  CreditCard, 
  TrendingUp, 
  AlertTriangle, 
  DollarSign, 
  Calendar,
  Eye,
  EyeOff,
  Plus,
  Calculator
} from 'lucide-react';
import { MetricCard } from '@/components/MetricCard';

interface LoanSummary {
  totalDebt: number;
  averageInterestRate: number;
  totalMonthlyPayments: number;
  totalInterestProjected: number;
  activeAlerts: number;
  loansCount: number;
  nextPaymentDue?: Date;
  introRateExpiringSoon: boolean;
}

interface LoanSummaryCardProps {
  className?: string;
  onViewAllLoans?: () => void;
  onAddLoan?: () => void;
}

async function fetchLoanSummary(): Promise<{ data: LoanSummary }> {
  const response = await fetch('/api/analytics/loan-summary?includeCalculations=true');
  if (!response.ok) {
    throw new Error('Failed to fetch loan summary');
  }
  return response.json();
}

export const LoanSummaryCard: React.FC<LoanSummaryCardProps> = ({
  className,
  onViewAllLoans,
  onAddLoan
}) => {
  const {
    data: loanData,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['loan-summary'],
    queryFn: fetchLoanSummary,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  const summary = loanData?.data;

  if (isLoading) {
    return (
      <Card className={cn("animate-pulse", className)}>
        <CardHeader>
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={cn("border-error-200 dark:border-error-800", className)}>
        <CardHeader>
          <CardTitle className="text-error-800 dark:text-error-200">
            <AlertTriangle className="w-5 h-5 inline mr-2" />
            Loan Data Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-error-700 dark:text-error-300 mb-4">
            Failed to load loan data. Please try again.
          </p>
          <Button
            variant="error"
            size="sm"
            onClick={() => refetch()}
          >
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!summary || summary.loansCount === 0) {
    return (
      <Card className={cn("border-dashed border-2", className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Loans
          </CardTitle>
          <CardDescription>
            Track your loans and interest rates
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <CreditCard className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              No Loans Added
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Add your loans to track interest rates, payments, and get insights.
            </p>
            {onAddLoan && (
              <Button onClick={onAddLoan} className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Loan
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  const getDebtColor = (debt: number) => {
    if (debt > 100000) return 'text-error-600 dark:text-error-400';
    if (debt > 50000) return 'text-warning-600 dark:text-warning-400';
    return 'text-success-600 dark:text-success-400';
  };

  const getInterestColor = (rate: number) => {
    if (rate > 15) return 'text-error-600 dark:text-error-400';
    if (rate > 8) return 'text-warning-600 dark:text-warning-400';
    return 'text-success-600 dark:text-success-400';
  };

  return (
    <Card className={cn("relative", className)}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary-600" />
            <CardTitle className="text-lg">Loans</CardTitle>
            {summary.activeAlerts > 0 && (
              <span className={cn(badgeVariants({ variant: 'error' }), "text-xs")}>
                {summary.activeAlerts}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {onViewAllLoans && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onViewAllLoans}
                className="text-xs"
              >
                View All
              </Button>
            )}
          </div>
        </div>
        <CardDescription>
          {summary.loansCount} active loan{summary.loansCount !== 1 ? 's' : ''}
          {summary.introRateExpiringSoon && (
            <span className="text-warning-600 dark:text-warning-400 ml-2">
              • Intro rate expiring soon
            </span>
          )}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Total Debt */}
        <MetricCard
          title="Total Debt"
          value={formatCurrency(summary.totalDebt)}
          color={getDebtColor(summary.totalDebt)}
        />

        {/* Average Interest Rate */}
        <MetricCard
          title="Avg. Interest Rate"
          value={formatPercentage(summary.averageInterestRate || 0)}
          color={getInterestColor(summary.averageInterestRate || 0)}
        />

        {/* Monthly Payments */}
        <MetricCard
          title="Monthly Payments"
          value={formatCurrency(summary.totalMonthlyPayments)}
        />

        {/* Projected Interest */}
        <MetricCard
          title="Projected Interest"
          value={formatCurrency(summary.totalInterestProjected)}
          color="text-warning-600 dark:text-warning-400"
        />

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          {onAddLoan && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onAddLoan}
              className="flex-1"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Loan
            </Button>
          )}
          {onViewAllLoans && (
            <Button
              variant="primary"
              size="sm"
              onClick={onViewAllLoans}
              className="flex-1"
            >
              Manage Loans
            </Button>
          )}
        </div>

        {/* Alerts Summary */}
        {summary.activeAlerts > 0 && (
          <div className="mt-4 p-3 bg-warning-50 dark:bg-warning-900/20 border border-warning-200 dark:border-warning-800 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-warning-600 dark:text-warning-400" />
              <span className="text-sm font-medium text-warning-800 dark:text-warning-200">
                {summary.activeAlerts} active alert{summary.activeAlerts !== 1 ? 's' : ''}
              </span>
            </div>
            <p className="text-xs text-warning-700 dark:text-warning-300 mt-1">
              Review your loans for important updates and recommendations.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}; 