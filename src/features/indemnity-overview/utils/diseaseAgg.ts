/**
 * Page-local aggregation: rollup of claims by diagnosis description.
 *
 * The API returns FDIAGNOSIS (code) and FDIAGNOSISDESC (description) but does
 * NOT return an ICD-10 group/category field. Grouping is therefore done by
 * the diagnosis description provided directly by the API response.
 */
import type { Claim, Icd10 } from '@/shared/types';

export interface DiseaseGroupRow {
  group: string;
  claimants: number;
  transactions: number;
  billing: number;
  approved: number;
  avgLos: number;
}

export function byDiseaseGroup(claims: Claim[], icd10: Icd10[]): DiseaseGroupRow[] {
  // Lookup description by code (icd10 entries are built from API FDIAGNOSISDESC)
  const descOf = new Map(icd10.map((d) => [d.code, d.description]));
  const map = new Map<string, { set: Set<string>; txn: number; bill: number; app: number; los: number }>();
  for (const c of claims) {
    if (!c.FDIAGNOSIS) continue;
    // Use FDIAGNOSISDESC from the claim (API field), fall back to icd10 lookup, then code
    const group = c.FDIAGNOSISDESC || descOf.get(c.FDIAGNOSIS) || c.FDIAGNOSIS || 'Unknown';
    let row = map.get(group);
    if (!row) {
      row = { set: new Set(), txn: 0, bill: 0, app: 0, los: 0 };
      map.set(group, row);
    }
    row.set.add(c.MEMBERNO);
    row.txn += 1;
    row.bill += c.INCURRED;
    row.app += c.APPROVED;
    row.los += Number(c.DURATION) || 0;
  }
  return [...map.entries()]
    .map(([group, r]) => ({
      group,
      claimants: r.set.size,
      transactions: r.txn,
      billing: r.bill,
      approved: r.app,
      avgLos: r.txn ? r.los / r.txn : 0,
    }))
    .sort((a, b) => b.claimants - a.claimants);
}