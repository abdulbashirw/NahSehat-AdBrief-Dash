/**
 * Page-local aggregations for the Demographics view: age x gender matrices
 * split per calendar year (2025 vs 2026), for members and claimants.
 * Preserved from original AdBrief business logic.
 */
import type { Claim, Member } from '@/shared/types';
import { AGE_BUCKETS, admissionOf, ageBucket, ageOf } from '@/entities/claim/lib/aggregate';
import { parseDDMMYYYY } from '@/shared/lib/format';

export interface YearGenderCell {
  bucket: string;
  female: number;
  male: number;
}

/** Distinct active members (joined on/before year end) per age bucket x gender, age at end of `year`. */
export function memberAgeGenderByYear(members: Member[], year: number): YearGenderCell[] {
  const ref = new Date(year, 11, 31);
  const rows = new Map<string, { female: Set<string>; male: Set<string> }>(
    AGE_BUCKETS.map((b) => [b, { female: new Set(), male: new Set() }]),
  );
  for (const m of members) {
    if (!m.active) continue;
    const joined = parseDDMMYYYY(m.joinDate);
    if (joined && joined.getTime() > ref.getTime()) continue;
    const bucket = ageBucket(ageOf(m, ref));
    const row = rows.get(bucket)!;
    (m.gender === 'F' ? row.female : row.male).add(m.MEMBERNO);
  }
  return AGE_BUCKETS.map((bucket) => {
    const r = rows.get(bucket)!;
    return { bucket, female: r.female.size, male: r.male.size };
  });
}

/** Distinct claimants with claims admitted in `year`, per age bucket x gender. */
export function claimantAgeGenderByYear(members: Member[], claims: Claim[], year: number): YearGenderCell[] {
  const memberByNo = new Map(members.map((m) => [m.MEMBERNO, m]));
  const ref = new Date(year, 11, 31);
  const rows = new Map<string, { female: Set<string>; male: Set<string> }>(
    AGE_BUCKETS.map((b) => [b, { female: new Set(), male: new Set() }]),
  );
  const seen = new Set<string>();
  for (const c of claims) {
    if (seen.has(c.MEMBERNO)) continue;
    const d = admissionOf(c);
    if (!d || d.getFullYear() !== year) continue;
    seen.add(c.MEMBERNO);
    const m = memberByNo.get(c.MEMBERNO);
    if (!m) continue;
    const bucket = ageBucket(ageOf(m, ref));
    const row = rows.get(bucket)!;
    (m.gender === 'F' ? row.female : row.male).add(c.MEMBERNO);
  }
  return AGE_BUCKETS.map((bucket) => {
    const r = rows.get(bucket)!;
    return { bucket, female: r.female.size, male: r.male.size };
  });
}

/** Fractional growth 2025 -> 2026 (0.05 = +5%). Returns null when the base is 0. */
export function growth(from: number, to: number): number | null {
  if (from === 0) return to > 0 ? 1 : null;
  return (to - from) / from;
}