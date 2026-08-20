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
import { useMemo, useEffect, useRef, useState } from 'react';
import { useSyncExternalStore } from 'react';
import { useGetDCSehatQuery } from '@/entities/claim/api/claimApi';
import type { AdmDailyClaimRequest } from '@/entities/claim/api/claimApi';
import {
  subscribe as subscribeFilter,
  getSnapshot as getFilterSnapshot,
  getServerSnapshot as getFilterServerSnapshot,
  getDateRange,
  validateCustomRange,
  setSelectedPayorId,
} from '@/features/indemnity-overview/store/periodFilterStore';
import { useGetPayorsQuery } from '@/entities/payor/api/payorApi';
import { useAppSelector } from '@/shared/store';
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

  // ── Filter: only INDEMNITY payors that the user has access to ──
  const indemnityPayors = useMemo(() => {
    const allPayors = payorsData?.data ?? [];
    const activeIndemnity = allPayors.filter(
      (p) => p.category === 'INDEMNITY' && p.isActive,
    );
    if (userPayorIds.length === 0) return activeIndemnity;
    return activeIndemnity.filter((p) => userPayorIds.includes(p.id));
  }, [payorsData, userPayorIds]);

  // ── Auto-select first payor if none selected (works even without PeriodFilter) ──
  useEffect(() => {
    if (periodFilter.selectedPayorId === 'ALL' && indemnityPayors.length > 0) {
      setSelectedPayorId(indemnityPayors[0].id);
    }
  }, [indemnityPayors, periodFilter.selectedPayorId]);

  // ── Resolve selectedPayorId → payor_code ──
  const selectedPayorId = periodFilter.selectedPayorId;
  const payorCode = useMemo(() => {
    if (!selectedPayorId || selectedPayorId === 'ALL') return '';
    const allPayors = payorsData?.data ?? [];
    const payor = allPayors.find((p) => p.id === selectedPayorId);
    return payor?.code ?? '';
  }, [selectedPayorId, payorsData]);

  // ── Validate custom range (max 1 month) ──
  const rangeValidation = validateCustomRange(periodFilter);

  // ── Build request body from period filter ──
  const requestBody: AdmDailyClaimRequest | undefined = useMemo(() => {
    if (!payorCode) return undefined; // Don't fetch until we have a payor code
    if (!rangeValidation.valid) return undefined; // Skip fetch when custom range exceeds 1 month
    const { startDate, endDate } = getDateRange(periodFilter);
    return {
      start_date: toDDMMYYYY(startDate),
      end_date: toDDMMYYYY(endDate),
      payor_code: payorCode,
    };
  }, [periodFilter, payorCode, rangeValidation.valid]);

  const { data, isLoading, isFetching, isError, error, refetch } = useGetDCSehatQuery(requestBody!, {
    skip: !requestBody,
  });

  // ── Auto-refresh: refetch every 10 minutes (matches Manage Care Daily Monitoring) ──
  useEffect(() => {
    if (!requestBody) return; // Don't poll until we have a valid request
    const interval = setInterval(() => {
      refetch();
    }, 600000); // 10 minutes
    return () => clearInterval(interval);
  }, [refetch, requestBody]);

  // ── Track last successful fetch timestamp (for "Updated HH:mm:ss" badge) ──
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const prevFetching = useRef(false);
  useEffect(() => {
    // Transition: fetching → done with data = successful fetch
    if (prevFetching.current && !isFetching && data) {
      setLastUpdated(new Date());
    }
    prevFetching.current = isFetching;
  }, [isFetching, data]);

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