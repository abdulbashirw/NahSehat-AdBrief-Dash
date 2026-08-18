/**
 * PageError — full-page error display with retry option.
 */
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface PageErrorProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export default function PageError({
  title = 'Something went wrong',
  message = 'An unexpected error occurred. Please try again or contact support.',
  onRetry,
}: PageErrorProps) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-50">
        <AlertTriangle className="h-10 w-10 text-red-500" />
      </div>
      <h2 className="text-2xl font-bold text-[#1F2A37]">{title}</h2>
      <p className="max-w-lg text-center text-sm text-[#6B7280]">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#2E7D5B] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#245A47]"
        >
          <RefreshCw className="h-4 w-4" />
          Try Again
        </button>
      )}
    </div>
  );
}