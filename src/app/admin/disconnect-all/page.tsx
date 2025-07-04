"use client";

import { useState, useEffect } from 'react';
import { AdminToolCard } from '@/components/admin/AdminToolCard';
import { AdminActionButton } from '@/components/admin/AdminActionButton';
import { AdminStatusBadge } from '@/components/admin/AdminStatusBadge';
import { ExclamationTriangleIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';

interface ActiveInstitution {
  institutionId: string;
  institutionName: string;
  accessToken: string;
  accountCount: number;
  itemId: string;
}

interface DisconnectAllJob {
  id: string;
  createdAt: string;
  totalTokens: number;
  successCount: number;
  failureCount: number;
  status: string;
  reportPath: string;
  hasReport: boolean;
}

export default function DisconnectAllPage() {
  const [activeInstitutions, setActiveInstitutions] = useState<ActiveInstitution[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [currentJob, setCurrentJob] = useState<DisconnectAllJob | null>(null);
  const [jobStatus, setJobStatus] = useState<string | null>(null);

  const fetchActiveInstitutions = async () => {
    try {
      const response = await fetch('/api/admin/disconnect-all');
      if (response.ok) {
        const data = await response.json();
        setActiveInstitutions(data.institutions || []);
      }
    } catch (error) {
      console.error('Error fetching active institutions:', error);
      setActiveInstitutions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnectAll = async () => {
    if (!confirmed) {
      return;
    }

    setSubmitting(true);
    setJobStatus('processing');
    
    try {
      const response = await fetch('/api/admin/disconnect-all', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();
      
      if (result.success) {
        setCurrentJob(result.job);
        setJobStatus('completed');
        await fetchActiveInstitutions(); // Refresh the list
      } else {
        console.error('Disconnect all error:', result);
        setJobStatus('error');
      }
    } catch (error) {
      console.error('Submit error:', error);
      setJobStatus('error');
    } finally {
      setSubmitting(false);
    }
  };

  const downloadReport = async (jobId: string) => {
    try {
      const response = await fetch(`/api/admin/bulk-disconnect/reports/${jobId}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `disconnect-all-job-${jobId}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        console.error('Error downloading report');
      }
    } catch (error) {
      console.error('Download error:', error);
    }
  };

  useEffect(() => {
    fetchActiveInstitutions();
  }, []);

  const totalAccounts = activeInstitutions.reduce((sum, inst) => sum + inst.accountCount, 0);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto py-8 px-4">
        <div className="text-center">Loading active institutions...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Disconnect All Institutions</h1>
        <AdminActionButton onClick={fetchActiveInstitutions} loading={loading}>
          Refresh
        </AdminActionButton>
      </div>

      <AdminToolCard
        title="Current Active Institutions"
        description={`Found ${activeInstitutions.length} active institutions with ${totalAccounts} total accounts`}
        status={activeInstitutions.length > 0 ? "warning" : "success"}
      >
        {activeInstitutions.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircleIcon className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No Active Institutions Found
            </p>
            <p className="text-gray-600 dark:text-gray-400">
              All institutions have already been disconnected or there are no active Plaid connections.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeInstitutions.map((institution) => (
                <div
                  key={institution.institutionId}
                  className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900 dark:text-white">
                        {institution.institutionName}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {institution.accountCount} account{institution.accountCount !== 1 ? 's' : ''}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                        ID: {institution.institutionId}
                      </p>
                    </div>
                    <AdminStatusBadge status="active" size="sm" />
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                    ⚠️ Irreversible Action
                  </h3>
                  <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                    <p>
                      This action will disconnect ALL active institutions from Plaid. This means:
                    </p>
                    <ul className="mt-2 list-disc list-inside space-y-1">
                      <li>All accounts will lose their Plaid connection</li>
                      <li>Automatic balance updates will stop</li>
                      <li>Transaction syncing will be disabled</li>
                      <li>Manual accounts will NOT be affected</li>
                      <li>This action cannot be undone</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <AdminActionButton
                onClick={() => setShowConfirmation(true)}
                disabled={activeInstitutions.length === 0}
                variant="danger"
              >
                Disconnect All Institutions
              </AdminActionButton>
              
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {activeInstitutions.length} institution{activeInstitutions.length !== 1 ? 's' : ''} • {totalAccounts} account{totalAccounts !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
        )}
      </AdminToolCard>

      {/* Job Status */}
      {currentJob && (
        <AdminToolCard
          title="Disconnect All Job Status"
          description={`Job ID: ${currentJob.id}`}
          status={currentJob.status === 'completed' ? 'success' : currentJob.status === 'completed_with_errors' ? 'warning' : 'info'}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {currentJob.totalTokens}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Total Tokens</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {currentJob.successCount}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Successful</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {currentJob.failureCount}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Failed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {currentJob.status}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Status</div>
              </div>
            </div>

            {currentJob.hasReport && (
              <div className="flex justify-center">
                <AdminActionButton
                  onClick={() => downloadReport(currentJob.id)}
                  variant="secondary"
                >
                  Download Report
                </AdminActionButton>
              </div>
            )}
          </div>
        </AdminToolCard>
      )}

      {/* Confirmation Modal */}
      {showConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center mb-4">
              <ExclamationTriangleIcon className="h-6 w-6 text-red-500 mr-2" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Confirm Disconnect All
              </h3>
            </div>
            
            <div className="mb-4">
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                Are you absolutely sure you want to disconnect ALL {activeInstitutions.length} institutions 
                ({totalAccounts} accounts) from Plaid?
              </p>
              
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded p-3 mb-4">
                <p className="text-sm text-red-700 dark:text-red-300 font-medium">
                  This action is irreversible and will:
                </p>
                <ul className="text-sm text-red-700 dark:text-red-300 mt-2 list-disc list-inside space-y-1">
                  <li>Disconnect all Plaid connections</li>
                  <li>Stop automatic balance updates</li>
                  <li>Disable transaction syncing</li>
                  <li>Require manual reconnection for each institution</li>
                </ul>
              </div>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                />
                <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                  I understand this action is irreversible and I want to proceed
                </span>
              </label>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowConfirmation(false);
                  setConfirmed(false);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowConfirmation(false);
                  handleDisconnectAll();
                }}
                disabled={!confirmed || submitting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed"
              >
                {submitting ? 'Disconnecting...' : 'Disconnect All'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 