"use client";

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { LoanCard } from '@/components/LoanCard';
import { LoanForm } from '@/components/LoanForm';
import { LoanDetailsDialog } from '@/components/LoanDetailsDialog';
import { LoanCalculationDialog } from '@/components/LoanCalculationDialog';
import { formatCurrency, cn } from '@/lib/ui';
import { LoanDetails, AlertSeverity, CreateLoanRequest, UpdateLoanRequest } from '@/types/loan';
import { 
  CreditCard, 
  Plus, 
  Filter, 
  Search,
  TrendingUp,
  AlertTriangle,
  Calculator,
  Edit
} from 'lucide-react';
import { MetricCard } from '@/components/MetricCard';

type LoanWithDetails = LoanDetails & {
  account?: {
    id: string;
    name: string;
    type: string;
    balance: {
      current: number;
      available?: number | null;
      limit?: number | null;
    };
    balances?: Array<{ current: number; date: Date }>;
    nextMonthlyPayment?: number | null;
  };
  calculations?: {
    remainingPayments: number;
    totalInterest: number;
    payoffDate: Date;
    optimalPayment: number;
    interestSavings: number;
  };
}

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

async function fetchLoans(): Promise<{ data: LoanWithDetails[] }> {
  const response = await fetch('/api/loans?includeCalculations=true');
  if (!response.ok) {
    throw new Error('Failed to fetch loans');
  }
  return response.json();
}

async function fetchLoanSummary(): Promise<{ data: LoanSummary }> {
  const response = await fetch('/api/analytics/loan-summary');
  if (!response.ok) {
    throw new Error('Failed to fetch loan summary');
  }
  return response.json();
}

async function fetchAccounts(): Promise<Array<{
  id: string;
  name: string;
  type: string;
  balance: { current: number };
}>> {
  const response = await fetch('/api/accounts');
  if (!response.ok) {
    throw new Error('Failed to fetch accounts');
  }
  const accounts = await response.json();
  return accounts.map((account: any) => ({
    id: account.id,
    name: account.name,
    type: account.type,
    balance: { current: account.balance?.current || 0 }
  }));
}

async function fetchDetectedLoans(): Promise<Array<{
  accountId: string;
  accountName: string;
  suggestedLoanType: string;
  confidence: number;
  reason: string;
}>> {
  const response = await fetch('/api/loans/detect');
  if (!response.ok) {
    throw new Error('Failed to fetch detected loans');
  }
  const result = await response.json();
  return result.data || [];
}

