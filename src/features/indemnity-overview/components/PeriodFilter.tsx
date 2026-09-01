/**
 * PeriodFilter — single-row filter bar with payor selector and date picker.
 *
 * Concept: "per Date Now" — a single date picker defaulting to today.
 * No period type toggle.
 *
 * Groups:
 *   ① Payor dropdown (filtered by INDEMNITY category + user access)
 *   ② Date picker (defaults to today)
 *   ③ Refresh status (last updated / refreshing)
 *
 * Reads/writes global state from periodFilterStore.
 */
import { useMemo, useEffect } from 'react';
import { useSyncExternalStore } from 'react';
import {
  subscribe,
  getSnapshot,
  getServerSnapshot,
  setSelectedDay,
  setSelectedPayorId,
} from '@/features/indemnity-overview/store/periodFilterStore';
import { useGetPayorsQuery } from '@/entities/payor/api/payorApi';
import { useAppSelector } from '@/shared/store';
import RefreshProgress from '@/shared/components/loading/RefreshProgress';

interface PeriodFilterProps {
  /** True while a background refetch is in-flight (RTK Query `isFetching`). */
  isFetching?: boolean;
  /** Timestamp of the most recent successful fetch — shown as "Updated HH:mm:ss". */
  lastUpdated?: Date | null;
}

export default function PeriodFilter({ isFetching, lastUpdated }: PeriodFilterProps) {
  const filter = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

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
    <div className="flex flex-wrap items-center gap-2">
        {/* ── Group 1: Payor selector ── */}
        {indemnityPayors.length > 0 && (
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 text-[#64748B]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <select
              value={filter.selectedPayorId}
              onChange={(e) => setSelectedPayorId(e.target.value)}
              className="h-9 rounded-lg border border-[#E2E8F0] bg-white pl-3 pr-9 text-[13px] font-medium text-[#1F2A37] outline-none transition-colors focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2214%22%20height%3D%2214%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2364748B%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%2F%3E%3C%2Fsvg%3E')] bg-[length:14px] bg-[right_10px_center] bg-no-repeat"
            >
              {indemnityPayors.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* ── Hairline divider between payor and date ── */}
        {indemnityPayors.length > 0 && (
          <div className="w-px self-stretch bg-[#E5E8EC]" />
        )}

        {/* ── Group 2: Date picker ── */}
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 text-[#64748B]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <input
            type="date"
            value={filter.selectedDay}
            onChange={(e) => setSelectedDay(e.target.value)}
            className="h-9 rounded-lg border border-[#E2E8F0] bg-white px-3 text-[13px] font-medium text-[#1F2A37] outline-none transition-colors focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 cursor-pointer"
          />
        </div>

        {/* ── Group 3: Refresh status ── */}
        <RefreshProgress isFetching={!!isFetching} lastUpdated={lastUpdated} />
    </div>
  );
}