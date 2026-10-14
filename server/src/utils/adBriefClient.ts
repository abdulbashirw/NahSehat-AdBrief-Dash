/**
 * AdBrief check-member client — gerbang validasi identitas member.
 *
 * Upstream contract (terverifikasi live via curl):
 *   POST {baseUrl}/check-member   { member_name, dob: 'YYYY-MM-DD', gender: 'M'|'F' }
 *     HTTP 200 → { code:200, status:'OK',     message:'Success', data:true  }  (member ditemukan)
 *     HTTP 404 → { code:404, status:'Failed', message:'Data Member Tidak Ada', data:false }
 *
 * ⚠️ not-found dikirim sebagai HTTP 404 — itu RESPONS VALID, bukan error.
 *    Hanya status lain (5xx / timeout / unreachable / bentuk tak dikenal)
 *    yang diperlakukan sebagai kegagalan layanan (fail-closed).
 *
 * SECURITY (pola P1c): JWT user di-forward ke upstream; error body upstream
 * TIDAK pernah diteruskan ke client — detail hanya di-log server-side.
 */
import { adBriefCheckMemberConfig } from '../config';

export interface CheckMemberIdentity {
  member_name: string;
  /** YYYY-MM-DD. */
  dob: string;
  gender: 'M' | 'F';
}

/**
 * Hasil check:
 *  - ok:true  → upstream menjawab dengan kontrak yang dikenali (found/not-found).
 *  - ok:false → layanan tidak tersedia / bentuk respons tak dikenal;
 *               `status` adalah kode HTTP yang layak dikembalikan ke client.
 */
export type CheckMemberResult =
  | { ok: true; found: boolean; message: string }
  | { ok: false; status: number; message: string };

interface UpstreamBody {
  code?: number;
  status?: string;
  message?: string;
  data?: boolean;
}

const NOT_FOUND_FALLBACK = 'Data Member Tidak Ada';

/** True when the check-member service has its base URL configured. */
export function isCheckMemberConfigured(): boolean {
  return Boolean(adBriefCheckMemberConfig.baseUrl);
}

export interface BatchCheckRow {
  /** true = upstream menjawab found (kontrak dikenali). */
  found: boolean;
  /** HTTP status layak dikembalikan ke client bila layanan gagal (ok:false). */
  error?: number;
  message?: string;
}

/**
 * Per-row check untuk mode bulk (Fase 5) dengan konkurensi terbatas agar
 * file besar tidak menghantam upstream sekaligus. Tidak melempar exception —
 * kegagalan layanan dikembalikan per baris (error + status) dan diputuskan
 * oleh pemanggil (fail-closed: submit bulk dibatalkan bila ada kegagalan).
 */
export async function checkMemberBatch(
  identities: CheckMemberIdentity[],
  userToken: string,
  concurrency = 16,
): Promise<BatchCheckRow[]> {
  const results: BatchCheckRow[] = new Array(identities.length);
  let cursor = 0;
  const workerCount = Math.max(1, Math.min(concurrency, identities.length));
  const workers = Array.from({ length: workerCount }, async () => {
    while (cursor < identities.length) {
      const index = cursor++;
      try {
        const result = await checkMemberAdBrief(identities[index], userToken);
        if (result.ok) {
          results[index] = { found: result.found, message: result.message };
        } else {
          results[index] = { found: false, error: result.status, message: result.message };
        }
      } catch (err) {
        console.error('[adscore check-member] batch row failed:', (err as Error).message);
        results[index] = { found: false, error: 502, message: 'Layanan cek member tidak dapat dihubungi' };
      }
    }
  });
  await Promise.all(workers);
  return results;
}

