/**
 * Verifier API — HTTP client for the verification console (DB-backed backend).
 *
 *   GET  {API_URLS.adscore}/verification/jobs                      → { jobs }
 *   GET  {API_URLS.adscore}/verification/audit?jobId=              → { entries }
 *   POST {API_URLS.adscore}/verification/jobs/{id}/claim           → { job }
 *   POST {API_URLS.adscore}/verification/jobs/{id}/unclaim         → { job }
 *   POST {API_URLS.adscore}/verification/jobs/{id}/cancel          → { job }
 *   POST {API_URLS.adscore}/verification/jobs/{id}/consent-check   → { fileId, checked } → { job }
 *   POST {API_URLS.adscore}/verification/jobs/{id}/consent-row     → { rowId, state, fileIds, note? } → { job } (bulk only)
 *   POST {API_URLS.adscore}/verification/jobs/{id}/match           → { memberId, rowId? } → { job } (bulk only)
 *   POST {API_URLS.adscore}/verification/jobs/{id}/reject          → { reason } → { job }
 *   POST {API_URLS.adscore}/verification/jobs/{id}/request-fix     → { category, note } → { job }
 *   POST {API_URLS.adscore}/verification/jobs/{id}/verify          → { job }
 *   GET  {API_URLS.adscore}/verification/jobs/{id}/consent/{fileId} → Blob
 *
 * subscribeQueue polls GET /verification/jobs every POLL_MS and pushes
 * snapshots to listeners. Mutations return the updated job and kick an
 * immediate re-poll so the UI stays snappy.
 *
 * Fase 4 takeout: the in-memory mock fallback (verifierStore) is removed.
 * Backend errors — network down, 401/403, 409 claim conflicts, 422 gating —
 * surface to the caller as-is; no offline demo data is fabricated.
 */
import { API_URLS } from '@/shared/store/api';
import { LS_TOKEN_KEY } from '@/shared/constants';
import type {
  AuditEntry,
  BulkRowResolution,
  ConsentFileRef,
  MatchCandidate,
  QueueFilters,
  QueueStats,
  VerifierJob,
} from '../model/verifierTypes';

const BASE = API_URLS.adscore;
const POLL_MS = 5000;

/* ─── HTTP helpers ─── */

export class ApiDownError extends Error {}

function authHeaders(): HeadersInit {
  const token = localStorage.getItem(LS_TOKEN_KEY);
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function httpJson<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, init);
  } catch {
    throw new ApiDownError('Backend unreachable');
  }
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (body?.message) message = body.message;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

function post(body?: unknown): RequestInit {
  return { method: 'POST', headers: authHeaders(), body: JSON.stringify(body ?? {}) };
}

/* ─── Queue subscription (polling) ─── */

export type OnVerifierJobsChanged = (jobs: VerifierJob[]) => void;

interface QueueSnapshot {
  jobs: VerifierJob[];
}

const listeners = new Set<OnVerifierJobsChanged>();
let pollTimer: number | null = null;
let pollInFlight = false;
let lastSnapshot: VerifierJob[] | null = null;
let downWarned = false;

async function pollOnce(): Promise<void> {
  if (pollInFlight || listeners.size === 0) return;
  pollInFlight = true;
  try {
    const data = await httpJson<QueueSnapshot>('/verification/jobs', {
      headers: authHeaders(),
    });
    downWarned = false;
    const jobs = data.jobs ?? [];
    lastSnapshot = jobs;
    listeners.forEach((cb) => cb(jobs));
  } catch (e) {
    if (e instanceof ApiDownError && !downWarned) {
      downWarned = true;
      console.warn('[verifierApi] backend unreachable — queue will not refresh until it is back');
    }
    // Keep the last snapshot on screen; do not mask the outage with fake data.
  } finally {
    pollInFlight = false;
  }
}

/** Kick an immediate poll (called after mutations). */
export function kickQueue(): void {
  void pollOnce();
}

export function subscribeQueue(cb: OnVerifierJobsChanged): () => void {
  listeners.add(cb);
  if (pollTimer === null) {
    pollTimer = window.setInterval(() => void pollOnce(), POLL_MS);
  }
  void pollOnce();
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0 && pollTimer !== null) {
      window.clearInterval(pollTimer);
      pollTimer = null;
    }
  };
}

/** One-off synchronous read — uses the last polled snapshot. */
export function listJobs(): VerifierJob[] {
  return lastSnapshot ?? [];
}

/* ─── Mutations (HTTP) ─── */

async function mutate(path: string, body?: unknown): Promise<VerifierJob | undefined> {
  const data = await httpJson<{ job: VerifierJob }>(path, post(body));
  kickQueue();
  return data.job;
}

export function claimJob(jobId: string): Promise<VerifierJob | undefined> {
  return mutate(`/verification/jobs/${encodeURIComponent(jobId)}/claim`);
}

export function checkConsent(jobId: string, fileId: string, checked: boolean): Promise<VerifierJob | undefined> {
  return mutate(`/verification/jobs/${encodeURIComponent(jobId)}/consent-check`, { fileId, checked });
}

/**
 * Per-member consent verdict (mode bulk, strict). `fileIds` = documents the
 * verifier opened before deciding (server rejects an empty list — fail-closed
 * manual-preview rule). state 'unverified' resets the verdict.
 */
