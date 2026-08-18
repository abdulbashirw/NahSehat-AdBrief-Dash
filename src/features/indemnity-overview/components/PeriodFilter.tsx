/**
 * PeriodFilter — segmented control for selecting claim period and payor.
 *
 * Displays W1/W2/W3/W4 | Month | Custom pills with month selector
 * or custom date range inputs, plus a payor dropdown filtered by
 * INDEMNITY category payors that the logged-in user has access to.
 *
 * Reads/writes global state from periodFilterStore.
 * Shows a badge with the computed date range.
 */
import { useMemo, useEffect } from 'react';
import { useSyncExternalStore } from 'react';
import {
  subscribe,
  getSnapshot,
  getServerSnapshot,
  setPeriodType,
  setSelectedMonth,
  setCustomStartDate,
  setCustomEndDate,
  setSelectedPayorId,
  getDateRangeLabel,
  validateCustomRange,
  MAX_CUSTOM_RANGE_DAYS,
  AVAILABLE_MONTHS,
  type PeriodType,
} from '@/features/indemnity-overview/store/periodFilterStore';
import { useGetPayorsQuery } from '@/entities/payor/api/payorApi';
import { useAppSelector } from '@/shared/store';
import { cn } from '@/shared/lib/utils';

const PERIOD_OPTIONS: { value: PeriodType; label: string }[] = [
  { value: 'w1', label: 'W1' },
  { value: 'w2', label: 'W2' },
  { value: 'w3', label: 'W3' },
  { value: 'w4', label: 'W4' },
  { value: 'month', label: 'Month' },
  { value: 'custom', label: 'Custom' },
];

export default function PeriodFilter() {
  const filter = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const rangeLabel = getDateRangeLabel(filter);
  const isCustom = filter.periodType === 'custom';
  const rangeValidation = validateCustomRange(filter);

  // Compute max end date = start date + (MAX_CUSTOM_RANGE_DAYS - 1) days
  const maxEndDate = useMemo(() => {
    if (!filter.customStartDate) return undefined;
    const start = new Date(filter.customStartDate);
    start.setDate(start.getDate() + MAX_CUSTOM_RANGE_DAYS - 1);
    return start.toISOString().split('T')[0];
  }, [filter.customStartDate]);

  // ── Auth: get user's payorIds ──
  const user = useAppSelector((s) => s.auth.user);
  const userPayorIds = user?.payorIds ?? [];

  // ── Fetch all payors ──
  const { data: payorsData } = useGetPayorsQuery({ page: 1, pageSize: 999 });

  // ── Filter: only INDEMNITY payors that the user has access to ──
  // If user has no payorIds (e.g. SUPER_ADMIN), show all active INDEMNITY payors
  const indemnityPayors = useMemo(() => {
    const allPayors = payorsData?.data ?? [];
    const activeIndemnity = allPayors.filter(
      (p) => p.category === 'INDEMNITY' && p.isActive,
    );
    if (userPayorIds.length === 0) return activeIndemnity;
    return activeIndemnity.filter((p) => userPayorIds.includes(p.id));
  }, [payorsData, userPayorIds]);

  // ── Auto-select first payor if none selected ──
  useEffect(() => {
    if (filter.selectedPayorId === 'ALL' && indemnityPayors.length > 0) {
      setSelectedPayorId(indemnityPayors[0].id);
    }
  }, [indemnityPayors, filter.selectedPayorId]);

  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="flex flex-col gap-3">
        {/* Row 1: Period pills + Payor selector + date range badge */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">
              Period
            </span>
            <div className="inline-flex rounded-[10px] bg-[#F1F5F9] p-[3px]">
              {PERIOD_OPTIONS.map((opt, i) => {
                const isActive = filter.periodType === opt.value;
                const isSeparator = i === 4; // before 'Month'
                return (
                  <span key={opt.value} className="contents">
                    {isSeparator && (
                      <span className="mx-[2px] my-1 w-px bg-[#CBD5E1]" />
                    )}
                    <button
                      onClick={() => setPeriodType(opt.value)}
                      className={cn(
                        'rounded-[8px] px-3 py-[6px] text-[13px] font-medium transition-all duration-150 whitespace-nowrap',
                        isActive
                          ? 'bg-white text-[#0F172A] font-semibold shadow-[0_1px_3px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.06)]'
                          : 'text-[#64748B] hover:text-[#334155] hover:bg-white/60',
                      )}
                    >
                      {opt.label}
                    </button>
                  </span>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Payor selector */}
            {indemnityPayors.length > 0 && (
              <div className="flex items-center gap-1.5">
                <svg className="h-3.5 w-3.5 text-[#64748B]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M3 21h18M3 7v1a3 3 0 0 0 6 0V7m0 1a3 3 0 0 0 6 0V7m0 1a3 3 0 0 0 6 0V7H3l2-4h14l2 4M9 21V11M15 21V11" />
                </svg>
                <select
                  value={filter.selectedPayorId}
                  onChange={(e) => setSelectedPayorId(e.target.value)}
                  className="h-8 rounded-lg border border-[#E2E8F0] bg-white px-2 text-[12px] font-medium text-[#1E293B] outline-none transition-colors focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2394A3B8%22%20stroke-width%3D%222%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%2F%3E%3C%2Fsvg%3E')] bg-[length:12px] bg-[right_8px_center] bg-no-repeat pr-7"
                >
                  {indemnityPayors.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Date range badge */}
            <div className="inline-flex items-center gap-1.5 rounded-[6px] border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-1">
              <svg className="h-3.5 w-3.5 text-[#64748B]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <span className="text-[12px] font-semibold text-[#334155]">{rangeLabel}</span>
            </div>
          </div>
        </div>

        {/* Row 2: Month selector OR custom date inputs */}
        <div className="flex flex-wrap items-center gap-3">
          {!isCustom ? (
            /* Month dropdown */
            <select
              value={filter.selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="h-9 rounded-lg border border-[#E2E8F0] bg-white px-3 text-[13px] font-medium text-[#1E293B] outline-none transition-colors focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2394A3B8%22%20stroke-width%3D%222%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%2F%3E%3C%2Fsvg%3E')] bg-[length:12px] bg-[right_10px_center] bg-no-repeat pr-8"
            >
              {AVAILABLE_MONTHS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          ) : (
            /* Custom date range inputs */
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <label className="text-[11px] font-medium text-[#64748B]">Start</label>
                <input
                  type="date"
                  value={filter.customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="h-9 rounded-lg border border-[#E2E8F0] bg-white px-3 text-[13px] font-medium text-[#1E293B] outline-none transition-colors focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 cursor-pointer"
                />
              </div>
              <svg className="h-4 w-4 text-[#94A3B8]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <div className="flex items-center gap-1.5">
                <label className="text-[11px] font-medium text-[#64748B]">End</label>
                <input
                  type="date"
                  value={filter.customEndDate}
                  max={maxEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="h-9 rounded-lg border border-[#E2E8F0] bg-white px-3 text-[13px] font-medium text-[#1E293B] outline-none transition-colors focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* Validation error for custom range */}
          {isCustom && !rangeValidation.valid && (
            <div className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5">
              <svg className="h-3.5 w-3.5 flex-shrink-0 text-red-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span className="text-[12px] font-medium text-red-600">{rangeValidation.message}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}