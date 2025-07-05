import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { formatCurrency, formatPercentage } from '@/lib/ui';
import { LoanType, RateType, DataSource, CreateLoanRequest, UpdateLoanRequest } from '@/types/loan';
import { 
  CreditCard, 
  Calendar, 
  DollarSign, 
  TrendingUp, 
  Edit,
  Shield,
  Calculator,
  Save,
  X
} from 'lucide-react';

interface LoanFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateLoanRequest | UpdateLoanRequest) => Promise<void>;
  initialData?: {
    id?: string;
    accountId: string;
    currentInterestRate?: number | null;
    introductoryRate?: number | null;
    introductoryRateExpiry?: Date | null;
    rateType?: RateType | null;
    paymentsPerMonth?: number | null;
    paymentsRemaining?: number | null;
    autoCalculatePayments?: boolean;
    loanType?: LoanType | null;
    loanTerm?: number | null;
    gracePeriod?: number | null;
    originalAmount?: number | null;
    currentBalance?: number | null;
    startDate?: string | undefined;
    paymentsMade?: number | null;
  };
  accounts?: Array<{
    id: string;
    name: string;
    type: string;
    balance: { current: number };
  }>;
  mode: 'create' | 'edit';
}

const LOAN_TYPES: { value: LoanType; label: string; icon: React.ReactNode }[] = [
  { value: 'mortgage', label: 'Mortgage', icon: <TrendingUp className="w-4 h-4" /> },
  { value: 'auto', label: 'Auto Loan', icon: <CreditCard className="w-4 h-4" /> },
  { value: 'personal', label: 'Personal Loan', icon: <DollarSign className="w-4 h-4" /> },
  { value: 'student', label: 'Student Loan', icon: <Calendar className="w-4 h-4" /> },
  { value: 'credit_card', label: 'Credit Card', icon: <CreditCard className="w-4 h-4" /> },
];

const RATE_TYPES: { value: RateType; label: string }[] = [
  { value: 'fixed', label: 'Fixed Rate' },
  { value: 'variable', label: 'Variable Rate' },
  { value: 'introductory', label: 'Introductory Rate' },
];

