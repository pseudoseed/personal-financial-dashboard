"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { 
  ExclamationTriangleIcon, 
  EyeSlashIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { TransactionDetailModal } from "./TransactionDetailModal";
import { AnomalyDismissalDialog } from "./AnomalyDismissalDialog";
import { DuplicateTransactionModal } from "./DuplicateTransactionModal";

interface AnomalyAlertProps {
  isMasked?: boolean;
  limit?: number;
  onHide?: () => void;
}

interface AnomalySettings {
  minAmount: number;
  maxAmount: number;
  timeWindow: number;
  zScoreThreshold: number;
  newMerchantThreshold: number;
  geographicThreshold: number;
  hoursWindow: number;
}

export function AnomalyAlert({ isMasked = false, limit = 5, onHide }: AnomalyAlertProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [showAll, setShowAll] = useState(false);
  const [showTuning, setShowTuning] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [showDismissalDialog, setShowDismissalDialog] = useState(false);
  const [dismissalTransaction, setDismissalTransaction] = useState<any>(null);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateTransactions, setDuplicateTransactions] = useState<any[]>([]);
  const [duplicateTimeSpan, setDuplicateTimeSpan] = useState<any>(null);
  const [settings, setSettings] = useState<AnomalySettings>({
    minAmount: 50,
    maxAmount: 10000,
    timeWindow: 30,
    zScoreThreshold: 2.5,
    newMerchantThreshold: 100,
    geographicThreshold: 50,
    hoursWindow: 24,
  });

  const queryClient = useQueryClient();
  const itemsPerPage = 10;

  const buildQueryString = () => {
    const params = new URLSearchParams();
    Object.entries(settings).forEach(([key, value]) => {
      params.append(key, value.toString());
    });
    if (showHidden) {
      params.append('showHidden', 'true');
    }
    return params.toString();
  };

  const { data: anomaliesData, isLoading, refetch } = useQuery({
    queryKey: ["anomalies", settings, showHidden],
    queryFn: async () => {
      const queryString = buildQueryString();
      const response = await fetch(`/api/analytics/anomalies?${queryString}`);
      if (!response.ok) throw new Error("Failed to fetch anomalies");
      return response.json();
    },
  });

  const toggleVisibilityMutation = useMutation({
    mutationFn: async ({ anomalyId, isHidden }: { anomalyId: string; isHidden: boolean }) => {
      const response = await fetch(`/api/analytics/anomalies/${anomalyId}/toggle-visibility`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isHidden }),
      });
      if (!response.ok) throw new Error("Failed to toggle anomaly visibility");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["anomalies"] });
    },
  });

  const dismissPatternMutation = useMutation({
    mutationFn: async ({ pattern, patternType, reason, anomalyId }: { 
      pattern: string; 
      patternType: string; 
      reason?: string; 
      anomalyId?: string; 
    }) => {
      const response = await fetch('/api/analytics/anomalies/dismiss-pattern', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pattern, patternType, reason, anomalyId }),
      });
      if (!response.ok) throw new Error("Failed to create dismissal rule");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["anomalies"] });
    },
  });

  const anomalies = anomaliesData?.anomalies || [];
  const visibleAnomalies = showHidden ? anomalies : anomalies.filter((anomaly: any) => !anomaly.isHidden);

  const highPriority = visibleAnomalies.filter((a: any) => a.severity === 'high');
  const mediumPriority = visibleAnomalies.filter((a: any) => a.severity === 'medium');
  const lowPriority = visibleAnomalies.filter((a: any) => a.severity === 'low');

  const totalAnomalies = visibleAnomalies.length;
  const totalPages = Math.ceil(totalAnomalies / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedAnomalies = showAll ? visibleAnomalies : visibleAnomalies.slice(0, limit);

  const handleHideAnomaly = (anomalyId: string) => {
    toggleVisibilityMutation.mutate({ anomalyId, isHidden: true });
  };

  const handleShowAnomaly = (anomalyId: string) => {
    toggleVisibilityMutation.mutate({ anomalyId, isHidden: false });
  };

  const handleSettingChange = (key: keyof AnomalySettings, value: number) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleApplySettings = () => {
    refetch();
    setShowTuning(false);
  };

  const handleTransactionClick = (transaction: any, anomaly: any) => {
    // If this is a duplicate charge anomaly, show the duplicate modal
    if (anomaly.type === 'duplicate_charge' && anomaly.metadata?.duplicateTransactions) {
      setDuplicateTransactions(anomaly.metadata.duplicateTransactions);
      setDuplicateTimeSpan(anomaly.metadata.timeSpan);
      setShowDuplicateModal(true);
    } else {
      // Otherwise show the regular transaction detail modal
      setSelectedTransaction(transaction);
      setShowTransactionModal(true);
    }
  };

  const handleDismissAnomaly = (anomaly: any) => {
    setDismissalTransaction(anomaly.transaction);
    setShowDismissalDialog(true);
  };

  const handleDismissPattern = (pattern: string, patternType: string, reason?: string) => {
    if (dismissalTransaction) {
      dismissPatternMutation.mutate({ 
        pattern, 
        patternType, 
        reason,
        anomalyId: dismissalTransaction.id 
      });
    }
  };

  if (isLoading) {
    return (
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-yellow-200 dark:bg-yellow-800 rounded w-1/3 mb-2"></div>
          <div className="h-3 bg-yellow-200 dark:bg-yellow-800 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (totalAnomalies === 0) {
    return null;
  }

  return (
    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
      {/* Header */}
      <div className="p-4 border-b border-yellow-200 dark:border-yellow-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
            <div>
              <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                Anomaly Detection
              </h3>
              <p className="text-xs text-yellow-600 dark:text-yellow-400">
                {highPriority.length} high, {mediumPriority.length} medium priority alerts
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowHidden(!showHidden)}
              className="px-2 py-1 text-xs bg-yellow-100 dark:bg-yellow-800 text-yellow-700 dark:text-yellow-300 rounded hover:bg-yellow-200 dark:hover:bg-yellow-700 transition-colors"
            >
              {showHidden ? 'Hide Hidden' : 'Show Hidden'}
            </button>
            <button
              onClick={() => setShowTuning(!showTuning)}
              className="px-2 py-1 text-xs bg-yellow-100 dark:bg-yellow-800 text-yellow-700 dark:text-yellow-300 rounded hover:bg-yellow-200 dark:hover:bg-yellow-700 transition-colors"
            >
              Tune
            </button>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-100 dark:hover:bg-yellow-800 rounded transition-colors"
            >
              {isExpanded ? (
                <ChevronUpIcon className="w-4 h-4" />
              ) : (
                <ChevronDownIcon className="w-4 h-4" />
              )}
            </button>
            {onHide && (
              <button
                onClick={onHide}
                className="p-1 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-100 dark:hover:bg-yellow-800 rounded transition-colors"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tuning Panel */}
      {showTuning && (
        <div className="p-4 border-b border-yellow-200 dark:border-yellow-800 bg-yellow-25 dark:bg-yellow-900/10">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-yellow-700 dark:text-yellow-300 mb-1">
                Min Amount ($)
              </label>
              <input
                type="number"
                value={settings.minAmount}
                onChange={(e) => handleSettingChange('minAmount', parseFloat(e.target.value) || 0)}
                className="w-full px-2 py-1 text-xs border border-yellow-300 dark:border-yellow-700 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-yellow-700 dark:text-yellow-300 mb-1">
                New Merchant Threshold ($)
              </label>
              <input
                type="number"
                value={settings.newMerchantThreshold}
                onChange={(e) => handleSettingChange('newMerchantThreshold', parseFloat(e.target.value) || 0)}
                className="w-full px-2 py-1 text-xs border border-yellow-300 dark:border-yellow-700 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-yellow-700 dark:text-yellow-300 mb-1">
                Z-Score Threshold
              </label>
              <input
                type="number"
                step="0.1"
                value={settings.zScoreThreshold}
                onChange={(e) => handleSettingChange('zScoreThreshold', parseFloat(e.target.value) || 0)}
                className="w-full px-2 py-1 text-xs border border-yellow-300 dark:border-yellow-700 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-yellow-700 dark:text-yellow-300 mb-1">
                Time Window (days)
              </label>
              <input
                type="number"
                value={settings.timeWindow}
                onChange={(e) => handleSettingChange('timeWindow', parseInt(e.target.value) || 0)}
                className="w-full px-2 py-1 text-xs border border-yellow-300 dark:border-yellow-700 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              onClick={handleApplySettings}
              className="px-3 py-1 text-xs bg-yellow-600 text-white rounded hover:bg-yellow-700 transition-colors"
            >
              Apply Settings
            </button>
          </div>
        </div>
      )}

      {/* Anomalies List */}
      {isExpanded && (
        <div className="p-4">
          {paginatedAnomalies.length > 0 ? (
            <div className="space-y-3">
              {paginatedAnomalies.map((anomaly: any) => (
                <div
                  key={anomaly.id}
                  className={`p-3 rounded-lg border ${
                    anomaly.severity === 'high'
                      ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                      : 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded ${
                            anomaly.severity === 'high'
                              ? 'bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-300'
                              : 'bg-orange-100 dark:bg-orange-800 text-orange-700 dark:text-orange-300'
                          }`}
                        >
                          {anomaly.severity.toUpperCase()}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {format(new Date(anomaly.date), 'MMM d, yyyy')}
                        </span>
                        {anomaly.isHidden && (
                          <span className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded">
                            Hidden
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                        {anomaly.reason}
                      </p>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        <p 
                          className="font-medium cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTransactionClick(anomaly.transaction, anomaly);
                          }}
                          title="Click to view transaction details"
                        >
                          {anomaly.transaction.name}
                        </p>
                        <p className="text-xs">
                          {isMasked ? '***' : `$${Math.abs(anomaly.transaction.amount).toFixed(2)}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDismissAnomaly(anomaly);
                        }}
                        className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                        title="Dismiss this type of anomaly"
                      >
                        <XMarkIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          anomaly.isHidden ? handleShowAnomaly(anomaly.id) : handleHideAnomaly(anomaly.id);
                        }}
                        className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                        title={anomaly.isHidden ? "Show this anomaly" : "Hide this anomaly"}
                      >
                        <EyeSlashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
              No anomalies to display
            </p>
          )}

          {/* Pagination and Controls */}
          {showAll && totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-yellow-200 dark:border-yellow-800">
              <div className="text-xs text-yellow-600 dark:text-yellow-400">
                Page {currentPage} of {totalPages}
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-2 py-1 text-xs bg-yellow-100 dark:bg-yellow-800 text-yellow-700 dark:text-yellow-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-yellow-200 dark:hover:bg-yellow-700 transition-colors"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-2 py-1 text-xs bg-yellow-100 dark:bg-yellow-800 text-yellow-700 dark:text-yellow-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-yellow-200 dark:hover:bg-yellow-700 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {/* View All/Show Less Toggle */}
          {!showAll && totalAnomalies > limit && (
            <div className="mt-4 pt-4 border-t border-yellow-200 dark:border-yellow-800">
              <button
                onClick={() => setShowAll(true)}
                className="w-full px-3 py-2 text-sm bg-yellow-100 dark:bg-yellow-800 text-yellow-700 dark:text-yellow-300 rounded hover:bg-yellow-200 dark:hover:bg-yellow-700 transition-colors"
              >
                View All {totalAnomalies} Anomalies
              </button>
            </div>
          )}

          {showAll && (
            <div className="mt-4 pt-4 border-t border-yellow-200 dark:border-yellow-800">
              <button
                onClick={() => {
                  setShowAll(false);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 text-sm bg-yellow-100 dark:bg-yellow-800 text-yellow-700 dark:text-yellow-300 rounded hover:bg-yellow-200 dark:hover:bg-yellow-700 transition-colors"
              >
                Show Less
              </button>
            </div>
          )}
        </div>
      )}

      {/* Transaction Detail Modal */}
      <TransactionDetailModal
        transaction={selectedTransaction}
        isOpen={showTransactionModal}
        onClose={() => {
          setShowTransactionModal(false);
          setSelectedTransaction(null);
        }}
      />

      {/* Anomaly Dismissal Dialog */}
      <AnomalyDismissalDialog
        isOpen={showDismissalDialog}
        onClose={() => {
          setShowDismissalDialog(false);
          setDismissalTransaction(null);
        }}
        onDismiss={handleDismissPattern}
        transaction={dismissalTransaction}
      />

      {/* Duplicate Transaction Modal */}
      <DuplicateTransactionModal
        isOpen={showDuplicateModal}
        onClose={() => {
          setShowDuplicateModal(false);
          setDuplicateTransactions([]);
          setDuplicateTimeSpan(null);
        }}
        duplicateTransactions={duplicateTransactions}
        timeSpan={duplicateTimeSpan}
      />
    </div>
  );
} 