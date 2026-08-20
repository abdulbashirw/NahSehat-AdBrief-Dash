/**
 * Pure aggregation helpers. Every number rendered by the dashboard is computed
 * here from the raw API records — nothing is hardcoded in components.
 */
import type { Claim, Icd10, Member, Provider } from "@/shared/types";
import { parseDDMMYYYY } from "@/shared/lib/format";

export interface KpiSummary {
  memberActive: number;
  claimants: number;
  morbidityRate: number; // 0..1
  transactions: number;
  healthcare: number;
  billing: number;
  approved: number;
  approvedPct: number; // 0..1
  avgTxnPerClaimant: number;
  avgApprovedPerClaimant: number;
}

export interface CoverageRow {
  coverage: string;
  claimants: number;
  transactions: number;
  billing: number;
  approved: number;
  approvedPct: number; // 0..1
}

export interface MonthRow {
  month: Date;
  key: string; // yyyy-mm
  transactions: number;
  claimants: number;
  billing: number;
  approved: number;
}

export interface PaymentSplit {
  type: "CASHLESS" | "REIMBURSEMENT";
  transactions: number;
  share: number; // 0..1
}

export interface ChannelRow {
  channel: string;
  claimants: number;
  billing: number;
  approved: number;
  approvedPct: number; // 0..1
}

export interface CityRow {
  city: string;
  province: string;
  claimants: number;
  transactions: number;
  billing: number;
  approved: number;
}

export interface ProviderRow {
  providerId: string;
  providerName: string;
  type: string;
  city: string;
  province: string;
  inNetwork: boolean;
  claimants: number;
  transactions: number;
  billing: number;
  approved: number;
  approvedPct: number;
}

export interface RelationshipRow {
  relationship: string;
  claimants: number;
  transactions: number;
  billing: number;
  approved: number;
  avgApproved: number;
}

export interface DiagnosisRow {
  code: string;
  description: string;
  group: string;
  claimants: number;
  transactions: number;
  billing: number;
  approved: number;
  avgLos: number;
}

const sum = (arr: number[]) => arr.reduce((s, v) => s + v, 0);

export function admissionOf(c: Claim): Date | null {
  return parseDDMMYYYY(c.ADMISSIONDATE);
}

export function isCashless(c: Claim): boolean {
  // "M" (member/facility-billed) codes are cashless; everything else reimburses.
  return c.CLAIMTYPE === "M";
}

/** Top-line KPI summary for a set of claims + the member master. */
export function kpiSummary(claims: Claim[], members: Member[]): KpiSummary {
  const memberActive = members.filter((m) => m.active).length;
  const claimantSet = new Set(claims.map((c) => c.MEMBERNO));
  const claimants = claimantSet.size;
  const billing = sum(claims.map((c) => c.INCURRED));
  const approved = sum(claims.map((c) => c.APPROVED));
  return {
    memberActive,
    claimants,
    morbidityRate: memberActive ? claimants / memberActive : 0,
    transactions: claims.length,
    healthcare: new Set(claims.map((c) => c.PROVIDERID)).size,
    billing,
    approved,
    approvedPct: billing ? approved / billing : 0,
    avgTxnPerClaimant: claimants ? claims.length / claimants : 0,
    avgApprovedPerClaimant: claimants ? approved / claimants : 0,
  };
}

/** Per-coverage utilization (distinct claimants per COVERAGEID). */
export function byCoverage(claims: Claim[]): CoverageRow[] {
  const map = new Map<string, { set: Set<string>; txn: number; bill: number; app: number }>();
  for (const c of claims) {
    let row = map.get(c.COVERAGEID);
    if (!row) {
      row = { set: new Set(), txn: 0, bill: 0, app: 0 };
      map.set(c.COVERAGEID, row);
    }
    row.set.add(c.MEMBERNO);
    row.txn += 1;
    row.bill += c.INCURRED;
    row.app += c.APPROVED;
  }
  return [...map.entries()]
    .map(([coverage, r]) => ({
      coverage,
      claimants: r.set.size,
      transactions: r.txn,
      billing: r.bill,
      approved: r.app,
      approvedPct: r.bill ? r.app / r.bill : 0,
    }))
    .sort((a, b) => b.claimants - a.claimants);
}

