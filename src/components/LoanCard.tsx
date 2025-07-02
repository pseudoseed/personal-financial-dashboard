import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { formatCurrency, formatPercentage, cn, badgeVariants } from '@/lib/ui';
import { LoanDetails, DataSource, AlertSeverity } from '@/types/loan';
import { 
  CreditCard, 
  Calendar, 
  DollarSign, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown,
  Edit,
  Eye,
  Calculator,
  Clock,
  Shield,
  MoreHorizontal
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

interface LoanCardProps {
  loan: LoanDetails & {
    account?: {
      name: string;
      balances?: Array<{ current: number; date: Date }>;
      nextMonthlyPayment?: number | null;
    };
    alerts?: Array<{
      id: string;
      alertType: string;
      title: string;
      message: string;
      severity: AlertSeverity;
    }>;
    calculations?: {
      remainingPayments: number;
      totalInterest: number;
      payoffDate: Date;
      optimalPayment: number;
      interestSavings: number;
    };
  };
  showSensitiveData?: boolean;
  onEdit?: (loanId: string) => void;
  onViewDetails?: (loanId: string) => void;
  onCalculate?: (loanId: string) => void;
  className?: string;
  variant?: 'default' | 'compact' | 'detailed';
}

// Data Source Indicator Component
const DataSourceIndicator: React.FC<{ source?: DataSource; field: string }> = ({ source, field }) => {
  if (!source || source === 'manual') return null;
  
  const getIcon = () => {
    switch (source) {
      case 'plaid':
        return <Shield className="w-3 h-3" />;
      case 'calculated':
        return <Calculator className="w-3 h-3" />;
      default:
        return null;
    }
  };

  const getColor = () => {
    switch (source) {
      case 'plaid':
        return 'text-blue-600 dark:text-blue-400';
      case 'calculated':
        return 'text-green-600 dark:text-green-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  return (
    <div className={cn("flex items-center gap-1", getColor())}>
      {getIcon()}
      <span className="text-xs capitalize">{source}</span>
    </div>
  );
};

// Alert Badge Component
const AlertBadge: React.FC<{ severity: AlertSeverity; count: number }> = ({ severity, count }) => {
  const getColor = () => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      case 'high':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      default:
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
    }
  };

  return (
    <span className={cn("inline-flex items-center px-2 py-1 rounded-full text-xs font-medium", getColor())}>
      <AlertTriangle className="w-3 h-3 mr-1" />
      {count}
    </span>
  );
};

