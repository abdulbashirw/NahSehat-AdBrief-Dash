/**
 * Page-local aggregations for the Demographics view: age × gender matrices
 * for members and claimants within the currently selected period.
 *
 * The period filter (W1–W4 / Month / Custom, max 31 days) is applied
 * server-side via the AdmDailyClaim API. These functions operate on the
 * already-filtered claim set and member master.
 *
 * %Growth is computed as first-half → second-half of the selected period
 * (same midpoint-split approach used by kpiDeltas for the KPI cards).
 */
import type { Claim, Member } from '@/shared/types';
import { AGE_BUCKETS, admissionOf, ageBucket, ageOf } from '@/entities/claim/lib/aggregate';

export interface AgeGenderCell {
  bucket: string;
  female: number;
  male: number;
  total: number;
}

export interface AgeGenderGrowthCell extends AgeGenderCell {
  firstHalf: number;
  secondHalf: number;
  growth: number | null; // fractional (0.05 = +5%), null when firstHalf is 0
}

/**
 * Active members per age bucket × gender.
 * Uses Member.age (from API AGE field) directly — no birthDate derivation.
 */
export function memberAgeGender(members: Member[]): AgeGenderCell[] {
  const rows = new Map<string, { female: Set<string>; male: Set<string> }>(
    AGE_BUCKETS.map((b) => [b, { female: new Set(), male: new Set() }]),
  );
  const ref = new Date();
  for (const m of members) {
    if (!m.active) continue;
    const bucket = ageBucket(ageOf(m, ref));
    const row = rows.get(bucket)!;
    (m.gender === 'F' ? row.female : row.male).add(m.MEMBERNO);
  }
  return AGE_BUCKETS.map((bucket) => {
    const r = rows.get(bucket)!;
    return { bucket, female: r.female.size, male: r.male.size, total: r.female.size + r.male.size };
  });
}

/**
 * Distinct claimants (from the filtered claim set) per age bucket × gender.
 * Uses Member.age (from API AGE field) directly.
 */
export function claimantAgeGender(members: Member[], claims: Claim[]): AgeGenderCell[] {
  const memberByNo = new Map(members.map((m) => [m.MEMBERNO, m]));
  const claimantNos = new Set(claims.map((c) => c.MEMBERNO));
  const ref = new Date();
  const rows = new Map<string, { female: Set<string>; male: Set<string> }>(
    AGE_BUCKETS.map((b) => [b, { female: new Set(), male: new Set() }]),
  );
  for (const no of claimantNos) {
    const m = memberByNo.get(no);
    if (!m) continue;
    const bucket = ageBucket(ageOf(m, ref));
    const row = rows.get(bucket)!;
    (m.gender === 'F' ? row.female : row.male).add(no);
  }
  return AGE_BUCKETS.map((bucket) => {
    const r = rows.get(bucket)!;
    return { bucket, female: r.female.size, male: r.male.size, total: r.female.size + r.male.size };
  });
}

/**
 * Split claims into first-half and second-half by admission date midpoint.
 * Same approach as kpiDeltas in aggregate.ts.
 */
function splitClaimsByMidpoint(claims: Claim[]): { first: Claim[]; second: Claim[] } {
  const withDates = claims
    .map((c) => ({ c, d: admissionOf(c) }))
    .filter((x): x is { c: Claim; d: Date } => x.d !== null)
    .sort((a, b) => a.d.getTime() - b.d.getTime());
  if (withDates.length < 2) {
    return { first: claims, second: [] };
  }
  const min = withDates[0].d.getTime();
  const max = withDates[withDates.length - 1].d.getTime();
  const mid = min + (max - min) / 2;
  return {
    first: withDates.filter((x) => x.d.getTime() < mid).map((x) => x.c),
    second: withDates.filter((x) => x.d.getTime() >= mid).map((x) => x.c),
  };
}

function growthOf(from: number, to: number): number | null {
  if (from === 0) return to > 0 ? 1 : null;
  return (to - from) / from;
}

/**
 * Claimants per age bucket × gender with first-half → second-half growth.
 * Returns current period totals plus per-bucket growth.
 */
export function claimantAgeGenderGrowth(members: Member[], claims: Claim[]): AgeGenderGrowthCell[] {
  const { first, second } = splitClaimsByMidpoint(claims);
  const current = claimantAgeGender(members, claims);
  const firstHalf = claimantAgeGender(members, first);
  const secondHalf = claimantAgeGender(members, second);
  return current.map((c, i) => ({
    ...c,
    firstHalf: firstHalf[i].total,
    secondHalf: secondHalf[i].total,
    growth: growthOf(firstHalf[i].total, secondHalf[i].total),
  }));
}

/**
 * Members per age bucket × gender with first-half → second-half growth.
 * Growth is based on distinct members appearing in claims in each half.
 */
export function memberAgeGenderGrowth(members: Member[], claims: Claim[]): AgeGenderGrowthCell[] {
  return claimantAgeGenderGrowth(members, claims);
}