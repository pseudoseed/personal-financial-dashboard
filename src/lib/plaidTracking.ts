import { prisma } from "./db";
import { v4 as uuidv4 } from "uuid";

export interface PlaidApiCallLogParams {
  endpoint: string;
  responseStatus: number;
  institutionId?: string;
  accountId?: string;
  userId?: string;
  durationMs?: number;
  errorMessage?: string;
  appInstanceId?: string;
  requestData?: any;
  responseData?: any;
}

/**
 * Log a Plaid API call to the database
 * This function should be called for every Plaid API request to ensure accurate billing tracking
 */
export async function logPlaidApiCall({
  endpoint,
  responseStatus,
  institutionId,
  accountId,
  userId,
  durationMs,
  errorMessage,
  appInstanceId,
  requestData,
  responseData,
}: PlaidApiCallLogParams): Promise<void> {
  try {
    await prisma.plaidApiCallLog.create({
      data: {
        id: uuidv4(),
        timestamp: new Date(),
        endpoint,
        responseStatus,
        institutionId: institutionId || null,
        accountId: accountId || null,
        userId: userId || null,
        durationMs: durationMs || null,
        errorMessage: errorMessage || null,
        appInstanceId: appInstanceId || null,
      },
    });
  } catch (err) {
    console.error('[PlaidApiCallLog] Failed to log Plaid API call:', err);
    // Don't throw - we don't want logging failures to break the main functionality
  }
}

/**
 * Wrapper function to track Plaid API calls with automatic timing and error handling
 * Usage: const result = await trackPlaidApiCall(() => plaidClient.someEndpoint(params), options)
 */
export async function trackPlaidApiCall<T>(
  apiCall: () => Promise<T>,
  options: {
    endpoint: string;
    institutionId?: string;
    accountId?: string;
    userId?: string;
    appInstanceId?: string;
    requestData?: any;
  }
): Promise<T> {
  const startTime = Date.now();
  let responseStatus = 200;
  let errorMessage: string | undefined;
  let responseData: any;

  try {
    const result = await apiCall();
    responseData = result;
    return result;
  } catch (error: any) {
    responseStatus = error?.response?.status || 500;
    errorMessage = error instanceof Error ? error.message : String(error || 'Unknown error');
    throw error;
  } finally {
    const durationMs = Date.now() - startTime;
    
    await logPlaidApiCall({
      endpoint: options.endpoint,
      responseStatus,
      institutionId: options.institutionId,
      accountId: options.accountId,
      userId: options.userId,
      durationMs,
      errorMessage,
      appInstanceId: options.appInstanceId,
      requestData: options.requestData,
      responseData,
    });
  }
}

/**
 * Get the current user ID for tracking purposes
 * This should be called from API routes to get the user context
 */
export async function getCurrentUserId(): Promise<string> {
  // For now, return default user ID
  // In a real implementation, this would get the user ID from the session/auth context
  return "default";
}

/**
 * Get app instance ID for tracking purposes
 * This helps identify which deployment/instance made the call
 */
export function getAppInstanceId(): string {
  return process.env.APP_INSTANCE_ID || process.env.VERCEL_URL || 'local';
} 