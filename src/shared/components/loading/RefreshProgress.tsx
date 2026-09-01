/**
 * RefreshProgress — non-blocking top loading bar + "last updated" badge.
 *
 * International-standard pattern (YouTube, GitHub, NProgress): a thin
 * indeterminate progress bar slides across the top of the viewport while
 * a background request is in-flight, plus a subtle pulsing badge so the
 * user knows data is being refreshed.
 *
 * Props:
 *   - isFetching: true while any request is in-flight (RTK Query `isFetching`)
 *   - lastUpdated: optional Date of the most recent successful fetch
 */
import { Loader2, RefreshCw } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

interface RefreshProgressProps {
  isFetching: boolean;
  lastUpdated?: Date | null;
}

/** Format a Date as "HH:mm:ss" (locale-agnostic) */
function formatTime(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mi}:${ss}`;
}

export default function RefreshProgress({ isFetching, lastUpdated }: RefreshProgressProps) {
  return (
    <>
      {/* Top loading bar — fixed at viewport top, above all content.
          Always mounted; visibility driven by CSS so no setState-in-effect
          is needed. The bar slides while fetching and fades out via the
          `refresh-bar-exit` animation when the fetch completes. */}
      <div
        className={cn(
          'fixed inset-x-0 top-0 z-[100] h-0.5 overflow-hidden bg-transparent transition-opacity duration-300',
          isFetching ? 'opacity-100' : 'opacity-0',
        )}
        aria-hidden={!isFetching}
      >
        <div
          className={cn(
            'h-full bg-gradient-to-r from-[#2E7D5B] via-[#3FA37A] to-[#10B981]',
            isFetching ? 'refresh-bar-slide' : 'refresh-bar-exit',
          )}
        />
      </div>

      {/* "Last updated" badge — subtle, non-blocking.
          Hidden below lg to save horizontal space for the export button. */}
      <div className="hidden items-center gap-2 lg:flex">
        {isFetching ? (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#E7F4EE] px-2.5 py-1 text-[11px] font-semibold text-[#2E7D5B]">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span className="animate-pulse">Refreshing…</span>
          </span>
        ) : lastUpdated ? (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#F4F6F8] px-2.5 py-1 text-[11px] font-medium text-[#6B7280]">
            <RefreshCw className="h-3 w-3 text-[#9CA3AF]" />
            <span>Updated {formatTime(lastUpdated)}</span>
          </span>
        ) : null}
      </div>
    </>
  );
}