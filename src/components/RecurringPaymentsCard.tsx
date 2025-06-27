"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatBalance } from "@/lib/formatters";
import { useSensitiveData } from "@/app/providers";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { RecurringPaymentForm } from "./RecurringPaymentForm";
import { useNotifications } from "@/components/ui/Notification";
import { formatFrequency, formatPaymentType, getDayOfWeekName } from "@/lib/recurringPaymentUtils";
import { 
  PlusIcon, 
  PencilIcon, 
  TrashIcon, 
  EyeIcon, 
  EyeSlashIcon,
  CalendarIcon,
  CurrencyDollarIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";

interface RecurringPayment {
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
  targetAccount?: {
    id: string;
    name: string;
    nickname?: string | null;
  } | null;
  isActive: boolean;
  isConfirmed: boolean;
  confidence: number;
}

export function RecurringPaymentsCard() {
  const { showSensitiveData } = useSensitiveData();
  const queryClient = useQueryClient();
  const { addNotification } = useNotifications();
  const [showForm, setShowForm] = useState(false);
  const [editingPayment, setEditingPayment] = useState<RecurringPayment | null>(null);

  const { data: payments = [], isLoading } = useQuery<RecurringPayment[]>({
    queryKey: ["recurringPayments"],
    queryFn: async () => {
      const response = await fetch("/api/recurring-payments");
      if (!response.ok) throw new Error("Failed to fetch recurring payments");
      return response.json();
    },
  });

  const activePayments = (payments || []).filter(p => p.isActive);
  const totalMonthly = activePayments.reduce((sum, payment) => {
    switch (payment.frequency) {
      case 'weekly': return sum + (payment.amount * 4.33); // Average weeks per month
      case 'bi-weekly': return sum + (payment.amount * 2.17); // Average bi-weeks per month
      case 'monthly': return sum + payment.amount;
      case 'quarterly': return sum + (payment.amount / 3);
      case 'yearly': return sum + (payment.amount / 12);
      default: return sum + payment.amount;
    }
  }, 0);

  const handleCreatePayment = () => {
    setEditingPayment(null);
    setShowForm(true);
  };

  const handleEditPayment = (payment: RecurringPayment) => {
    setEditingPayment(payment);
    setShowForm(true);
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (!confirm("Are you sure you want to delete this recurring payment?")) {
      return;
    }

    try {
      const response = await fetch(`/api/recurring-payments/${paymentId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        addNotification({
          type: "success",
          title: "Payment deleted",
          message: "Recurring payment has been deleted successfully.",
        });
        queryClient.invalidateQueries({ queryKey: ["recurringPayments"] });
        queryClient.invalidateQueries({ queryKey: ["bills"] });
      } else {
        throw new Error("Failed to delete payment");
      }
    } catch (error) {
      addNotification({
        type: "error",
        title: "Delete failed",
        message: "Failed to delete recurring payment. Please try again.",
      });
    }
  };

  const handleToggleActive = async (payment: RecurringPayment) => {
    try {
      const response = await fetch(`/api/recurring-payments/${payment.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !payment.isActive }),
      });

      if (response.ok) {
        addNotification({
          type: "success",
          title: "Payment updated",
          message: `Recurring payment ${payment.isActive ? 'deactivated' : 'activated'} successfully.`,
        });
        queryClient.invalidateQueries({ queryKey: ["recurringPayments"] });
        queryClient.invalidateQueries({ queryKey: ["bills"] });
      } else {
        throw new Error("Failed to update payment");
      }
    } catch (error) {
      addNotification({
        type: "error",
        title: "Update failed",
        message: "Failed to update recurring payment. Please try again.",
      });
    }
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingPayment(null);
    queryClient.invalidateQueries({ queryKey: ["recurringPayments"] });
    queryClient.invalidateQueries({ queryKey: ["bills"] });
    addNotification({
      type: "success",
      title: "Payment saved",
      message: `Recurring payment ${editingPayment ? 'updated' : 'created'} successfully.`,
    });
  };

  const formatNextPaymentDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return "Overdue";
    } else if (diffDays === 0) {
      return "Today";
    } else if (diffDays === 1) {
      return "Tomorrow";
    } else if (diffDays <= 7) {
      return `In ${diffDays} days`;
    } else {
      return date.toLocaleDateString();
    }
  };

  if (isLoading) {
    return (
      <div className="card">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 dark:bg-zinc-700 rounded w-1/3 mb-4"></div>
          <div className="h-32 bg-gray-200 dark:bg-zinc-700 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="card">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-semibold text-surface-900 dark:text-surface-100 mb-2">
              Recurring Payments
            </h2>
            <p className="text-sm text-surface-600 dark:text-surface-400">
              Expected income from recurring payments
            </p>
          </div>
          <Button
            onClick={handleCreatePayment}
            leftIcon={<PlusIcon className="w-5 h-5" />}
          >
            Add Payment
          </Button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <p className="text-sm text-green-700 dark:text-green-300 mb-1">Active Payments</p>
            <p className="text-lg font-bold text-green-700 dark:text-green-300">
              {activePayments.length}
            </p>
          </div>
          <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p className="text-sm text-blue-700 dark:text-blue-300 mb-1">Monthly Total</p>
            <p className="text-lg font-bold text-blue-700 dark:text-blue-300">
              {showSensitiveData ? formatBalance(totalMonthly) : "••••••"}
            </p>
          </div>
          <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
            <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-1">Unconfirmed</p>
            <p className="text-lg font-bold text-yellow-700 dark:text-yellow-300">
              {payments.filter(p => !p.isConfirmed).length}
            </p>
          </div>
        </div>

        {/* Payments List */}
        {payments.length === 0 ? (
          <div className="text-center py-8">
            <CurrencyDollarIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              No recurring payments
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              Add your first recurring payment to track expected income
            </p>
            <Button onClick={handleCreatePayment} leftIcon={<PlusIcon className="w-5 h-5" />}>
              Add Payment
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {payments.map((payment) => (
              <div
                key={payment.id}
                className={`p-4 rounded-lg border transition-all duration-200 ${
                  payment.isActive
                    ? 'bg-white dark:bg-black border-gray-200 dark:border-gray-800'
                    : 'bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className={`font-medium truncate ${
                        payment.isActive 
                          ? 'text-gray-900 dark:text-gray-100' 
                          : 'text-gray-500 dark:text-gray-400'
                      }`}>
                        {payment.name}
                      </h3>
                      {!payment.isConfirmed && (
                        <span className="px-2 py-1 text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 rounded-full">
                          Unconfirmed
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                      <div className="flex items-center gap-1">
                        <CurrencyDollarIcon className="w-4 h-4" />
                        <span>{showSensitiveData ? formatBalance(payment.amount) : "••••••"}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <ClockIcon className="w-4 h-4" />
                        <span>{formatFrequency(payment.frequency)}</span>
                        {payment.dayOfWeek !== null && payment.dayOfWeek !== undefined && (
                          <span> • {getDayOfWeekName(payment.dayOfWeek)}</span>
                        )}
                        {payment.dayOfMonth !== null && payment.dayOfMonth !== undefined && (
                          <span> • {payment.dayOfMonth}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <CalendarIcon className="w-4 h-4" />
                        <span>{formatNextPaymentDate(payment.nextPaymentDate)}</span>
                      </div>
                    </div>

                    {payment.targetAccount && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Deposits to: {payment.targetAccount.nickname || payment.targetAccount.name}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => handleToggleActive(payment)}
                      className="p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors"
                      title={payment.isActive ? "Deactivate" : "Activate"}
                    >
                      {payment.isActive ? (
                        <EyeIcon className="w-4 h-4" />
                      ) : (
                        <EyeSlashIcon className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => handleEditPayment(payment)}
                      className="p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors"
                      title="Edit"
                    >
                      <PencilIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeletePayment(payment.id)}
                      className="p-1 rounded-md text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                      title="Delete"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Form Modal */}
      <Modal 
        isOpen={showForm} 
        onClose={() => setShowForm(false)} 
        title={editingPayment ? "Edit Recurring Payment" : "Add Recurring Payment"}
      >
        <RecurringPaymentForm
          payment={editingPayment}
          onSuccess={handleFormSuccess}
          onCancel={() => setShowForm(false)}
        />
      </Modal>
    </>
  );
} 