/** Forward an identity check to the AdBrief check-member service. */
export async function checkMemberAdBrief(
  identity: CheckMemberIdentity,
  userToken: string,
): Promise<CheckMemberResult> {
  if (!isCheckMemberConfigured()) {
    console.error(
      '[adscore check-member] 503: ADSCORE_CHECK_MEMBER_BASE_URL is not configured ' +
        '(set it in env.cloud-run.yaml / server/.env, then redeploy)',
    );
    return { ok: false, status: 503, message: 'Layanan cek member tidak tersedia' };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), adBriefCheckMemberConfig.timeoutMs);
    let res: Awaited<ReturnType<typeof fetch>>;
    try {
      res = await fetch(`${adBriefCheckMemberConfig.baseUrl}/check-member`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Forward user's JWT — upstream validates with the same secret.
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify(identity),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    const payload = (await res.json().catch(() => null)) as UpstreamBody | null;

    // HTTP 404 = member tidak ditemukan — respons VALID (bukan kegagalan layanan).
    if (res.status === 404) {
      return { ok: true, found: false, message: payload?.message || NOT_FOUND_FALLBACK };
    }
    if (res.ok && payload?.data === true) {
      return { ok: true, found: true, message: payload.message || 'Success' };
    }
    if (res.ok) {
      // 2xx tapi bentuk payload tidak dikenali — jangan pernah dianggap "found"
      // (fail-closed terhadap perubahan kontrak upstream).
      console.error(
        '[adscore check-member] unexpected 2xx payload:',
        JSON.stringify(payload)?.slice(0, 300) ?? '(non-JSON)',
      );
      return { ok: false, status: 502, message: 'Respons layanan cek member tidak dikenali' };
    }

    console.error(
      `[adscore check-member] upstream ${res.status}:`,
      JSON.stringify(payload)?.slice(0, 500) ?? '(non-JSON)',
    );
    return { ok: false, status: 502, message: 'Layanan cek member gagal memproses permintaan' };
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      console.error('[adscore check-member] upstream timeout');
      return { ok: false, status: 504, message: 'Layanan cek member tidak merespons (timeout)' };
    }
    console.error('[adscore check-member] upstream unreachable:', (err as Error).message);
    return { ok: false, status: 502, message: 'Layanan cek member tidak dapat dihubungi' };
  }
}

/* ─── Member card info (Member Profile dashboard) ─── */

/** Satu baris profil member dari upstream member-card-info (kontrak terverifikasi live). */
export interface MemberCardInfo {
  category_adscore: string;
  final_score: number;
  member_name: string;
  age: number;
  dob: string;
  gender: string;
  max_score: number;
}

export type MemberCardInfoResult =
  | { ok: true; member: MemberCardInfo | null }
  | { ok: false; status: number; message: string };

interface CardInfoUpstreamBody {
  code?: number;
  status?: string;
  message?: string;
  data?: MemberCardInfo[];
}

function isMemberCardInfo(value: unknown): value is MemberCardInfo {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.category_adscore === 'string' &&
    typeof v.final_score === 'number' && Number.isFinite(v.final_score) &&
    typeof v.member_name === 'string' &&
    typeof v.age === 'number' && Number.isFinite(v.age) &&
    typeof v.dob === 'string' &&
    typeof v.gender === 'string' &&
    typeof v.max_score === 'number' && Number.isFinite(v.max_score)
  );
}

/**
 * Forward a Member Profile lookup to the AdBrief member-card-info service.
 *
 * Upstream contract (terverifikasi live via curl):
 *   POST {baseUrl}/member-card-info  { member_name, dob: 'YYYY-MM-DD', gender: 'M'|'F' }
 *     HTTP 200 → { code:200, status:'OK', message:'Success', data:[MemberCardInfo] }
 *     data:[] (array kosong) → member tidak ditemukan — RESPONS VALID, bukan error.
 *
 * ⚠️ Skala skor upstream TERBALIK dari skala lama dashboard: sampel
 *    terverifikasi final_score 19/20 = "High Risk" (semakin tinggi skor,
 *    semakin tinggi risiko). category_adscore diteruskan verbatim —
 *    pemetaan ke level UI dilakukan di sisi frontend.
 */