export function setRowConsent(
  jobId: string,
  rowId: string,
  state: 'unverified' | 'match' | 'mismatch',
  fileIds: string[],
  note?: string,
): Promise<VerifierJob | undefined> {
  return mutate(`/verification/jobs/${encodeURIComponent(jobId)}/consent-row`, { rowId, state, fileIds, note });
}

export function resolveMatch(
  jobId: string,
  memberId: string | null,
  rowId?: string
): Promise<VerifierJob | undefined> {
  return mutate(`/verification/jobs/${encodeURIComponent(jobId)}/match`, { memberId, rowId });
}

export function rejectJob(jobId: string, reason: string): Promise<VerifierJob | undefined> {
  return mutate(`/verification/jobs/${encodeURIComponent(jobId)}/reject`, { reason });
}

export function requestFix(jobId: string, category: string, note: string): Promise<VerifierJob | undefined> {
  return mutate(`/verification/jobs/${encodeURIComponent(jobId)}/request-fix`, { category, note });
}

export function verifyJob(jobId: string): Promise<VerifierJob | undefined> {
  return mutate(`/verification/jobs/${encodeURIComponent(jobId)}/verify`);
}

export function unclaimJob(jobId: string): Promise<VerifierJob | undefined> {
  return mutate(`/verification/jobs/${encodeURIComponent(jobId)}/unclaim`);
}

export function cancelJob(jobId: string, reason?: string): Promise<VerifierJob | undefined> {
  return mutate(`/verification/jobs/${encodeURIComponent(jobId)}/cancel`, { reason });
}

export async function getConsentFile(jobId: string, fileId: string): Promise<Blob> {
  let res: Response;
  try {
    res = await fetch(
      `${BASE}/verification/jobs/${encodeURIComponent(jobId)}/consent/${encodeURIComponent(fileId)}`,
      { headers: authHeaders() },
    );
  } catch {
    throw new ApiDownError('Backend unreachable');
  }
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (body?.message) message = body.message;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(message);
  }
  return res.blob();
}

/* ─── Audit ─── */

export async function listAudit(jobId?: string): Promise<AuditEntry[]> {
  const qs = jobId ? `?jobId=${encodeURIComponent(jobId)}` : '';
  const data = await httpJson<{ entries: AuditEntry[] }>(`/verification/audit${qs}`, {
    headers: authHeaders(),
  });
  return data.entries ?? [];
}

/* ─── Pure helpers ─── */

export function getJob(_jobId: string): VerifierJob | undefined {
  return listJobs().find((j) => j.id === _jobId);
}

export function computeStats(jobs: VerifierJob[], now: number = Date.now()): QueueStats {
  const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
  const stats: QueueStats = { waiting: 0, processing: 0, needsAction: 0, doneToday: 0, slaBreach: 0 };
  for (const job of jobs) {
    if (job.status === 'submitted') stats.waiting++;
    else if (job.status === 'on_progress') stats.processing++;
    else if (job.status === 'verified') stats.needsAction++;
    else if (job.status === 'completed' && job.createdAt >= startOfDay.getTime()) stats.doneToday++;
    if ((job.status === 'submitted' || job.status === 'on_progress') && now - job.createdAt > 24 * 60 * 60 * 1000) {
      stats.slaBreach++;
    }
  }
  return stats;
}

/** Apply queue filters client-side (mock parity with backend query params). */
export function filterJobs(jobs: VerifierJob[], f: QueueFilters): VerifierJob[] {
  const q = f.q.trim().toLowerCase();
  return jobs.filter((job) => {
    if (f.status === 'needs_action' && job.status !== 'verified') return false;
    if (f.status && f.status !== 'needs_action' && job.status !== f.status) return false;
    if (f.mode && job.mode !== f.mode) return false;
    if (f.date) {
      const d = new Date(job.createdAt);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (iso !== f.date) return false;
    }
    if (q) {
      const hay = [
        job.id,
        job.submittedBy,
        job.identity?.nama,
        job.dataFile?.name,
        ...(job.rows?.map((r) => r.nama) ?? []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

/** Bulk row summary helper (incl. per-member consent verdict counts). */
export function bulkSummary(rows: BulkRowResolution[]): {
  auto: number; review: number; notFound: number; resolved: number; total: number;
  onboard: number; consentMatch: number; consentMismatch: number; consentPending: number;
} {
  const total = rows.length;
  const auto = rows.filter((r) => r.state === 'auto').length;
  const manual = rows.filter((r) => r.state === 'manual').length;
  const notFound = rows.filter((r) => r.state === 'notfound').length;
  const unresolved = rows.filter((r) => r.state === 'unresolved').length;
  // Rows that will be onboarded — they require a consent verdict of 'match' (strict).
  const onboard = rows.filter((r) => r.state === 'auto' || r.state === 'manual');
  const consentMatch = onboard.filter((r) => r.consent?.state === 'match').length;
  const consentMismatch = rows.filter((r) => r.consent?.state === 'mismatch').length;
  const consentPending = onboard.filter((r) => r.consent?.state !== 'match' && r.consent?.state !== 'mismatch').length;
  return {
    auto: auto + manual, review: unresolved, notFound, resolved: total - unresolved, total,
    onboard: onboard.length, consentMatch, consentMismatch, consentPending,
  };
}

export type { ConsentFileRef, MatchCandidate, VerifierJob, AuditEntry };