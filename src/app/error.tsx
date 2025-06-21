'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/Button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background">
      <div className="p-10 bg-surface-100 dark:bg-surface-dark-100 border border-border rounded-lg text-center">
        <h2 className="text-2xl font-bold text-error-500 mb-4">Something went wrong!</h2>
        <p className="text-secondary-600 dark:text-secondary-400 mb-6">
          {error.message || "An unexpected error occurred. Please try again."}
        </p>
        <Button
          onClick={() => reset()}
          variant="primary"
        >
          Try again
        </Button>
      </div>
    </div>
  );
} 