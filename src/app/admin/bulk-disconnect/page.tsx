"use client";

import { useState, useEffect } from 'react';
import { AdminToolCard } from '@/components/admin/AdminToolCard';
import { AdminDataTable } from '@/components/admin/AdminDataTable';
import { AdminActionButton } from '@/components/admin/AdminActionButton';
import { AdminStatusBadge } from '@/components/admin/AdminStatusBadge';

interface BulkDisconnectJob {
  id: string;
  createdAt: string;
  totalTokens: number;
  successCount: number;
  failureCount: number;
  status: string;
  reportPath: string;
  hasReport: boolean;
}

interface BulkDisconnectResult {
  id: string;
  accessToken: string;
  institutionId: string | null;
  institutionName: string | null;
  success: boolean;
  errorMessage: string | null;
  retryCount: number;
  createdAt: string;
}

interface JobDetails {
  id: string;
  createdAt: string;
  totalTokens: number;
  successCount: number;
  failureCount: number;
  status: string;
  reportPath: string;
  results: BulkDisconnectResult[];
}

export default function BulkDisconnectPage() {
  const [jobs, setJobs] = useState<BulkDisconnectJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [tokens, setTokens] = useState('');
  const [selectedJob, setSelectedJob] = useState<JobDetails | null>(null);
  const [showJobDetails, setShowJobDetails] = useState(false);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);

  const fetchJobs = async () => {
    try {
      const response = await fetch('/api/admin/bulk-disconnect');
      if (response.ok) {
        const data = await response.json();
        setJobs(data.jobs || []);
      }
    } catch (error) {
      console.error('Error fetching jobs:', error);
      setJobs([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!tokens.trim()) {
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/admin/bulk-disconnect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tokens }),
      });

      const result = await response.json();
      
      if (result.success) {
        setTokens('');
        await fetchJobs();
      } else {
        console.error('Bulk disconnect error:', result);
      }
    } catch (error) {
      console.error('Submit error:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetry = async (jobId: string, resultId: string) => {
    setRetrying(resultId);
    try {
      const response = await fetch('/api/admin/bulk-disconnect/retry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ jobId, resultId }),
      });

      const result = await response.json();
      
      if (result.success) {
        if (selectedJob) {
          await fetchJobDetails(selectedJob.id);
        }
        await fetchJobs();
      } else {
        console.error('Retry failed:', result.error);
      }
    } catch (error) {
      console.error('Retry error:', error);
    } finally {
      setRetrying(null);
    }
  };

  const fetchJobDetails = async (jobId: string) => {
    try {
      const response = await fetch(`/api/admin/bulk-disconnect/jobs/${jobId}`);
      if (response.ok) {
        const jobDetails = await response.json();
        console.log('Job details:', jobDetails);
        setSelectedJob(jobDetails);
        setShowJobDetails(true);
      } else {
        console.error('Failed to fetch job details:', response.status);
      }
    } catch (error) {
      console.error('Error fetching job details:', error);
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
        a.download = `bulk-disconnect-job-${jobId}.json`;
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

  const toggleJobExpansion = async (jobId: string) => {
    if (expandedJob === jobId) {
      setExpandedJob(null);
    } else {
      setExpandedJob(jobId);
      if (!selectedJob || selectedJob.id !== jobId) {
        await fetchJobDetails(jobId);
      }
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const jobColumns = [
    { key: 'createdAt', label: 'Date', render: (value: string) => new Date(value).toLocaleString() },
    { key: 'totalTokens', label: 'Total Tokens' },
    { key: 'successCount', label: 'Success' },
    { key: 'failureCount', label: 'Failures' },
    { 
      key: 'status', 
      label: 'Status', 
      render: (value: string) => <AdminStatusBadge status={value as any} size="sm" />
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_: any, job: BulkDisconnectJob) => {
        if (!job) return null;
        return (
          <div className="flex gap-2">
            <button
              onClick={() => toggleJobExpansion(job.id)}
              className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
            >
              {expandedJob === job.id ? 'Hide Results' : 'View Results'}
            </button>
            {job.hasReport && (
              <button
                onClick={() => downloadReport(job.id)}
                className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
              >
                Download
              </button>
            )}
          </div>
        );
      },
    },
  ];

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto py-8 px-4">
        <div className="text-center">Loading bulk disconnect jobs...</div>
      </div>
    );
  }

  console.log('AdminDataTable jobs:', jobs);

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Bulk Plaid Token Disconnection</h1>
        <AdminActionButton onClick={fetchJobs} loading={loading}>
          Refresh Jobs
        </AdminActionButton>
      </div>

      <AdminToolCard
        title="Disconnect Access Tokens"
        description="Enter comma-separated Plaid access tokens to disconnect them from Plaid"
        status="warning"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Access Tokens (comma-separated)
            </label>
            <textarea
              value={tokens}
              onChange={(e) => setTokens(e.target.value)}
              placeholder="access-production-4e402271-8191-4037-4e7e-0b3089446e1f, access-sandbox-12345678-1234-1234-1234-123456789012"
              className="w-full h-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Format: access-{'{environment}'}-{'{uuid}'} (e.g., access-production-4e402271-8191-4037-4e7e-0b3089446e1f)
            </p>
          </div>
          
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
            <h4 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">⚠️ Important Notes</h4>
            <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
              <li>• Tokens will be disconnected from Plaid immediately</li>
              <li>• Successful disconnections will be recorded in the database</li>
              <li>• Failed disconnections can be retried individually</li>
              <li>• A detailed report will be generated for each job</li>
              <li>• This action cannot be undone</li>
            </ul>
          </div>

          <AdminActionButton
            onClick={handleSubmit}
            loading={submitting}
            disabled={!tokens.trim()}
            variant="danger"
          >
            Disconnect Tokens
          </AdminActionButton>
        </div>
      </AdminToolCard>

      <AdminToolCard
        title="Job History"
        description="Recent bulk disconnect operations"
        status="info"
      >
        {jobs.length === 0 ? (
          <div className="text-gray-500 text-center py-8">No jobs found</div>
        ) : (
          <div className="space-y-4">
            <AdminDataTable
              columns={jobColumns}
              data={jobs}
              itemsPerPage={10}
            />
            
            {expandedJob && selectedJob && selectedJob.id === expandedJob && (
              <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Job Results - {selectedJob.id}</h3>
                  <div className="flex items-center gap-4">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {selectedJob.successCount} success, {selectedJob.failureCount} failures
                    </div>
                    <button
                      onClick={() => fetchJobDetails(selectedJob.id)}
                      className="px-2 py-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700"
                    >
                      Refresh
                    </button>
                  </div>
                </div>
                
                <div className="space-y-2">
                  {selectedJob.results && selectedJob.results.length > 0 ? (
                    selectedJob.results.map((result) => (
                      <div
                        key={result.id}
                        className={`p-3 rounded border ${
                          result.success
                            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700'
                            : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">
                              {result.accessToken.substring(0, 20)}...
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                              {result.institutionName || 'Unknown Institution'}
                            </div>
                            {!result.success && result.errorMessage && (
                              <div className="text-sm text-red-600 dark:text-red-400 mt-1">
                                Error: {result.errorMessage}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <AdminStatusBadge 
                              status={result.success ? 'active' : 'error'} 
                              size="sm" 
                            />
                            {!result.success && (
                              <button
                                onClick={() => handleRetry(selectedJob.id, result.id)}
                                disabled={retrying === result.id}
                                className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed"
                              >
                                {retrying === result.id ? 'Retrying...' : 'Retry'}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-gray-500 text-center py-4">
                      No results found for this job.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </AdminToolCard>
    </div>
  );
}