/** Monthly series keyed on admission month (yyyy-mm). */
export function byMonth(claims: Claim[]): MonthRow[] {
  const map = new Map<string, { set: Set<string>; txn: number; bill: number; app: number }>();
  for (const c of claims) {
    const d = admissionOf(c);
    if (!d) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    let row = map.get(key);
    if (!row) {
      row = { set: new Set(), txn: 0, bill: 0, app: 0 };
      map.set(key, row);
    }
    row.set.add(c.MEMBERNO);
    row.txn += 1;
    row.bill += c.INCURRED;
    row.app += c.APPROVED;
  }
  return [...map.entries()]
    .map(([key, r]) => {
      const [y, m] = key.split("-").map(Number);
      return {
        month: new Date(y, m - 1, 1),
        key,
        transactions: r.txn,
        claimants: r.set.size,
        billing: r.bill,
        approved: r.app,
      };
    })
    .sort((a, b) => a.month.getTime() - b.month.getTime());
}

/** CASHLESS vs REIMBURSEMENT derived from CLAIMTYPE. */
export function paymentSplit(claims: Claim[]): PaymentSplit[] {
  const cashless = claims.filter(isCashless).length;
  const total = claims.length || 1;
  return [
    { type: "CASHLESS", transactions: cashless, share: cashless / total },
    { type: "REIMBURSEMENT", transactions: claims.length - cashless, share: (claims.length - cashless) / total },
  ];
}

/** In-network (Provider) vs out-of-network (Non Provider) channel split. */
export function providerSplit(claims: Claim[], providers: Provider[]): ChannelRow[] {
  const network = new Map(providers.map((p) => [p.PROVIDERID, p.inNetwork]));
  const groups: [string, boolean][] = [
    ["Provider (in-network)", true],
    ["Non Provider (reimburse)", false],
  ];
  return groups.map(([channel, inNet]) => {
    const subset = claims.filter((c) => (network.get(c.PROVIDERID) ?? true) === inNet);
    const billing = sum(subset.map((c) => c.INCURRED));
    const approved = sum(subset.map((c) => c.APPROVED));
    return {
      channel,
      claimants: new Set(subset.map((c) => c.MEMBERNO)).size,
      billing,
      approved,
      approvedPct: billing ? approved / billing : 0,
    };
  });
}

/** Top cities by claim value. */
export function byCity(claims: Claim[], providers: Provider[]): CityRow[] {
  const provById = new Map(providers.map((p) => [p.PROVIDERID, p]));
  const map = new Map<string, { province: string; set: Set<string>; txn: number; bill: number; app: number }>();
  for (const c of claims) {
    const p = provById.get(c.PROVIDERID);
    if (!p) continue;
    let row = map.get(p.city);
    if (!row) {
      row = { province: p.province, set: new Set(), txn: 0, bill: 0, app: 0 };
      map.set(p.city, row);
    }
    row.set.add(c.MEMBERNO);
    row.txn += 1;
    row.bill += c.INCURRED;
    row.app += c.APPROVED;
  }
  return [...map.entries()]
    .map(([city, r]) => ({
      city,
      province: r.province,
      claimants: r.set.size,
      transactions: r.txn,
      billing: r.bill,
      approved: r.app,
    }))
    .sort((a, b) => b.billing - a.billing);
}

/** Per-province rollup for the choropleth map. */
export function byProvince(claims: Claim[], providers: Provider[]): Map<string, CityRow> {
  const provById = new Map(providers.map((p) => [p.PROVIDERID, p]));
  const map = new Map<string, CityRow & { set: Set<string> }>();
  for (const c of claims) {
    const p = provById.get(c.PROVIDERID);
    if (!p) continue;
    let row = map.get(p.province);
    if (!row) {
      row = { city: "", province: p.province, claimants: 0, transactions: 0, billing: 0, approved: 0, set: new Set() };
      map.set(p.province, row);
    }
    row.set.add(c.MEMBERNO);
    row.transactions += 1;
    row.billing += c.INCURRED;
    row.approved += c.APPROVED;
  }
  const out = new Map<string, CityRow>();
  for (const [k, r] of map) {
    out.set(k, { city: "", province: k, claimants: r.set.size, transactions: r.transactions, billing: r.billing, approved: r.approved });
  }
  return out;
}