export const LoanForm: React.FC<LoanFormProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  accounts = [],
  mode
}) => {
  const [formData, setFormData] = useState<Omit<CreateLoanRequest, 'startDate'> & { startDate?: string }>({
    accountId: '',
    currentInterestRate: undefined,
    introductoryRate: undefined,
    introductoryRateExpiry: undefined,
    rateType: undefined,
    paymentsPerMonth: undefined,
    paymentsRemaining: undefined,
    autoCalculatePayments: true,
    loanType: undefined,
    loanTerm: undefined,
    gracePeriod: undefined,
    originalAmount: undefined,
    currentBalance: undefined,
    startDate: undefined,
    paymentsMade: undefined,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dataSources, setDataSources] = useState<Record<string, DataSource>>({
    currentInterestRate: 'manual',
    introductoryRate: 'manual',
    introductoryRateExpiry: 'manual',
    paymentsPerMonth: 'manual',
    paymentsRemaining: 'manual',
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        accountId: initialData.accountId,
        currentInterestRate: initialData.currentInterestRate ?? undefined,
        introductoryRate: initialData.introductoryRate ?? undefined,
        introductoryRateExpiry: initialData.introductoryRateExpiry ?? undefined,
        rateType: initialData.rateType ?? undefined,
        paymentsPerMonth: initialData.paymentsPerMonth ?? undefined,
        paymentsRemaining: initialData.paymentsRemaining ?? undefined,
        autoCalculatePayments: initialData.autoCalculatePayments ?? true,
        loanType: initialData.loanType ?? undefined,
        loanTerm: initialData.loanTerm ?? undefined,
        gracePeriod: initialData.gracePeriod ?? undefined,
        originalAmount: initialData.originalAmount != null ? initialData.originalAmount / 100 : undefined,
        currentBalance: initialData.currentBalance != null ? initialData.currentBalance / 100 : undefined,
        startDate: initialData.startDate ?? undefined,
        paymentsMade: initialData.paymentsMade != null ? initialData.paymentsMade / 100 : undefined,
      });
    } else {
      setFormData({
        accountId: '',
        currentInterestRate: undefined,
        introductoryRate: undefined,
        introductoryRateExpiry: undefined,
        rateType: undefined,
        paymentsPerMonth: undefined,
        paymentsRemaining: undefined,
        autoCalculatePayments: true,
        loanType: undefined,
        loanTerm: undefined,
        gracePeriod: undefined,
        originalAmount: undefined,
        currentBalance: undefined,
        startDate: undefined,
        paymentsMade: undefined,
      });
    }
    setErrors({});
  }, [initialData, isOpen]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.accountId) {
      newErrors.accountId = 'Account is required';
    }

    if (formData.currentInterestRate !== null && formData.currentInterestRate !== undefined) {
      if (formData.currentInterestRate < 0 || formData.currentInterestRate > 100) {
        newErrors.currentInterestRate = 'Interest rate must be between 0 and 100%';
      }
    }

    if (formData.introductoryRate !== null && formData.introductoryRate !== undefined) {
      if (formData.introductoryRate < 0 || formData.introductoryRate > 100) {
        newErrors.introductoryRate = 'Introductory rate must be between 0 and 100%';
      }
    }

    if (formData.paymentsPerMonth !== null && formData.paymentsPerMonth !== undefined) {
      if (formData.paymentsPerMonth < 1 || formData.paymentsPerMonth > 31) {
        newErrors.paymentsPerMonth = 'Payments per month must be between 1 and 31';
      }
    }

    if (formData.paymentsRemaining !== null && formData.paymentsRemaining !== undefined) {
      if (formData.paymentsRemaining < 0) {
        newErrors.paymentsRemaining = 'Payments remaining cannot be negative';
      }
    }

    if (formData.loanTerm !== null && formData.loanTerm !== undefined) {
      if (formData.loanTerm < 1 || formData.loanTerm > 600) {
        newErrors.loanTerm = 'Loan term must be between 1 and 600 months';
      }
    }

    if (formData.gracePeriod !== null && formData.gracePeriod !== undefined) {
      if (formData.gracePeriod < 0 || formData.gracePeriod > 90) {
        newErrors.gracePeriod = 'Grace period must be between 0 and 90 days';
      }
    }

    if (formData.originalAmount === undefined || formData.originalAmount === null || isNaN(Number(formData.originalAmount)) || Number(formData.originalAmount) <= 0) {
      newErrors.originalAmount = 'Original amount is required and must be a positive number';
    }

    if (formData.startDate === undefined || formData.startDate === null || formData.startDate === '') {
      newErrors.startDate = 'Start date is required';
    }

    if (formData.currentBalance !== undefined && formData.currentBalance !== null && Number(formData.currentBalance) < 0) {
      newErrors.currentBalance = 'Current balance cannot be negative';
    }

    if (formData.paymentsMade !== undefined && formData.paymentsMade !== null && Number(formData.paymentsMade) < 0) {
      newErrors.paymentsMade = 'Payments made cannot be negative';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      const submitData = {
        ...formData,
        originalAmount: formData.originalAmount != null ? Math.round(formData.originalAmount * 100) : undefined,
        currentBalance: formData.currentBalance != null ? Math.round(formData.currentBalance * 100) : undefined,
        paymentsMade: formData.paymentsMade != null ? Math.round(formData.paymentsMade * 100) : undefined,
        startDate: formData.startDate ? new Date(formData.startDate) : undefined,
      };
      
      await onSubmit(submitData);
      onClose();
    } catch (error) {
      console.error('Error submitting loan form:', error);
      setErrors({ submit: 'Failed to save loan. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: string, value: any, source: DataSource = 'manual') => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setDataSources(prev => ({ ...prev, [field]: source }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const getDataSourceIcon = (source: DataSource) => {
    switch (source) {
      case 'plaid':
        return <Shield className="w-3 h-3 text-blue-500" />;
      case 'manual':
        return <Edit className="w-3 h-3 text-green-500" />;
      case 'calculated':
        return <Calculator className="w-3 h-3 text-purple-500" />;
      default:
        return <Edit className="w-3 h-3 text-gray-500" />;
    }
  };

  const selectedAccount = accounts.find(acc => acc.id === formData.accountId);

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="max-w-lg">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {mode === 'create' ? <CreditCard className="w-5 h-5" /> : <Edit className="w-5 h-5" />}
            {mode === 'create' ? 'Add New Loan' : 'Edit Loan'}
          </CardTitle>
          <CardDescription>
            {mode === 'create' 
              ? 'Add a new loan to track interest rates and payments'
              : 'Update loan information and settings'
            }
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6">
            {/* Account Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Account *
              </label>
              <select
                value={formData.accountId}
                onChange={(e) => handleInputChange('accountId', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                disabled={mode === 'edit'}
              >
                <option value="">Select an account</option>
                {accounts.map(account => (
                  <option key={account.id} value={account.id}>
                    {account.name} - {formatCurrency(account.balance.current)}
                  </option>
                ))}
              </select>
              {errors.accountId && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.accountId}</p>
              )}
            </div>

            {/* Loan Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Loan Type
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {LOAN_TYPES.map(type => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => handleInputChange('loanType', type.value)}
                    className={`p-3 border rounded-lg text-left transition-colors ${
                      formData.loanType === type.value
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                        : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {type.icon}
                      <span className="text-sm font-medium">{type.label}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Interest Rate Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Current Interest Rate (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={formData.currentInterestRate || ''}
                    onChange={(e) => handleInputChange('currentInterestRate', e.target.value ? parseFloat(e.target.value) : null)}
                    className="w-full px-3 py-2 pr-8 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="e.g., 5.25"
                  />
                  <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                    {getDataSourceIcon(dataSources.currentInterestRate)}
                  </div>
                </div>
                {errors.currentInterestRate && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.currentInterestRate}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Rate Type
                </label>
                <select
                  value={formData.rateType || ''}
                  onChange={(e) => handleInputChange('rateType', e.target.value || null)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="">Select rate type</option>
                  {RATE_TYPES.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Introductory Rate */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Introductory Rate (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={formData.introductoryRate || ''}
                    onChange={(e) => handleInputChange('introductoryRate', e.target.value ? parseFloat(e.target.value) : null)}
                    className="w-full px-3 py-2 pr-8 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="e.g., 0.00"
                  />
                  <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                    {getDataSourceIcon(dataSources.introductoryRate)}
                  </div>
                </div>
                {errors.introductoryRate && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.introductoryRate}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Introductory Rate Expiry
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={formData.introductoryRateExpiry ? new Date(formData.introductoryRateExpiry).toISOString().split('T')[0] : ''}
                    onChange={(e) => handleInputChange('introductoryRateExpiry', e.target.value ? new Date(e.target.value) : null)}
                    className="w-full px-3 py-2 pr-8 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                    {getDataSourceIcon(dataSources.introductoryRateExpiry)}
                  </div>
                </div>
              </div>
            </div>

            {/* Payment Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Payments Per Month
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={formData.paymentsPerMonth || ''}
                    onChange={(e) => handleInputChange('paymentsPerMonth', e.target.value ? parseInt(e.target.value) : null)}
                    className="w-full px-3 py-2 pr-8 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="e.g., 1"
                  />
                  <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                    {getDataSourceIcon(dataSources.paymentsPerMonth)}
                  </div>
                </div>
                {errors.paymentsPerMonth && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.paymentsPerMonth}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Payments Remaining
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    value={formData.paymentsRemaining || ''}
                    onChange={(e) => handleInputChange('paymentsRemaining', e.target.value ? parseInt(e.target.value) : null)}
                    className="w-full px-3 py-2 pr-8 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="e.g., 360"
                  />
                  <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                    {getDataSourceIcon(dataSources.paymentsRemaining)}
                  </div>
                </div>
                {errors.paymentsRemaining && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.paymentsRemaining}</p>
                )}
              </div>
            </div>

            {/* Additional Settings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Loan Term (months)
                </label>
                <input
                  type="number"
                  min="1"
                  max="600"
                  value={formData.loanTerm || ''}
                  onChange={(e) => handleInputChange('loanTerm', e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="e.g., 360"
                />
                {errors.loanTerm && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.loanTerm}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Grace Period (days)
                </label>
                <input
                  type="number"
                  min="0"
                  max="90"
                  value={formData.gracePeriod || ''}
                  onChange={(e) => handleInputChange('gracePeriod', e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="e.g., 15"
                />
                {errors.gracePeriod && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.gracePeriod}</p>
                )}
              </div>
            </div>

            {/* Auto-calculation Setting */}
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="autoCalculatePayments"
                checked={formData.autoCalculatePayments}
                onChange={(e) => handleInputChange('autoCalculatePayments', e.target.checked)}
                className="w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500 dark:focus:ring-primary-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
              />
              <label htmlFor="autoCalculatePayments" className="text-sm text-gray-700 dark:text-gray-300">
                Auto-calculate remaining payments and interest
              </label>
            </div>

            {/* New fields */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Original Amount
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={formData.originalAmount || ''}
                  onChange={(e) => handleInputChange('originalAmount', e.target.value ? parseFloat(e.target.value) : null)}
                  className="w-full px-3 py-2 pr-8 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="e.g., 100000"
                />
                <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                  {getDataSourceIcon(dataSources.originalAmount)}
                </div>
              </div>
              {errors.originalAmount && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.originalAmount}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Current Balance
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={formData.currentBalance || ''}
                  onChange={(e) => handleInputChange('currentBalance', e.target.value ? parseFloat(e.target.value) : null)}
                  className="w-full px-3 py-2 pr-8 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="e.g., 95000"
                />
                <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                  {getDataSourceIcon(dataSources.currentBalance)}
                </div>
              </div>
              {errors.currentBalance && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.currentBalance}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Start Date
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={formData.startDate ? new Date(formData.startDate).toISOString().split('T')[0] : ''}
                  onChange={(e) => handleInputChange('startDate', e.target.value ? new Date(e.target.value) : null)}
                  className="w-full px-3 py-2 pr-8 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                  {getDataSourceIcon(dataSources.startDate)}
                </div>
              </div>
              {errors.startDate && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.startDate}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Payments Made
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={formData.paymentsMade || ''}
                  onChange={(e) => handleInputChange('paymentsMade', e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full px-3 py-2 pr-8 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="e.g., 120"
                />
                <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                  {getDataSourceIcon(dataSources.paymentsMade)}
                </div>
              </div>
              {errors.paymentsMade && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.paymentsMade}</p>
              )}
            </div>

            {/* Add a note about override logic */}
            <div className="mb-4 text-xs text-gray-500 dark:text-gray-400">
              If your current balance does not match the original amount minus linked payments, you can accept the current balance as the state of truth later in the loan details.
            </div>

            {errors.submit && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400">{errors.submit}</p>
              </div>
            )}
          </CardContent>

          <CardFooter className="flex justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
            >
              <Save className="w-4 h-4 mr-2" />
              {isSubmitting ? 'Saving...' : mode === 'create' ? 'Add Loan' : 'Save Changes'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </Modal>
  );
}; 