/**
 * Safe error handling utility to prevent console.error issues with null/undefined errors
 */

export interface SafeErrorInfo {
  message: string;
  stack?: string;
  errorType: string;
  originalError?: any;
}

export function safeErrorLog(context: string, error: any): SafeErrorInfo {
  const errorInfo: SafeErrorInfo = {
    message: error ? (error instanceof Error ? error.message : String(error)) : 'Unknown error',
    errorType: error ? typeof error : 'null/undefined'
  };

  if (error && error instanceof Error) {
    errorInfo.stack = error.stack;
  }

  // Use console.log instead of console.error to avoid null payload issues
  console.log(`Error in ${context}:`, errorInfo);
  
  return errorInfo;
}

export function createErrorResponse(error: any, defaultMessage: string = 'An error occurred') {
  const errorInfo = safeErrorLog('API endpoint', error);
  
  return {
    error: defaultMessage,
    details: errorInfo.message
  };
} 