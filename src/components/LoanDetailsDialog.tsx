"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import ReactDOM from "react-dom";
import { XMarkIcon, InformationCircleIcon, PencilIcon, ChevronUpIcon, ChevronDownIcon } from "@heroicons/react/24/outline";
import { formatBalance } from "@/lib/formatters";
import { useSensitiveData } from "@/app/providers";
import { EntityLinkList } from "./EntityLinkList";
import { TransactionLinker } from "./TransactionLinker";
import { LoanDetails } from "@/types/loan";
import { TransactionLink } from "@/types/transactionLink";
import { Button } from "./ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/Card";
import { Modal } from './ui/Modal';
import { TransactionList } from "./TransactionList";
import { FileText } from 'lucide-react';
import { Pagination, SortConfig, SortableHeader } from "@/components/ui/Pagination";
import { Transaction } from '@prisma/client';

interface LoanDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  loan: LoanDetails & {
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
  };
}

export function LoanDetailsDialog({ 
  isOpen, 
  onClose, 
  loan 
}: LoanDetailsDialogProps) {
  const { showSensitiveData } = useSensitiveData();
  const [isMounted, setIsMounted] = useState(false);
  const [showLinker, setShowLinker] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  
  // Transaction list state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: "date",
    direction: "desc",
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState<"all" | "30days" | "90days" | "6months" | "1year">("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  // New: State for linked transactions
  const [linkedTransactions, setLinkedTransactions] = useState<Transaction[]>([]);
  const [isLoadingLinked, setIsLoadingLinked] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Load transactions when dialog opens
  useEffect(() => {
    if (isOpen) {
      const loadTransactions = async () => {
        setIsLoadingTransactions(true);
        try {
          const response = await fetch('/api/transactions?limit=1000');
          if (response.ok) {
            const data = await response.json();
            setTransactions(data.transactions || []);
          } else {
            console.error('Failed to fetch transactions');
            setTransactions([]);
          }
        } catch (error) {
          console.error('Error loading transactions:', error);
          setTransactions([]);
        } finally {
          setIsLoadingTransactions(false);
        }
      };

      loadTransactions();
    }
  }, [isOpen]);

  // Fetch linked transactions for this loan
  useEffect(() => {
    if (!loan?.id) return;
    setIsLoadingLinked(true);
    fetch(`/api/transactions/links?entityType=loan&entityId=${loan.id}`)
      .then(res => res.json())
      .then(data => {
        // The API returns an array of TransactionLink objects, each with a transactionId and transaction
        setLinkedTransactions((data.data || []).map((link: any) => link.transaction));
      })
      .catch(() => setLinkedTransactions([]))
      .finally(() => setIsLoadingLinked(false));
  }, [loan?.id]);

  // Handle ESC key and click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !showLinker && !showEditForm) {
        onClose();
      }
    };

    const handleClickOutside = (event: MouseEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(event.target as Node)) {
        if (!showLinker && !showEditForm) {
          onClose();
        }
      }
    };

    // Add event listeners
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);

    // Prevent body scroll when dialog is open
    document.body.style.overflow = 'hidden';

    // Cleanup
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose, showLinker, showEditForm]);

  const handleLinkCreated = (link: TransactionLink) => {
    // Refresh the linked transactions list
    if (loan?.id) {
      setIsLoadingLinked(true);
      fetch(`/api/transactions/links?entityType=loan&entityId=${loan.id}`)
        .then(res => res.json())
        .then(data => {
          setLinkedTransactions((data.data || []).map((link: any) => link.transaction));
        })
        .catch(() => setLinkedTransactions([]))
        .finally(() => setIsLoadingLinked(false));
    }
    setShowLinker(false);
  };

  const handleShowLinker = () => {
    setShowLinker(true);
  };

  const handleCloseLinker = () => {
    setShowLinker(false);
  };

  const handleEditLoan = () => {
    setShowEditForm(true);
  };

  const handleCloseEditForm = () => {
    setShowEditForm(false);
  };

  const handleSaveLoan = async (updatedData: Partial<LoanDetails>) => {
    try {
      const response = await fetch(`/api/loans/${loan.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData),
      });
      
      if (response.ok) {
        setShowEditForm(false);
        // You might want to refresh the loan data here
        window.location.reload(); // Simple refresh for now
      }
    } catch (error) {
      console.error('Failed to update loan:', error);
    }
  };

  // Get unique categories for filtering
  const uniqueCategories = useMemo(() => {
    const categories = new Set<string>();
    transactions.forEach(transaction => {
      const category = (transaction as any).categoryAi || transaction.category;
      if (category) {
        categories.add(category);
      }
    });
    return Array.from(categories).sort();
  }, [transactions]);

  // Filter and sort transactions
  const filteredAndSortedTransactions = useMemo(() => {
    let filtered = transactions;

    // Apply date filter
    if (dateFilter !== "all") {
      const now = new Date();
      let cutoffDate: Date;
      
      switch (dateFilter) {
        case "30days":
          cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case "90days":
          cutoffDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        case "6months":
          cutoffDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
          break;
        case "1year":
          cutoffDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
        default:
          cutoffDate = new Date(0);
      }
      
      filtered = filtered.filter(transaction => new Date(transaction.date) >= cutoffDate);
    }

    // Apply category filter
    if (categoryFilter !== "all") {
      filtered = filtered.filter(transaction => {
        const category = (transaction as any).categoryAi || transaction.category;
        return category === categoryFilter;
      });
    }

    // Apply search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(transaction => 
        transaction.name.toLowerCase().includes(term) ||
        (transaction.category && transaction.category.toLowerCase().includes(term)) ||
        ((transaction as any).categoryAi && (transaction as any).categoryAi.toLowerCase().includes(term))
      );
    }

    // Sort transactions
    filtered.sort((a, b) => {
      const aValue = a[sortConfig.key as keyof typeof a];
      const bValue = b[sortConfig.key as keyof typeof b];

      if (typeof aValue === "string" && typeof bValue === "string") {
        // Handle date strings specially
        if (sortConfig.key === "date") {
          const aDate = new Date(aValue);
          const bDate = new Date(bValue);
          const comparison = aDate.getTime() - bDate.getTime();
          return sortConfig.direction === "asc" ? comparison : -comparison;
        }
        
        const comparison = aValue.localeCompare(bValue);
        return sortConfig.direction === "asc" ? comparison : -comparison;
      }

      if (typeof aValue === "number" && typeof bValue === "number") {
        const comparison = aValue - bValue;
        return sortConfig.direction === "asc" ? comparison : -comparison;
      }

      return 0;
    });

    return filtered;
  }, [transactions, sortConfig, searchTerm, dateFilter, categoryFilter]);

  // Paginate transactions
  const paginatedTransactions = useMemo(() => {
    const totalPages = Math.ceil(filteredAndSortedTransactions.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return {
      transactions: filteredAndSortedTransactions.slice(startIndex, endIndex),
      totalPages,
    };
  }, [filteredAndSortedTransactions, currentPage, itemsPerPage]);

  const handleSort = (key: string) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
    setCurrentPage(1); // Reset to first page when sorting
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1); // Reset to first page when changing items per page
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1); // Reset to first page when searching
  };

  const handleDateFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setDateFilter(e.target.value as "all" | "30days" | "90days" | "6months" | "1year");
    setCurrentPage(1); // Reset to first page when filtering
  };

  const handleCategoryFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCategoryFilter(e.target.value);
    setCurrentPage(1); // Reset to first page when filtering
  };

  const clearFilters = () => {
    setSearchTerm("");
    setDateFilter("all");
    setCategoryFilter("all");
    setCurrentPage(1);
  };

  const hasActiveFilters = searchTerm || dateFilter !== "all" || categoryFilter !== "all";

  const handleUnlinkTransaction = async (transactionId: string) => {
    if (!loan?.id) return;
    
    try {
      const response = await fetch(`/api/transactions/links?entityType=loan&entityId=${loan.id}&transactionId=${transactionId}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        // Remove the transaction from the linked transactions list
        setLinkedTransactions(prev => prev.filter(t => t.id !== transactionId));
      } else {
        console.error('Failed to unlink transaction');
      }
    } catch (error) {
      console.error('Error unlinking transaction:', error);
    }
  };

  // Calculate sum of linked payments (convert from cents to dollars for calculation)
  const sumLinkedPayments = useMemo(() => linkedTransactions.reduce((sum, t) => sum + (t.amount || 0), 0), [linkedTransactions]);
  const expectedBalance = loan.originalAmount != null ? (loan.originalAmount / 100) - sumLinkedPayments : null;
  const hasDiscrepancy = loan.currentBalance != null && expectedBalance != null && Math.abs((loan.currentBalance / 100) - expectedBalance) > 0.01 && !loan.balanceOverride;

  const handleAcceptOverride = async () => {
    await handleSaveLoan({ balanceOverride: true, overrideDate: new Date().toISOString() });
  };

  // Don't render if not open
  if (!isOpen) {
    return null;
  }

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Loan Details"
        subtitle={loan.account?.name || 'Unknown Account'}
        icon={<FileText className="w-6 h-6 text-gray-400" />}
        maxWidth="max-w-4xl"
        footer={
          <div className="flex gap-3 justify-end w-full">
            <Button variant="primary" onClick={handleShowLinker}>
              Link Transactions
            </Button>
            <Button variant="outline" onClick={handleEditLoan}>
              Edit Loan
            </Button>
          </div>
        }
      >
        {/* Loan Information and Calculations */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-0">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Loan Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-500 dark:text-gray-400 font-normal">Account:</span>
                <span className="text-gray-900 dark:text-white font-medium">
                  {loan.account?.name || 'N/A'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 dark:text-gray-400 font-normal">Current Balance:</span>
                <span className="text-gray-900 dark:text-white font-medium">
                  {showSensitiveData ? formatBalance(loan.account?.balance?.current || 0) : '••••••'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 dark:text-gray-400 font-normal">Interest Rate:</span>
                <span className="text-gray-900 dark:text-white font-medium">
                  {showSensitiveData ? `${loan.currentInterestRate?.toFixed(2)}%` : '••••••'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 dark:text-gray-400 font-normal">Rate Type:</span>
                <span className="text-gray-900 dark:text-white font-medium">
                  {loan.rateType || 'N/A'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 dark:text-gray-400 font-normal">Payments per Month:</span>
                <span className="text-gray-900 dark:text-white font-medium">
                  {loan.paymentsPerMonth || 'N/A'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 dark:text-gray-400 font-normal">Original Amount:</span>
                <span className="text-gray-900 dark:text-white font-medium">
                  {loan.originalAmount != null ? formatBalance(loan.originalAmount / 100) : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 dark:text-gray-400 font-normal">Current Balance:</span>
                <span className="text-gray-900 dark:text-white font-medium">
                  {loan.currentBalance != null ? formatBalance(loan.currentBalance / 100) : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 dark:text-gray-400 font-normal">Start Date:</span>
                <span className="text-gray-900 dark:text-white font-medium">
                  {loan.startDate ? (typeof loan.startDate === 'string' ? loan.startDate : new Date(loan.startDate).toLocaleDateString()) : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 dark:text-gray-400 font-normal">Payments Made:</span>
                <span className="text-gray-900 dark:text-white font-medium">
                  {loan.paymentsMade != null ? formatBalance(loan.paymentsMade / 100) : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 dark:text-gray-400 font-normal">Override Active:</span>
                <span className="text-gray-900 dark:text-white font-medium">
                  {loan.balanceOverride ? `Yes (as of ${loan.overrideDate ? (typeof loan.overrideDate === 'string' ? loan.overrideDate : new Date(loan.overrideDate).toLocaleDateString()) : 'N/A'})` : 'No'}
                </span>
              </div>
              {loan.loanType && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 dark:text-gray-400 font-normal">Loan Type:</span>
                  <span className="text-gray-900 dark:text-white font-medium capitalize">
                    {loan.loanType.replace('_', ' ')}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Calculations</CardTitle>
            </CardHeader>
            <CardContent>
              {loan.calculations ? (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 dark:text-gray-400 font-normal">Remaining Payments:</span>
                    <span className="text-gray-900 dark:text-white font-medium">
                      {loan.calculations.remainingPayments}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 dark:text-gray-400 font-normal">Total Interest:</span>
                    <span className="text-gray-900 dark:text-white font-medium">
                      {showSensitiveData ? formatBalance(loan.calculations.totalInterest) : '••••••'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 dark:text-gray-400 font-normal">Payoff Date:</span>
                    <span className="text-gray-900 dark:text-white font-medium">
                      {new Date(loan.calculations.payoffDate).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 dark:text-gray-400 font-normal">Optimal Payment:</span>
                    <span className="text-gray-900 dark:text-white font-medium">
                      {showSensitiveData ? formatBalance(loan.calculations.optimalPayment) : '••••••'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 dark:text-gray-400 font-normal">Interest Savings:</span>
                    <span className="text-green-600 dark:text-green-400 font-medium">
                      {showSensitiveData ? formatBalance(loan.calculations.interestSavings) : '••••••'}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-gray-500 dark:text-gray-400 text-sm">
                  Calculations not available
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        {/* Linked Transactions Section */}
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-2">Linked Transactions</h3>
          {isLoadingLinked ? (
            <div className="p-4 text-center text-gray-500">Loading linked transactions...</div>
          ) : linkedTransactions.length === 0 ? (
            <div className="p-4 text-center text-gray-500">No transactions linked to this loan.</div>
          ) : (
            <TransactionList
              accountId={loan.accountId}
              initialTransactions={linkedTransactions}
              downloadLogs={[]}
              hideDownloadHistory={true}
              hideTransactionRecordsHeader={true}
              onUnlinkTransaction={handleUnlinkTransaction}
            />
          )}
        </div>
        {/* Discrepancy Alert and Override */}
        {hasDiscrepancy && (
          <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <div className="text-yellow-800 dark:text-yellow-200 font-semibold mb-2">Balance Discrepancy Detected</div>
            <div className="text-sm text-yellow-700 dark:text-yellow-300 mb-2">
              The current balance (${loan.currentBalance}) does not match the original amount minus the sum of linked payments (${expectedBalance}).
              <br />
              If this is correct, you can accept the current balance as the state of truth and move forward. This will block linking of older transactions.
            </div>
            <Button onClick={handleAcceptOverride} variant="warning">Accept Current Balance as State of Truth</Button>
          </div>
        )}
        {/* Edit Loan Modal */}
        <Modal
          isOpen={showEditForm}
          onClose={handleCloseEditForm}
          title="Edit Loan Details"
          maxWidth="max-w-4xl"
          footer={
            <div className="flex gap-3 justify-end w-full">
              <Button onClick={handleCloseEditForm} variant="secondary">
                Cancel
              </Button>
              <Button 
                type="submit" 
                form="loan-edit-form"
                disabled={false}
              >
                Save Changes
              </Button>
            </div>
          }
        >
          <LoanEditForm
            loan={loan}
            onSave={handleSaveLoan}
            onCancel={handleCloseEditForm}
            showSensitiveData={showSensitiveData}
          />
        </Modal>
      </Modal>
      {showLinker && (
        <Modal
          isOpen={showLinker}
          onClose={handleCloseLinker}
          title="Link Transactions"
          maxWidth="max-w-3xl"
        >
          <TransactionLinker
            entityType="loan"
            entityId={loan.id}
            initialTransactions={transactions}
            onLinkCreated={handleLinkCreated}
            onCancel={handleCloseLinker}
            showSensitiveData={showSensitiveData}
            isLoading={isLoadingTransactions}
          />
        </Modal>
      )}
    </>
  );
}

// Loan Edit Form Component
interface LoanEditFormProps {
  loan: LoanDetails & {
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
  };
  onSave: (data: Partial<LoanDetails>) => void;
  onCancel: () => void;
  showSensitiveData: boolean;
}

function LoanEditForm({ loan, onSave, onCancel, showSensitiveData }: LoanEditFormProps) {
  // Convert cents to dollars for display
  const [formData, setFormData] = useState({
    currentInterestRate: loan.currentInterestRate || 0,
    currentInterestRateSource: loan.currentInterestRateSource || 'manual',
    paymentsPerMonth: loan.paymentsPerMonth || 1,
    paymentsPerMonthSource: loan.paymentsPerMonthSource || 'manual',
    paymentsRemaining: loan.paymentsRemaining || 0,
    paymentsRemainingSource: loan.paymentsRemainingSource || 'manual',
    loanTerm: loan.loanTerm || 0,
    loanTermSource: loan.loanTermSource || 'manual',
    // Values are already in dollars, no conversion needed
    originalAmount: loan.originalAmount != null ? loan.originalAmount : loan.account?.originationPrincipalAmount != null ? loan.account.originationPrincipalAmount : 0,
    currentBalance: loan.currentBalance != null ? loan.currentBalance : loan.account?.balance?.current != null ? loan.account.balance.current : 0,
    startDate: loan.startDate ? new Date(loan.startDate).toISOString().split('T')[0] : (loan.account?.originationDate ? new Date(loan.account.originationDate).toISOString().split('T')[0] : ''),
    paymentsMade: loan.paymentsMade != null ? loan.paymentsMade : 0,
    balanceOverride: loan.balanceOverride || false,
    overrideDate: loan.overrideDate ? new Date(loan.overrideDate).toISOString().split('T')[0] : '',
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      // Values are already in dollars, no conversion needed
      await onSave({
        ...formData,
        originalAmount: formData.originalAmount || 0,
        currentBalance: formData.currentBalance || 0,
        paymentsMade: formData.paymentsMade || 0,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Edit Loan Details
        </h2>
        <button
          onClick={onCancel}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          <XMarkIcon className="w-6 h-6" />
        </button>
      </div>

      <form id="loan-edit-form" onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Current Interest Rate (%)
            <span className="ml-2 text-xs text-gray-500">[{formData.currentInterestRateSource}]</span>
          </label>
          <input
            type="number"
            step="0.01"
            value={formData.currentInterestRate}
            onChange={(e) => setFormData(prev => ({ ...prev, currentInterestRate: parseFloat(e.target.value) || 0 }))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={!showSensitiveData}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Payments per Month
            <span className="ml-2 text-xs text-gray-500">[{formData.paymentsPerMonthSource}]</span>
          </label>
          <input
            type="number"
            min="1"
            value={formData.paymentsPerMonth}
            onChange={(e) => setFormData(prev => ({ ...prev, paymentsPerMonth: parseInt(e.target.value) || 1 }))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Remaining Payments
            <span className="ml-2 text-xs text-gray-500">[{formData.paymentsRemainingSource}]</span>
          </label>
          <input
            type="number"
            min="0"
            value={formData.paymentsRemaining}
            onChange={(e) => setFormData(prev => ({ ...prev, paymentsRemaining: parseInt(e.target.value) || 0 }))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Loan Term (months)
            <span className="ml-2 text-xs text-gray-500">[{formData.loanTermSource}]</span>
          </label>
          <input
            type="number"
            min="1"
            value={formData.loanTerm}
            onChange={(e) => setFormData(prev => ({ ...prev, loanTerm: parseInt(e.target.value) || 0 }))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Original Amount
          </label>
          <input
            type="number"
            min="0"
            value={formData.originalAmount}
            onChange={(e) => setFormData(prev => ({ ...prev, originalAmount: parseFloat(e.target.value) || 0 }))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Current Balance
          </label>
          <input
            type="number"
            min="0"
            value={formData.currentBalance}
            onChange={(e) => setFormData(prev => ({ ...prev, currentBalance: parseFloat(e.target.value) || 0 }))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Start Date
          </label>
          <input
            type="date"
            value={formData.startDate}
            onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Payments Made
          </label>
          <input
            type="number"
            min="0"
            value={formData.paymentsMade}
            onChange={(e) => setFormData(prev => ({ ...prev, paymentsMade: parseFloat(e.target.value) || 0 }))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        {/* Optionally, show override status and date (read-only) */}
        {formData.balanceOverride && (
          <div className="text-yellow-700 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 rounded p-2">
            <strong>Override Active:</strong> Balance override is in effect as of {formData.overrideDate || 'N/A'}.
          </div>
        )}


      </form>
    </div>
  );
} 