export default function LoansPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLoanType, setSelectedLoanType] = useState<string>('all');
  const [showSensitiveData, setShowSensitiveData] = useState(true);
  const [isLoanFormOpen, setIsLoanFormOpen] = useState(false);
  const [editingLoan, setEditingLoan] = useState<LoanWithDetails | null>(null);
  const [isDetectionOpen, setIsDetectionOpen] = useState(false);
  const [selectedLoanForDetails, setSelectedLoanForDetails] = useState<LoanWithDetails | null>(null);
  const [selectedLoanForCalculation, setSelectedLoanForCalculation] = useState<LoanWithDetails | null>(null);
  const queryClient = useQueryClient();

  const {
    data: loansData,
    isLoading: loansLoading,
    error: loansError,
    refetch: refetchLoans
  } = useQuery({
    queryKey: ['loans'],
    queryFn: fetchLoans,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const {
    data: summaryData,
    isLoading: summaryLoading,
    error: summaryError
  } = useQuery({
    queryKey: ['loan-summary'],
    queryFn: fetchLoanSummary,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const {
    data: accounts,
    isLoading: accountsLoading,
    error: accountsError
  } = useQuery({
    queryKey: ['accounts'],
    queryFn: fetchAccounts,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const {
    data: detectedLoans,
    isLoading: detectedLoansLoading,
    error: detectedLoansError
  } = useQuery({
    queryKey: ['detected-loans'],
    queryFn: fetchDetectedLoans,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const loans = loansData?.data || [];
  const summary = summaryData?.data;

  // Filter loans based on search and type
  const filteredLoans = loans.filter(loan => {
    const accountName = loan.account?.name || '';
    const loanType = loan.loanType || '';
    const matchesSearch = accountName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         loanType.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = selectedLoanType === 'all' || loanType === selectedLoanType;
    return matchesSearch && matchesType;
  });

  const loanTypes = ['all', ...Array.from(new Set(loans.map(loan => loan.loanType || '').filter(Boolean)))];

  // Mutation for creating/updating loans
  const loanMutation = useMutation({
    mutationFn: async (data: CreateLoanRequest | UpdateLoanRequest) => {
      const url = editingLoan ? `/api/loans/${editingLoan.id}` : '/api/loans';
      const method = editingLoan ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error('Failed to save loan');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      queryClient.invalidateQueries({ queryKey: ['loan-summary'] });
      setIsLoanFormOpen(false);
      setEditingLoan(null);
    },
    onError: (error) => {
      console.error('Error saving loan:', error);
      alert('Failed to save loan. Please try again.');
    },
  });

  const handleAddLoan = () => {
    setEditingLoan(null);
    setIsLoanFormOpen(true);
  };

  const handleEditLoan = (loanId: string) => {
    const loan = loans.find(l => l.id === loanId);
    if (loan) {
      setEditingLoan(loan);
      setIsLoanFormOpen(true);
    }
  };

  const handleViewDetails = (loanId: string) => {
    const loan = loans.find(l => l.id === loanId);
    if (loan) {
      setSelectedLoanForDetails(loan);
    }
  };

  const handleCalculate = (loanId: string) => {
    const loan = loans.find(l => l.id === loanId);
    if (loan) {
      setSelectedLoanForCalculation(loan);
    }
  };

  const handleLoanSubmit = async (data: CreateLoanRequest | UpdateLoanRequest) => {
    await loanMutation.mutateAsync(data);
  };

  if (loansLoading || summaryLoading || accountsLoading) {
    return (
      <div className="max-w-screen-xl mx-auto px-4 lg:px-8 py-8">
        <div className="animate-pulse space-y-8">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (loansError || summaryError || accountsError) {
    return (
      <div className="max-w-screen-xl mx-auto px-4 lg:px-8 py-8">
        <Card className="border-error-200 dark:border-error-800">
          <CardHeader>
            <CardTitle className="text-error-800 dark:text-error-200">
              <AlertTriangle className="w-5 h-5 inline mr-2" />
              Error Loading Loans
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-error-700 dark:text-error-300 mb-4">
              Failed to load loan data. Please try again.
            </p>
            <Button
              variant="error"
              onClick={() => refetchLoans()}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-screen-xl mx-auto px-4 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Loans
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Manage your loans, track interest rates, and optimize payments
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Button onClick={() => setIsDetectionOpen(true)} variant="secondary">
              <Plus className="w-4 h-4 mr-2" />
              Add Loan
            </Button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          <MetricCard
            title="Total Debt"
            value={formatCurrency(summary.totalDebt)}
            color={summary.totalDebt > 100000 ? "text-red-600 dark:text-red-400" : 
                   summary.totalDebt > 50000 ? "text-orange-600 dark:text-orange-400" : 
                   "text-green-600 dark:text-green-400"}
          />
          <MetricCard
            title="Avg. Interest Rate"
            value={`${(summary.averageInterestRate || 0).toFixed(2)}%`}
            color={(summary.averageInterestRate || 0) > 15 ? "text-red-600 dark:text-red-400" : 
                   (summary.averageInterestRate || 0) > 10 ? "text-orange-600 dark:text-orange-400" : 
                   "text-green-600 dark:text-green-400"}
          />
          <MetricCard
            title="Monthly Payments"
            value={formatCurrency(summary.totalMonthlyPayments)}
            color="text-blue-600 dark:text-blue-400"
          />
          <MetricCard
            title="Active Alerts"
            value={String(summary.activeAlerts ?? 0)}
            color={summary.activeAlerts > 0 ? "text-red-600 dark:text-red-400" : "text-gray-600 dark:text-gray-400"}
          />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search loans by name or type..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
          />
        </div>
        <div className="relative flex items-center gap-3">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={selectedLoanType}
            onChange={(e) => setSelectedLoanType(e.target.value)}
            className="px-4 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent appearance-none cursor-pointer transition-colors"
          >
            {loanTypes.map(type => (
              <option key={type} value={type}>
                {type === 'all' ? 'All Types' : (type || '').replace('_', ' ').toUpperCase()}
              </option>
            ))}
          </select>
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Loans Grid */}
      {filteredLoans.length === 0 ? (
        <Card className="border-dashed border-2 border-gray-300 dark:border-gray-600">
          <CardContent className="p-12 text-center">
            <div className="w-20 h-20 mx-auto mb-6 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
              <CreditCard className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">
              {loans.length === 0 ? 'No Loans Added Yet' : 'No Loans Found'}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-md mx-auto">
              {loans.length === 0 
                ? 'Start tracking your loans to monitor interest rates, payments, and optimize your debt strategy.'
                : 'Try adjusting your search or filter criteria to find what you\'re looking for.'
              }
            </p>
            {loans.length === 0 && (
              <Button 
                onClick={handleAddLoan}
                className="px-6 py-3"
              >
                <Plus className="w-5 h-5 mr-2" />
                Add Your First Loan
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredLoans.map(loan => (
            <LoanCard
              key={loan.id}
              loan={loan}
              showSensitiveData={showSensitiveData}
              onEdit={handleEditLoan}
              onViewDetails={handleViewDetails}
              onCalculate={handleCalculate}
              variant="default"
            />
          ))}
        </div>
      )}

      {/* Results Summary */}
      {filteredLoans.length > 0 && (
        <div className="mt-8 text-center text-sm text-gray-600 dark:text-gray-400">
          Showing {filteredLoans.length} of {loans.length} loan{loans.length !== 1 ? 's' : ''}
        </div>
      )}

      {/* Loan Form Modal */}
      <LoanForm
        isOpen={isLoanFormOpen}
        onClose={() => {
          setIsLoanFormOpen(false);
          setEditingLoan(null);
        }}
        onSubmit={handleLoanSubmit}
        initialData={editingLoan ? {
          id: editingLoan.id,
          accountId: editingLoan.accountId,
          currentInterestRate: editingLoan.currentInterestRate,
          introductoryRate: editingLoan.introductoryRate,
          introductoryRateExpiry: editingLoan.introductoryRateExpiry,
          rateType: editingLoan.rateType,
          paymentsPerMonth: editingLoan.paymentsPerMonth,
          paymentsRemaining: editingLoan.paymentsRemaining,
          autoCalculatePayments: editingLoan.autoCalculatePayments,
          loanType: editingLoan.loanType,
          loanTerm: editingLoan.loanTerm,
          gracePeriod: editingLoan.gracePeriod,
        } : undefined}
        accounts={accounts || []}
        mode={editingLoan ? 'edit' : 'create'}
      />

      {/* Loan Detection Modal */}
      <Modal 
        isOpen={isDetectionOpen} 
        onClose={() => setIsDetectionOpen(false)} 
        title="Add Loan"
        subtitle="Choose how to add a loan - detect from Plaid accounts or add manually"
        icon={<CreditCard className="w-6 h-6 text-blue-500" />}
        maxWidth="max-w-2xl"
      >
        {/* Detected Loans */}
        {detectedLoans && detectedLoans.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Detected from Plaid ({detectedLoans.length})
            </h3>
            <div className="space-y-3">
              {detectedLoans.map((detection) => (
                <div key={detection.accountId} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white">{detection.accountName}</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Suggested: {detection.suggestedLoanType.replace('_', ' ').toUpperCase()}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-500">
                        {detection.reason} (Confidence: {detection.confidence}%)
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => {
                        // Pre-fill form with detection data
                        setEditingLoan({
                          id: '',
                          accountId: detection.accountId,
                          currentInterestRate: undefined,
                          introductoryRate: undefined,
                          introductoryRateExpiry: undefined,
                          rateType: undefined,
                          paymentsPerMonth: 1,
                          paymentsRemaining: undefined,
                          autoCalculatePayments: true,
                          loanType: detection.suggestedLoanType as any,
                          loanTerm: undefined,
                          gracePeriod: undefined,
                          userId: 'default',
                          currentInterestRateSource: 'manual',
                          introductoryRateSource: 'manual',
                          introductoryRateExpirySource: 'manual',
                          paymentsPerMonthSource: 'manual',
                          paymentsRemainingSource: 'user_provided',
                          createdAt: new Date(),
                          updatedAt: new Date(),
                          account: accounts?.find(a => a.id === detection.accountId)
                        } as any);
                        setIsDetectionOpen(false);
                        setIsLoanFormOpen(true);
                      }}
                    >
                      Use Detection
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Manual Entry Option */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Manual Entry</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Add loan details manually for any account
          </p>
          <Button
            onClick={() => {
              setIsDetectionOpen(false);
              setEditingLoan(null);
              setIsLoanFormOpen(true);
            }}
            variant="secondary"
          >
            <Edit className="w-4 h-4 mr-2" />
            Add Manually
          </Button>
        </div>
      </Modal>

      {/* Loan Details Dialog */}
      {selectedLoanForDetails && (
        <LoanDetailsDialog
          isOpen={!!selectedLoanForDetails}
          onClose={() => setSelectedLoanForDetails(null)}
          loan={selectedLoanForDetails}
        />
      )}

      {/* Loan Calculation Dialog */}
      {selectedLoanForCalculation && (
        <LoanCalculationDialog
          isOpen={!!selectedLoanForCalculation}
          onClose={() => setSelectedLoanForCalculation(null)}
          loan={selectedLoanForCalculation}
        />
      )}
    </div>
  );
} 