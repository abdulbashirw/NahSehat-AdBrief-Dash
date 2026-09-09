/**
 * PayorFilter — single-row filter bar with payor selector only.
 *
 * Mirrors the `PeriodFilter` pattern from Indemnity, but without the date
 * picker — Daily Monitoring uses a fixed 30-day range (per product requirement).
 *
 * Groups:
 *   ① Payor dropdown (filtered by MANAGE_CARE category + user access)
 *
 * Reads/writes global state from monitoringPayorStore.
 */
import { useMemo, useEffect } from 'react';
import { useSyncExternalStore } from 'react';
import {
  subscribe,
  getSnapshot,
  getServerSnapshot,
  setSelectedPayorId,
} from '@/features/daily-monitoring/store/monitoringPayorStore';
import { useGetPayorsQuery } from '@/entities/payor/api/payorApi';
import { useAppSelector } from '@/shared/store';
import { useHasRole } from '@/entities/auth/model/useRbac';

export default function PayorFilter() {
  const filter = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // ── Auth & RBAC ──
  const user = useAppSelector((s) => s.auth.user);
  const userPayorIds = user?.payorIds ?? [];
  const isManageCareRole = useHasRole('MANAGECARE');
  const isSuperAdmin = useHasRole('SUPER_ADMIN');
  const isAdmin = useHasRole('ADMIN');
  const isManageCare = isManageCareRole || isSuperAdmin || isAdmin;

  // ── Fetch all payors ──
  const { data: payorsData } = useGetPayorsQuery(
    { page: 1, pageSize: 999 },
    { skip: !isManageCare },
  );

  // ── Filter: only MANAGE_CARE payors that the user has access to ──
  // If user has no payorIds (e.g. SUPER_ADMIN), show all active MANAGE_CARE payors
  const manageCarePayors = useMemo(() => {
    const allPayors = payorsData?.data ?? [];
    const activeManageCare = allPayors.filter(
      (p) => p.category === 'MANAGE_CARE' && p.isActive,
    );
    if (userPayorIds.length === 0) return activeManageCare;
    return activeManageCare.filter((p) => userPayorIds.includes(p.id));
  }, [payorsData, userPayorIds]);

  // ── Auto-select first payor if none selected ──
  useEffect(() => {
    if (filter.selectedPayorId === 'ALL' && manageCarePayors.length > 0) {
      setSelectedPayorId(manageCarePayors[0].id);
    }
  }, [manageCarePayors, filter.selectedPayorId]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* ── Group 1: Payor selector ── */}
      {manageCarePayors.length > 0 && (
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 text-[#64748B]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <select
            value={filter.selectedPayorId}
            onChange={(e) => setSelectedPayorId(e.target.value)}
            className="h-9 rounded-lg border border-[#E2E8F0] bg-white pl-3 pr-9 text-[13px] font-medium text-[#1F2A37] outline-none transition-colors focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2214%22%20height%3D%2214%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2364748B%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%2F%3E%3C%2Fsvg%3E')] bg-[length:14px] bg-[right_10px_center] bg-no-repeat"
          >
            {manageCarePayors.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      )}

    </div>
  );
}