export async function memberCardInfoAdBrief(
  identity: CheckMemberIdentity,
  userToken: string,
): Promise<MemberCardInfoResult> {
  if (!isCheckMemberConfigured()) {
    console.error(
      '[adscore member-card-info] 503: ADSCORE_CHECK_MEMBER_BASE_URL is not configured ' +
        '(set it in env.cloud-run.yaml / server/.env, then redeploy)',
    );
    return { ok: false, status: 503, message: 'Layanan profil member tidak tersedia' };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), adBriefCheckMemberConfig.timeoutMs);
    let res: Awaited<ReturnType<typeof fetch>>;
    try {
      res = await fetch(`${adBriefCheckMemberConfig.baseUrl}/member-card-info`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Forward user's JWT — upstream validates with the same secret.
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify(identity),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    // Defensif: upstream lama check-member memakai 404 untuk not-found.
    if (res.status === 404) {
      return { ok: true, member: null };
    }

    const payload = (await res.json().catch(() => null)) as CardInfoUpstreamBody | null;

    if (res.ok && Array.isArray(payload?.data)) {
      const first = payload!.data[0];
      if (first === undefined) return { ok: true, member: null };
      if (!isMemberCardInfo(first)) {
        console.error(
          '[adscore member-card-info] unexpected data item shape:',
          JSON.stringify(first)?.slice(0, 300) ?? '(non-JSON)',
        );
        return { ok: false, status: 502, message: 'Respons layanan profil member tidak dikenali' };
      }
      return { ok: true, member: first };
    }

    console.error(
      `[adscore member-card-info] upstream ${res.status}:`,
      JSON.stringify(payload)?.slice(0, 500) ?? '(non-JSON)',
    );
    return { ok: false, status: 502, message: 'Layanan profil member gagal memproses permintaan' };
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      console.error('[adscore member-card-info] upstream timeout');
      return { ok: false, status: 504, message: 'Layanan profil member tidak merespons (timeout)' };
    }
    console.error('[adscore member-card-info] upstream unreachable:', (err as Error).message);
    return { ok: false, status: 502, message: 'Layanan profil member tidak dapat dihubungi' };
  }
}

/* ─── Member card claims (Claim Summary dashboard) ─── */

/** Ringkasan klaim member dari upstream member-card-claims (kontrak terverifikasi live). */
export interface MemberCardClaims {
  total_claims: number;
  avg_claim_cost: number;
}

export type MemberCardClaimsResult =
  | { ok: true; claims: MemberCardClaims | null }
  | { ok: false; status: number; message: string };

interface CardClaimsUpstreamBody {
  code?: number;
  status?: string;
  message?: string;
  data?: MemberCardClaims | null;
}

function isMemberCardClaims(value: unknown): value is MemberCardClaims {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.total_claims === 'number' && Number.isFinite(v.total_claims) && v.total_claims >= 0 &&
    typeof v.avg_claim_cost === 'number' && Number.isFinite(v.avg_claim_cost) && v.avg_claim_cost >= 0
  );
}

/**
 * Forward a Claim Summary lookup to the AdBrief member-card-claims service.
 *
 * Upstream contract (terverifikasi live via curl):
 *   POST {baseUrl}/member-card-claims  { member_name, dob: 'YYYY-MM-DD', gender: 'M'|'F' }
 *     HTTP 200 → { code:200, status:'OK', message:'Success',
 *                  data:{ total_claims:number, avg_claim_cost:number } }
 *     Member tidak dikenal → data bernilai nol semua (total_claims:0,
 *     avg_claim_cost:0) — dipetakan ke claims:null (tanpa data klaim),
 *     BUKAN angka riil yang ditampilkan ke user.
 */
