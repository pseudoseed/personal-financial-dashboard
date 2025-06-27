"use client";

import { useState } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { useDialogDismiss } from "@/lib/useDialogDismiss";

interface AnomalyDismissalDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onDismiss: (pattern: string, patternType: string, reason?: string) => void;
  transaction: {
    name: string;
    merchantName?: string;
    category?: string;
    categoryAi?: string;
    amount: number;
  } | null;
}

export function AnomalyDismissalDialog({ 
  isOpen, 
  onClose, 
  onDismiss, 
  transaction 
}: AnomalyDismissalDialogProps) {
  const [patternType, setPatternType] = useState<string>("exact_name");
  const [customPattern, setCustomPattern] = useState<string>("");
  const [reason, setReason] = useState<string>("");

  // Use the dialog dismiss hook - Anomaly dismissal dialog requires input, so prevent dismissal
  const dialogRef = useDialogDismiss({
    isOpen,
    onClose,
    allowEscape: false,
    allowClickOutside: false,
    requireInput: true,
  });

  if (!isOpen || !transaction) return null;

  const getDefaultPattern = () => {
    switch (patternType) {
      case "exact_name":
        return transaction.name;
      case "merchant_name":
        return transaction.merchantName || transaction.name;
      case "category":
        return transaction.categoryAi || transaction.category || "";
      case "amount_range":
        const amount = Math.abs(transaction.amount);
        return `${Math.floor(amount * 0.9)}-${Math.ceil(amount * 1.1)}`;
      default:
        return transaction.name;
    }
  };

  const handleDismiss = () => {
    const pattern = customPattern || getDefaultPattern();
    if (pattern) {
      onDismiss(pattern, patternType, reason || undefined);
      onClose();
      // Reset form
      setPatternType("exact_name");
      setCustomPattern("");
      setReason("");
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div 
        ref={dialogRef}
        className="bg-white dark:bg-zinc-800 rounded-lg max-w-md w-full"
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Dismiss Anomaly
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Transaction Info */}
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Transaction Details
            </h3>
            <p className="text-sm text-gray-900 dark:text-white font-medium">
              {transaction.name}
            </p>
            {transaction.merchantName && (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {transaction.merchantName}
              </p>
            )}
            <p className="text-sm text-gray-600 dark:text-gray-400">
              ${Math.abs(transaction.amount).toFixed(2)}
            </p>
          </div>

          {/* Dismissal Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Dismissal Type
            </label>
            <select
              value={patternType}
              onChange={(e) => setPatternType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none"
            >
              <option value="exact_name">Exact Transaction Name</option>
              <option value="merchant_name">Merchant Name</option>
              <option value="category">Category</option>
              <option value="amount_range">Amount Range</option>
              <option value="custom">Custom Pattern</option>
            </select>
          </div>

          {/* Pattern */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Pattern
            </label>
            <input
              type="text"
              value={customPattern || getDefaultPattern()}
              onChange={(e) => setCustomPattern(e.target.value)}
              disabled={patternType !== "custom"}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none disabled:bg-gray-100 dark:disabled:bg-gray-600"
              placeholder="Enter pattern to match..."
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {patternType === "exact_name" && "Will dismiss exact transaction names"}
              {patternType === "merchant_name" && "Will dismiss all transactions from this merchant"}
              {patternType === "category" && "Will dismiss all transactions in this category"}
              {patternType === "amount_range" && "Will dismiss transactions within this amount range"}
              {patternType === "custom" && "Enter a custom pattern to match"}
            </p>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Reason (Optional)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none"
              placeholder="Why are you dismissing this anomaly?"
            />
          </div>
        </div>

        <div className="flex justify-end space-x-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDismiss}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
} 