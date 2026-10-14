/**
 * Onboarding API — client-side job engine for member data verification.
 *
 *   POST {API_URLS.adscore}/onboarding/submit         → 201 { jobId }
 *   GET  {API_URLS.adscore}/onboarding/jobs           → { jobs } (active jobs owned by user)
 *   GET  {API_URLS.adscore}/onboarding/{jobId}        → { job }
 *   POST {API_URLS.adscore}/onboarding/{jobId}/cancel → { job }
 *   GET  {API_URLS.adscore}/onboarding/search         → { found, member?, total }
 *   POST {API_URLS.adscore}/check-member              → { found, message? }
 *
 * subscribeJob polls GET /onboarding/{jobId} every POLL_MS until the job is
 * terminal (client-visible 'completed' — the backend maps verifier 'verified'
 * to client 'completed') then stops polling automatically.
 *
 * Fase 4 takeout: the offline mock engine and the browser registry
 * (memberRegistry.ts) are removed. Backend errors surface to the caller
 * as-is — no offline demo data is fabricated.
 */
import { API_URLS } from '@/shared/store/api';
import { LS_TOKEN_KEY } from '@/shared/constants';
import type {
  BulkSubmitPayload,
  ConsentFileMeta,
  IndividuSubmitPayload,
  JobStatus,
  OnboardingJob,
  RegisteredMember,
} from '../model/onboardingTypes';
import { kickQueue } from '@/features/adscore-verifier/lib/verifierApi';

const BASE = API_URLS.adscore;
const POLL_MS = 1500;

/* ─── HTTP helpers ─── */

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
    throw new Error('Backend unreachable');
  }
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (body?.message) message = body.message;
    } catch {
      /* non-JSON error body */
    }
    throw new OnboardingApiError(message, res.status);
  }
  return (await res.json()) as T;
}

export class OnboardingApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'OnboardingApiError';
    this.status = status;
  }
}

/* ─── Public API ─── */

export type OnboardingSubmitPayload = IndividuSubmitPayload | BulkSubmitPayload;

export interface OnboardingTrackingRecord {
  jobId: string;
  mode: 'individu' | 'bulk';
  status: JobStatus;
  createdAt: number;
  dataFileName?: string;
  consentFiles: ConsentFileMeta[];
}

/** List active jobs for the authenticated user, independent of browser storage. */
export async function fetchOnboardingTrackingJobs(): Promise<OnboardingTrackingRecord[]> {
  const body = await httpJson<{ jobs: OnboardingTrackingRecord[] }>('/onboarding/jobs', {
    headers: authHeaders(),
  });
  return body.jobs ?? [];
}

/** Submit a verification job. Returns the initial job (status: submitted). */
export async function createOnboardingJob(
  mode: 'individu' | 'bulk',
  payload: OnboardingSubmitPayload,
  consentFiles: File[],
  dataFile?: File,
): Promise<OnboardingJob> {
  const body = new FormData();
  body.append('mode', mode);
  if (mode === 'individu') {
    const identity = payload as IndividuSubmitPayload;
    body.append('identity', JSON.stringify({ nama: identity.nama, tglLahir: identity.tglLahir, gender: identity.gender }));
  } else {
    if (!dataFile) throw new Error('File data member (.xlsx) wajib diunggah');
    body.append('dataFileName', (payload as BulkSubmitPayload).dataFileName);
    body.append('memberFile', dataFile, dataFile.name);
  }
  consentFiles.forEach((file) => body.append('consentFiles', file, file.name));
  const token = localStorage.getItem(LS_TOKEN_KEY);
  const res = await httpJson<{ jobId: string }>('/onboarding/submit', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body,
  });
  // Seed the local copy so the stepper renders instantly, then poll.
  const now = Date.now();
  const job: OnboardingJob = {
    id: res.jobId,
    mode,
    status: 'submitted',
    createdAt: now,
    timeline: [{ status: 'submitted', at: now }],
  };
  // Refresh the verifier console immediately (its poll loop also covers this).
  kickQueue();
  return job;
}