export async function memberCardClaimsAdBrief(
  identity: CheckMemberIdentity,
  userToken: string,
): Promise<MemberCardClaimsResult> {
  if (!isCheckMemberConfigured()) {
    console.error(
      '[adscore member-card-claims] 503: ADSCORE_CHECK_MEMBER_BASE_URL is not configured ' +
        '(set it in env.cloud-run.yaml / server/.env, then redeploy)',
    );
    return { ok: false, status: 503, message: 'Layanan ringkasan klaim tidak tersedia' };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), adBriefCheckMemberConfig.timeoutMs);
    let res: Awaited<ReturnType<typeof fetch>>;
    try {
      res = await fetch(`${adBriefCheckMemberConfig.baseUrl}/member-card-claims`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Forward user's JWT — upstream validates with the same secret.
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify(identity),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    // Defensif: upstream lama check-member memakai 404 untuk not-found.
    if (res.status === 404) {
      return { ok: true, claims: null };
    }

    const payload = (await res.json().catch(() => null)) as CardClaimsUpstreamBody | null;

    if (res.ok) {
      const data = payload?.data;
      if (data === undefined || data === null) return { ok: true, claims: null };
      if (!isMemberCardClaims(data)) {
        console.error(
          '[adscore member-card-claims] unexpected data shape:',
          JSON.stringify(data)?.slice(0, 300) ?? '(non-JSON)',
        );
        return { ok: false, status: 502, message: 'Respons layanan ringkasan klaim tidak dikenali' };
      }
      // Upstream membalas nol semua untuk member yang tidak dikenal —
      // perlakukan sebagai "tanpa data klaim", bukan angka riil.
      if (data.total_claims === 0 && data.avg_claim_cost === 0) {
        return { ok: true, claims: null };
      }
      return { ok: true, claims: data };
    }

    console.error(
      `[adscore member-card-claims] upstream ${res.status}:`,
      JSON.stringify(payload)?.slice(0, 500) ?? '(non-JSON)',
    );
    return { ok: false, status: 502, message: 'Layanan ringkasan klaim gagal memproses permintaan' };
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      console.error('[adscore member-card-claims] upstream timeout');
      return { ok: false, status: 504, message: 'Layanan ringkasan klaim tidak merespons (timeout)' };
    }
    console.error('[adscore member-card-claims] upstream unreachable:', (err as Error).message);
    return { ok: false, status: 502, message: 'Layanan ringkasan klaim tidak dapat dihubungi' };
  }
}

/* ─── Member card monthly (Claim History dashboard) ─── */

/** Satu baris riwayat klaim bulanan dari upstream member-card-monthly. */
export interface MemberCardMonthlyRow {
  month: string;
  claim_amount: number;
  number_of_claims: number;
}

/** Riwayat klaim bulanan member dari upstream member-card-monthly (kontrak terverifikasi live). */
export interface MemberCardMonthly {
  total_claim_amount: number;
  total_claims: number;
  data: MemberCardMonthlyRow[];
}

export type MemberCardMonthlyResult =
  | { ok: true; monthly: MemberCardMonthly | null }
  | { ok: false; status: number; message: string };

interface CardMonthlyUpstreamBody {
  code?: number;
  status?: string;
  message?: string;
  data?: MemberCardMonthly | null;
}

function isMemberCardMonthlyRow(value: unknown): value is MemberCardMonthlyRow {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.month === 'string' && v.month.trim().length > 0 &&
    typeof v.claim_amount === 'number' && Number.isFinite(v.claim_amount) && v.claim_amount >= 0 &&
    typeof v.number_of_claims === 'number' && Number.isFinite(v.number_of_claims) && v.number_of_claims >= 0
  );
}

function isMemberCardMonthly(value: unknown): value is MemberCardMonthly {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.total_claim_amount === 'number' && Number.isFinite(v.total_claim_amount) && v.total_claim_amount >= 0 &&
    typeof v.total_claims === 'number' && Number.isFinite(v.total_claims) && v.total_claims >= 0 &&
    Array.isArray(v.data) && v.data.every(isMemberCardMonthlyRow)
  );
}

/* ─── Member card disease (Claim Cost Breakdown dashboard) ─── */

