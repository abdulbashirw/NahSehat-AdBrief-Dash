/**
 * AdScore Member Page — Member Risk Scoring.
 *
 * Allows switching between:
 * 1. Member tab (Full Name + Date of Birth)
 *
 * Displays (semua dari service API AdBrief via server proxy — tanpa dummy):
 * - Member Profile (member-card-info): gauge AdScore + kategori risiko
 * - Claim Summary (member-card-claims)
 * - Claim History (member-card-monthly): combo bar+line bulanan
 * - Claim Cost Breakdown (member-card-disease): donat per kategori diagnosis
 * - Risk Insights (member-card-rec-dim) & Next Action (member-card-rec-plan)
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  ArrowLeft,
  Search,
  Clock,
  AlertTriangle,
  FileSpreadsheet,
  FileText,
  Coins,
  CalendarDays,
  CheckCircle2,
  Activity,
  Compass,
  User,
  UserX,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import type { ScoreLevel } from '@/entities/adscore';
import MemberSearchFilterBar from '../components/MemberSearchFilterBar';
import MemberEmptyState from '../components/MemberEmptyState';
import UploadDataModal from '../components/UploadDataModal';
import TrackingJobCard from '../components/TrackingJobCard';
import VerificationResult from '../components/VerificationResult';
import ConfirmDialog from '@/shared/components/common/ConfirmDialog';
import {
  ACTIVE_TRACKING_KEY,
  ACTIVE_TRACKING_LIST_KEY,
  clearActiveTrackingDetails,
  readActiveTrackingList,
  removeActiveTrackingEntry,
  saveActiveTrackingList,
} from '../lib/activeTracking';
import type { ActiveTrackingDetails } from '../lib/activeTracking';
import {
  cancelOnboardingJob,
  checkMemberIdentity,
  createOnboardingJob,
  fetchMemberCardClaims,
  fetchMemberCardDisease,
  fetchMemberCardInfo,
  fetchMemberCardMonthly,
  fetchMemberCardRecPlan,
  fetchMemberCardRiskInsights,
  fetchOnboardingTrackingJobs,
  getJob,
  OnboardingApiError,
  searchMembers,
  subscribeJob,
} from '../lib/onboardingApi';
import type {
  MemberCardClaims,
  MemberCardDisease,
  MemberCardInfo,
  MemberCardMonthly,
  MemberCardRecPlan,
  MemberCardRiskInsight,
} from '../lib/onboardingApi';
import type {
  OnboardingStage,
  OnboardingJob,
  EmptyVariant,
  MemberSearchFilter,
  RegisteredMember,
  IndividuSubmitPayload,
  BulkSubmitPayload,
} from '../model/onboardingTypes';

/* ── Claim History: skala & transformasi data real member-card-monthly ──
   (tanpa dummy 24 bulan — chart memakai data real dari service API) */

/** Skala Y "nice" — langkah bulat (1/2/2.5/5 × 10ⁿ) agar grid chart rapi. */
function niceCeil(value: number): number {
  if (value <= 0) return 1;
  const base = 10 ** Math.floor(Math.log10(value));
  const n = value / base;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * base;
}

/** Skala Y amount (rupiah): domain[0, max] + ticks bulat (pola mockup 5-6 ticks). */
function buildAmountScale(maxAmount: number): { domain: [number, number]; ticks: number[] } {
  const max = niceCeil(maxAmount * 1.1);
  const step = niceCeil(max / 5);
  const ticks: number[] = [];
  for (let t = 0; t <= max + 1e-9; t += step) ticks.push(Math.round(t * 100) / 100);
  return { domain: [0, max], ticks };
}

/** Skala Y jumlah klaim: domain[0, max] + ticks bulat. */
function buildClaimsScale(maxClaims: number): { domain: [number, number]; ticks: number[] } {
  const max = niceCeil(maxClaims * 1.15);
  const step = niceCeil(max / 5);
  const ticks: number[] = [];
  for (let t = 0; t <= max + 1e-9; t += step) ticks.push(Math.round(t * 100) / 100);
  return { domain: [0, max], ticks };
}

/** Label tick sumbu amount — singkatan Indonesia (jt = juta, M = miliar). */
const formatAmountTick = (value: number): string => {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })}M`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toLocaleString('id-ID', { maximumFractionDigits: 0 })}jt`;
  }
  return value.toLocaleString('id-ID', { maximumFractionDigits: 0 });
};

// ── Claim Cost Breakdown: palet warna donat (urutan pola mockup) ──
const DISEASE_COLOR_PALETTE = ['#EF4444', '#F97316', '#3B82F6', '#10B981', '#8B5CF6', '#EC4899', '#14B8A6', '#F59E0B', '#6366F1', '#84CC16'];

/* ── Format Rupiah ringkas (singkatan Indonesia: jt = juta, M = miliar) ── */
const formatRupiahCompact = (value: number): string => {
  if (!Number.isFinite(value) || value < 0) return 'Rp 0';
  if (value >= 1_000_000_000) {
    return `Rp ${(value / 1_000_000_000).toLocaleString('id-ID', { maximumFractionDigits: 2 })} M`;
  }
  if (value >= 1_000_000) {
    return `Rp ${(value / 1_000_000).toLocaleString('id-ID', { maximumFractionDigits: 2 })} jt`;
  }
  return `Rp ${value.toLocaleString('id-ID', { maximumFractionDigits: 0 })}`;
};

// Custom 2-line tick for monthly axis (label 'Sep 24' → dua baris)
const RenderCustomAxisTick = ({ x, y, payload }: { x?: number; y?: number; payload?: { value?: string | number } }) => {
  const parts = String(payload?.value ?? '').split(' ');
  return (
    <g transform={`translate(${x ?? 0},${y ?? 0})`}>
      <text x={0} y={0} dy={10} textAnchor="middle" fill="#64748B" fontSize={9} fontWeight={500}>
        {parts[0]}
      </text>
      <text x={0} y={0} dy={20} textAnchor="middle" fill="#94A3B8" fontSize={8}>
        {parts[1]}
      </text>
    </g>
  );
};

