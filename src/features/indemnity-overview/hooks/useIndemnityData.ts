/**
 * useIndemnityData — hook that fetches AdmDailyClaim data via RTK Query
 * and applies client-side filters (coverage, claim type, status, search).
 *
 * Server-side filtering:
 *   - Period filter: start_date / end_date sent as POST body (ddmmyyyy)
 *   - Payor filter: payor_code sent as POST body (resolved from Payor.code)
 *
 * Client-side filtering (additional):
 *   - coverageId, claimType, status, search
 */
import { useMemo, useEffect } from 'react';
import { useSyncExternalStore } from 'react';
import { useGetDCSehatQuery } from '@/entities/claim/api/claimApi';
import type { AdmDailyClaimRequest } from '@/entities/claim/api/claimApi';
import {
  subscribe as subscribeFilter,
  getSnapshot as getFilterSnapshot,
  getServerSnapshot as getFilterServerSnapshot,
  getDateRange,
  setSelectedPayorId,
} from '@/features/indemnity-overview/store/periodFilterStore';
import { useGetPayorsQuery } from '@/entities/payor/api/payorApi';
import { useAppSelector } from '@/shared/store';
import { useHasRole } from '@/entities/auth/model/useRbac';
import type { ClaimsApiResponse } from '@/shared/types';

export interface IndemnityFilters {
  payorId?: string;
  coverageId?: string;
  claimType?: string;
  status?: string;
  search?: string;
}

/** Convert Date to ddmmyyyy string */
function toDDMMYYYY(d: Date): string {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}${month}${year}`;
}

export function useIndemnityData(filters?: IndemnityFilters) {
  const periodFilter = useSyncExternalStore(subscribeFilter, getFilterSnapshot, getFilterServerSnapshot);



  // ── Fetch all payors to resolve payor_code ──
  const { data: payorsData } = useGetPayorsQuery({ page: 1, pageSize: 999 });

  // ── Auth: get user's payorIds ──
  const user = useAppSelector((s) => s.auth.user);
  const userPayorIds = user?.payorIds ?? [];
  const isSuperAdmin = useHasRole('SUPER_ADMIN');

  // ── Filter: only INDEMNITY payors that the user has access to ──
  const indemnityPayors = useMemo(() => {
    const allPayors = payorsData?.data ?? [];
    const activeIndemnity = allPayors.filter(
      (p) => p.category === 'INDEMNITY' && p.isActive,
    );
    if (isSuperAdmin && userPayorIds.length === 0) return activeIndemnity;
    const assignedPayorIds = new Set(userPayorIds.map(String));
    return activeIndemnity.filter((p) => assignedPayorIds.has(String(p.id)));
  }, [isSuperAdmin, payorsData, userPayorIds]);

  // ── Keep the global selection within the user's current access ──
  useEffect(() => {
    const selectedPayorIsAllowed = indemnityPayors.some(
      (payor) => payor.id === periodFilter.selectedPayorId,
    );
    if (!selectedPayorIsAllowed) {
      setSelectedPayorId(indemnityPayors[0]?.id ?? 'ALL');
    }
  }, [indemnityPayors, periodFilter.selectedPayorId]);

  // ── Resolve selectedPayorId → payor_code ──
  const selectedPayorId = periodFilter.selectedPayorId;
  const payorCode = useMemo(() => {
    if (!selectedPayorId || selectedPayorId === 'ALL') return '';
    const allPayors = payorsData?.data ?? [];
    const payor = allPayors.find((p) => String(p.id) === String(selectedPayorId));
    return payor?.code ?? '';
  }, [selectedPayorId, payorsData]);

  // ── Build request body from period filter ──
  const requestBody: AdmDailyClaimRequest | undefined = useMemo(() => {
    if (!payorCode) return undefined; // Don't fetch until we have a payor code
    const { startDate, endDate } = getDateRange(periodFilter);
    return {
      start_date: toDDMMYYYY(startDate),
      end_date: toDDMMYYYY(endDate),
      payor_code: payorCode,
    };
  }, [periodFilter, payorCode]);

  const { data, isLoading, isFetching, isError, error, refetch, fulfilledTimeStamp } = useGetDCSehatQuery(requestBody!, {
    skip: !requestBody,
    pollingInterval: 600_000, // 10 minutes — RTK Query native polling (1 timer per cache entry)
  });

  // ── Last successful fetch timestamp (for "Updated HH:mm:ss" badge) ──
  // Uses RTK Query's fulfilledTimeStamp from the cache entry, so it
  // persists across tab navigation (unlike component-local useState).
  const lastUpdated = useMemo(
    () => (fulfilledTimeStamp ? new Date(fulfilledTimeStamp) : null),
    [fulfilledTimeStamp],
  );

  // ── Client-side filters (coverage, claim type, status, search) ──
  const filtered = useMemo(() => {
    if (!data) return null;
    let claims = data.claims;

    if (filters) {
      if (filters.payorId && filters.payorId !== 'ALL') {
        claims = claims.filter((c) => c.PAYORID === filters.payorId);
      }
      if (filters.coverageId && filters.coverageId !== 'ALL') {
        claims = claims.filter((c) => c.COVERAGEID === filters.coverageId);
      }
      if (filters.claimType && filters.claimType !== 'ALL') {
        claims = claims.filter((c) => c.CLAIMTYPE === filters.claimType);
      }
      if (filters.status && filters.status !== 'ALL') {
        claims = claims.filter((c) => c.STATUS === filters.status);
      }
      if (filters.search) {
        const q = filters.search.toLowerCase();
        claims = claims.filter(
          (c) =>
            c.NAME.toLowerCase().includes(q) ||
            c.CLAIMNO.toLowerCase().includes(q) ||
            c.MEMBERNO.toLowerCase().includes(q) ||
            c.providerName?.toLowerCase().includes(q),
        );
      }
    }

    return { ...data, claims } as ClaimsApiResponse;
  }, [data, filters]);

  return {
    data: filtered,
    isLoading,
    isFetching,
    lastUpdated,
    isError,
    error,
    refetch,
  };
}