/** Satu kategori diagnosis dari upstream member-card-disease. */
export interface MemberCardDiseaseItem {
  name: string;
  value: number;
  value_formatted: string;
  persentage: number;
}

/** Breakdown biaya klaim per kategori diagnosis (kontrak terverifikasi live). */
export interface MemberCardDisease {
  type: string;
  total_bill: number;
  data: MemberCardDiseaseItem[];
}

export type MemberCardDiseaseResult =
  | { ok: true; disease: MemberCardDisease | null }
  | { ok: false; status: number; message: string };

interface CardDiseaseUpstreamBody {
  code?: number;
  status?: string;
  message?: string;
  // Array heterogen: slice { type:'pie' } + baris insight ber-dimension_rank.
  data?: unknown[] | null;
}

interface CardRecPlanUpstreamBody {
  code?: number;
  status?: string;
  message?: string;
  data?: unknown[] | null;
}

function isMemberCardDiseaseItem(value: unknown): value is MemberCardDiseaseItem {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.name === 'string' && v.name.trim().length > 0 &&
    typeof v.value === 'number' && Number.isFinite(v.value) && v.value >= 0 &&
    typeof v.persentage === 'number' && Number.isFinite(v.persentage)
  );
}

function isMemberCardDisease(value: unknown): value is MemberCardDisease {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.total_bill === 'number' && Number.isFinite(v.total_bill) && v.total_bill >= 0 &&
    Array.isArray(v.data) && v.data.length > 0 && v.data.every(isMemberCardDiseaseItem)
  );
}

/**
 * Forward a Claim Cost Breakdown lookup to the AdBrief member-card-disease
 * service.
 *
 * Upstream contract (terverifikasi live):
 *   POST {baseUrl}/member-card-disease  { member_name, dob: 'YYYY-MM-DD', gender: 'M'|'F' }
 *     HTTP 200 → { code:200, status:'OK', message:'Success',
 *                  data:[{ type:'pie', total_bill:number,
 *                          data:[{ name, value, value_formatted, persentage }] }] }
 *   Member tidak dikenal → PIE KOSONG { type:'pie', total_bill:0, data:[] }
 *   (BERBEDA dari service member-card lain yang memakai data:[]) — dipetakan
 *   ke disease:null (tanpa breakdown), BUKAN donat kosong angka riil.
 */
export async function memberCardDiseaseAdBrief(
  identity: CheckMemberIdentity,
  userToken: string,
): Promise<MemberCardDiseaseResult> {
  if (!isCheckMemberConfigured()) {
    console.error(
      '[adscore member-card-disease] 503: ADSCORE_CHECK_MEMBER_BASE_URL is not configured ' +
        '(set it in env.cloud-run.yaml / server/.env, then redeploy)',
    );
    return { ok: false, status: 503, message: 'Layanan breakdown klaim tidak tersedia' };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), adBriefCheckMemberConfig.timeoutMs);
    let res: Awaited<ReturnType<typeof fetch>>;
    try {
      res = await fetch(`${adBriefCheckMemberConfig.baseUrl}/member-card-disease`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Forward user's JWT — upstream validates with the same secret.
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify(identity),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    // Defensif: upstream lama check-member memakai 404 untuk not-found.
    if (res.status === 404) {
      return { ok: true, disease: null };
    }

    const payload = (await res.json().catch(() => null)) as CardDiseaseUpstreamBody | null;

    if (res.ok) {
      const list = payload?.data;
      // data:[] / null → member tidak dikenal — respons valid, bukan error.
      if (!Array.isArray(list) || list.length === 0) return { ok: true, disease: null };
      // Upstream membungkus donat dalam slice { type:'pie', ... } — array data
      // bisa heterogen (pie + baris insight ber-dimension_rank). Tanpa slice
      // pie = member tanpa breakdown — respons valid, bukan error.
      const slice = list.find(
        (item): item is MemberCardDisease => !!item && typeof item === 'object' && (item as Record<string, unknown>).type === 'pie',
      );
      if (!slice) return { ok: true, disease: null };
      // Member tidak dikenal: upstream mengirim PIE KOSONG
      // { total_bill:0, data:[] } — BERBEDA dari service member-card lain
      // yang memakai data:[] / nol semua. Pie kosong ditangani SEBELUM
      // validasi shape agar tidak salah 502 → dipetakan ke disease:null.
      if (
        typeof slice.total_bill !== 'number' || !Number.isFinite(slice.total_bill) ||
        slice.total_bill === 0 ||
        !Array.isArray(slice.data) || slice.data.length === 0
      ) {
        return { ok: true, disease: null };
      }
      if (!isMemberCardDisease(slice)) {
        console.error(
          '[adscore member-card-disease] unexpected data slice shape:',
          JSON.stringify(slice)?.slice(0, 300) ?? '(non-JSON)',
        );
        return { ok: false, status: 502, message: 'Respons layanan breakdown klaim tidak dikenali' };
      }
      return { ok: true, disease: slice };
    }

    console.error(
      `[adscore member-card-disease] upstream ${res.status}:`,
      JSON.stringify(payload)?.slice(0, 500) ?? '(non-JSON)',
    );
    return { ok: false, status: 502, message: 'Layanan breakdown klaim gagal memproses permintaan' };
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      console.error('[adscore member-card-disease] upstream timeout');
      return { ok: false, status: 504, message: 'Layanan breakdown klaim tidak merespons (timeout)' };
    }
    console.error('[adscore member-card-disease] upstream unreachable:', (err as Error).message);
    return { ok: false, status: 502, message: 'Layanan breakdown klaim tidak dapat dihubungi' };
  }
}