/* ─── Job polling ─── */

const listeners = new Map<string, Set<(job: OnboardingJob) => void>>();
const timers = new Map<string, number[]>();

/** Subscribe to job updates (polling; stops automatically when terminal). */
export function subscribeJob(
  jobId: string,
  onUpdate: (job: OnboardingJob) => void,
): () => void {
  let subs = listeners.get(jobId);
  if (!subs) {
    subs = new Set();
    listeners.set(jobId, subs);
  }
  subs.add(onUpdate);

  void pollJobOnce(jobId);
  const timer = window.setInterval(() => void pollJobOnce(jobId), POLL_MS);
  timers.set(jobId, [...(timers.get(jobId) ?? []), timer]);

  return () => {
    subs?.delete(onUpdate);
    if (subs && subs.size === 0) {
      listeners.delete(jobId);
      (timers.get(jobId) ?? []).forEach((t) => window.clearInterval(t));
      timers.delete(jobId);
    }
  };
}

async function pollJobOnce(jobId: string): Promise<void> {
  try {
    const data = await httpJson<{ job: OnboardingJob }>(`/onboarding/${encodeURIComponent(jobId)}`, {
      headers: authHeaders(),
    });
    const job = data.job;
    const subs = listeners.get(jobId);
    if (subs) subs.forEach((cb) => cb(job));
    if (job.status === 'completed' || job.status === 'cancelled') {
      // Terminal — stop polling for this job.
      (timers.get(jobId) ?? []).forEach((t) => window.clearInterval(t));
      timers.delete(jobId);
    }
  } catch {
    // Transient network error or 404 while the job settles — keep polling.
  }
}

/** One-off lookup (e.g. restoring state). Errors propagate to the caller. */
export async function getJob(jobId: string): Promise<OnboardingJob | undefined> {
  const data = await httpJson<{ job: OnboardingJob }>(`/onboarding/${encodeURIComponent(jobId)}`, {
    headers: authHeaders(),
  });
  return data.job;
}

/** Cancel an onboarding job. Stops polling timers and syncs to the server. */
export async function cancelOnboardingJob(jobId: string, reason?: string): Promise<OnboardingJob | undefined> {
  // Stop polling immediately so the stepper does not race the cancellation.
  (timers.get(jobId) ?? []).forEach((t) => window.clearInterval(t));
  timers.delete(jobId);
  const data = await httpJson<{ job: OnboardingJob }>(
    `/onboarding/${encodeURIComponent(jobId)}/cancel`,
    {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ reason: reason || 'Dibatalkan oleh pemohon' }),
    },
  );
  kickQueue();
  return data.job;
}

/* ─── Member registry search (client top filter bar) ─── */

/** Gerbang strict hasil verifikasi untuk Cari Data Member: keputusan
 * verifikator TERAKHIR yang melibatkan member harus "siap lanjut"
 * (member ditemukan + dokumen persetujuan sesuai). */
export interface VerificationGate {
  blocked: 'consent-mismatch' | 'not-ready';
  reason: string;
  jobId: string;
}

export interface SearchMembersResult {
  found: boolean;
  member?: RegisteredMember;
  total: number;
  /** true bila member masih memiliki job verifikasi aktif — dashboard
   * AdScore TIDAK boleh dibuka sebelum verifikasi dokumen selesai. */
  pendingVerification?: boolean;
  /** Keputusan verifikasi terakhir TIDAK siap lanjut (consent mismatch /
   * request-fix / ditolak) — dashboard diblokir dengan alasan. */
  verificationGate?: VerificationGate;
}

