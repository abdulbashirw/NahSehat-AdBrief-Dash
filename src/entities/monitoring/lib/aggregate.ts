/**
 * Pure aggregation helpers for the Daily Monitoring dashboard.
 *
 * Every number rendered by DailyMonitoringPage is computed here from the raw
 * API records — nothing is hardcoded in components.
 *
 * Mirrors the pattern from `entities/claim/lib/aggregate.ts` (Indemnity).
 */
import type { DailyMonitoringItem } from '@/entities/monitoring/api/monitoringApi';

/* ------------------------------------------------------------------ */
/*  KPI Summary                                                        */
/* ------------------------------------------------------------------ */

export interface MonitoringKpiSummary {
  /** Count of items with ClaimStatus === 'DMO' (active monitoring patients). */
  dmo: number;
  /** Count of items with a truthy AdmissionDate. */
  admission: number;
  /** Count of items with ClaimStatus === 'DHC' (discharged). */
  dhc: number;
  /** Count of unique ProviderID values. */
  providerCount: number;
  /** Count of items with ClaimStatus !== 'DMO' && !== 'DHC'. */
  rejected: number;
  /** Total item count. */
  total: number;
}

export function kpiSummary(items: DailyMonitoringItem[]): MonitoringKpiSummary {
  let dmo = 0;
  let admission = 0;
  let dhc = 0;
  let rejected = 0;
  const providerSet = new Set<string>();

  for (const item of items) {
    const h = item?.header;
    if (!h) continue;

    const status = h.ClaimStatus;
    if (status === 'DMO') dmo++;
    else if (status === 'DHC') dhc++;
    else rejected++;

    if (h.AdmissionDate) admission++;
    if (h.ProviderID) providerSet.add(h.ProviderID);
  }

  return {
    dmo,
    admission,
    dhc,
    providerCount: providerSet.size,
    rejected,
    total: items.length,
  };
}

/* ------------------------------------------------------------------ */
/*  Trend Diagnosa                                                     */
/* ------------------------------------------------------------------ */

export interface DiagnosisTrendRow {
  diagnosis: string;
  count: number;
}

/**
 * Group items by ICDXDesc, count frequency, sort descending.
 * Filters out empty / '-' descriptions.
 */
export function byDiagnosis(items: DailyMonitoringItem[]): DiagnosisTrendRow[] {
  const counts: Record<string, number> = {};

  for (const item of items) {
    const desc = item?.header?.ICDXDesc;
    if (!desc || desc.trim() === '' || desc === '-') continue;
    counts[desc] = (counts[desc] || 0) + 1;
  }

  return Object.entries(counts)
    .map(([diagnosis, count]) => ({ diagnosis, count }))
    .sort((a, b) => b.count - a.count);
}

/* ------------------------------------------------------------------ */
/*  Claim Status Distribution (for donut chart)                       */
/* ------------------------------------------------------------------ */

export interface ClaimStatusSplit {
  status: string;
  count: number;
  /** 0..1 share of the total. */
  share: number;
}

/**
 * Split items by ClaimStatus into DMO / DHC / REJECT buckets with counts
 * and percentage shares. Returns exactly 3 rows (even if count is 0) so the
 * donut chart legend is stable.
 */
export function claimStatusSplit(items: DailyMonitoringItem[]): ClaimStatusSplit[] {
  let dmo = 0;
  let dhc = 0;
  let reject = 0;

  for (const item of items) {
    const status = item?.header?.ClaimStatus;
    if (status === 'DMO') dmo++;
    else if (status === 'DHC') dhc++;
    else reject++;
  }

  const total = dmo + dhc + reject || 1; // avoid div-by-zero

  return [
    { status: 'DMO', count: dmo, share: dmo / total },
    { status: 'DHC', count: dhc, share: dhc / total },
    { status: 'REJECT', count: reject, share: reject / total },
  ];
}

/* ------------------------------------------------------------------ */
/*  Patient List (DMO active patients)                                */
/* ------------------------------------------------------------------ */

export interface PatientRow {
  memberID: string;
  memberName: string;
  pd: 'P' | 'D' | string;
  providerName: string;
  admissionDate: string;
  days: number;
}

/**
 * Filter to DMO-status patients, sorted by Days descending (longest stay first).
 */
export function dmoPatients(items: DailyMonitoringItem[]): PatientRow[] {
  return items
    .filter((item) => item?.header?.ClaimStatus === 'DMO')
    .map((item) => ({
      memberID: item?.header?.MemberID ?? '',
      memberName: item?.header?.MemberName ?? '',
      pd: item?.header?.PD ?? '',
      providerName: item?.header?.ProviderName ?? '',
      admissionDate: item?.header?.AdmissionDate ?? '',
      days: Number(item?.header?.Days) || 0,
    }))
    .sort((a, b) => b.days - a.days);
}