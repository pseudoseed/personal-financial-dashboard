"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { calculateNextPaymentDate } from "@/lib/recurringPaymentUtils";

interface RecurringPaymentFormProps {
  payment?: {
    id: string;
    name: string;
    amount: number;
    frequency: string;
    nextPaymentDate: string;
    lastPaymentDate?: string | null;
    dayOfWeek?: number | null;
    dayOfMonth?: number | null;
    paymentType: string;
    targetAccountId?: string | null;
    isActive: boolean;
    isConfirmed: boolean;
    confidence: number;
  } | null;
  onSuccess: () => void;
  onCancel: () => void;
}

interface Account {
  id: string;
  name: string;
  nickname?: string | null;
  type: string;
}

export function RecurringPaymentForm({ payment, onSuccess, onCancel }: RecurringPaymentFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    amount: "",
    frequency: "bi-weekly" as string,
    nextPaymentDate: "",
    lastPaymentDate: "",
    dayOfWeek: "" as string | number,
    dayOfMonth: "" as string | number,
    paymentType: "paycheck" as string,
    targetAccountId: "",
    isActive: true,
    isConfirmed: false,
    confidence: 100,
  });

  // Fetch accounts for target account selection
  const { data: accounts = [] } = useQuery<Account[]>({
    queryKey: ["accounts"],
    queryFn: async () => {
      const response = await fetch("/api/accounts");
      if (!response.ok) throw new Error("Failed to fetch accounts");
      return response.json();
    },
  });

  // Filter to only depository accounts for target selection
  const depositoryAccounts = accounts.filter(account => account.type === "depository");

  useEffect(() => {
    if (payment) {
      setFormData({
        name: payment.name,
        amount: payment.amount.toString(),
        frequency: payment.frequency,
        nextPaymentDate: payment.nextPaymentDate.split('T')[0], // Convert to YYYY-MM-DD format
        lastPaymentDate: payment.lastPaymentDate ? payment.lastPaymentDate.split('T')[0] : "",
        dayOfWeek: payment.dayOfWeek?.toString() || "",
        dayOfMonth: payment.dayOfMonth?.toString() || "",
        paymentType: payment.paymentType,
        targetAccountId: payment.targetAccountId || "",
        isActive: payment.isActive,
        isConfirmed: payment.isConfirmed,
        confidence: payment.confidence,
      });
    } else {
      // Set default next payment date to next Friday for bi-weekly payments
      const today = new Date();
      const nextFriday = new Date(today);
      const daysUntilFriday = (5 - today.getDay() + 7) % 7;
      nextFriday.setDate(today.getDate() + daysUntilFriday);
      
      setFormData(prev => ({
        ...prev,
        nextPaymentDate: nextFriday.toISOString().split('T')[0],
        dayOfWeek: "5", // Friday
      }));
    }
  }, [payment]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const payload = {
        ...formData,
        amount: parseFloat(formData.amount),
        dayOfWeek: formData.dayOfWeek ? parseInt(formData.dayOfWeek.toString()) : null,
        dayOfMonth: formData.dayOfMonth ? parseInt(formData.dayOfMonth.toString()) : null,
        targetAccountId: formData.targetAccountId || null,
        lastPaymentDate: formData.lastPaymentDate || null,
      };

      const url = payment ? `/api/recurring-payments/${payment.id}` : "/api/recurring-payments";
      const method = payment ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Failed to save recurring payment");
      }

      onSuccess();
    } catch (error) {
      console.error("Error saving recurring payment:", error);
      alert("Failed to save recurring payment. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFrequencyChange = (frequency: string) => {
    setFormData(prev => {
      const newData = { ...prev, frequency };
      
      // Auto-calculate next payment date based on frequency
      if (prev.nextPaymentDate) {
        const currentDate = new Date(prev.nextPaymentDate);
        const nextDate = calculateNextPaymentDate(
          currentDate,
          frequency,
          prev.dayOfWeek ? parseInt(prev.dayOfWeek.toString()) : null,
          prev.dayOfMonth ? parseInt(prev.dayOfMonth.toString()) : null
        );
        newData.nextPaymentDate = nextDate.toISOString().split('T')[0];
      }
      
      return newData;
    });
  };

  const frequencies = [
    { value: "weekly", label: "Weekly" },
    { value: "bi-weekly", label: "Bi-weekly" },
    { value: "monthly", label: "Monthly" },
    { value: "quarterly", label: "Quarterly" },
    { value: "yearly", label: "Yearly" },
  ];

  const paymentTypes = [
    { value: "paycheck", label: "Paycheck" },
    { value: "direct_deposit", label: "Direct Deposit" },
    { value: "investment_dividend", label: "Investment Dividend" },
    { value: "other", label: "Other" },
  ];

  const daysOfWeek = [
    { value: "0", label: "Sunday" },
    { value: "1", label: "Monday" },
    { value: "2", label: "Tuesday" },
    { value: "3", label: "Wednesday" },
    { value: "4", label: "Thursday" },
    { value: "5", label: "Friday" },
    { value: "6", label: "Saturday" },
  ];

  const daysOfMonth = Array.from({ length: 31 }, (_, i) => ({
    value: (i + 1).toString(),
    label: (i + 1).toString(),
  }));

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Payment Name
        </label>
        <input
          type="text"
          required
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          className="mt-1 block w-full rounded border border-gray-300 dark:border-gray-600 px-3 py-2 text-base shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
          placeholder="e.g., Bi-weekly Paycheck"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Amount
        </label>
        <div className="mt-1 relative rounded-md shadow-sm">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <span className="text-gray-500 sm:text-sm">$</span>
          </div>
          <input
            type="number"
            required
            step="0.01"
            min="0"
            value={formData.amount}
            onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
            className="pl-7 block w-full rounded border border-gray-300 dark:border-gray-600 px-3 py-2 text-base shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
            placeholder="0.00"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Payment Type
        </label>
        <select
          required
          value={formData.paymentType}
          onChange={(e) => setFormData(prev => ({ ...prev, paymentType: e.target.value }))}
          className="mt-1 block w-full rounded border border-gray-300 dark:border-gray-600 px-3 py-2 text-base shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
        >
          {paymentTypes.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Frequency
        </label>
        <select
          required
          value={formData.frequency}
          onChange={(e) => handleFrequencyChange(e.target.value)}
          className="mt-1 block w-full rounded border border-gray-300 dark:border-gray-600 px-3 py-2 text-base shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
        >
          {frequencies.map((freq) => (
            <option key={freq.value} value={freq.value}>
              {freq.label}
            </option>
          ))}
        </select>
      </div>

      {(formData.frequency === 'weekly' || formData.frequency === 'bi-weekly') && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Day of Week
          </label>
          <select
            required
            value={formData.dayOfWeek}
            onChange={(e) => setFormData(prev => ({ ...prev, dayOfWeek: e.target.value }))}
            className="mt-1 block w-full rounded border border-gray-300 dark:border-gray-600 px-3 py-2 text-base shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
          >
            <option value="">Select day</option>
            {daysOfWeek.map((day) => (
              <option key={day.value} value={day.value}>
                {day.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {formData.frequency === 'monthly' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Day of Month
          </label>
          <select
            required
            value={formData.dayOfMonth}
            onChange={(e) => setFormData(prev => ({ ...prev, dayOfMonth: e.target.value }))}
            className="mt-1 block w-full rounded border border-gray-300 dark:border-gray-600 px-3 py-2 text-base shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
          >
            <option value="">Select day</option>
            {daysOfMonth.map((day) => (
              <option key={day.value} value={day.value}>
                {day.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Next Payment Date
        </label>
        <input
          type="date"
          required
          value={formData.nextPaymentDate}
          onChange={(e) => setFormData(prev => ({ ...prev, nextPaymentDate: e.target.value }))}
          className="mt-1 block w-full rounded border border-gray-300 dark:border-gray-600 px-3 py-2 text-base shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Last Payment Date (Optional)
        </label>
        <input
          type="date"
          value={formData.lastPaymentDate}
          onChange={(e) => setFormData(prev => ({ ...prev, lastPaymentDate: e.target.value }))}
          className="mt-1 block w-full rounded border border-gray-300 dark:border-gray-600 px-3 py-2 text-base shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Target Account (Optional)
        </label>
        <select
          value={formData.targetAccountId}
          onChange={(e) => setFormData(prev => ({ ...prev, targetAccountId: e.target.value }))}
          className="mt-1 block w-full rounded border border-gray-300 dark:border-gray-600 px-3 py-2 text-base shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
        >
          <option value="">Select account (optional)</option>
          {depositoryAccounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.nickname || account.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center space-x-4">
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={formData.isActive}
            onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Active</span>
        </label>

        <label className="flex items-center">
          <input
            type="checkbox"
            checked={formData.isConfirmed}
            onChange={(e) => setFormData(prev => ({ ...prev, isConfirmed: e.target.checked }))}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Confirmed</span>
        </label>
      </div>

      <div className="flex justify-end space-x-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 text-sm font-medium text-white bg-purple-600 dark:bg-purple-500 border border-transparent rounded-md shadow-sm hover:bg-purple-700 dark:hover:bg-purple-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50"
        >
          {isSubmitting ? "Saving..." : (payment ? "Update Payment" : "Add Payment")}
        </button>
      </div>
    </form>
  );
} 