/** Exact-normalized search against the server-side registry. */
export async function searchMembers(filter: { nama: string; tglLahir?: string; gender?: string }): Promise<SearchMembersResult> {
  const qs = new URLSearchParams();
  qs.set('nama', filter.nama);
  if (filter.tglLahir) qs.set('tglLahir', filter.tglLahir);
  if (filter.gender) qs.set('gender', filter.gender);
  return httpJson<SearchMembersResult>(`/onboarding/search?${qs.toString()}`, { headers: authHeaders() });
}

/* ─── Check Member AdBrief (gerbang validasi identitas) ─── */

export interface CheckMemberResult {
  found: boolean;
  message?: string;
}

export interface CheckMemberIdentity {
  nama: string;
  tglLahir: string;
  gender: string;
}

/**
 * Check a member identity against the AdBrief registry (authoritative).
 *
 * Direct HTTP — NO mock fallback on purpose: this is an enforcement
 * pre-check and the backend re-validates fail-closed on submit, so
 * masking a failure here would lie to the user. Errors surface as-is
 * (network down, 5xx sanitized message from the server, etc).
 *
 * Server contract: HTTP 200 { success, found, message } — upstream 404
 * is mapped to found:false (a valid response, not an error).
 */
export async function checkMemberIdentity(
  identity: CheckMemberIdentity,
  context: 'upload-precheck' | 'member-search' = 'upload-precheck',
): Promise<CheckMemberResult> {
  const token = localStorage.getItem(LS_TOKEN_KEY);
  let res: Response;
  try {
    res = await fetch(`${BASE}/check-member`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        member_name: identity.nama,
        dob: identity.tglLahir,
        gender: identity.gender,
        context,
      }),
    });
  } catch {
    throw new Error('Layanan cek member tidak dapat dihubungi. Coba lagi.');
  }

  let body: { success?: boolean; found?: boolean; message?: string } = {};
  try {
    body = (await res.json()) as typeof body;
  } catch {
    /* non-JSON error body */
  }

  if (!res.ok) {
    throw new Error(body?.message || `Gagal memeriksa member (HTTP ${res.status})`);
  }

  return { found: Boolean(body.found), message: body.message };
}

/* ─── Member card info (Member Profile dashboard) ─── */

/** Profil member dari service member-card-info AdBrief (via server proxy). */
export interface MemberCardInfo {
  category_adscore: string;
  final_score: number;
  member_name: string;
  age: number;
  dob: string;
  gender: string;
  max_score: number;
}

/**
 * Ambil profil member (skor & kategori risiko) dari service member-card-info
 * AdBrief melalui proxy server (pola P1c — tanpa mock fallback).
 *
 * Server contract: HTTP 200 { success, found, member? } — data:[] upstream
 * dipetakan ke found:false (respons valid, bukan error). Kegagalan layanan
 * (503/504/502) dilempar as-is agar pemanggil bisa menampilkan status
 * simulasi, bukan diam-diam memalsukan data.
 */
export async function fetchMemberCardInfo(identity: CheckMemberIdentity): Promise<MemberCardInfo | null> {
  const body = await httpJson<{ success?: boolean; found?: boolean; member?: MemberCardInfo; message?: string }>(
    '/member-card-info',
    {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        member_name: identity.nama,
        dob: identity.tglLahir,
        gender: identity.gender,
      }),
    },
  );
  if (!body.success || body.found === false) return null;
  return body.member ?? null;
}

/* ─── Member card claims (Claim Summary card) ─── */

/** Ringkasan klaim member dari service member-card-claims AdBrief (via server proxy). */
export interface MemberCardClaims {
  total_claims: number;
  avg_claim_cost: number;
}

/**
 * Ambil ringkasan klaim (Total Claims & Avg Claim Cost) dari service
 * member-card-claims AdBrief melalui proxy server (pola P1c — tanpa mock
 * fallback).
 *
 * Server contract: HTTP 200 { success, found, claims? } — upstream yang
 * membalas nol semua / data null dipetakan ke found:false (tanpa data klaim,
 * respons valid, bukan error). Kegagalan layanan (503/504/502) dilempar
 * as-is agar kartu bisa menampilkan state error, bukan angka palsu.
 */