/**
 * Forward a Claim History lookup to the AdBrief member-card-monthly service.
 *
 * Upstream contract (terverifikasi live via curl):
 *   POST {baseUrl}/member-card-monthly  { member_name, dob: 'YYYY-MM-DD', gender: 'M'|'F' }
 *     HTTP 200 → { code:200, status:'OK', message:'Success',
 *                  data:{ total_claim_amount:number, total_claims:number,
 *                         data:[{ month:'Sep 2024 ', claim_amount:number,
 *                                 number_of_claims:number }] } }
 *     Member tidak dikenal → data nol semua + array kosong — dipetakan ke
 *     monthly:null (tanpa riwayat klaim), BUKAN angka riil.
 *   Catatan: string month upstream diakhiri spasi ('Sep 2024 ') dan TIDAK
 *     selalu terurut — trim + sorting ditangani sisi client.
 */
export async function memberCardMonthlyAdBrief(
  identity: CheckMemberIdentity,
  userToken: string,
): Promise<MemberCardMonthlyResult> {
  if (!isCheckMemberConfigured()) {
    console.error(
      '[adscore member-card-monthly] 503: ADSCORE_CHECK_MEMBER_BASE_URL is not configured ' +
        '(set it in env.cloud-run.yaml / server/.env, then redeploy)',
    );
    return { ok: false, status: 503, message: 'Layanan riwayat klaim tidak tersedia' };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), adBriefCheckMemberConfig.timeoutMs);
    let res: Awaited<ReturnType<typeof fetch>>;
    try {
      res = await fetch(`${adBriefCheckMemberConfig.baseUrl}/member-card-monthly`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Forward user's JWT — upstream validates with the same secret.
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify(identity),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    // Defensif: upstream lama check-member memakai 404 untuk not-found.
    if (res.status === 404) {
      return { ok: true, monthly: null };
    }

    const payload = (await res.json().catch(() => null)) as CardMonthlyUpstreamBody | null;

    if (res.ok) {
      const data = payload?.data;
      if (data === undefined || data === null) return { ok: true, monthly: null };
      if (!isMemberCardMonthly(data)) {
        console.error(
          '[adscore member-card-monthly] unexpected data shape:',
          JSON.stringify(data)?.slice(0, 300) ?? '(non-JSON)',
        );
        return { ok: false, status: 502, message: 'Respons layanan riwayat klaim tidak dikenali' };
      }
      // Upstream membalas nol semua + array kosong untuk member yang tidak
      // dikenal — perlakukan sebagai "tanpa riwayat klaim", bukan angka riil.
      if (data.total_claims === 0 && data.total_claim_amount === 0 && data.data.length === 0) {
        return { ok: true, monthly: null };
      }
      return { ok: true, monthly: data };
    }

    console.error(
      `[adscore member-card-monthly] upstream ${res.status}:`,
      JSON.stringify(payload)?.slice(0, 500) ?? '(non-JSON)',
    );
    return { ok: false, status: 502, message: 'Layanan riwayat klaim gagal memproses permintaan' };
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      console.error('[adscore member-card-monthly] upstream timeout');
      return { ok: false, status: 504, message: 'Layanan riwayat klaim tidak merespons (timeout)' };
    }
    console.error('[adscore member-card-monthly] upstream unreachable:', (err as Error).message);
    return { ok: false, status: 502, message: 'Layanan riwayat klaim tidak dapat dihubungi' };
  }
}

