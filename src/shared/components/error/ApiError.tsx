/**
 * ApiError — displays API error states with retry option.
 * Supports 'light' (default) and 'dark' variants.
 */
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

interface ApiErrorProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  /** Visual variant: 'light' for white backgrounds, 'dark' for dark/navy backgrounds */
  variant?: 'light' | 'dark';
}

export default function ApiError({
  title = 'Failed to load data',
  message = 'An error occurred while fetching data. Please try again.',
  onRetry,
  variant = 'light',
}: ApiErrorProps) {
  const isDark = variant === 'dark';

  return (
    <div className="flex min-h-[300px] flex-col items-center justify-center gap-4 p-8">
      <div className={cn(
        'flex h-16 w-16 items-center justify-center rounded-full',
        isDark ? 'bg-red-500/15' : 'bg-red-50',
      )}>
        <AlertTriangle className={cn('h-8 w-8', isDark ? 'text-red-400' : 'text-red-500')} />
      </div>
      <h3 className={cn('text-lg font-semibold', isDark ? 'text-white' : 'text-[#1F2A37]')}>{title}</h3>
      <p className={cn('max-w-md text-center text-sm', isDark ? 'text-[#94A3B8]' : 'text-[#6B7280]')}>{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className={cn(
            'mt-2 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition',
            isDark
              ? 'bg-[#2563EB] hover:bg-[#1D4ED8]'
              : 'bg-[#2E7D5B] hover:bg-[#245A47]',
          )}
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </button>
      )}
    </div>
  );
}