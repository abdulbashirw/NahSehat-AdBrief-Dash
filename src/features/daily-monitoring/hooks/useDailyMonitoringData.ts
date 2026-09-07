/**
 * useDailyMonitoringData — hook that fetches daily monitoring data via RTK Query.
 *
 * Mirrors the `useIndemnityData` pattern from the Indemnity pages:
 *   - Encapsulates payor resolution (user.payorIds → payor_code)
 *   - Computes the 30-day date range (KEEP from original DailyMonitoring)
 *   - Uses RTK Query native `pollingInterval` for auto-refresh (ADOPT from Indemnity)
 *   - Exposes `fulfilledTimeStamp` as `lastUpdated` for the "Updated HH:mm:ss" badge
 *
 * Unlike Indemnity, there is no user-selectable date filter — the range is
 * always the last 30 days (hardcoded, per product requirement).
 */
import { useMemo } from 'react';
import { useGetDailyMonitoringQuery } from '@/entities/monitoring/api/monitoringApi';
import type { DailyMonitoringItem, DailyMonitoringResponse } from '@/entities/monitoring/api/monitoringApi';
import { useGetPayorsQuery } from '@/entities/payor/api/payorApi';
import { useAppSelector } from '@/shared/store';
import { useHasRole } from '@/entities/auth/model/useRbac';

/** Format Date to YYYY-MM-DD (API expects this format for dailyMonitoring). */
function formatDate(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export interface UseDailyMonitoringDataResult {
  /** Raw monitoring items (empty array while loading). */
  items: DailyMonitoringItem[];
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  refetch: () => void;
  /** Timestamp of the most recent successful fetch — for "Updated" badge. */
  lastUpdated: Date | null;
  /** Resolved payor code (empty string if not yet resolved / no access). */
  payorCode: string;
}

export function useDailyMonitoringData(): UseDailyMonitoringDataResult {
  // ── Auth & RBAC ──
  const user = useAppSelector((s) => s.auth.user);
  const isManageCareRole = useHasRole('MANAGECARE');
  const isSuperAdmin = useHasRole('SUPER_ADMIN');
  const isAdmin = useHasRole('ADMIN');
  const isManageCare = isManageCareRole || isSuperAdmin || isAdmin;

  // ── Fetch all payors to resolve payorIds → payor_code ──
  const { data: payorsData } = useGetPayorsQuery(
    { page: 1, pageSize: 999 },
    { skip: !isManageCare },
  );

  // ── Resolve payor_code: first MANAGE_CARE payor matching user's payorIds ──
  const payorCode = useMemo(() => {
    if (!isManageCare || !user?.payorIds?.length) return '';
    const allPayors = payorsData?.data ?? [];
    const match = allPayors.find(
      (p) => p.category === 'MANAGE_CARE' && user.payorIds.includes(p.id),
    );
    return match?.code ?? '';
  }, [payorsData, user, isManageCare]);

  // ── Compute date range: 30 days ago → now (KEEP from original) ──
  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return { startDate: formatDate(thirtyDaysAgo), endDate: formatDate(now) };
  }, []);

  // ── Daily monitoring query with native polling (ADOPT from Indemnity) ──
  const {
    data: responseData,
    isLoading,
    isFetching,
    isError,
    refetch,
    fulfilledTimeStamp,
  } = useGetDailyMonitoringQuery(
    { payor_code: payorCode, start_date: startDate, end_date: endDate },
    {
      skip: !payorCode,
      pollingInterval: 600_000, // 10 minutes — RTK Query native polling
    },
  );

  // ── Normalise response → items array ──
  const items: DailyMonitoringItem[] = useMemo(() => {
    return Array.isArray(responseData?.data) ? (responseData as DailyMonitoringResponse).data : [];
  }, [responseData]);

  // ── Last successful fetch timestamp ──
  const lastUpdated = useMemo(
    () => (fulfilledTimeStamp ? new Date(fulfilledTimeStamp) : null),
    [fulfilledTimeStamp],
  );

  return {
    items,
    isLoading,
    isFetching,
    isError,
    refetch,
    lastUpdated,
    payorCode,
  };
}