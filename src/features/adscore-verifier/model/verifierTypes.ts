/**
 * AdScore Verifier — domain types.
 *
 * Back-office console for the internal operations team (role ADSCORE_VERIFIER):
 *   1. Process & match submitted member data against the membership registry.
 *   2. Verify membership & consent documents (multi-file checklist).
 *
 * Complements the member onboarding pipeline (features/adscore-member):
 * the client submits a job → it appears in the verifier queue → the verifier
 * claims, matches & verifies → the client receives the result.
 */

/** Queue-level job status (mirrors the client-side stepper). */
export type VerifierJobStatus = 'submitted' | 'on_progress' | 'verified' | 'completed' | 'cancelled';

export type VerifierJobMode = 'individu' | 'bulk';

/** Metadata of a consent file attached to a job. */
export interface ConsentFileRef {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: number;
}

/** Identity as submitted by the client (raw, unverified). */
export interface SubmittedIdentity {
  nama: string;
  /** ISO format YYYY-MM-DD. */
  tglLahir: string;
  gender: 'M' | 'F';
}

/** A membership candidate produced by the matching engine. */
export interface MatchCandidate {
  memberId: string;
  nama: string;
  tglLahir: string;
  gender: 'M' | 'F';
  /** 0–100 similarity against the submitted identity. */
  score: number;
  exact: boolean;
  registeredAt: number;
}

/**
 * Per-member consent verification verdict (mode bulk, strict).
 * The verifier must open the consent document(s) before deciding — the
 * consulted fileIds are stored as evidence on the row.
 */
export type RowConsentState = 'unverified' | 'match' | 'mismatch';

export interface RowConsent {
  state: RowConsentState;
  /** Consent documents consulted for this verdict (evidence). */
  fileIds: string[];
  checkedAt?: number;
  checkedBy?: string;
  note?: string;
}

/** Resolution of a single bulk row. */
export interface BulkRowResolution {
  rowId: string;
  /** 1-based position in the bulk file (server-provided; display only). */
  rowNo?: number;
  nama: string;
  tglLahir: string;
  gender: 'M' | 'F';
  /** auto = matched by engine, manual = verifier picked a candidate, unresolved = pending. */
  state: 'auto' | 'manual' | 'notfound' | 'unresolved';
  memberId?: string;
  /** Candidates offered to the verifier when state is 'unresolved' (fuzzy). */
  candidates: MatchCandidate[];
  /** Per-member consent verdict (required 'match' for auto/manual rows before submit). */
  consent?: RowConsent;
}

/** Audit trail entry (compliance requirement for consent verification). */
export interface AuditEntry {
  id: string;
  jobId: string;
  at: number;
  action: 'claim' | 'unclaim' | 'consent_check' | 'consent_uncheck' | 'consent_row_check' | 'consent_row_mismatch' | 'match' | 'approve' | 'reject' | 'request_fix' | 'cancel' | 'bulk_submit' | 'export';
  actor: string;
  detail: string;
  outcome: string;
}

/** A verification job in the queue. */
export interface VerifierJob {
  id: string;
  mode: VerifierJobMode;
  status: VerifierJobStatus;
  createdAt: number;
  submittedBy: string;
  /** Identity for individu mode. */
  identity?: SubmittedIdentity;
  /** File name + row count for bulk mode. */
  dataFile?: { name: string; rows: number };
  consentFiles: ConsentFileRef[];
  /** Consent files the current verifier has marked as reviewed. */
  consentChecked: string[];
  /** Optimistic-lock claim. */
  claimedBy?: string;
  claimedAt?: number;
  /** Matching candidates for individu mode. */
  candidates?: MatchCandidate[];
  /** Picked candidate (individu). */
  pickedMemberId?: string;
  /** AdBrief check-member result recorded at submission (new-flow individu jobs). */
  adbriefFound?: boolean;
  adbriefCheckedAt?: number;
  /** Bulk rows + resolutions. */
  rows?: BulkRowResolution[];
  /** Required when rejecting / requesting a fix. */
  rejectionReason?: string;
  fixCategory?: string;
  fixNote?: string;
  /** Final outcome summary shown in history. */
  outcome?: string;
}

/** KPI cards on the queue screen. */
export interface QueueStats {
  waiting: number;
  processing: number;
  needsAction: number;
  doneToday: number;
  slaBreach: number;
}

/** Filters for the queue table. */
export interface QueueFilters {
  q: string;
  status: '' | VerifierJobStatus | 'needs_action';
  mode: '' | VerifierJobMode;
  date: string;
}

/** SLA window in ms — 1×24 working hours (configurable). */
export const SLA_MS = 24 * 60 * 60 * 1000;

/** Age of a job relative to now, e.g. "2j 40m". */
export function formatAge(from: number, now: number = Date.now()): string {
  const ms = Math.max(0, now - from);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}j ${m}m`;
}