export const LoanCard: React.FC<LoanCardProps> = ({
  loan,
  showSensitiveData = true,
  onEdit,
  onViewDetails,
  onCalculate,
  className,
  variant = 'default'
}) => {
  const currentBalance = loan.account?.balances?.[0]?.current || 0;
  const monthlyPayment = loan.account?.nextMonthlyPayment || 0;
  const activeAlerts = loan.alerts?.filter(alert => !alert.isDismissed) || [];
  const criticalAlerts = activeAlerts.filter(alert => alert.severity === 'critical');
  const highAlerts = activeAlerts.filter(alert => alert.severity === 'high');
  const [actionsOpen, setActionsOpen] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (actionsRef.current && !actionsRef.current.contains(event.target as Node)) {
        setActionsOpen(false);
      }
    }
    if (actionsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [actionsOpen]);

  const getLoanTypeIcon = () => {
    switch (loan.loanType) {
      case 'credit_card':
        return <CreditCard className="w-8 h-8" />;
      case 'mortgage':
        return <TrendingUp className="w-8 h-8" />;
      case 'auto':
        return <TrendingDown className="w-8 h-8" />;
      case 'student':
        return <Calendar className="w-8 h-8" />;
      default:
        return <DollarSign className="w-8 h-8" />;
    }
  };

  const getLoanTypeColor = () => {
    switch (loan.loanType) {
      case 'credit_card':
        return 'text-red-600 dark:text-red-400';
      case 'mortgage':
        return 'text-blue-600 dark:text-blue-400';
      case 'auto':
        return 'text-green-600 dark:text-green-400';
      case 'student':
        return 'text-purple-600 dark:text-purple-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getBalanceColor = (balance: number) => {
    if (balance > 100000) return 'text-red-600 dark:text-red-400';
    if (balance > 50000) return 'text-orange-600 dark:text-orange-400';
    if (balance > 10000) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-green-600 dark:text-green-400';
  };

  const getInterestColor = (rate: number) => {
    if (rate > 15) return 'text-red-600 dark:text-red-400';
    if (rate > 10) return 'text-orange-600 dark:text-orange-400';
    if (rate > 5) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-green-600 dark:text-green-400';
  };

  if (variant === 'compact') {
    return (
      <Card className={cn("hover:shadow-md transition-shadow", className)}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn("p-2 rounded-full bg-gray-100 dark:bg-gray-800", getLoanTypeColor())}>
                {getLoanTypeIcon()}
              </div>
              <div>
                <h4 className="font-medium text-sm text-gray-900 dark:text-gray-100">
                  {loan.account?.name}
                </h4>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {loan.loanType ? loan.loanType.replace('_', ' ').toUpperCase() : 'LOAN'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className={cn("text-sm font-medium", getBalanceColor(currentBalance))}>
                {showSensitiveData ? formatCurrency(currentBalance) : '••••••'}
              </p>
              {activeAlerts.length > 0 && (
                <AlertBadge severity="high" count={activeAlerts.length} />
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("hover:shadow-lg transition-all duration-200 p-4", className)}>
      <div className="flex flex-row items-start gap-3">
        <div className="flex items-start justify-center mt-0.5">
          {getLoanTypeIcon()}
        </div>
        <div className="flex flex-col justify-start">
          <span className="text-lg font-bold text-gray-900 dark:text-gray-100 leading-tight">
            {loan.account?.name}
          </span>
          <span className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {loan.loanType ? loan.loanType.replace('_', ' ').toUpperCase() : 'LOAN'}
          </span>
        </div>
        <div className="flex-1 flex justify-end items-start">
          {/* Actions Dropdown */}
          <div className="relative" ref={actionsRef}>
            <button
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none"
              onClick={() => setActionsOpen((open) => !open)}
              aria-label="Loan actions"
            >
              <MoreHorizontal className="w-6 h-6 text-gray-500" />
            </button>
            {actionsOpen && (
              <div className="absolute right-0 mt-2 w-44 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-20">
                {onViewDetails && (
                  <button
                    className="flex items-center w-full px-4 py-2 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm"
                    onClick={() => { setActionsOpen(false); onViewDetails(loan.id); }}
                  >
                    <Eye className="w-4 h-4 mr-2" /> Details
                  </button>
                )}
                {onCalculate && (
                  <button
                    className="flex items-center w-full px-4 py-2 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm"
                    onClick={() => { setActionsOpen(false); onCalculate(loan.id); }}
                  >
                    <Calculator className="w-4 h-4 mr-2" /> Calculate
                  </button>
                )}
                {onEdit && (
                  <button
                    className="flex items-center w-full px-4 py-2 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm"
                    onClick={() => { setActionsOpen(false); onEdit(loan.id); }}
                  >
                    <Edit className="w-4 h-4 mr-2" /> Edit
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="mt-4 flex justify-center">
        <div className="w-full max-w-[80%]">
          <div className="grid grid-cols-2 gap-y-3 gap-x-6">
            {/* Current Balance */}
            <div className="flex flex-col items-center text-center">
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Current Balance</p>
              <p className={cn("text-lg font-bold", getBalanceColor(currentBalance))}>
                {showSensitiveData ? formatCurrency(currentBalance) : '••••••'}
              </p>
            </div>
            {/* Interest Rate */}
            <div className="flex flex-col items-center text-center">
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Interest Rate</p>
              <p className={cn("text-lg font-bold", getInterestColor(loan.currentInterestRate || 0))}>
                {showSensitiveData ? formatPercentage(loan.currentInterestRate || 0) : '••••••'}
              </p>
            </div>
            {/* Monthly Payment */}
            <div className="flex flex-col items-center text-center">
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Monthly Payment</p>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {showSensitiveData ? formatCurrency(monthlyPayment) : '••••••'}
              </p>
            </div>
            {/* Empty cell for grid alignment */}
            <div></div>
            {/* Quick Stats */}
            {loan.calculations && (
              <>
                <div className="pt-3 border-t border-gray-200 dark:border-gray-700 col-span-2"></div>
                <div className="flex flex-col items-center text-center">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Remaining:</span>
                  <p className="text-base font-semibold text-gray-900 dark:text-gray-100 mt-0.5">
                    {loan.calculations.remainingPayments} payments
                  </p>
                </div>
                <div className="flex flex-col items-center text-center">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Payoff:</span>
                  <p className="text-base font-semibold text-gray-900 dark:text-gray-100 mt-0.5">
                    {new Date(loan.calculations.payoffDate).toLocaleDateString()}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}; 