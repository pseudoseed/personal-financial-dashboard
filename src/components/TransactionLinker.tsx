import React, { useState, useEffect } from 'react';
import { Transaction } from '@prisma/client';
import { TransactionList } from './TransactionList';
import { CreateTransactionLinkRequest, EntityType, TransactionLink } from '@/types/transactionLink';
import { Button } from './ui/Button';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { Modal } from './ui/Modal';

interface TransactionLinkerProps {
  entityType: EntityType;
  entityId: string;
  initialTransactions: Transaction[];
  onLinkCreated: (link: TransactionLink) => void;
  onCancel: () => void;
  showSensitiveData?: boolean;
  isLoading?: boolean;
}

export const TransactionLinker: React.FC<TransactionLinkerProps> = ({
  entityType,
  entityId,
  initialTransactions,
  onLinkCreated,
  onCancel,
  showSensitiveData = true,
  isLoading = false,
}) => {
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [isLinking, setIsLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingLinks, setExistingLinks] = useState<TransactionLink[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);

  // Fetch existing links to filter out already linked transactions
  useEffect(() => {
    const fetchExistingLinks = async () => {
      try {
        const response = await fetch(`/api/transactions/links?entityType=${entityType}&entityId=${entityId}&showSensitiveData=${showSensitiveData}`);
        if (response.ok) {
          const data = await response.json();
          setExistingLinks(data.data || []);
        }
      } catch (error) {
        console.error('Failed to fetch existing links:', error);
      }
    };

    fetchExistingLinks();
  }, [entityType, entityId, showSensitiveData]);

  // Block transactions before overrideDate if override is active
  const overrideDate = (entityType === 'loan' && (window as any).loanOverrideDate) ? new Date((window as any).loanOverrideDate) : null;
  const blockOldTransactions = (entityType === 'loan' && (window as any).loanBalanceOverride);

  useEffect(() => {
    const filtered = initialTransactions.filter(transaction => {
      if (blockOldTransactions && overrideDate) {
        return new Date(transaction.date) >= overrideDate;
      }
      return true;
    });
    setFilteredTransactions(filtered);
  }, [initialTransactions, blockOldTransactions, overrideDate]);

  const handleTransactionSelect = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setError(null);
  };

  const handleLink = async () => {
    if (!selectedTransaction) {
      setError('Please select a transaction to link.');
      return;
    }
    setIsLinking(true);
    setError(null);
    try {
      const res = await fetch('/api/transactions/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionId: selectedTransaction.id,
          entityType,
          entityId,
          metadata: {
            detectionMethod: 'manual',
            paymentDate: new Date(selectedTransaction.date).toISOString(),
            paymentAmount: selectedTransaction.amount,
            paymentType: 'principal', // Default, can be edited later
            isScheduled: false,
          },
        } as CreateTransactionLinkRequest),
      });
      
      if (res.status === 409) {
        setError('This transaction is already linked to this loan.');
        return;
      }
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create link');
      
      onLinkCreated(data.data);
      setSelectedTransaction(null);
    } catch (err: any) {
      setError(err.message || 'Failed to create link');
    } finally {
      setIsLinking(false);
    }
  };

  return (
    <div className="p-4">
      {/* Header */}
      {isLoading ? (
        <div className="mb-4 p-4 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading transactions...</p>
        </div>
      ) : (
        <div className="mb-6">
          <div className="mb-4">
            <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Select a Transaction to Link
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Choose a transaction to link to this {entityType}. Already linked transactions are hidden.
            </p>
            {filteredTransactions.length === 0 && (
              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  {blockOldTransactions ? 'All available transactions are before the override date and cannot be linked.' : `All available transactions are already linked to this ${entityType}.`}
                </p>
              </div>
            )}
          </div>
          
          <div className="rounded-lg overflow-hidden">
            <TransactionList
              accountId={selectedTransaction?.accountId || ''}
              initialTransactions={filteredTransactions}
              downloadLogs={[]}
              onTransactionSelect={handleTransactionSelect}
              selectedTransactionId={selectedTransaction?.id}
              hideDownloadHistory={true}
              hideTransactionRecordsHeader={true}
            />
          </div>
        </div>
      )}

      {selectedTransaction && (
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <h4 className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">
            Selected Transaction
          </h4>
          <div className="text-sm text-blue-600 dark:text-blue-400">
            <div><strong>Name:</strong> {selectedTransaction.name}</div>
            <div><strong>Amount:</strong> ${Math.abs(selectedTransaction.amount).toFixed(2)}</div>
            <div><strong>Date:</strong> {new Date(selectedTransaction.date).toLocaleDateString()}</div>
          </div>
        </div>
      )}

      <div className="flex gap-3 justify-end">
        <Button onClick={onCancel} variant="secondary">
          Cancel
        </Button>
        <Button
          onClick={handleLink}
          disabled={!selectedTransaction || isLinking}
          loading={isLinking}
        >
          Link Transaction
        </Button>
      </div>
      
      {error && (
        <div className="mt-4 text-red-600 text-sm text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
          {error}
        </div>
      )}
    </div>
  );
}; 