/** Per-provider utilization table rows. */
export function byProvider(claims: Claim[], providers: Provider[]): ProviderRow[] {
  const provById = new Map(providers.map((p) => [p.PROVIDERID, p]));
  const map = new Map<string, { set: Set<string>; txn: number; bill: number; app: number }>();
  for (const c of claims) {
    let row = map.get(c.PROVIDERID);
    if (!row) {
      row = { set: new Set(), txn: 0, bill: 0, app: 0 };
      map.set(c.PROVIDERID, row);
    }
    row.set.add(c.MEMBERNO);
    row.txn += 1;
    row.bill += c.INCURRED;
    row.app += c.APPROVED;
  }
  return [...map.entries()]
    .map(([pid, r]) => {
      const p = provById.get(pid);
      return {
        providerId: pid,
        providerName: p?.providerName ?? pid,
        type: p?.type || "-",
        city: p?.city ?? "-",
        province: p?.province ?? "-",
        inNetwork: p?.inNetwork ?? true,
        claimants: r.set.size,
        transactions: r.txn,
        billing: r.bill,
        approved: r.app,
        approvedPct: r.bill ? r.app / r.bill : 0,
      };
    })
    .sort((a, b) => b.billing - a.billing);
}

export const AGE_BUCKETS = ["<1", "1-5", "6-14", "15-24", "25-44", "45-64", ">64"] as const;

export function ageBucket(age: number): (typeof AGE_BUCKETS)[number] {
  if (age < 1) return "<1";
  if (age <= 5) return "1-5";
  if (age <= 14) return "6-14";
  if (age <= 24) return "15-24";
  if (age <= 44) return "25-44";
  if (age <= 64) return "45-64";
  return ">64";
}

export function ageOf(member: Member, at: Date): number {
  // Prefer direct AGE from data source (DCSehat) over birthDate computation
  if (member.age !== undefined && member.age !== null) return member.age;
  const birth = parseDDMMYYYY(member.birthDate);
  if (!birth) return 0;
  return (at.getTime() - birth.getTime()) / (365.25 * 24 * 3600 * 1000);
}

export interface AgeGenderRow {
  bucket: string;
  female: number;
  male: number;
  total: number;
}

/** Distinct claimants per age bucket x gender. */
export function byAgeGender(members: Member[], claims: Claim[]): AgeGenderRow[] {
  const memberByNo = new Map(members.map((m) => [m.MEMBERNO, m]));
  const claimantNos = new Set(claims.map((c) => c.MEMBERNO));
  const ref = claims.length
    ? new Date(Math.max(...claims.map((c) => new Date(c.created_at).getTime())))
    : new Date();
  const rows = new Map<string, { female: Set<string>; male: Set<string> }>(
    AGE_BUCKETS.map((b) => [b, { female: new Set(), male: new Set() }]),
  );
  for (const no of claimantNos) {
    const m = memberByNo.get(no);
    if (!m) continue;
    const bucket = ageBucket(ageOf(m, ref));
    const row = rows.get(bucket)!;
    (m.gender === "F" ? row.female : row.male).add(no);
  }
  return AGE_BUCKETS.map((bucket) => {
    const r = rows.get(bucket)!;
    return { bucket, female: r.female.size, male: r.male.size, total: r.female.size + r.male.size };
  });
}

