"use client";

import { useState, useEffect } from "react";
import { usePlaidLink } from "react-plaid-link";
import { 
  ExclamationTriangleIcon, 
  XMarkIcon,
  ArrowPathIcon 
} from "@heroicons/react/24/outline";

interface AuthStatus {
  institutionId: string;
  institutionName: string;
  status: "valid" | "needs_reauth" | "institution_down" | "error" | "unknown";
  errorMessage?: string;
  errorCode?: string;
  accounts: number;
  lastChecked: string;
}

interface AuthSummary {
  total: number;
  valid: number;
  needsReauth: number;
  institutionDown: number;
  errors: number;
}

export function AuthenticationAlerts() {
  const [authStatus, setAuthStatus] = useState<AuthStatus[]>([]);
  const [summary, setSummary] = useState<AuthSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [selectedInstitution, setSelectedInstitution] = useState<string | null>(null);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());

  // Fetch authentication status
  const checkAuthStatus = async () => {
    try {
      setIsChecking(true);
      const response = await fetch("/api/accounts/auth-status");
      if (!response.ok) throw new Error("Failed to check auth status");
      
      const data = await response.json();
      setAuthStatus(data.authStatus);
      setSummary(data.summary);
    } catch (error) {
      console.error("Error checking auth status:", error);
    } finally {
      setIsChecking(false);
    }
  };

  // Check auth status on mount and every 5 minutes
  useEffect(() => {
    checkAuthStatus();
    const interval = setInterval(checkAuthStatus, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Handle re-authentication
  const handleReauth = async (institutionId: string) => {
    try {
      setIsLoading(true);
      setSelectedInstitution(institutionId);
      
      const response = await fetch("/api/plaid/create-update-link-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ institutionId }),
      });
      
      if (!response.ok) throw new Error("Failed to create update token");
      
      const { link_token } = await response.json();
      setLinkToken(link_token);
    } catch (error) {
      console.error("Error initiating re-auth:", error);
      setIsLoading(false);
      setSelectedInstitution(null);
    }
  };

  // Plaid Link configuration
  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: async (public_token, metadata) => {
      try {
        // Exchange the public token for an access token
        const response = await fetch("/api/plaid/exchange-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ publicToken: public_token }),
        });

        if (!response.ok) throw new Error("Failed to exchange token");

        // Refresh the auth status
        await checkAuthStatus();
        
        // Clear the selected institution
        setSelectedInstitution(null);
        setLinkToken(null);
      } catch (error) {
        console.error("Error completing re-auth:", error);
      } finally {
        setIsLoading(false);
      }
    },
    onExit: () => {
      setIsLoading(false);
      setSelectedInstitution(null);
      setLinkToken(null);
    },
  });

  // Open Plaid Link when ready
  useEffect(() => {
    if (ready && linkToken && selectedInstitution) {
      open();
    }
  }, [ready, linkToken, selectedInstitution, open]);

  // Dismiss an alert
  const dismissAlert = (institutionId: string) => {
    setDismissedAlerts(prev => new Set(prev).add(institutionId));
  };

  // Utility to determine severity order
  const statusSeverity = (status: string) => {
    switch (status) {
      case "needs_reauth": return 3;
      case "institution_down": return 2;
      case "error": return 1;
      default: return 0;
    }
  };

  // Group authStatus by institutionId
  const groupedAuthStatus: AuthStatus[] = Object.values(
    (authStatus || []).reduce((acc, curr) => {
      if (!acc[curr.institutionId]) {
        acc[curr.institutionId] = { ...curr };
      } else {
        // Aggregate accounts
        acc[curr.institutionId].accounts += curr.accounts;
        // Pick the most severe status
        if (statusSeverity(curr.status) > statusSeverity(acc[curr.institutionId].status)) {
          acc[curr.institutionId].status = curr.status;
          acc[curr.institutionId].errorMessage = curr.errorMessage;
          acc[curr.institutionId].errorCode = curr.errorCode;
        }
      }
      return acc;
    }, {} as Record<string, AuthStatus>)
  );

  // Filter out dismissed alerts and only show problematic ones
  const problematicInstitutions = groupedAuthStatus.filter(
    status => 
      status.status !== "valid" && 
      !dismissedAlerts.has(status.institutionId)
  );

  if (problematicInstitutions.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 mb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <ExclamationTriangleIcon className="h-5 w-5 text-orange-600 dark:text-orange-400" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Authentication Issues
          </h2>
        </div>
        <button
          onClick={checkAuthStatus}
          disabled={isChecking}
          className="flex items-center space-x-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white disabled:opacity-50"
        >
          <ArrowPathIcon className={`h-4 w-4 ${isChecking ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Alerts */}
      {problematicInstitutions.map((institution) => (
        <div
          key={institution.institutionId}
          className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center">
                <ExclamationTriangleIcon className="h-5 w-5 text-orange-600 dark:text-orange-400 mr-2" />
                <h3 className="text-sm font-medium text-orange-800 dark:text-orange-200">
                  {institution.institutionName}
                </h3>
              </div>
              <div className="mt-2 text-sm text-orange-700 dark:text-orange-300">
                <p>{institution.errorMessage}</p>
                <p className="text-xs mt-1">
                  {institution.accounts} account{institution.accounts !== 1 ? 's' : ''} affected
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {institution.status === "needs_reauth" && (
                <button
                  onClick={() => handleReauth(institution.institutionId)}
                  disabled={isLoading}
                  className="bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 text-white text-sm px-3 py-1 rounded-md transition-colors"
                >
                  {isLoading && selectedInstitution === institution.institutionId 
                    ? "Connecting..." 
                    : "Reconnect"}
                </button>
              )}
              <button
                onClick={() => dismissAlert(institution.institutionId)}
                className="text-orange-600 dark:text-orange-400 hover:text-orange-800 dark:hover:text-orange-200"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      ))}

      {/* Summary */}
      {summary && (
        <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
          {summary.needsReauth > 0 && (
            <span className="mr-3">
              {summary.needsReauth} institution{summary.needsReauth !== 1 ? 's' : ''} need{summary.needsReauth !== 1 ? '' : 's'} re-authentication
            </span>
          )}
          {summary.institutionDown > 0 && (
            <span className="mr-3">
              {summary.institutionDown} institution{summary.institutionDown !== 1 ? 's' : ''} temporarily unavailable
            </span>
          )}
          {summary.valid > 0 && (
            <span>
              {summary.valid} institution{summary.valid !== 1 ? 's' : ''} working properly
            </span>
          )}
        </div>
      )}
    </div>
  );
} 