/* ─── Member card risk insights (Risk Insights dashboard) ─── */

/** Satu insight risiko dari upstream member-card-rec-dim (kontrak terverifikasi live). */
export interface MemberCardRiskInsight {
  dimension_rank: number;
  next_action_dimension: string;
  title_web: string;
}

export type MemberCardRiskInsightsResult =
  | { ok: true; insights: MemberCardRiskInsight[] }
  | { ok: false; status: number; message: string };

interface CardRiskInsightsUpstreamBody {
  code?: number;
  status?: string;
  message?: string;
  data?: MemberCardRiskInsight[] | null;
}

/**
 * Forward a Risk Insights lookup to the AdBrief member-card-rec-dim service
 * (endpoint DEDICATED untuk Top 3 Risk Contributors — berbeda dari
 * member-card-disease yang hanya memuat breakdown pie).
 *
 * Upstream contract (terverifikasi live via curl):
 *   POST {baseUrl}/member-card-rec-dim  { member_name, dob: 'YYYY-MM-DD', gender: 'M'|'F' }
 *     HTTP 200 → { code:200, status:'OK', message:'Success',
 *                  data:[{ dimension_rank:1, next_action_dimension:string,
 *                          title_web:string }, ...] }
 *   data:[] / tanpa baris valid → insights:[] — respons valid, bukan error
 *   (kartu menampilkan state kosong, BUKAN insight simulasi).
 */
export async function memberCardRiskInsightsAdBrief(
  identity: CheckMemberIdentity,
  userToken: string,
): Promise<MemberCardRiskInsightsResult> {
  if (!isCheckMemberConfigured()) {
    console.error(
      '[adscore member-card-rec-dim] 503: ADSCORE_CHECK_MEMBER_BASE_URL is not configured ' +
        '(set it in env.cloud-run.yaml / server/.env, then redeploy)',
    );
    return { ok: false, status: 503, message: 'Layanan insight risiko tidak tersedia' };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), adBriefCheckMemberConfig.timeoutMs);
    let res: Awaited<ReturnType<typeof fetch>>;
    try {
      res = await fetch(`${adBriefCheckMemberConfig.baseUrl}/member-card-rec-dim`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Forward user's JWT — upstream validates with the same secret.
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify(identity),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    // Defensif: upstream lama check-member memakai 404 untuk not-found.
    if (res.status === 404) {
      return { ok: true, insights: [] };
    }

    const payload = (await res.json().catch(() => null)) as CardRiskInsightsUpstreamBody | null;

    if (res.ok) {
      const list = payload?.data;
      if (!Array.isArray(list)) return { ok: true, insights: [] };
      const insights = list.filter((item): item is MemberCardRiskInsight => {
        if (!item || typeof item !== 'object') return false;
        const v = item as unknown as Record<string, unknown>;
        return (
          typeof v.dimension_rank === 'number' && Number.isFinite(v.dimension_rank) &&
          typeof v.title_web === 'string' && v.title_web.trim().length > 0 &&
          typeof v.next_action_dimension === 'string'
        );
      });
      return { ok: true, insights };
    }

    console.error(
      `[adscore member-card-rec-dim] upstream ${res.status}:`,
      JSON.stringify(payload)?.slice(0, 500) ?? '(non-JSON)',
    );
    return { ok: false, status: 502, message: 'Layanan insight risiko gagal memproses permintaan' };
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      console.error('[adscore member-card-rec-dim] upstream timeout');
      return { ok: false, status: 504, message: 'Layanan insight risiko tidak merespons (timeout)' };
    }
    console.error('[adscore member-card-rec-dim] upstream unreachable:', (err as Error).message);
    return { ok: false, status: 502, message: 'Layanan insight risiko tidak dapat dihubungi' };
  }
}