// Custom tooltip for Claim History
const CustomHistoryTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value?: number | string }>; label?: string | number }) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-xl border border-slate-200/90 bg-white/95 p-3 shadow-lg backdrop-blur-sm text-xs">
        <p className="font-bold text-slate-800 mb-1.5">{label}</p>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-sm bg-[#60A5FA]" />
            <span className="text-slate-500">Total Claim Amount:</span>
            <span className="font-bold font-mono text-slate-800">
              {formatRupiahCompact(Number(payload[0]?.value ?? 0))}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#1E3A8A]" />
            <span className="text-slate-500">Number of Claims:</span>
            <span className="font-bold font-mono text-slate-800">
              {payload[1]?.value}
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

/**
 * Map kategori upstream (category_adscore) → level dashboard.
 * Sampel upstream terverifikasi: final_score 19/20 = "High Risk" — skala
 * upstream berlawanan arah dengan skala lama dashboard (1=Ekstrem..20=Minimum).
 * Kategori tidak dikenal dipetakan konservatif ke 'bad' (konteks underwriting:
 * false-negative lebih berbahaya daripada false-positive).
 */
function categoryToLevel(category: string): ScoreLevel {
  const normalized = category.trim().toLowerCase();
  if (normalized.includes('low')) return 'good';
  if (normalized.includes('moderate') || normalized.includes('medium')) return 'moderate';
  return 'bad';
}

export default function AdScoreMemberPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  // Member form state — hanya diisi dari data real (hasil pencarian DB /
  // hasil verifikasi onboarding). Tanpa default dummy mockup.
  const [memberName, setMemberName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState('male');

  // Nama member yang sedang dianalisis (dari input real, bukan default dummy).
  const [submittedName, setSubmittedName] = useState('');

  // Member Profile dari service member-card-info AdBrief (via server proxy).
  // null + status notfound/error → kartu menampilkan state kosong profesional
  // (tanpa data simulasi) — hanya data real dari service API yang ditampilkan.
  const [memberCardInfo, setMemberCardInfo] = useState<MemberCardInfo | null>(null);
  const [memberCardInfoStatus, setMemberCardInfoStatus] = useState<'idle' | 'loading' | 'found' | 'notfound' | 'error'>('idle');

  // Claim Summary dari service member-card-claims AdBrief (via server proxy).
  // null + status notfound/error → kartu menampilkan state kosong profesional
  // (tanpa angka dummy 42 / Rp 11.5M) — hanya data real dari service API.
  const [memberCardClaims, setMemberCardClaims] = useState<MemberCardClaims | null>(null);
  const [memberCardClaimsStatus, setMemberCardClaimsStatus] = useState<'idle' | 'loading' | 'found' | 'notfound' | 'error'>('idle');

  // Claim History (riwayat klaim bulanan) dari service member-card-monthly
  // AdBrief (via server proxy) — grafik memakai data real, tanpa dummy 24 bulan.
  const [memberCardMonthly, setMemberCardMonthly] = useState<MemberCardMonthly | null>(null);
  const [memberCardMonthlyStatus, setMemberCardMonthlyStatus] = useState<'idle' | 'loading' | 'found' | 'notfound' | 'error'>('idle');

  // Claim Cost Breakdown (per kategori diagnosis) dari service
  // member-card-disease AdBrief (via server proxy) — donat memakai data real.
  const [memberCardDisease, setMemberCardDisease] = useState<MemberCardDisease | null>(null);
  const [memberCardDiseaseStatus, setMemberCardDiseaseStatus] = useState<'idle' | 'loading' | 'found' | 'notfound' | 'error'>('idle');

  // Risk Insights (Top 3 Risk Contributors) dari service member-card-rec-dim
  // AdBrief (via server proxy) — daftar insight memakai data real.
  const [memberCardInsights, setMemberCardInsights] = useState<MemberCardRiskInsight[] | null>(null);
  const [memberCardInsightsStatus, setMemberCardInsightsStatus] = useState<'idle' | 'loading' | 'found' | 'notfound' | 'error'>('idle');

  // Next Action (rencana tindak lanjut) dari service member-card-rec-plan
  // AdBrief (via server proxy) — tabel memakai data real, tanpa dummy.
  const [memberCardRecPlan, setMemberCardRecPlan] = useState<MemberCardRecPlan[] | null>(null);
  const [memberCardRecPlanStatus, setMemberCardRecPlanStatus] = useState<'idle' | 'loading' | 'found' | 'notfound' | 'error'>('idle');

  // ── Onboarding state machine (Modul 1–3, before the dashboard) ──
  // 'dashboard' renders the EXISTING design untouched (Modul 4 contract).
  // Multi-job: SEMUA unggahan yang masih proses dilacak bersamaan (bukan
  // hanya job terakhir) — satu ActiveTrackingDetails per job.
  const [trackedJobs, setTrackedJobs] = useState<ActiveTrackingDetails[]>(() => readActiveTrackingList());
  const [stage, setStage] = useState<OnboardingStage>(() =>
    trackedJobs.some((d) => d.job.status !== 'completed' && d.job.status !== 'cancelled') ? 'processing' : 'search'
  );
  const [searchFilter, setSearchFilter] = useState<MemberSearchFilter>({
    nama: '',
    tglLahir: '',
    gender: '',
  });
  const [emptyVariant, setEmptyVariant] = useState<EmptyVariant>('no-data');
  /** Alasan pemblokiran dashboard (varian verification-blocked). */
  const [blockedReason, setBlockedReason] = useState<string | undefined>(undefined);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadDefaultTab, setUploadDefaultTab] = useState<'individu' | 'bulk'>('individu');
  const [submitting, setSubmitting] = useState(false);
  const [job, setJob] = useState<OnboardingJob | null>(() =>
    trackedJobs.length ? trackedJobs[trackedJobs.length - 1].job : null
  );
  const [searching, setSearching] = useState(false);
  // Fase 5: cek eksplisit ke registry AdBrief dari empty-state pencarian
  const [adBriefCheck, setAdBriefCheck] = useState<{ state: 'checking' | 'found' | 'notfound' | 'error'; message?: string } | undefined>(undefined);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  // Hasil verifikasi yang selesai namun BELUM dilihat: tetap tersimpan dalam
  // daftar tracking dan tampil di hub sebagai kartu "hasil siap" (bukan
  // hilang) — bisa dibuka per-job tanpa meninggalkan antrean lainnya.
  const unviewedResults = useMemo(
    () => trackedJobs.filter((d) => d.job.status === 'completed' && d.job.result),
    [trackedJobs],
  );
  const activeTrackedCount = useMemo(
    () => trackedJobs.filter((d) => d.job.status !== 'completed' && d.job.status !== 'cancelled').length,
    [trackedJobs],
  );
  // Target pembatalan per-job (dari tombol "Batalkan" pada kartu job).
  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);

  // Refs untuk keputusan di dalam callback polling — hindari stale closure.
  const trackedJobsRef = useRef(trackedJobs);
  const jobRef = useRef(job);
  useEffect(() => {
    trackedJobsRef.current = trackedJobs;
    jobRef.current = job;
  }, [trackedJobs, job]);

  // Mirror state → localStorage: state React sebagai single source of truth,
  // storage hanya persistensi (sekaligus migrasi slot legacy → list).
  useEffect(() => {
    saveActiveTrackingList(trackedJobs);
  }, [trackedJobs]);

  // Keep tabs in the same browser profile in sync when another tab changes
  // the persisted tracking list. Job polling starts through the subscription effect.
  useEffect(() => {
    const syncTrackedJobs = (event: StorageEvent) => {
      if (event.key !== ACTIVE_TRACKING_KEY && event.key !== ACTIVE_TRACKING_LIST_KEY) return;
      const latest = readActiveTrackingList();
      setTrackedJobs((current) =>
        JSON.stringify(current) === JSON.stringify(latest) ? current : latest,
      );
    };

    window.addEventListener('storage', syncTrackedJobs);
    return () => window.removeEventListener('storage', syncTrackedJobs);
  }, []);

  // Guard: hub tracking tanpa job aktif tidak boleh menggantung
  // (derived state, bukan effect — aman dari cascading render).
  const showProcessingHub = stage === 'processing' && trackedJobs.length > 0;

  /* ── Restore: cocokkan SEMUA job terlacak dengan status terkini server ── */
  useEffect(() => {
    let alive = true;

    void (async () => {
      let serverJobs: Awaited<ReturnType<typeof fetchOnboardingTrackingJobs>> = [];
      try {
        serverJobs = await fetchOnboardingTrackingJobs();
      } catch (error) {
        console.warn('[AdScoreMember] server tracking list unavailable; using saved tracking', error);
      }
      if (!alive) return;

      const candidates = new Map<string, ActiveTrackingDetails>();
      for (const record of serverJobs) {
        candidates.set(record.jobId, {
          jobId: record.jobId,
          dataFileName: record.dataFileName,
          consentFiles: record.consentFiles,
          job: {
            id: record.jobId,
            mode: record.mode,
            status: record.status,
            createdAt: record.createdAt,
            timeline: [{ status: record.status, at: record.createdAt }],
          },
        });
      }
      for (const localDetails of trackedJobsRef.current) {
        const serverDetails = candidates.get(localDetails.jobId);
        candidates.set(
          localDetails.jobId,
          serverDetails
            ? {
                ...serverDetails,
                ...localDetails,
                dataFileName: localDetails.dataFileName ?? serverDetails.dataFileName,
                consentFiles: localDetails.consentFiles.length
                  ? localDetails.consentFiles
                  : serverDetails.consentFiles,
              }
            : localDetails,
        );
      }

      const kept: ActiveTrackingDetails[] = [];
      const active: ActiveTrackingDetails[] = [];
      let latestCompleted: OnboardingJob | null = null;

      for (const details of candidates.values()) {
        let restoredJob: OnboardingJob | undefined;
        let fetchFailed = false;
        try {
          restoredJob = await getJob(details.jobId);
        } catch (error) {
          if (error instanceof OnboardingApiError && (error.status === 403 || error.status === 404)) {
            removeActiveTrackingEntry(details.jobId);
            continue;
          }
          fetchFailed = true;
          console.warn('[AdScoreMember] status unavailable; showing saved tracking', error);
        }
        if (!alive) return;
        if (!fetchFailed && (!restoredJob || restoredJob.status === 'cancelled')) {
          console.warn('[AdScoreMember] job not found or cancelled; resetting tracking');
          removeActiveTrackingEntry(details.jobId);
          continue;
        }
        const merged = restoredJob ? { ...details, job: restoredJob } : details;
        if (!fetchFailed && restoredJob && restoredJob.status === 'completed') {
          // Hasil siap: TETAP ditampilkan di hub sebagai kartu "hasil siap"
          // — tidak dihapus, agar hasil tidak hilang saat antrean lain jalan.
          if (!latestCompleted || restoredJob.createdAt > latestCompleted.createdAt) {
            latestCompleted = restoredJob;
          }
          kept.push(merged);
          continue;
        }
        active.push(merged);
        kept.push(merged);
      }
      if (!alive) return;

      saveActiveTrackingList(kept);
      setTrackedJobs(kept);
      if (active.length > 0) {
        // Masih ada antrean aktif → hub menampilkan SEMUA job (aktif + hasil siap).
        setJob(active[active.length - 1].job);
        setStage('processing');
        return;
      }
      if (latestCompleted) {
        // Semua job selesai → buka hasil terbaru; job lain tetap tersimpan
        // sebagai hasil siap (banner/kartu) setelah kembali dari hasil.
        const opened = latestCompleted;
        removeActiveTrackingEntry(opened.id);
        setTrackedJobs(kept.filter((d) => d.jobId !== opened.id));
        setJob(opened);
        setStage(
          opened.result?.kind === 'bulk'
            ? 'bulk-confirm'
            : opened.result?.kind === 'notfound'
              ? 'result-notfound'
              : 'result-success',
        );
        return;
      }
      setJob(null);
      setStage('search');
    })();

    return () => {
      alive = false;
    };
  }, []);

  /* ── Member Profile, Claim Summary, Claim History, Claim Cost Breakdown,
     Risk Insights & Next Action: fetch data real dari AdBrief (6 layanan
     paralel via Promise.allSettled — kegagalan satu layanan tidak
     mengganggu yang lainnya). */
  const loadMemberCardInfo = useCallback(async (name: string, dob: string, genderSelection: string) => {
    const genderApi = genderSelection === 'female' ? 'F' : 'M';
    if (!name.trim() || !dob) {
      setMemberCardInfo(null);
      setMemberCardInfoStatus('idle');
      setMemberCardClaims(null);
      setMemberCardClaimsStatus('idle');
      setMemberCardMonthly(null);
      setMemberCardMonthlyStatus('idle');
      setMemberCardDisease(null);
      setMemberCardDiseaseStatus('idle');
      setMemberCardInsights(null);
      setMemberCardInsightsStatus('idle');
      setMemberCardRecPlan(null);
      setMemberCardRecPlanStatus('idle');
      return;
    }
    setMemberCardInfoStatus('loading');
    setMemberCardClaimsStatus('loading');
    setMemberCardMonthlyStatus('loading');
    setMemberCardDiseaseStatus('loading');
    setMemberCardInsightsStatus('loading');
    setMemberCardRecPlanStatus('loading');
    const identity = { nama: name.trim(), tglLahir: dob, gender: genderApi };
    const [infoRes, claimsRes, monthlyRes, diseaseRes, insightsRes, recPlanRes] = await Promise.allSettled([
      fetchMemberCardInfo(identity),
      fetchMemberCardClaims(identity),
      fetchMemberCardMonthly(identity),
      fetchMemberCardDisease(identity),
      fetchMemberCardRiskInsights(identity),
      fetchMemberCardRecPlan(identity),
    ]);
    if (infoRes.status === 'fulfilled') {
      setMemberCardInfo(infoRes.value);
      setMemberCardInfoStatus(infoRes.value ? 'found' : 'notfound');
    } else {
      console.error('[AdScoreMember] member-card-info failed', infoRes.reason);
      setMemberCardInfo(null);
      setMemberCardInfoStatus('error');
    }
    if (claimsRes.status === 'fulfilled') {
      setMemberCardClaims(claimsRes.value);
      setMemberCardClaimsStatus(claimsRes.value ? 'found' : 'notfound');
    } else {
      console.error('[AdScoreMember] member-card-claims failed', claimsRes.reason);
      setMemberCardClaims(null);
      setMemberCardClaimsStatus('error');
    }
    if (monthlyRes.status === 'fulfilled') {
      setMemberCardMonthly(monthlyRes.value);
      setMemberCardMonthlyStatus(monthlyRes.value ? 'found' : 'notfound');
    } else {
      console.error('[AdScoreMember] member-card-monthly failed', monthlyRes.reason);
      setMemberCardMonthly(null);
      setMemberCardMonthlyStatus('error');
    }
    if (diseaseRes.status === 'fulfilled') {
      setMemberCardDisease(diseaseRes.value);
      setMemberCardDiseaseStatus(diseaseRes.value ? 'found' : 'notfound');
    } else {
      console.error('[AdScoreMember] member-card-disease failed', diseaseRes.reason);
      setMemberCardDisease(null);
      setMemberCardDiseaseStatus('error');
    }
    if (insightsRes.status === 'fulfilled') {
      setMemberCardInsights(insightsRes.value);
      setMemberCardInsightsStatus(insightsRes.value && insightsRes.value.length > 0 ? 'found' : 'notfound');
    } else {
      console.error('[AdScoreMember] member-card-risk-insights failed', insightsRes.reason);
      setMemberCardInsights(null);
      setMemberCardInsightsStatus('error');
    }
    if (recPlanRes.status === 'fulfilled') {
      setMemberCardRecPlan(recPlanRes.value);
      setMemberCardRecPlanStatus(recPlanRes.value && recPlanRes.value.length > 0 ? 'found' : 'notfound');
    } else {
      console.error('[AdScoreMember] member-card-rec-plan failed', recPlanRes.reason);
      setMemberCardRecPlan(null);
      setMemberCardRecPlanStatus('error');
    }
  }, []);

  /* ── Search (DB-backed with mock fallback) ── */
  const runSearch = useCallback(async (filter: MemberSearchFilter) => {
    // Semua kolom wajib terisi sebelum pencarian dijalankan.
    if (!filter.nama.trim() || !filter.tglLahir.trim() || !filter.gender) return;
    setSearching(true);
    setAdBriefCheck(undefined);
    try {
      const res = await searchMembers({
        nama: filter.nama.trim(),
        tglLahir: filter.tglLahir || undefined,
        gender: filter.gender || undefined,
      });
      if (res.found && res.member && res.pendingVerification) {
        // Gate alur: member masih memiliki job verifikasi aktif (submitted /
        // on_progress) — dashboard AdScore TIDAK boleh dibuka. Hasil
        // verifikasi dokumen harus selesai terlebih dahulu.
        setBlockedReason(undefined);
        setEmptyVariant('verification-pending');
        setStage('empty');
      } else if (res.found && res.member && res.verificationGate) {
        // Gate strict: keputusan verifikasi TERAKHIR bukan "siap lanjut"
        // (consent mismatch "Tidak sesuai dokument" / request-fix / ditolak).
        // Member terdaftar di registry, tetapi dashboard tetap diblokir.
        setBlockedReason(res.verificationGate.reason);
        setEmptyVariant('verification-blocked');
        setStage('empty');
      } else if (res.found && res.member) {
        setBlockedReason(undefined);
        setMemberName(res.member.nama);
        if (res.member.tglLahir) setBirthDate(res.member.tglLahir);
        if (res.member.gender) setGender(res.member.gender === 'F' ? 'female' : 'male');
        setSubmittedName(res.member.nama);
        setStage('dashboard');
        void loadMemberCardInfo(res.member.nama, res.member.tglLahir, res.member.gender === 'F' ? 'female' : 'M');
      } else {
        setEmptyVariant('not-found');
        setStage('empty');
      }
    } catch (e) {
      setEmptyVariant('not-found');
      setStage('empty');
      console.error('[AdScoreMember] search failed', e);
    } finally {
      setSearching(false);
    }
  }, [loadMemberCardInfo]);

  /* ── Fase 5: cek eksplisit member ke registry AdBrief (audit action check_member) ── */
  const runAdBriefCheck = useCallback(async () => {
    if (!searchFilter.nama.trim() || !searchFilter.tglLahir.trim() || !searchFilter.gender) return;
    setAdBriefCheck({ state: 'checking' });
    try {
      const res = await checkMemberIdentity({
        nama: searchFilter.nama.trim(),
        tglLahir: searchFilter.tglLahir,
        gender: searchFilter.gender,
      }, 'member-search');
      setAdBriefCheck({ state: res.found ? 'found' : 'notfound' });
    } catch (e) {
      setAdBriefCheck({ state: 'error', message: e instanceof Error ? e.message : 'Gagal memeriksa member' });
    }
  }, [searchFilter.nama, searchFilter.tglLahir, searchFilter.gender]);

  /* ── Polling multi-job: setiap job aktif berlangganan update sendiri ── */
  const handleJobUpdate = useCallback((updated: OnboardingJob) => {
    const prevList = trackedJobsRef.current;
    if (!prevList.some((d) => d.jobId === updated.id)) return;

    if (updated.status === 'cancelled') {
      // Dibatalkan di luar komponen ini → keluarkan dari daftar tracking.
      const remaining = prevList.filter((d) => d.jobId !== updated.id);
      removeActiveTrackingEntry(updated.id);
      setTrackedJobs(remaining);
      if (jobRef.current?.id === updated.id) {
        if (remaining.length > 0) {
          setJob(remaining[remaining.length - 1].job);
          setStage('processing');
        } else {
          setJob(null);
          setStage('search');
        }
      }
      return;
    }

    if (updated.status === 'completed') {
      if (prevList.length === 1) {
        // Satu-satunya job selesai → langsung ke kartu hasil (perilaku lama).
        removeActiveTrackingEntry(updated.id);
        setTrackedJobs([]);
        setJob(updated);
        setStage(
          updated.result?.kind === 'bulk'
            ? 'bulk-confirm'
            : updated.result?.kind === 'notfound'
              ? 'result-notfound'
              : 'result-success',
        );
        return;
      }
      // Job lain masih ada → kartu completed TETAP tampil di hub sebagai
      // "hasil siap" (tombol Lihat Hasil per-job) + banner; antrean lain
      // yang masih proses tidak tertutup hasil satu job.
      setTrackedJobs(prevList.map((d) => (d.jobId === updated.id ? { ...d, job: updated } : d)));
      setJob((prev) => (prev && prev.id === updated.id ? updated : prev));
      return;
    }

    // Masih proses: perbarui entri job terkait (list + fokus).
    setTrackedJobs(prevList.map((d) => (d.jobId === updated.id ? { ...d, job: updated } : d)));
    setJob((prev) => (prev && prev.id === updated.id ? updated : prev));
  }, []);

  const trackedJobIdsKey = trackedJobs.map((d) => d.jobId).join(',');
  useEffect(() => {
    const trackedJobIds = trackedJobIdsKey ? trackedJobIdsKey.split(',') : [];
    if (trackedJobIds.length === 0) return;
    const unsubs = trackedJobIds.map((jobId) => subscribeJob(jobId, handleJobUpdate));
    return () => unsubs.forEach((unsub) => unsub());
  }, [trackedJobIdsKey, handleJobUpdate]);

  /* ── Upload handlers (Modul 2 → Modul 3 stepper) ── */
  const handleUploadIndividu = async (payload: IndividuSubmitPayload, consentFiles: File[]) => {
    setSubmitting(true);
    try {
      const created = await createOnboardingJob('individu', payload, consentFiles);
      const details = { jobId: created.id, consentFiles: payload.consentFiles, job: created };
      setTrackedJobs((prev) => [...prev.filter((d) => d.jobId !== created.id), details]);
      setUploadOpen(false);
      setJob(created);
      setStage('processing');
    } catch (e) {
      console.error('[AdScoreMember] submit individu failed', e);
      throw e;
    } finally {
      setSubmitting(false);
    }
  };

  const handleUploadBulk = async (payload: BulkSubmitPayload, dataFile: File, consentFiles: File[]) => {
    setSubmitting(true);
    try {
      const created = await createOnboardingJob('bulk', payload, consentFiles, dataFile);
      const details = {
        jobId: created.id,
        dataFileName: payload.dataFileName,
        consentFiles: payload.consentFiles,
        job: created,
      };
      setTrackedJobs((prev) => [...prev.filter((d) => d.jobId !== created.id), details]);
      setUploadOpen(false);
      setJob(created);
      setStage('processing');
    } catch (e) {
      console.error('[AdScoreMember] submit bulk failed', e);
      throw e;
    } finally {
      setSubmitting(false);
    }
  };

  /** Buka dialog konfirmasi pembatalan untuk SATU job (dari kartu job). */
  const handleCancelTracking = (jobId: string) => {
    setCancelTargetId(jobId);
    setCancelDialogOpen(true);
  };

  const handleConfirmCancel = async () => {
    const targetId = cancelTargetId ?? jobRef.current?.id ?? null;
    if (!targetId) {
      clearActiveTrackingDetails();
      setTrackedJobs([]);
      setJob(null);
      setStage('search');
      setCancelDialogOpen(false);
      return;
    }
    setCancelling(true);
    try {
      await cancelOnboardingJob(targetId, 'Dibatalkan oleh pemohon');
    } catch (err) {
      console.warn('[AdScoreMember] cancel job call failed; clearing tracking anyway', err);
    } finally {
      const remaining = trackedJobsRef.current.filter((d) => d.jobId !== targetId);
      removeActiveTrackingEntry(targetId);
      setTrackedJobs(remaining);
      if (jobRef.current?.id === targetId) {
        if (remaining.length > 0) {
          setJob(remaining[remaining.length - 1].job);
          setStage('processing');
        } else {
          setJob(null);
          setStage('search');
        }
      }
      setCancelling(false);
      setCancelDialogOpen(false);
      setCancelTargetId(null);
    }
  };

  /** Buka hasil verifikasi satu job (dari banner hub / kartu "hasil siap")
   * — job dikeluarkan dari daftar tracking setelah hasilnya dilihat. */
  const handleViewResult = (jobId: string) => {
    const target = trackedJobsRef.current.find(
      (d) => d.jobId === jobId && d.job.status === 'completed',
    );
    if (!target) return;
    removeActiveTrackingEntry(jobId);
    setTrackedJobs((prev) => prev.filter((d) => d.jobId !== jobId));
    setJob(target.job);
    setStage(
      target.job.result?.kind === 'bulk'
        ? 'bulk-confirm'
        : target.job.result?.kind === 'notfound'
          ? 'result-notfound'
          : 'result-success',
    );
  };

  /* ── Post-verification actions (Modul 3 result states) ── */
  const handleViewAdScore = (member: RegisteredMember) => {
    setMemberName(member.nama);
    if (member.tglLahir) setBirthDate(member.tglLahir);
    if (member.gender) setGender(member.gender === 'F' ? 'female' : 'male');
    setSubmittedName(member.nama);
    setStage('dashboard');
    void loadMemberCardInfo(member.nama, member.tglLahir, member.gender === 'F' ? 'female' : 'M');
  };

  /** Terima HANYA baris siap lanjut dari layar konfirmasi bulk (member
   * ditemukan + dokumen persetujuan sesuai). */
  const handleConfirmBulk = (ready: RegisteredMember[]) => {
    const first = ready[0];
    if (first) {
      setMemberName(first.nama);
      if (first.tglLahir) setBirthDate(first.tglLahir);
      if (first.gender) setGender(first.gender === 'F' ? 'female' : 'male');
      setSubmittedName(first.nama);
      void loadMemberCardInfo(first.nama, first.tglLahir, first.gender === 'F' ? 'female' : 'M');
    }
    setStage('dashboard');
  };

  /* ── Member Profile gauge — derivasi MURNI dari service member-card-info
     (tanpa skor demo, tanpa fallback angka riil). null saat profil belum
     ada → gauge tidak dirender (bukan skor 10 simulasi). */
  const memberRiskView = useMemo(() => {
    if (!memberCardInfo) return null;
    const level = categoryToLevel(memberCardInfo.category_adscore);
    return {
      score: memberCardInfo.final_score,
      level,
      color: level === 'good' ? '#10B981' : level === 'moderate' ? '#F59E0B' : '#EF4444',
      label: memberCardInfo.category_adscore,
    };
  }, [memberCardInfo]);

  // Batas atas gauge: skala asli dari upstream member-card-info.
  const gaugeMax = memberCardInfo ? Math.max(memberCardInfo.max_score, 1) : 1;

  // Top 3 Risk Contributors — data real dari service member-card-rec-dim
  // (via server proxy). Tanpa insight → kartu menampilkan state kosong.
  const riskContributors = useMemo(() => {
    if (!memberCardInsights) return [];
    return [...memberCardInsights]
      .sort((a, b) => a.dimension_rank - b.dimension_rank)
      .slice(0, 3)
      .map((insight, idx) => ({
        title: insight.title_web,
        desc: insight.next_action_dimension,
        // Pola mockup: rank 1-2 merah (kontributor teratas), rank 3 amber.
        badgeColor: idx < 2 ? 'bg-rose-500' : 'bg-amber-400',
      }));
  }, [memberCardInsights]);

  /* ── Next Action — data real dari service member-card-rec-plan (via proxy
     server). Upstream mengembalikan pemetaan kategori → tindak lanjut untuk
     member (sampel: 1 baris "High Risk → Detailed assessment required").
     Callout = baris kategori member (dari profil) atau baris pertama; tabel
     menampilkan baris real saja (tanpa kategori dummy). Tanpa data → kartu
     menampilkan state kosong. */
  const nextActionView = useMemo(() => {
    if (!memberCardRecPlan || memberCardRecPlan.length === 0) return null;
    const memberCategory = memberCardInfo?.category_adscore ?? null;
    // Baris kategori member: cocokkan dengan profil; bila profil tidak ada
    // dan upstream hanya mengirim 1 baris, baris itu adalah kategori member.
    const activeCategory = memberCategory
      ?? (memberCardRecPlan.length === 1 ? memberCardRecPlan[0].category_adscore : null);
    const callout =
      (activeCategory
        ? memberCardRecPlan.find((plan) => plan.category_adscore === activeCategory)
        : undefined) ?? memberCardRecPlan[0];
    const calloutLevel = categoryToLevel(callout.category_adscore);
    const dotByLevel: Record<ScoreLevel, string> = {
      good: 'bg-emerald-500',
      moderate: 'bg-amber-500',
      bad: 'bg-rose-500',
    };
    const rowActiveByLevel: Record<ScoreLevel, string> = {
      good: 'bg-emerald-50/70 font-semibold text-emerald-900',
      moderate: 'bg-amber-50/80 font-semibold text-amber-900',
      bad: 'bg-rose-50/70 font-semibold text-rose-900',
    };
    const calloutBoxByLevel: Record<ScoreLevel, { box: string; icon: string }> = {
      good: { box: 'border-emerald-200/80 bg-emerald-50/80 text-emerald-900', icon: 'text-emerald-500' },
      moderate: { box: 'border-amber-200/80 bg-amber-50/80 text-amber-900', icon: 'text-amber-500' },
      bad: { box: 'border-rose-200/80 bg-rose-50/80 text-rose-900', icon: 'text-rose-500' },
    };
    return {
      callout,
      calloutLevel,
      calloutBox: calloutBoxByLevel[calloutLevel],
      rows: memberCardRecPlan.map((plan) => {
        const level = categoryToLevel(plan.category_adscore);
        return {
          category: plan.category_adscore,
          action: plan.next_action,
          dot: dotByLevel[level],
          active: activeCategory !== null && plan.category_adscore === activeCategory,
          activeClass: rowActiveByLevel[level],
        };
      }),
    };
  }, [memberCardRecPlan, memberCardInfo]);

  /* ── Claim History: transformasi data real member-card-monthly → chart ──
     String bulan upstream diakhiri spasi ('Sep 2024 ') dan tidak terurut —
     dirapikan: trim, urutkan kronologis, tampilkan 'Sep 24'. Bulan tanpa
     klaim tidak ada di upstream dan TIDAK diisi nol (tanpa fabrikasi data). */
  const claimHistoryRows = useMemo(() => {
    if (!memberCardMonthly) return [];
    const MONTH_INDEX: Record<string, number> = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
    };
    const sortKey = (month: string): number => {
      const parts = month.trim().split(' ');
      const m = MONTH_INDEX[(parts[0] ?? '').slice(0, 3).toLowerCase()] ?? 0;
      const y = Number.parseInt(parts[1] ?? '0', 10) || 0;
      return y * 12 + m;
    };
    return memberCardMonthly.data
      .map((row) => {
        const parts = row.month.trim().split(' ');
        const abbr = parts[0] ?? row.month.trim();
        const yearShort = (parts[1] ?? '').slice(-2);
        return {
          month: yearShort ? `${abbr} ${yearShort}` : abbr,
          amount: row.claim_amount,
          claims: row.number_of_claims,
        };
      })
      .sort((a, b) => sortKey(a.month) - sortKey(b.month));
  }, [memberCardMonthly]);

  /* ── Skala sumbu Y dinamis mengikuti data real (pola mockup: 5-6 ticks) ── */
  const claimHistoryScale = useMemo(() => {
    const maxAmount = claimHistoryRows.reduce((m, r) => Math.max(m, r.amount), 0);
    const maxClaims = claimHistoryRows.reduce((m, r) => Math.max(m, r.claims), 0);
    return {
      amount: buildAmountScale(maxAmount),
      claims: buildClaimsScale(maxClaims),
    };
  }, [claimHistoryRows]);

  /* ── Claim Cost Breakdown: transformasi data real member-card-disease →
     donat + daftar. Kategori diurutkan dari nilai terbesar; 'Others' selalu
     di akhir (pola mockup). Warna dari palet mockup. */
  const diseaseBreakdownRows = useMemo(() => {
    if (!memberCardDisease) return [];
    const isOthers = (name: string) => /^others$/i.test(name.trim());
    const sorted = [...memberCardDisease.data].sort((a, b) => b.value - a.value);
    const ordered = [...sorted.filter((row) => !isOthers(row.name)), ...sorted.filter((row) => isOthers(row.name))];
    return ordered.map((row, index) => ({
      name: row.name.trim(),
      percentage: row.persentage,
      value: row.value,
      amount: formatRupiahCompact(row.value),
      color: DISEASE_COLOR_PALETTE[index % DISEASE_COLOR_PALETTE.length]!,
    }));
  }, [memberCardDisease]);

  /* ────────────────────────────────────────────────────────────────
   * Onboarding gate (Modul 1–3) — renders INSTEAD of the dashboard
   * when stage !== 'dashboard'. The dashboard JSX below is untouched.
   * ──────────────────────────────────────────────────────────────── */
  if (stage !== 'dashboard') {
    return (
      <div className="relative min-h-[calc(100vh-5rem)] p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-7xl space-y-5">
          {/* Header (same design language as dashboard banner, compact) */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#3730A3] via-[#4F46E5] to-[#7C3AED] p-6 text-white shadow-lg">
            <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => navigate('/adscore')}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-white backdrop-blur-md transition-all hover:bg-white/25 active:scale-95"
                  title="Kembali ke AdScore Landing"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-bold tracking-tight">AdScore Member</h1>
                    <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold backdrop-blur-sm">
                      Risk & Underwriting
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-indigo-100">
                    {t('adScore.member.subtitle', 'Masukkan data untuk analisis AdScore berdasarkan riwayat transaksi di jaringan AdMedika')}
                  </p>
                </div>
              </div>
              {activeTrackedCount > 0 && stage !== 'processing' && (
                <button
                  type="button"
                  onClick={() => setStage('processing')}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-white/30 bg-white/15 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/25 focus:outline-none focus:ring-2 focus:ring-white/70"
                >
                  <ShieldCheck className="h-4 w-4" />
                  Tracking Verifikasi
                </button>
              )}
            </div>
            <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-purple-400/20 blur-3xl" />
          </div>

          {/* ── Modul 1a: Top Filter Bar (member search) ── */}
          {stage === 'search' || stage === 'empty' ? (
            <>
              {/* Re-entry: antrean verifikasi masih berjalan di latar belakang */}
              {activeTrackedCount > 0 && (
                <div className="mb-4 flex flex-col gap-2 rounded-xl border border-indigo-100 bg-indigo-50/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="flex items-center gap-2 text-sm font-semibold text-indigo-800">
                    <Clock className="h-4 w-4 shrink-0" />
                    {activeTrackedCount} verifikasi sedang diproses di latar belakang
                  </p>
                  <button
                    type="button"
                    onClick={() => setStage('processing')}
                    className="inline-flex items-center justify-center rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs font-semibold text-indigo-700 transition-colors hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  >
                    Lihat tracking
                  </button>
                </div>
              )}
              {/* Re-entry: hasil verifikasi sudah siap namun belum dilihat */}
              {activeTrackedCount === 0 && unviewedResults.length > 0 && (
                <div className="mb-4 flex flex-col gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    {unviewedResults.length} hasil verifikasi siap dilihat
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      handleViewResult(unviewedResults[unviewedResults.length - 1].jobId)
                    }
                    className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  >
                    Lihat hasil verifikasi
                  </button>
                </div>
              )}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <MemberSearchFilterBar
                  filter={searchFilter}
                  onChange={setSearchFilter}
                  onSearch={() => void runSearch(searchFilter)}
                  searching={searching}
                />
              </div>

              {/* ── Modul 1b: Empty State Card ── */}
              {stage === 'empty' && (
                <MemberEmptyState
                  variant={emptyVariant}
                  searchedName={searchFilter.nama}
                  blockedReason={blockedReason}
                  onUploadClick={() => {
                    setUploadDefaultTab('individu');
                    setUploadOpen(true);
                  }}
                  adbriefCheck={adBriefCheck}
                  onAdBriefCheck={() => void runAdBriefCheck()}
                  onTrackingClick={
                    activeTrackedCount > 0 ? () => setStage('processing') : undefined
                  }
                />
              )}
            </>
          ) : null}

          {/* ── Modul 3a: Tracking Unggahan & Consent (hub multi-job) ── */}
          {showProcessingHub && (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
                      Tracking Unggahan & Consent
                    </h2>
                    {activeTrackedCount > 0 && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-500" />
                        {activeTrackedCount} antrean aktif
                      </span>
                    )}
                    {unviewedResults.length > 0 && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                        <CheckCircle2 className="h-3 w-3" />
                        {unviewedResults.length} hasil siap
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    Pantau progres verifikasi tiap unggahan — data & consent diproses bertahap per job.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setUploadDefaultTab('individu');
                      setUploadOpen(true);
                    }}
                    className="inline-flex items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 transition-colors hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  >
                    + Unggahan Baru
                  </button>
                  <button
                    type="button"
                    onClick={() => setStage('search')}
                    className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  >
                    Ke pencarian
                  </button>
                </div>
              </div>

              {/* Banner: hasil verifikasi siap — antrean lain tetap terlihat */}
              {unviewedResults.length > 0 && (
                <div className="mb-4 flex flex-col gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    {unviewedResults.length > 1
                      ? `${unviewedResults.length} verifikasi selesai — hasil siap dilihat`
                      : 'Verifikasi selesai — hasil siap dilihat'}
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      handleViewResult(unviewedResults[unviewedResults.length - 1].jobId)
                    }
                    className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  >
                    Lihat Hasil Verifikasi
                  </button>
                </div>
              )}

              {/* Kartu per job — terbaru di atas, terbuka secara default.
                  Job selesai tampil sebagai kartu "hasil siap" (Lihat Hasil),
                  bukan hilang — antrean aktif & hasil terlihat bersamaan. */}
              <div className="space-y-3">
                {[...trackedJobs].reverse().map((details, idx) => (
                  <TrackingJobCard
                    key={details.jobId}
                    details={details}
                    defaultExpanded={idx === 0}
                    cancelling={cancelling}
                    onCancel={() => handleCancelTracking(details.jobId)}
                    onViewResult={
                      details.job.status === 'completed' && details.job.result
                        ? () => handleViewResult(details.jobId)
                        : undefined
                    }
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── Modul 3b: Verification result (3 variants) ── */}
          {job && job.status === 'completed' && job.result && stage !== 'processing' && (
            <VerificationResult
              job={job}
              onViewAdScore={handleViewAdScore}
              onReupload={() => {
                setUploadDefaultTab(job.result?.kind === 'bulk' ? 'bulk' : 'individu');
                setUploadOpen(true);
              }}
              onBackToSearch={() => {
                setJob(null);
                setStage('search');
              }}
              onConfirmBulk={handleConfirmBulk}
            />
          )}

          {/* ── Modul 2: Upload modal ── */}
          <UploadDataModal
            open={uploadOpen}
            onOpenChange={setUploadOpen}
            defaultTab={uploadDefaultTab}
            onSubmitIndividu={handleUploadIndividu}
            onSubmitBulk={handleUploadBulk}
            submitting={submitting}
          />

          {/* ── Confirm Cancel Queue Modal ── */}
          <ConfirmDialog
            open={cancelDialogOpen}
            onOpenChange={setCancelDialogOpen}
            title={t('verifier.cancelQueuePrompt', 'Batalkan Antrean Verifikasi')}
            description={t('verifier.cancelQueueConfirm', 'Apakah Anda yakin ingin membatalkan antrean verifikasi ini? Data yang telah diunggah tidak akan diproses lebih lanjut.')}
            confirmLabel={t('verifier.cancelQueueSend', 'Ya, Batalkan Antrean')}
            cancelLabel={t('verifier.cancel', 'Batal')}
            variant="danger"
            loading={cancelling}
            onConfirm={handleConfirmCancel}
          />
        </div>
      </div>
    );
  }

  /* ── Dashboard (design untouched) ── */
  return (
    <div className="relative min-h-[calc(100vh-5rem)] p-4 sm:p-6 lg:p-8">
      <UploadDataModal
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        defaultTab={uploadDefaultTab}
        onSubmitIndividu={handleUploadIndividu}
        onSubmitBulk={handleUploadBulk}
        submitting={submitting}
      />
      <div className="mx-auto max-w-7xl">
        {/* ── Top Header Banner with Back Button ── */}
        <div className="relative mb-6 overflow-hidden rounded-2xl bg-gradient-to-r from-[#3730A3] via-[#4F46E5] to-[#7C3AED] p-6 text-white shadow-lg">
          <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => navigate('/adscore')}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-white backdrop-blur-md transition-all hover:bg-white/25 active:scale-95"
                title="Kembali ke AdScore Landing"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold tracking-tight">
                    AdScore Member
                  </h1>
                  <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold backdrop-blur-sm">
                    Risk & Underwriting
                  </span>
                </div>
                <p className="mt-1 text-sm text-indigo-100">
                  {t(
                    'adScore.member.subtitle',
                    'Masukkan data untuk analisis AdScore berdasarkan riwayat transaksi di jaringan AdMedika'
                  )}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setSearchFilter({ nama: '', tglLahir: '', gender: '' });
                  setAdBriefCheck(undefined);
                  setEmptyVariant('no-data');
                  setStage('search');
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/30 bg-white/15 px-3.5 py-2 text-xs font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/25 active:scale-95"
              >
                <Search className="h-3.5 w-3.5" />
                Cari Member Lain
              </button>
              {activeTrackedCount > 0 && (
                <button
                  type="button"
                  onClick={() => setStage('processing')}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/30 bg-white/15 px-3.5 py-2 text-xs font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/25 active:scale-95"
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Tracking Verifikasi
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setUploadDefaultTab('bulk');
                  setUploadOpen(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-xs font-bold text-indigo-700 shadow-md transition-all hover:bg-indigo-50 active:scale-95"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                Upload Member Baru
              </button>
            </div>
          </div>

          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-purple-400/20 blur-3xl" />
        </div>


        {/* ── Mockup-Inspired Member Risk Scoring Dashboard ── */}
        <div className="mt-6 space-y-4">
          {/* ── Main 2-Column Dashboard Grid ── */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            {/* ── LEFT COLUMN (Member Profile & Claim Summary) ── */}
            <div className="flex flex-col gap-4 lg:col-span-4">
              {/* Member Profile Card */}
              <div className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
                <div>
                  {/* Card Header */}
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-slate-600" />
                    <h3 className="font-bold text-slate-800 text-sm">
                      Member Profile
                    </h3>
                  </div>

                  {memberCardInfoStatus === 'loading' && (
                    /* Skeleton — sedang memeriksa AdBrief, tanpa data simulasi */
                    <div className="mt-5 animate-pulse text-center">
                      <div className="mx-auto h-20 w-20 rounded-full bg-slate-100" />
                      <div className="mx-auto mt-3 h-5 w-44 rounded-full bg-slate-100" />
                      <div className="mx-auto mt-6 h-28 w-56 rounded-2xl bg-slate-50" />
                      <div className="mx-auto mt-3 h-3 w-32 rounded-full bg-slate-100" />
                    </div>
                  )}

                  {memberCardInfoStatus === 'notfound' && (
                    /* Member tidak terdaftar di AdBrief — state kosong profesional.
                       Tidak ada skor/gauge simulasi: hanya data real dari service API. */
                    <div className="mt-5 text-center">
                      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 shadow-inner">
                        <UserX className="h-10 w-10 text-slate-400" />
                      </div>
                      <h4 className="mt-3 text-lg font-bold text-slate-900 tracking-tight">
                        {memberCardInfo?.member_name || submittedName}
                      </h4>
                      <p className="text-xs font-medium text-slate-500">
                        Lahir: {birthDate}
                      </p>
                      <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-left">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                          <div>
                            <p className="text-xs font-bold text-amber-800">
                              Member tidak ditemukan di AdBrief
                            </p>
                            <p className="mt-1 text-[11px] leading-relaxed text-amber-700">
                              Profil risiko AdScore hanya tersedia untuk member yang terdaftar
                              pada layanan AdBrief. Periksa kembali nama, tanggal lahir, dan
                              jenis kelamin, atau daftarkan member terlebih dahulu melalui
                              alur onboarding.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {memberCardInfoStatus === 'error' && (
                    /* Layanan gagal dihubungi — state error profesional + opsi coba ulang */
                    <div className="mt-5 text-center">
                      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-rose-50 shadow-inner">
                        <AlertTriangle className="h-10 w-10 text-rose-400" />
                      </div>
                      <h4 className="mt-3 text-lg font-bold text-slate-900 tracking-tight">
                        {memberCardInfo?.member_name || submittedName}
                      </h4>
                      <p className="text-xs font-medium text-slate-500">
                        Lahir: {birthDate}
                      </p>
                      <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-left">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                          <div>
                            <p className="text-xs font-bold text-rose-800">
                              Layanan profil AdBrief tidak tersedia
                            </p>
                            <p className="mt-1 text-[11px] leading-relaxed text-rose-700">
                              Terjadi gangguan saat memeriksa profil member. Tidak ada data
                              simulasi yang ditampilkan — profil akan tampil otomatis setelah
                              layanan kembali normal.
                            </p>
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void loadMemberCardInfo(memberName, birthDate, gender)}
                        className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-rose-700 transition-colors hover:bg-rose-50"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Coba Periksa Ulang
                      </button>
                    </div>
                  )}

                  {memberCardInfo && memberRiskView && memberCardInfoStatus === 'found' && (
                    <>
                      {/* Avatar & Identification — nama & umur real dari member-card-info */}
                      <div className="mt-5 text-center">
                        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 text-slate-400 shadow-inner">
                          <User className="h-10 w-10 text-slate-400" />
                        </div>
                        <h4 className="mt-3 text-lg font-bold text-slate-900 tracking-tight">
                          {memberCardInfo.member_name}
                        </h4>
                        <p className="text-xs font-medium text-slate-500">
                          {`Age ${memberCardInfo.age}`}
                        </p>
                      </div>

                      {/* Semicircular Gauge (180 degree gauge arc) — skor & skala real */}
                      <div className="relative mx-auto mt-6 mb-2 flex h-36 w-60 items-end justify-center overflow-hidden">
                        <svg viewBox="0 0 200 115" className="h-full w-full">
                          {/* Background Track */}
                          <path
                            d="M 25 100 A 75 75 0 0 1 175 100"
                            fill="none"
                            stroke="#E2E8F0"
                            strokeWidth="14"
                            strokeLinecap="round"
                          />
                          {/* Active Progress Arc */}
                          <path
                            d="M 25 100 A 75 75 0 0 1 175 100"
                            fill="none"
                            stroke={memberRiskView.color}
                            strokeWidth="14"
                            strokeLinecap="round"
                            strokeDasharray="235.62"
                            strokeDashoffset={
                              235.62 * (1 - Math.min(Math.max(memberRiskView.score, 0), gaugeMax) / gaugeMax)
                            }
                            className="transition-all duration-1000 ease-out"
                          />
                        </svg>

                        {/* Centered Score Inside Arc */}
                        <div className="absolute inset-x-0 bottom-1 flex flex-col items-center justify-center text-center">
                          <span
                            style={{ color: memberRiskView.color }}
                            className="text-5xl font-extrabold tracking-tight leading-none"
                          >
                            {memberRiskView.score}
                          </span>
                          <span
                            style={{ color: memberRiskView.color }}
                            className="mt-1 text-sm font-bold tracking-tight"
                          >
                            {memberRiskView.label}
                          </span>
                          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">
                            RISK SCORE
                          </span>
                        </div>
                      </div>
                    </>
                  )}

                  {memberCardInfoStatus === 'idle' && (
                    /* Belum ada pemeriksaan — tanpa skor/gauge simulasi */
                    <div className="mt-5 text-center">
                      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 text-slate-400 shadow-inner">
                        <User className="h-10 w-10 text-slate-400" />
                      </div>
                      <h4 className="mt-3 text-lg font-bold text-slate-900 tracking-tight">
                        {submittedName || 'Member belum diperiksa'}
                      </h4>
                      <p className="text-xs font-medium text-slate-500">
                        {birthDate ? `Lahir: ${birthDate}` : 'Profil belum diperiksa ke AdBrief'}
                      </p>
                    </div>
                  )}
                </div>

                <div className="mt-4 space-y-2 pt-4 border-t border-slate-100 text-center">
                  {memberCardInfoStatus === 'loading' && (
                    <p className="text-[11px] font-medium text-indigo-600">
                      Memeriksa data AdBrief…
                    </p>
                  )}
                  {memberCardInfoStatus === 'error' && (
                    <p className="text-[11px] font-medium text-rose-600">
                      Profil gagal diperiksa — layanan AdBrief tidak dapat dihubungi.
                    </p>
                  )}
                  <p className="text-[11px] text-slate-400">
                    {memberCardInfo
                      ? `Sumber: AdBrief member-card-info • Skala 1–${gaugeMax}`
                      : 'Sumber: AdBrief member-card-info (server proxy)'}
                  </p>
                </div>
              </div>

              {/* Claim Summary Card */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                    <FileSpreadsheet className="h-4 w-4" />
                  </div>
                  <h3 className="font-bold text-slate-800 text-sm">Claim Summary</h3>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {memberCardClaimsStatus === 'loading' && (
                    /* Skeleton — sedang memeriksa AdBrief, tanpa angka dummy */
                    <>
                      <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
                      <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
                      <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
                    </>
                  )}

                  {memberCardClaimsStatus === 'notfound' && (
                    /* Member tidak terdaftar di AdBrief — state kosong profesional,
                       tanpa angka dummy (hanya data real dari service API). */
                    <div className="col-span-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                        <div>
                          <p className="text-xs font-bold text-amber-800">
                            Belum ada data klaim
                          </p>
                          <p className="mt-1 text-[11px] leading-relaxed text-amber-700">
                            Member belum terdaftar pada layanan AdBrief, sehingga ringkasan
                            klaim tidak tersedia.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {memberCardClaimsStatus === 'error' && (
                    /* Layanan gagal dihubungi — state error profesional + coba ulang */
                    <div className="col-span-3 rounded-xl border border-rose-200 bg-rose-50 p-3">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                        <div>
                          <p className="text-xs font-bold text-rose-800">
                            Layanan ringkasan klaim tidak tersedia
                          </p>
                          <p className="mt-1 text-[11px] leading-relaxed text-rose-700">
                            Terjadi gangguan saat memeriksa data klaim. Tidak ada angka
                            simulasi yang ditampilkan.
                          </p>
                          <button
                            type="button"
                            onClick={() => void loadMemberCardInfo(memberName, birthDate, gender)}
                            className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-rose-700 transition-colors hover:bg-rose-50"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                            Coba Periksa Ulang
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {memberCardClaims && memberCardClaimsStatus === 'found' && (
                    <>
                      <div className="flex flex-col">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50 text-slate-600 mb-2">
                          <FileText className="h-4 w-4 text-blue-600" />
                        </div>
                        <span className="text-lg font-black text-slate-900 leading-tight">
                          {memberCardClaims?.total_claims ?? 0}
                        </span>
                        <span className="text-[11px] font-medium text-slate-400 mt-0.5">
                          Total Claims
                        </span>
                      </div>

                      <div className="flex flex-col border-l border-slate-100 pl-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50 text-slate-600 mb-2">
                          <Coins className="h-4 w-4 text-blue-600" />
                        </div>
                        <span className="text-lg font-black text-slate-900 leading-tight">
                          {formatRupiahCompact(memberCardClaims?.avg_claim_cost ?? 0)}
                        </span>
                        <span className="text-[11px] font-medium text-slate-400 mt-0.5">
                          Avg Claim Cost
                        </span>
                      </div>

                      <div className="flex flex-col border-l border-slate-100 pl-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50 text-slate-600 mb-2">
                          <CalendarDays className="h-4 w-4 text-blue-600" />
                        </div>
                        <span className="text-xs font-bold text-slate-900 leading-tight pt-1">
                          Last 24 Months
                        </span>
                        <span className="text-[11px] font-medium text-slate-400 mt-1">
                          Observation Period
                        </span>
                      </div>
                    </>
                  )}
                </div>

                {memberCardClaimsStatus === 'loading' && (
                  <p className="mt-3 border-t border-slate-100 pt-2 text-[10px] text-indigo-600">
                    Memeriksa data klaim AdBrief…
                  </p>
                )}
                {memberCardClaims && memberCardClaimsStatus === 'found' && (
                  <p className="mt-3 border-t border-slate-100 pt-2 text-[10px] text-slate-400">
                    Sumber: AdBrief member-card-claims
                  </p>
                )}
              </div>
            </div>

            {/* ── RIGHT COLUMN (Claim History, Breakdown, Insights, Next Action) ── */}
            <div className="flex flex-col gap-4 lg:col-span-8">
              {/* Claim History Card (Combo Bar + Line Chart) */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                      <Activity className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                        Claim History
                      </h3>
                      <p className="text-xs text-slate-400">
                        Total Claim Amount (IDR) & Number of Claims
                        {claimHistoryRows.length > 0 &&
                          ` · ${claimHistoryRows[0].month} – ${claimHistoryRows[claimHistoryRows.length - 1].month}`}
                      </p>
                    </div>
                  </div>

                  {/* Chart Legend */}
                  <div className="flex items-center gap-4 text-xs font-medium text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-sm bg-[#60A5FA]" />
                      <span>Total Claim Amount (IDR)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="flex items-center justify-center">
                        <span className="h-0.5 w-3 bg-[#1E3A8A]" />
                        <span className="h-2 w-2 rounded-full bg-[#1E3A8A] -ml-2.5" />
                      </span>
                      <span className="ml-1">Number of Claims</span>
                    </div>
                  </div>
                </div>

                {memberCardMonthlyStatus === 'loading' && (
                  /* Skeleton — sedang memeriksa AdBrief, tanpa grafik dummy */
                  <div className="h-60 w-full animate-pulse rounded-xl bg-slate-100" />
                )}

                {memberCardMonthlyStatus === 'notfound' && (
                  /* Member tidak terdaftar di AdBrief — state kosong profesional,
                     tanpa grafik data simulasi (hanya data real dari service API). */
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                      <div>
                        <p className="text-xs font-bold text-amber-800">
                          Belum ada riwayat klaim
                        </p>
                        <p className="mt-1 text-[11px] leading-relaxed text-amber-700">
                          Member belum terdaftar pada layanan AdBrief, sehingga riwayat
                          klaim bulanan tidak tersedia.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {memberCardMonthlyStatus === 'error' && (
                  /* Layanan gagal dihubungi — state error profesional + coba ulang */
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                      <div>
                        <p className="text-xs font-bold text-rose-800">
                          Layanan riwayat klaim tidak tersedia
                        </p>
                        <p className="mt-1 text-[11px] leading-relaxed text-rose-700">
                          Terjadi gangguan saat memeriksa riwayat klaim. Tidak ada grafik
                          simulasi yang ditampilkan.
                        </p>
                        <button
                          type="button"
                          onClick={() => void loadMemberCardInfo(memberName, birthDate, gender)}
                          className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-rose-700 transition-colors hover:bg-rose-50"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          Coba Periksa Ulang
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {memberCardMonthly && memberCardMonthlyStatus === 'found' && (
                  /* Composed Chart — data real member-card-monthly, skala Y dinamis */
                  <div className="h-60 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart
                        data={claimHistoryRows}
                        margin={{ top: 15, right: 15, left: -10, bottom: 20 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                        <XAxis
                          dataKey="month"
                          tickLine={false}
                          axisLine={{ stroke: '#E2E8F0' }}
                          interval={0}
                          tick={<RenderCustomAxisTick />}
                        />
                        <YAxis
                          yAxisId="left"
                          domain={claimHistoryScale.amount.domain}
                          ticks={claimHistoryScale.amount.ticks}
                          tickFormatter={formatAmountTick}
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 10, fill: '#64748B' }}
                        />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          domain={claimHistoryScale.claims.domain}
                          ticks={claimHistoryScale.claims.ticks}
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 10, fill: '#64748B' }}
                        />
                        <Tooltip content={<CustomHistoryTooltip />} />
                        <Bar
                          yAxisId="left"
                          dataKey="amount"
                          name="Total Claim Amount (IDR)"
                          fill="#60A5FA"
                          radius={[3, 3, 0, 0]}
                          barSize={12}
                        />
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="claims"
                          name="Number of Claims"
                          stroke="#1E3A8A"
                          strokeWidth={2}
                          dot={{ r: 3, fill: '#1E3A8A', strokeWidth: 0 }}
                          activeDot={{ r: 5, fill: '#1E3A8A' }}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {memberCardMonthlyStatus === 'loading' && (
                  <p className="mt-3 border-t border-slate-100 pt-2 text-[10px] text-indigo-600">
                    Memeriksa riwayat klaim AdBrief…
                  </p>
                )}
                {memberCardMonthly && memberCardMonthlyStatus === 'found' && (
                  <p className="mt-3 border-t border-slate-100 pt-2 text-[10px] text-slate-400">
                    Sumber: AdBrief member-card-monthly • {claimHistoryRows.length} bulan dengan klaim
                  </p>
                )}
              </div>

              {/* Claim Cost Breakdown Card (Donut Chart + List) */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                    <Clock className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                      Claim Cost Breakdown
                    </h3>
                    <p className="text-xs text-slate-400">
                      Total Billing Amount by Diagnosis Category (Last 24 Months)
                    </p>
                  </div>
                </div>

                {memberCardDiseaseStatus === 'loading' && (
                  /* Skeleton — sedang memeriksa AdBrief, tanpa donat dummy */
                  <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
                    <div className="h-48 w-48 shrink-0 animate-pulse rounded-full bg-slate-100" />
                    <div className="flex-1 space-y-3">
                      {[0, 1, 2].map((i) => (
                        <div key={i} className="h-3.5 w-full animate-pulse rounded bg-slate-100" />
                      ))}
                    </div>
                  </div>
                )}

                {memberCardDiseaseStatus === 'notfound' && (
                  /* Member tidak terdaftar di AdBrief — state kosong profesional,
                     tanpa donat data simulasi (hanya data real dari service API). */
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                      <div>
                        <p className="text-xs font-bold text-amber-800">
                          Belum ada data breakdown
                        </p>
                        <p className="mt-1 text-[11px] leading-relaxed text-amber-700">
                          Member belum terdaftar pada layanan AdBrief, sehingga breakdown
                          biaya klaim per kategori diagnosis tidak tersedia.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {memberCardDiseaseStatus === 'error' && (
                  /* Layanan gagal dihubungi — state error profesional + coba ulang */
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                      <div>
                        <p className="text-xs font-bold text-rose-800">
                          Layanan breakdown diagnosis tidak tersedia
                        </p>
                        <p className="mt-1 text-[11px] leading-relaxed text-rose-700">
                          Terjadi gangguan saat memeriksa breakdown biaya klaim. Tidak ada
                          donat simulasi yang ditampilkan.
                        </p>
                        <button
                          type="button"
                          onClick={() => void loadMemberCardInfo(memberName, birthDate, gender)}
                          className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-rose-700 transition-colors hover:bg-rose-50"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          Coba Periksa Ulang
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {memberCardDisease && memberCardDiseaseStatus === 'found' && (
                  <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
                    {/* Donut Chart with Center Text */}
                    <div className="relative mx-auto flex h-48 w-48 shrink-0 items-center justify-center sm:mx-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={diseaseBreakdownRows}
                            cx="50%"
                            cy="50%"
                            innerRadius={52}
                            outerRadius={76}
                            paddingAngle={2}
                            dataKey="value"
                            nameKey="name"
                          >
                            {diseaseBreakdownRows.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(val: unknown, name: unknown, entry: unknown) => {
                              const payload = (entry as { payload?: { amount?: string; percentage?: number } } | undefined)?.payload;
                              return [`${payload?.amount ?? String(val)} (${payload?.percentage ?? 0}%)`, String(name)];
                            }}
                            contentStyle={{
                              backgroundColor: '#ffffff',
                              borderRadius: '8px',
                              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                              border: '1px solid #e2e8f0',
                              fontSize: '12px',
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                        <span className="text-[11px] font-medium text-slate-500">Total Billing</span>
                        <span className="text-sm font-bold text-slate-900">
                          {formatRupiahCompact(memberCardDisease.total_bill)}
                        </span>
                      </div>
                    </div>

                    {/* Category Breakdown List */}
                    <div className="flex-1 space-y-3">
                      {diseaseBreakdownRows.map((item) => (
                        <div key={item.name} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2.5">
                            <span
                              className="h-3 w-3 rounded-full shrink-0"
                              style={{ backgroundColor: item.color }}
                            />
                            <span className="font-semibold text-slate-700">{item.name}</span>
                          </div>
                          <div className="flex items-center gap-6 font-mono">
                            <span className="font-bold text-slate-600">
                              {item.percentage.toLocaleString('id-ID', { maximumFractionDigits: 2 })}%
                            </span>
                            <span className="font-semibold text-slate-800 min-w-[75px] text-right">
                              {item.amount}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {memberCardDiseaseStatus === 'loading' && (
                  <p className="mt-3 border-t border-slate-100 pt-2 text-[10px] text-indigo-600">
                    Memeriksa breakdown diagnosis AdBrief…
                  </p>
                )}
                {memberCardDisease && memberCardDiseaseStatus === 'found' && (
                  <p className="mt-3 border-t border-slate-100 pt-2 text-[10px] text-slate-400">
                    Sumber: AdBrief member-card-disease • {diseaseBreakdownRows.length} kategori diagnosis
                  </p>
                )}
              </div>

              {/* Bottom 2 Cards: Risk Insights & Next Action */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Risk Insights Card */}
                <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <Search className="h-5 w-5 text-indigo-600" />
                    <h3 className="font-bold text-slate-800 text-sm">Risk Insights</h3>
                  </div>
                  <p className="text-xs text-slate-400 mb-4">Top 3 Risk Contributors</p>

                  {memberCardInsightsStatus === 'loading' && (
                    <div className="space-y-3.5" aria-label="Memuat risk insights">
                      {[0, 1, 2].map((i) => (
                        <div key={i} className="flex items-start gap-3">
                          <span className="h-5 w-5 shrink-0 animate-pulse rounded-full bg-slate-200" />
                          <div className="flex-1 space-y-1.5 pt-0.5">
                            <div className="h-3 w-3/4 animate-pulse rounded bg-slate-200" />
                            <div className="h-2.5 w-full animate-pulse rounded bg-slate-100" />
                          </div>
                        </div>
                      ))}
                      <p className="text-[10px] text-indigo-600">Memeriksa insight risiko AdBrief…</p>
                    </div>
                  )}

                  {memberCardInsightsStatus === 'notfound' && (
                    <div className="flex items-start gap-3 rounded-xl border border-amber-200/80 bg-amber-50/80 p-3">
                      <UserX className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
                      <div>
                        <h4 className="text-xs font-bold text-amber-900">Belum ada insight risiko</h4>
                        <p className="text-[11px] text-amber-800/90 leading-relaxed mt-0.5">
                          Member belum terdaftar di AdBrief, sehingga kontributor risiko belum dapat dihitung.
                        </p>
                      </div>
                    </div>
                  )}

                  {memberCardInsightsStatus === 'error' && (
                    <div className="flex items-start gap-3 rounded-xl border border-rose-200/80 bg-rose-50/80 p-3">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="text-xs font-bold text-rose-900">Layanan insight risiko tidak tersedia</h4>
                        <p className="text-[11px] text-rose-800/90 leading-relaxed mt-0.5">
                          Terjadi gangguan saat mengambil data dari AdBrief.
                        </p>
                        <button
                          type="button"
                          onClick={() => void loadMemberCardInfo(memberName, birthDate, gender)}
                          className="mt-2 rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-rose-700 transition hover:bg-rose-50"
                        >
                          Coba Periksa Ulang
                        </button>
                      </div>
                    </div>
                  )}

                  {riskContributors.length > 0 && (
                    <div className="space-y-3.5">
                      {riskContributors.map((item, idx) => (
                        <div key={idx} className="flex items-start gap-3">
                          <span
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white shadow-sm ${item.badgeColor}`}
                          >
                            {idx + 1}
                          </span>
                          <div>
                            <h4 className="text-xs font-bold text-slate-800 leading-snug">
                              {item.title}
                            </h4>
                            <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">
                              {item.desc}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Next Action Card */}
                <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <Compass className="h-5 w-5 text-indigo-600" />
                    <h3 className="font-bold text-slate-800 text-sm">Next Action</h3>
                  </div>

                  {memberCardRecPlanStatus === 'loading' && (
                    <div className="animate-pulse space-y-3" aria-busy="true">
                      <div className="h-16 rounded-xl bg-slate-100" />
                      <div className="h-24 rounded-xl bg-slate-100" />
                      <p className="text-[10px] text-indigo-600">Memeriksa rekomendasi tindak lanjut AdBrief…</p>
                    </div>
                  )}

                  {memberCardRecPlanStatus === 'notfound' && (
                    <div className="flex items-start gap-3 rounded-xl border border-amber-200/80 bg-amber-50/80 p-3 text-amber-900">
                      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                      <div>
                        <h4 className="text-xs font-bold">Belum ada rekomendasi tindak lanjut</h4>
                        <p className="mt-0.5 text-[11px] opacity-90">
                          Member belum terdaftar di AdBrief, sehingga belum ada rencana
                          aksi. Daftarkan via onboarding untuk memperoleh rekomendasi.
                        </p>
                      </div>
                    </div>
                  )}

                  {memberCardRecPlanStatus === 'error' && (
                    <div className="flex items-start gap-3 rounded-xl border border-rose-200/80 bg-rose-50/80 p-3 text-rose-900">
                      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" />
                      <div>
                        <h4 className="text-xs font-bold">Layanan rekomendasi tindak lanjut tidak tersedia</h4>
                        <p className="mt-0.5 text-[11px] opacity-90">
                          Coba periksa kembali beberapa saat lagi.
                        </p>
                        <button
                          type="button"
                          onClick={() => void loadMemberCardInfo(memberName, birthDate, gender)}
                          className="mt-2 rounded-lg border border-rose-300 bg-white px-3 py-1 text-[11px] font-semibold text-rose-700 transition-colors hover:bg-rose-100"
                        >
                          Coba Periksa Ulang
                        </button>
                      </div>
                    </div>
                  )}

                  {nextActionView && memberCardRecPlanStatus === 'found' && (
                    <>
                      {/* Callout box — kategori & tindak lanjut real dari upstream */}
                      <div
                        className={`mb-4 flex items-start gap-3 rounded-xl border p-3 ${nextActionView.calloutBox.box}`}
                      >
                        <AlertTriangle
                          className={`mt-0.5 h-5 w-5 shrink-0 ${nextActionView.calloutBox.icon}`}
                        />
                        <div>
                          <h4 className="text-xs font-bold">{nextActionView.callout.next_action}</h4>
                          <p className="mt-0.5 text-[11px] opacity-90">
                            Based on {nextActionView.callout.category_adscore} classification.
                          </p>
                        </div>
                      </div>

                      {/* Action Table — baris real dari member-card-rec-plan */}
                      <div className="overflow-hidden rounded-xl border border-slate-200/70 text-xs">
                        <div className="grid grid-cols-12 border-b border-slate-200/70 bg-slate-50/80 px-3 py-2 font-semibold text-slate-500">
                          <div className="col-span-5">Risk Category</div>
                          <div className="col-span-7">Next Action</div>
                        </div>
                        <div className="divide-y divide-slate-100">
                          {nextActionView.rows.map((row) => (
                            <div
                              key={`${row.category}-${row.action}`}
                              className={`grid grid-cols-12 items-center px-3 py-2 transition-colors ${row.active ? row.activeClass : 'hover:bg-slate-50/50'}`}
                            >
                              <div className="col-span-5 flex items-center gap-2">
                                <span className={`h-2 w-2 rounded-full ${row.dot}`} />
                                <span className="font-medium text-slate-700">{row.category}</span>
                              </div>
                              <div className="col-span-7 text-slate-600">{row.action}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <p className="mt-3 border-t border-slate-100 pt-2 text-[10px] text-slate-400">
                        Sumber: AdBrief member-card-rec-plan • {nextActionView.rows.length} kategori
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