export async function fetchMemberCardClaims(identity: CheckMemberIdentity): Promise<MemberCardClaims | null> {
  const body = await httpJson<{ success?: boolean; found?: boolean; claims?: MemberCardClaims; message?: string }>(
    '/member-card-claims',
    {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        member_name: identity.nama,
        dob: identity.tglLahir,
        gender: identity.gender,
      }),
    },
  );
  if (!body.success || body.found === false) return null;
  return body.claims ?? null;
}

/* ─── Member card monthly (Claim History card) ─── */

/** Satu baris riwayat klaim bulanan dari service member-card-monthly AdBrief. */
export interface MemberCardMonthlyRow {
  month: string;
  claim_amount: number;
  number_of_claims: number;
}

/** Riwayat klaim bulanan member (Claim History) dari service AdBrief (via server proxy). */
export interface MemberCardMonthly {
  total_claim_amount: number;
  total_claims: number;
  data: MemberCardMonthlyRow[];
}

/**
 * Ambil riwayat klaim bulanan (Claim History) dari service
 * member-card-monthly AdBrief melalui proxy server (pola P1c — tanpa mock
 * fallback).
 *
 * Server contract: HTTP 200 { success, found, monthly? } — upstream nol semua
 * / data null dipetakan ke found:false (tanpa riwayat klaim, respons valid,
 * bukan error). Kegagalan layanan (503/504/502) dilempar as-is agar kartu
 * bisa menampilkan state error, bukan grafik palsu.
 *
 * Catatan upstream: string month diakhiri spasi ('Sep 2024 ') dan tidak
 * selalu terurut — normalisasi + sorting dilakukan di halaman.
 */
export async function fetchMemberCardMonthly(identity: CheckMemberIdentity): Promise<MemberCardMonthly | null> {
  const body = await httpJson<{ success?: boolean; found?: boolean; monthly?: MemberCardMonthly; message?: string }>(
    '/member-card-monthly',
    {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        member_name: identity.nama,
        dob: identity.tglLahir,
        gender: identity.gender,
      }),
    },
  );
  if (!body.success || body.found === false) return null;
  return body.monthly ?? null;
}

/* ─── Member card disease (Claim Cost Breakdown card) ─── */

/** Satu kategori diagnosis dari service member-card-disease AdBrief. */
export interface MemberCardDiseaseItem {
  name: string;
  value: number;
  value_formatted: string;
  persentage: number;
}

/** Breakdown biaya klaim per kategori diagnosis (via server proxy). */
export interface MemberCardDisease {
  type: string;
  total_bill: number;
  data: MemberCardDiseaseItem[];
}

/**
 * Ambil breakdown biaya klaim per kategori diagnosis (Claim Cost Breakdown)
 * dari service member-card-disease AdBrief melalui proxy server (pola P1c —
 * tanpa mock fallback).
 *
 * Server contract: HTTP 200 { success, found, disease? } — upstream pie kosong
 * ({ total_bill:0, data:[] } untuk member tak dikenal; BERBEDA dari service
 * member-card lain yang memakai data:[]) dipetakan ke found:false (tanpa
 * breakdown, respons valid, bukan error). Kegagalan layanan (503/504/502)
 * dilempar as-is agar kartu bisa menampilkan state error, bukan donat palsu.
 */
export async function fetchMemberCardDisease(identity: CheckMemberIdentity): Promise<MemberCardDisease | null> {
  const body = await httpJson<{ success?: boolean; found?: boolean; disease?: MemberCardDisease; message?: string }>(
    '/member-card-disease',
    {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        member_name: identity.nama,
        dob: identity.tglLahir,
        gender: identity.gender,
      }),
    },
  );
  if (!body.success || body.found === false) return null;
  return body.disease ?? null;
}

/* ─── Next Action — member-card-rec-plan ─── */