/** Claimant relationship distribution. */
export function byRelationship(members: Member[], claims: Claim[]): RelationshipRow[] {
  const memberByNo = new Map(members.map((m) => [m.MEMBERNO, m]));
  const map = new Map<string, { set: Set<string>; txn: number; bill: number; app: number }>();
  for (const c of claims) {
    const rel = memberByNo.get(c.MEMBERNO)?.relationship ?? "PRINCIPLE";
    let row = map.get(rel);
    if (!row) {
      row = { set: new Set(), txn: 0, bill: 0, app: 0 };
      map.set(rel, row);
    }
    row.set.add(c.MEMBERNO);
    row.txn += 1;
    row.bill += c.INCURRED;
    row.app += c.APPROVED;
  }
  return [...map.entries()]
    .map(([relationship, r]) => ({
      relationship,
      claimants: r.set.size,
      transactions: r.txn,
      billing: r.bill,
      approved: r.app,
      avgApproved: r.set.size ? r.app / r.set.size : 0,
    }))
    .sort((a, b) => b.claimants - a.claimants);
}

/** Diagnosis ranking joined with the ICD-10 dictionary. */
export function byDiagnosis(claims: Claim[], icd10: Icd10[]): DiagnosisRow[] {
  const dict = new Map(icd10.map((d) => [d.code, d]));
  const map = new Map<string, { set: Set<string>; txn: number; bill: number; app: number; los: number }>();
  for (const c of claims) {
    if (!c.FDIAGNOSIS) continue;
    let row = map.get(c.FDIAGNOSIS);
    if (!row) {
      row = { set: new Set(), txn: 0, bill: 0, app: 0, los: 0 };
      map.set(c.FDIAGNOSIS, row);
    }
    row.set.add(c.MEMBERNO);
    row.txn += 1;
    row.bill += c.INCURRED;
    row.app += c.APPROVED;
    row.los += Number(c.DURATION) || 0;
  }
  return [...map.entries()]
    .map(([code, r]) => ({
      code,
      description: dict.get(code)?.description ?? code,
      group: dict.get(code)?.description || code,
      claimants: r.set.size,
      transactions: r.txn,
      billing: r.bill,
      approved: r.app,
      avgLos: r.txn ? r.los / r.txn : 0,
    }))
    .sort((a, b) => b.transactions - a.transactions);
}

/** Latest created_at in the dataset (drives the "Last Updated" header). */
export function lastUpdatedAt(claims: Claim[]): Date {
  if (!claims.length) return new Date();
  return new Date(Math.max(...claims.map((c) => new Date(c.created_at).getTime())));
}

/**
 * Period-over-period deltas. The dataset covers a single 13-month window, so
 * the "previous period" baseline is the first half of the selected window vs
 * the second half (same shape as a real prev-period comparison). Returns
 * fractional deltas (0.042 = up by 4,2%).
 */
export interface KpiDeltas {
  memberActive: number;
  claimants: number;
  morbidityRate: number;
  transactions: number;
  healthcare: number;
  billing: number;
  approved: number;
}

export function kpiDeltas(claims: Claim[], members: Member[]): KpiDeltas {
  const withDates = claims
    .map((c) => ({ c, d: admissionOf(c) }))
    .filter((x): x is { c: Claim; d: Date } => x.d !== null)
    .sort((a, b) => a.d.getTime() - b.d.getTime());
  if (withDates.length < 2) {
    return { memberActive: 0, claimants: 0, morbidityRate: 0, transactions: 0, healthcare: 0, billing: 0, approved: 0 };
  }
  const min = withDates[0].d.getTime();
  const max = withDates[withDates.length - 1].d.getTime();
  const mid = min + (max - min) / 2;
  const first = withDates.filter((x) => x.d.getTime() < mid).map((x) => x.c);
  const second = withDates.filter((x) => x.d.getTime() >= mid).map((x) => x.c);
  const k1 = kpiSummary(first, members);
  const k2 = kpiSummary(second, members);
  const delta = (a: number, b: number) => (a === 0 ? 0 : (b - a) / a);
  return {
    memberActive: delta(k1.claimants, k2.claimants), // proxy: active members seen claiming
    claimants: delta(k1.claimants, k2.claimants),
    morbidityRate: delta(k1.morbidityRate, k2.morbidityRate),
    transactions: delta(k1.transactions, k2.transactions),
    healthcare: delta(k1.healthcare, k2.healthcare),
    billing: delta(k1.billing, k2.billing),
    approved: delta(k1.approved, k2.approved),
  };
}