/* ─── Member card rec plan (Next Action dashboard) ─── */

/** Satu rekomendasi aksi dari upstream member-card-rec-plan (kontrak terverifikasi live). */
export interface MemberCardRecPlan {
  category_adscore: string;
  next_action: string;
}

export type MemberCardRecPlanResult =
  | { ok: true; plans: MemberCardRecPlan[] }
  | { ok: false; status: number; message: string };

/**
 * Forward a Next Action lookup to the AdBrief member-card-rec-plan service
 * (pola P1c). Upstream contract (terverifikasi live 2026-10-12):
 *   HTTP 200 → data:[{ category_adscore, next_action }, ...]
 *   member tidak dikenal → data:[] — respons valid, bukan error.
 */
export async function memberCardRecPlanAdBrief(
  identity: CheckMemberIdentity,
  userToken: string,
): Promise<MemberCardRecPlanResult> {
  if (!isCheckMemberConfigured()) {
    console.error(
      '[adscore member-card-rec-plan] 503: ADSCORE_CHECK_MEMBER_BASE_URL is not configured ' +
        '(set it in env.cloud-run.yaml / server/.env, then redeploy)',
    );
    return { ok: false, status: 503, message: 'Layanan rekomendasi aksi tidak tersedia' };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), adBriefCheckMemberConfig.timeoutMs);
    let res: Awaited<ReturnType<typeof fetch>>;
    try {
      res = await fetch(`${adBriefCheckMemberConfig.baseUrl}/member-card-rec-plan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Forward user's JWT — upstream validates with the same secret.
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify(identity),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    // Defensif: upstream lama check-member memakai 404 untuk not-found.
    if (res.status === 404) {
      return { ok: true, plans: [] };
    }

    const payload = (await res.json().catch(() => null)) as CardRecPlanUpstreamBody | null;

    if (res.ok) {
      const list = payload?.data;
      if (!Array.isArray(list)) return { ok: true, plans: [] };
      const plans = list.filter((item): item is MemberCardRecPlan => {
        if (!item || typeof item !== 'object') return false;
        const v = item as Record<string, unknown>;
        return (
          typeof v.category_adscore === 'string' && v.category_adscore.trim().length > 0 &&
          typeof v.next_action === 'string' && v.next_action.trim().length > 0
        );
      });
      return { ok: true, plans };
    }

    console.error(
      `[adscore member-card-rec-plan] upstream ${res.status}:`,
      JSON.stringify(payload)?.slice(0, 500) ?? '(non-JSON)',
    );
    return { ok: false, status: 502, message: 'Layanan rekomendasi aksi gagal memproses permintaan' };
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      console.error('[adscore member-card-rec-plan] upstream timeout');
      return { ok: false, status: 504, message: 'Layanan rekomendasi aksi tidak merespons (timeout)' };
    }
    console.error('[adscore member-card-rec-plan] upstream unreachable:', (err as Error).message);
    return { ok: false, status: 502, message: 'Layanan rekomendasi aksi tidak dapat dihubungi' };
  }
}