/** Satu baris rencana tindak lanjut dari service member-card-rec-plan AdBrief. */
export interface MemberCardRecPlan {
  category_adscore: string;
  next_action: string;
}

/* ─── Risk Insights (Top 3 Risk Contributors) — member-card-rec-dim ─── */

/** Satu insight risiko dari service member-card-rec-dim AdBrief. */
export interface MemberCardRiskInsight {
  dimension_rank: number;
  next_action_dimension: string;
  title_web: string;
}

/**
 * Ambil Top 3 Risk Contributors member dari service member-card-rec-dim
 * AdBrief melalui proxy server (pola P1c — tanpa mock fallback). Member tanpa
 * insight (found:false) → null (kartu menampilkan state kosong); kegagalan
 * layanan (503/504/502) dilempar as-is agar kartu bisa menampilkan state
 * error + tombol coba ulang.
 */
/**
 * Next Action card — rencana tindak lanjut dari service member-card-rec-plan
 * AdBrief (via server proxy, pola P1c). Null = member tidak dikenal upstream
 * (data:[] — bukan error). Kegagalan layanan (503/504/502) dilempar as-is
 * agar kartu bisa menampilkan state error.
 */
export async function fetchMemberCardRecPlan(identity: CheckMemberIdentity): Promise<MemberCardRecPlan[] | null> {
  const body = await httpJson<{ success?: boolean; found?: boolean; plans?: MemberCardRecPlan[]; message?: string }>(
    '/member-card-rec-plan',
    {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        member_name: identity.nama,
        dob: identity.tglLahir,
        gender: identity.gender,
      }),
    },
  );
  if (!body.success || body.found === false) return null;
  return body.plans ?? null;
}

export async function fetchMemberCardRiskInsights(
  identity: CheckMemberIdentity,
): Promise<MemberCardRiskInsight[] | null> {
  const body = await httpJson<{ success?: boolean; found?: boolean; insights?: MemberCardRiskInsight[]; message?: string }>(
    '/member-card-risk-insights',
    {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        member_name: identity.nama,
        dob: identity.tglLahir,
        gender: identity.gender,
      }),
    },
  );
  if (!body.success || body.found === false) return null;
  return body.insights ?? null;
}

/* ─── Fase 5: pre-check per baris file bulk (tanpa membuat job) ─── */

export interface BulkPreviewRow {
  nama: string;
  tglLahir: string;
  gender: string;
  found: boolean;
}

export interface BulkPreviewResult {
  total: number;
  found: number;
  notFound: number;
  rows: BulkPreviewRow[];
}

/**
 * Upload file XLSX data member untuk pre-check per baris ke registry
 * AdBrief (endpoint /check-member/preview). TIDAK membuat job — hasil
 * dipakai modal Upload Data Member untuk menampilkan "X cocok / Y tidak
 * ditemukan" sebelum submit. Enforcement tetap dijalankan server saat submit.
 */
export async function previewBulkMembers(file: File): Promise<BulkPreviewResult> {
  const token = localStorage.getItem(LS_TOKEN_KEY);
  const body = new FormData();
  body.append('memberFile', file, file.name);
  let res: Response;
  try {
    res = await fetch(`${BASE}/check-member/preview`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body,
    });
  } catch {
    throw new Error('Layanan cek member tidak dapat dihubungi. Coba lagi.');
  }

  let parsed: unknown;
  try {
    parsed = await res.json();
  } catch {
    /* non-JSON error body */
  }
  const payload = (parsed ?? {}) as { success?: boolean; message?: string; total?: number; found?: number; notFound?: number; rows?: BulkPreviewRow[] };
  if (!res.ok) {
    throw new Error(payload.message || `Gagal memeriksa file (HTTP ${res.status})`);
  }
  if (!Array.isArray(payload.rows)) {
    throw new Error('Respons preview tidak dikenali');
  }
  return { total: payload.total ?? payload.rows.length, found: payload.found ?? 0, notFound: payload.notFound ?? 0, rows: payload.rows };
}