/**
 * VerifierJobDetailPage — Process & Match + Verifikasi Keanggotaan & Consent.
 *
 * Individu mode: submitted identity + multi-file consent checklist (gating)
 * + matching candidates (exact/fuzzy) with approve / not-found / request-fix.
 * Bulk mode: row-by-row resolution table with per-row candidate overrides.
 */
import { Fragment, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, FileText, Image as ImageIcon, Info, X, XCircle } from 'lucide-react';
import { useAuth } from '@/entities/auth';
import { cn } from '@/shared/lib/utils';
import {
  bulkSummary,
  checkConsent,
  claimJob,
  getJob,
  getConsentFile,
  rejectJob,
  requestFix,
  resolveMatch,
  setRowConsent,
  subscribeQueue,
  unclaimJob,
  verifyJob,
} from '../lib/verifierApi';
import { formatAge, type BulkRowResolution, type ConsentFileRef, type VerifierJob, type VerifierJobStatus } from '../model/verifierTypes';

function consentIcon(name: string) {
  return name.endsWith('.pdf') ? FileText : ImageIcon;
}

/* ─── Flow helpers — status/outcome chips + mini stepper + read-only bar ─── */

/** Chip color per queue status (mirrors VerifierQueuePage STATUS_BADGE). */
const STATUS_CHIP: Record<VerifierJobStatus, string> = {
  submitted: 'border-blue-200 bg-blue-50 text-blue-700',
  on_progress: 'border-amber-200 bg-amber-50 text-amber-700',
  verified: 'border-red-200 bg-red-50 text-red-700',
  completed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  cancelled: 'border-rose-200 bg-rose-50 text-rose-700',
};

/** Style of the active stepper stage, indexed like FLOW_STAGES. */
const STAGE_ACTIVE = [
  'bg-blue-50 text-blue-700 ring-blue-200',
  'bg-amber-50 text-amber-700 ring-amber-200',
  'bg-red-50 text-red-700 ring-red-200',
  'bg-emerald-50 text-emerald-700 ring-emerald-200',
];

const FLOW_STAGES = ['stageSubmitted', 'stageProcessing', 'stageDecision', 'stageDone'] as const;

const FIX_CAT_KEY: Record<string, string> = {
  consent: 'verifier.fixCatConsent',
  incomplete: 'verifier.fixCatIncomplete',
  'name-mismatch': 'verifier.fixCatNameMismatch',
  duplicate: 'verifier.fixCatDuplicate',
};

function statusChipLabel(status: VerifierJobStatus, t: (k: string, o?: Record<string, unknown>) => string): string {
  if (status === 'submitted') return t('verifier.statusSubmitted');
  if (status === 'on_progress') return t('verifier.statusOnProgress');
  if (status === 'verified') return t('verifier.statusNeedsAction');
  if (status === 'completed') return t('verifier.statusCompleted');
  return t('verifier.statusCancelled');
}

/** Text of the outcome chip for a decided job (verified = sent back, completed = success). */
function outcomeChipText(job: VerifierJob, t: (k: string, o?: Record<string, unknown>) => string): string {
  if (job.status === 'verified') {
    if (job.fixCategory) {
      const catKey = FIX_CAT_KEY[job.fixCategory];
      return `↩ ${t('verifier.outcomeRequestFix', { category: catKey ? t(catKey) : job.fixCategory })}`;
    }
    if (job.rejectionReason) return `↩ ${t('verifier.outcomeNotFound')}`;
    return `↩ ${job.outcome ?? ''}`;
  }
  if (job.status === 'completed') {
    if (job.mode === 'individu' && job.pickedMemberId) return `✓ Verified → ${job.pickedMemberId}`;
    return `✓ ${job.outcome ?? ''}`;
  }
  return '';
}

/** 4-stage mini stepper under the job title (hidden for cancelled jobs). */
function FlowStepper({ status, t }: { status: VerifierJobStatus; t: (k: string) => string }) {
  if (status === 'cancelled') return null;
  const activeIdx = status === 'submitted' ? 0 : status === 'on_progress' ? 1 : status === 'verified' ? 2 : 3;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[10px] font-semibold">
      {FLOW_STAGES.map((key, i) => {
        const done = i < activeIdx;
        const active = i === activeIdx;
        return (
          <Fragment key={key}>
            {i > 0 && <span className="text-slate-300">—</span>}
            <span
              className={cn(
                'flex items-center gap-1',
                done && 'text-emerald-600',
                active && `rounded-full px-2 py-0.5 ring-1 ${STAGE_ACTIVE[activeIdx]}`,
                !done && !active && 'text-slate-400',
              )}
            >
              <span aria-hidden="true">{done ? '✓' : active ? '●' : '○'}</span>
              {t(`verifier.${key}`)}
            </span>
          </Fragment>
        );
      })}
    </div>
  );
}

export default function VerifierJobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const me = user?.username ?? '';
  const [job, setJob] = useState<VerifierJob | undefined>(() => (jobId ? getJob(jobId) : undefined));
  const [now, setNow] = useState(() => Date.now());
  const [fixOpen, setFixOpen] = useState(false);
  const [fixCategory, setFixCategory] = useState('');
  const [fixNote, setFixNote] = useState('');
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [previewFile, setPreviewFile] = useState<{ name: string; url: string; type: string } | null>(null);
  /** Row currently being consent-verified (bulk mode) — opens RowConsentModal. */
  const [consentRow, setConsentRow] = useState<BulkRowResolution | null>(null);
  const [toast, setToast] = useState('');
  /** True while a mutation is in flight — locks the action bar against double actions. */
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!jobId) return;
    return subscribeQueue((jobs) => setJob(jobs.find((j) => j.id === jobId)));
  }, [jobId]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => () => {
    if (previewFile) URL.revokeObjectURL(previewFile.url);
  }, [previewFile]);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(''), 3500);
  };

  /** Async mutation wrapper — surfaces backend errors (409 claim conflict, 422 gating) as toast. */
  const run = (op: Promise<VerifierJob | undefined>, okMsg?: string, onOk?: () => void) => {
    op
      .then((updated) => {
        if (!updated) {
          showToast(`⚠ ${t('verifier.updateFailed')}`);
          return;
        }
        if (okMsg) showToast(okMsg);
        onOk?.();
      })
      .catch((e: Error) => showToast(`⚠ ${e.message}`));
  };

  /** Terminal decisions (verify / request-fix / reject) — the action bar stays
   *  locked until navigation so the redirect window can't be double-actioned. */
  const runAndLeave = (op: Promise<VerifierJob | undefined>, okMsg: string) => {
    setBusy(true);
    op
      .then((updated) => {
        if (!updated) {
          setBusy(false);
          showToast(`⚠ ${t('verifier.updateFailed')}`);
          return;
        }
        showToast(okMsg);
        window.setTimeout(() => navigate('/verifikasi'), 1200);
      })
      .catch((e: Error) => {
        setBusy(false);
        showToast(`⚠ ${e.message}`);
      });
  };

  const allConsentChecked = !!job && job.consentFiles.length > 0 && job.consentChecked.length === job.consentFiles.length;
  // Fase 3: job aliran baru (adbriefFound) tidak wajib pick kandidat —
  // consent checklist jadi satu-satunya gate approve.
  const individuReady = !!job && job.mode === 'individu' && (!!job.pickedMemberId || !!job.adbriefFound) && allConsentChecked;
  const bulkResolved = job?.rows ? job.rows.every((r) => r.state !== 'unresolved') : false;
  // Strict per-member consent: every row that will be onboarded (auto/manual)
  // must have an explicit 'match' verdict on its consent document.
  const bulkConsentOk = job?.rows
    ? job.rows.every((r) => (r.state === 'auto' || r.state === 'manual' ? r.consent?.state === 'match' : true))
    : false;
  const bulkReady = !!job && job.mode === 'bulk' && bulkResolved && bulkConsentOk;
  const bulk = useMemo(() => (job?.rows ? bulkSummary(job.rows) : null), [job]);
  const unresolvedCount = job?.rows?.filter((r) => r.state === 'unresolved').length ?? 0;
  const mismatchCount = job?.rows?.filter((r) => r.consent?.state === 'mismatch').length ?? 0;
  const consentPendingCount = bulk?.consentPending ?? 0;

  const openConsentPreview = async (file: ConsentFileRef) => {
    try {
      const content = await getConsentFile(jobId ?? '', file.id);
      setPreviewFile({ name: file.name, url: URL.createObjectURL(content), type: file.type });
    } catch (error) {
      showToast(`⚠ ${error instanceof Error ? error.message : t('verifier.previewFailed')}`);
    }
  };

  if (!job) {
    return (
      <div className="mx-auto max-w-[1000px] py-16 text-center">
        <p className="text-sm text-[#64748B]">{t('verifier.notFoundJob')}</p>
        <Link to="/verifikasi" className="mt-3 inline-block text-sm font-semibold text-[#2862E4] hover:underline">
          ← {t('verifier.backToQueue')}
        </Link>
      </div>
    );
  }

  /** Server hanya menerima mutasi verifikator saat job masih submitted/on_progress. */
  const actionable = job.status === 'submitted' || job.status === 'on_progress';

  /* ─── Individu render ─── */
  if (job.mode === 'individu') {
    const canApprove = individuReady && job.status === 'on_progress';
    const approveHint = job.adbriefFound
      ? t('verifier.gateHintAdbrief', { done: job.consentChecked.length, total: job.consentFiles.length })
      : job.pickedMemberId
        ? t('verifier.gateHintLegacyPicked', { done: job.consentChecked.length, total: job.consentFiles.length })
        : t('verifier.gateHintLegacy', { done: job.consentChecked.length, total: job.consentFiles.length });
    return (
      <div className="mx-auto max-w-[1240px] pb-24">
        <Breadcrumb jobId={job.id} t={t} />
        <JobHeader
          job={job}
          t={t}
          now={now}
          me={me}
          onClaim={() => run(claimJob(job.id), t('verifier.claimSuccess', { jobId: job.id }))}
          onUnclaim={() => run(unclaimJob(job.id), t('verifier.unclaimSuccess'))}
        />

        {job.status === 'cancelled' && (
          <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50/90 p-4 text-rose-900 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-bold text-rose-700">
              <XCircle className="h-5 w-5" />
              {t('verifier.jobCancelledBanner')}
            </div>
            <p className="mt-1 text-xs text-rose-800">
              {job.outcome || t('verifier.jobCancelledDesc')}
            </p>
          </div>
        )}

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          {/* Left — submitted data + consent */}
          <div className="space-y-5">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-[#64748B]">{t('verifier.submittedData')}</h2>
              <dl className="grid grid-cols-3 gap-3 text-sm">
                <div className="rounded-xl bg-[#F8FAFC] p-3">
                  <dt className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">{t('verifier.fullName')}</dt>
                  <dd className="mt-1 font-semibold text-[#1E293B]">{job.identity?.nama}</dd>
                </div>
                <div className="rounded-xl bg-[#F8FAFC] p-3">
                  <dt className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">{t('verifier.birthDate')}</dt>
                  <dd className="mt-1 font-semibold text-[#1E293B]">{job.identity?.tglLahir}</dd>
                </div>
                <div className="rounded-xl bg-[#F8FAFC] p-3">
                  <dt className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">{t('verifier.gender')}</dt>
                  <dd className="mt-1 font-semibold text-[#1E293B]">{job.identity?.gender === 'M' ? t('verifier.genderM') : t('verifier.genderF')}</dd>
                </div>
              </dl>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-wide text-[#64748B]">
                  {t('verifier.consentFiles')}
                  <span className="ml-2 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700">{t('verifier.consentMulti')}</span>
                </h2>
                <span className={cn('text-xs font-semibold', allConsentChecked ? 'text-emerald-600' : 'text-amber-600')}>
                  {t('verifier.mustCheck', { done: job.consentChecked.length, total: job.consentFiles.length })}
                </span>
              </div>
              <div className="space-y-2">
                {job.consentFiles.map((file) => {
                  const Icon = consentIcon(file.name);
                  const checked = job.consentChecked.includes(file.id);
                  return (
                    <div
                      key={file.id}
                      className={cn(
                        'flex items-center gap-3 rounded-xl border p-3 transition',
                        checked ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200 bg-white hover:border-[#2862E4]/30',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={!actionable}
                        onChange={(e) => {
                          e.stopPropagation();
                          run(checkConsent(job.id, file.id, e.currentTarget.checked));
                        }}
                        className="h-4 w-4 cursor-pointer accent-[#2862E4] disabled:cursor-not-allowed"
                      />
                      <button
                        type="button"
                        onClick={() => openConsentPreview(file)}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                          <Icon className="h-4 w-4 text-[#64748B]" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-[#1E293B]">{file.name}</span>
                          <span className="text-[11px] text-[#94A3B8]">{(file.size / 1024).toFixed(0)} KB</span>
                        </span>
                      </button>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openConsentPreview(file)}
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-[#2862E4] transition hover:bg-[#2862E4]/5"
                        >
                          {t('verifier.viewDoc')}
                        </button>
                        <span className={cn('text-[11px] font-semibold', checked ? 'text-emerald-600' : 'text-[#94A3B8]')}>
                          {checked ? t('verifier.valid') : ''}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-[#94A3B8]">{t('verifier.consentHint')}</p>
            </section>
          </div>

          {/* Right — membership verification (new flow) / matching result (legacy) */}
          <div className="space-y-5">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-[#64748B]">
                {t('verifier.membershipCheck')}
              </h2>
              <div className={cn('rounded-xl border p-4', job.adbriefFound ? 'border-emerald-200 bg-emerald-50/60' : 'border-amber-200 bg-amber-50/60')}>
                <div className="flex flex-wrap items-center gap-2">
                  {job.adbriefFound ? (
                    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700">
                      ✓ {t('verifier.adbriefVerified')}
                    </span>
                  ) : (
                    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-700">
                      {t('verifier.adbriefLegacyBadge')}
                    </span>
                  )}
                  {job.adbriefFound && job.adbriefCheckedAt && (
                    <span className="text-[10px] text-[#94A3B8]">
                      {t('verifier.adbriefCheckedAt', { at: new Date(job.adbriefCheckedAt).toLocaleString() })}
                    </span>
                  )}
                </div>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded-lg bg-white p-2.5 ring-1 ring-slate-100">
                    <dt className="text-[9px] font-bold uppercase tracking-wider text-[#94A3B8]">{t('verifier.fullName')}</dt>
                    <dd className="mt-0.5 font-semibold text-[#1E293B]">{job.identity?.nama}</dd>
                  </div>
                  <div className="rounded-lg bg-white p-2.5 ring-1 ring-slate-100">
                    <dt className="text-[9px] font-bold uppercase tracking-wider text-[#94A3B8]">{t('verifier.birthDate')}</dt>
                    <dd className="mt-0.5 font-semibold text-[#1E293B]">{job.identity?.tglLahir}</dd>
                  </div>
                  <div className="rounded-lg bg-white p-2.5 ring-1 ring-slate-100">
                    <dt className="text-[9px] font-bold uppercase tracking-wider text-[#94A3B8]">{t('verifier.gender')}</dt>
                    <dd className="mt-0.5 font-semibold text-[#1E293B]">{job.identity?.gender === 'M' ? t('verifier.genderM') : t('verifier.genderF')}</dd>
                  </div>
                </dl>
              </div>
              <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-[#64748B]">
                {job.adbriefFound ? t('verifier.adbriefNote') : t('verifier.adbriefLegacyNote')}
              </p>
              <button
                type="button"
                disabled={!actionable}
                onClick={() => setRejectOpen(true)}
                className="mt-3 w-full rounded-xl border border-red-200 bg-white px-3 py-2.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t('verifier.markNotFound')}
              </button>
            </section>
          </div>
        </div>

        {/* Sticky action bar */}
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-6 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] backdrop-blur">
          {job.status === 'cancelled' ? (
            <div className="mx-auto flex max-w-[1240px] items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-rose-600">
                <XCircle className="h-4 w-4" />
                {job.outcome || t('verifier.jobCancelledBanner')}
              </div>
              <button
                type="button"
                onClick={() => navigate('/verifikasi')}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-[#64748B] hover:bg-slate-50 transition shadow-sm"
              >
                ← {t('verifier.backToQueue')}
              </button>
            </div>
          ) : !actionable ? (
            <div className="mx-auto flex max-w-[1240px] items-center justify-between gap-3">
              <div className={cn('flex min-w-0 items-center gap-2 text-xs font-semibold', job.status === 'verified' ? 'text-amber-600' : 'text-emerald-600')}>
                <Info className="h-4 w-4 shrink-0" />
                <span className="min-w-0 truncate">
                  {job.status === 'verified'
                    ? t('verifier.decisionSentBanner', { detail: job.outcome || outcomeChipText(job, t) })
                    : t('verifier.decisionClosedBanner', { detail: job.outcome || outcomeChipText(job, t) })}
                </span>
              </div>
              <button
                type="button"
                onClick={() => navigate('/verifikasi')}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-[#64748B] hover:bg-slate-50 transition shadow-sm"
              >
                ← {t('verifier.backToQueue')}
              </button>
            </div>
          ) : job.claimedBy !== me ? (
            <div className="mx-auto flex max-w-[1240px] items-center justify-between gap-3">
              <p className="text-xs font-medium text-[#64748B]">
                {job.claimedBy ? t('verifier.claimedBy', { name: job.claimedBy }) : t('verifier.claimHint')}
              </p>
              <button
                type="button"
                onClick={() => navigate('/verifikasi')}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-[#64748B] hover:bg-slate-50 transition shadow-sm"
              >
                ← {t('verifier.backToQueue')}
              </button>
            </div>
          ) : (
            <>
              <div className="mx-auto flex max-w-[1240px] items-center gap-3">
                <button type="button" disabled={busy} onClick={() => setFixOpen(true)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-[#475569] transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
                  {t('verifier.requestFix')}
                </button>
                <button type="button" disabled={busy} onClick={() => setRejectOpen(true)} className="rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50">
                  {t('verifier.markNotFoundBtn')}
                </button>
                <button
                  type="button"
                  disabled={!canApprove || busy}
                  onClick={() => runAndLeave(verifyJob(job.id), `✓ ${job.id} — ${t('verifier.verifiedSuccess')}`)}
                  className={cn(
                    'ml-auto rounded-xl px-5 py-2 text-sm font-bold shadow-sm transition',
                    canApprove && !busy ? 'bg-[#2862E4] text-white hover:bg-[#2D2A7A]' : 'cursor-not-allowed bg-slate-100 text-slate-400',
                  )}
                >
                  {t('verifier.approveVerify')}
                </button>
              </div>
              {!canApprove && (
                <p className="mx-auto mt-1.5 max-w-[1240px] text-[11px] font-medium text-amber-600">
                  {approveHint}
                </p>
              )}
            </>
          )}
        </div>

        <FixModal
          open={fixOpen}
          jobId={job.id}
          t={t}
          category={fixCategory}
          onCategory={setFixCategory}
          note={fixNote}
          onNote={setFixNote}
          onClose={() => setFixOpen(false)}
          onSend={() => {
            setFixOpen(false);
            runAndLeave(requestFix(job.id, fixCategory, fixNote), t('verifier.fixSent'));
          }}
        />
        <RejectModal
          open={rejectOpen}
          t={t}
          reason={rejectReason}
          onReason={setRejectReason}
          onClose={() => setRejectOpen(false)}
          onSend={() => {
            setRejectOpen(false);
            runAndLeave(rejectJob(job.id, rejectReason), t('verifier.rejectSent'));
          }}
        />
        <Toast message={toast} />
        <ConsentPreviewModal previewFile={previewFile} onClose={() => setPreviewFile(null)} />
      </div>
    );
  }

  /* ─── Bulk render ─── */
  const canSubmit = bulkReady && job.status === 'on_progress';
  return (
    <div className="mx-auto max-w-[1240px] pb-24">
      <Breadcrumb jobId={job.id} t={t} />
      <JobHeader
        job={job}
        t={t}
        now={now}
        me={me}
        onClaim={() => run(claimJob(job.id), t('verifier.claimSuccess', { jobId: job.id }))}
        onUnclaim={() => run(unclaimJob(job.id), t('verifier.unclaimSuccess'))}
      />

      {job.status === 'cancelled' && (
        <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50/90 p-4 text-rose-900 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-bold text-rose-700">
            <XCircle className="h-5 w-5" />
            {t('verifier.jobCancelledBanner')}
          </div>
          <p className="mt-1 text-xs text-rose-800">
            {job.outcome || t('verifier.jobCancelledDesc')}
          </p>
        </div>
      )}

      {/* Consent chips */}
      <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-[#64748B]">{t('verifier.consentFiles')}</h2>
          <span className={cn('text-xs font-semibold', allConsentChecked ? 'text-emerald-600' : 'text-amber-600')}>
            {t('verifier.mustCheck', { done: job.consentChecked.length, total: job.consentFiles.length })}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {job.consentFiles.map((file) => {
            const Icon = consentIcon(file.name);
            const checked = job.consentChecked.includes(file.id);
            return (
              <div key={file.id} className={cn('flex items-center gap-2 rounded-xl border px-3 py-2 text-xs transition', checked ? 'border-emerald-200 bg-emerald-50/60' : 'border-slate-200 hover:border-[#2862E4]/30')}>
                <input type="checkbox" checked={checked} disabled={!actionable} onChange={(e) => { e.stopPropagation(); run(checkConsent(job.id, file.id, e.currentTarget.checked)); }} className="h-3.5 w-3.5 accent-[#2862E4] disabled:cursor-not-allowed" />
                <button type="button" onClick={() => openConsentPreview(file)} className="flex items-center gap-2 text-left">
                  <Icon className="h-4 w-4 text-[#64748B]" />
                  <span className="font-semibold text-[#1E293B]">{file.name}</span>
                </button>
                {checked && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
                <button type="button" onClick={() => openConsentPreview(file)} className="ml-auto rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-[#2862E4] hover:bg-[#2862E4]/5">
                  {t('verifier.viewDoc')}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bulk rows */}
      {bulk && (
        <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-[#F8FAFC] px-5 py-3">
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">{t('verifier.autoMatched')} {bulk.auto}</span>
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">{t('verifier.needReview')} {bulk.review}</span>
            <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700">{t('verifier.notFound')} {bulk.notFound}</span>
            <span className="mx-1 h-5 w-px bg-slate-200" aria-hidden="true" />
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">{t('verifier.consentMatchChip', { count: bulk.consentMatch, total: bulk.onboard })}</span>
            {bulk.consentMismatch > 0 && (
              <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700">{t('verifier.consentMismatchChip', { count: bulk.consentMismatch })}</span>
            )}
            {bulk.consentPending > 0 && (
              <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">{t('verifier.consentPendingChip', { count: bulk.consentPending })}</span>
            )}
            <span className="ml-auto text-xs font-semibold text-[#64748B]">
              {t('verifier.resolutionProgress')}: {bulk.resolved}/{bulk.total}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-[#64748B]">
                  <th className="px-4 py-2.5 font-semibold">{t('verifier.no')}</th>
                  <th className="px-4 py-2.5 font-semibold">{t('verifier.name')}</th>
                  <th className="px-4 py-2.5 font-semibold">{t('verifier.birthDateCol')}</th>
                  <th className="px-4 py-2.5 font-semibold">{t('verifier.genderCol')}</th>
                  <th className="px-4 py-2.5 font-semibold">{t('verifier.statusCol')}</th>
                  <th className="px-4 py-2.5 font-semibold">
                    {t('verifier.consentCol')}
                    <span className="ml-1 rounded-full bg-violet-50 px-1.5 py-0.5 text-[9px] font-bold text-violet-700">{t('verifier.newBadge')}</span>
                  </th>
                  <th className="px-4 py-2.5 font-semibold">{t('verifier.verifierAction')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {job.rows!.map((row, i) => (
                  <tr key={row.rowId} className={row.state === 'unresolved' ? 'bg-amber-50/40' : row.state === 'notfound' ? 'bg-red-50/30' : ''}>
                    <td className="px-4 py-2.5 text-xs text-[#94A3B8]">{i + 1}</td>
                    <td className="px-4 py-2.5 font-medium text-[#1E293B]">{row.nama}</td>
                    <td className="px-4 py-2.5 text-xs text-[#64748B]">{row.tglLahir}</td>
                    <td className="px-4 py-2.5 text-xs text-[#64748B]">
                      {row.gender === 'M' ? t('verifier.genderM') : row.gender === 'F' ? t('verifier.genderF') : row.gender || '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      {row.state === 'auto' && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">{t('verifier.autoMatched')}</span>}
                      {row.state === 'manual' && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">{t('verifier.manualMatch')}</span>}
                      {row.state === 'unresolved' && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">{t('verifier.needReview')}</span>}
                      {row.state === 'notfound' && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">{t('verifier.confirmedNotFound')}</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      {(row.state === 'unresolved' || row.state === 'notfound') && (
                        <span className="text-[11px] text-[#94A3B8]">—</span>
                      )}
                      {(row.state === 'auto' || row.state === 'manual') && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {row.consent?.state === 'match' && (
                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">{t('verifier.consentMatch')}</span>
                          )}
                          {row.consent?.state === 'mismatch' && (
                            <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">{t('verifier.consentMismatch')}</span>
                          )}
                          {(!row.consent || row.consent.state === 'unverified') && (
                            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">{t('verifier.consentPending')}</span>
                          )}
                          <button
                            type="button"
                            disabled={!actionable}
                            onClick={() => setConsentRow(row)}
                            className={cn(
                              'rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50',
                              row.consent?.state === 'mismatch'
                                ? 'border-red-200 bg-white text-red-600 hover:bg-red-50'
                                : 'border-[#2862E4]/25 bg-white text-[#2862E4] hover:bg-[#2862E4]/5',
                            )}
                          >
                            {t('verifier.consentCheck')}
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {row.state === 'unresolved' && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {row.candidates.map((c) => (
                            <button
                              key={c.memberId}
                              type="button"
                              disabled={!actionable}
                              onClick={() => run(resolveMatch(job.id, c.memberId, row.rowId))}
                              className="rounded-lg border border-[#2862E4]/25 bg-white px-2.5 py-1 text-[11px] font-semibold text-[#2862E4] transition hover:bg-[#2862E4]/5 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {t('verifier.pick', { name: c.nama, score: c.score })}
                            </button>
                          ))}
                          <button
                            type="button"
                            disabled={!actionable}
                            onClick={() => run(resolveMatch(job.id, null, row.rowId))}
                            className="rounded-lg border border-red-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {t('verifier.notMatch')}
                          </button>
                        </div>
                      )}
                      {row.state === 'notfound' && !row.memberId && (
                        <span className="text-[11px] text-[#94A3B8]">{t('verifier.noCandidates')}</span>
                      )}
                      {(row.state === 'auto' || row.state === 'manual') && (
                        <span className="text-[11px] text-[#64748B]">{row.memberId}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sticky bulk action bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-6 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] backdrop-blur">
        {job.status === 'cancelled' ? (
          <div className="mx-auto flex max-w-[1240px] items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-rose-600">
              <XCircle className="h-4 w-4" />
              {job.outcome || t('verifier.jobCancelledBanner')}
            </div>
            <button
              type="button"
              onClick={() => navigate('/verifikasi')}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-[#64748B] hover:bg-slate-50 transition shadow-sm"
            >
              ← {t('verifier.backToQueue')}
            </button>
          </div>
        ) : !actionable ? (
          <div className="mx-auto flex max-w-[1240px] items-center justify-between gap-3">
            <div className={cn('flex min-w-0 items-center gap-2 text-xs font-semibold', job.status === 'verified' ? 'text-amber-600' : 'text-emerald-600')}>
              <Info className="h-4 w-4 shrink-0" />
              <span className="min-w-0 truncate">
                {job.status === 'verified'
                  ? t('verifier.decisionSentBanner', { detail: job.outcome || outcomeChipText(job, t) })
                  : t('verifier.decisionClosedBanner', { detail: job.outcome || outcomeChipText(job, t) })}
              </span>
            </div>
            <button
              type="button"
              onClick={() => navigate('/verifikasi')}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-[#64748B] hover:bg-slate-50 transition shadow-sm"
            >
              ← {t('verifier.backToQueue')}
            </button>
          </div>
        ) : job.claimedBy !== me ? (
          <div className="mx-auto flex max-w-[1240px] items-center justify-between gap-3">
            <p className="text-xs font-medium text-[#64748B]">
              {job.claimedBy ? t('verifier.claimedBy', { name: job.claimedBy }) : t('verifier.claimHint')}
            </p>
            <button
              type="button"
              onClick={() => navigate('/verifikasi')}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-[#64748B] hover:bg-slate-50 transition shadow-sm"
            >
              ← {t('verifier.backToQueue')}
            </button>
          </div>
        ) : (
          <div className="mx-auto flex max-w-[1240px] items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium text-[#64748B]">{t('verifier.bulkRule', { total: bulk?.total ?? 0 })}</p>
              {!canSubmit && (
                <p className="mt-0.5 text-[11px] font-medium text-amber-600">
                  {[
                    unresolvedCount > 0 && t('verifier.bulkBlockUnresolved', { count: unresolvedCount }),
                    mismatchCount > 0 && t('verifier.bulkBlockMismatch', { count: mismatchCount }),
                    consentPendingCount > 0 && t('verifier.bulkBlockConsent', { count: consentPendingCount }),
                  ].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (mismatchCount > 0) {
                  const rows = (job.rows ?? [])
                    .map((r, i) => ({ r, i }))
                    .filter(({ r }) => r.consent?.state === 'mismatch')
                    .map(({ r, i }) => `${i + 1} (${r.nama})`);
                  setFixCategory('consent');
                  setFixNote(t('verifier.fixPrefillMismatch', { rows: rows.join(', ') }));
                }
                setFixOpen(true);
              }}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-[#475569] transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t('verifier.requestFix')}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setRejectOpen(true)}
              className="rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t('verifier.markNotFoundBtn')}
            </button>
            <button
              type="button"
              disabled={!canSubmit || busy}
              onClick={() => runAndLeave(verifyJob(job.id), t('verifier.bulkSent'))}
              className={cn(
                'ml-auto rounded-xl px-5 py-2 text-sm font-bold shadow-sm transition',
                canSubmit && !busy ? 'bg-[#2862E4] text-white hover:bg-[#2D2A7A]' : 'cursor-not-allowed bg-slate-100 text-slate-400',
              )}
            >
              {t('verifier.bulkSubmit', { done: bulk?.resolved ?? 0, total: bulk?.total ?? 0 })}
            </button>
          </div>
        )}
      </div>

      <FixModal
        open={fixOpen}
        jobId={job.id}
        t={t}
        category={fixCategory}
        onCategory={setFixCategory}
        note={fixNote}
        onNote={setFixNote}
        onClose={() => setFixOpen(false)}
        onSend={() => {
          setFixOpen(false);
          runAndLeave(requestFix(job.id, fixCategory, fixNote), t('verifier.fixSent'));
        }}
      />
      <RejectModal
        open={rejectOpen}
        t={t}
        reason={rejectReason}
        onReason={setRejectReason}
        onClose={() => setRejectOpen(false)}
        onSend={() => {
          setRejectOpen(false);
          runAndLeave(rejectJob(job.id, rejectReason), t('verifier.rejectSent'));
        }}
      />
      <Toast message={toast} />
      <ConsentPreviewModal previewFile={previewFile} onClose={() => setPreviewFile(null)} />
      {consentRow && job.rows && (
        <RowConsentModal
          key={consentRow.rowId}
          row={job.rows.find((r) => r.rowId === consentRow.rowId) ?? consentRow}
          jobId={job.id}
          consentFiles={job.consentFiles}
          t={t}
          onClose={() => setConsentRow(null)}
          onVerdict={(state, fileIds, note) => {
            run(
              setRowConsent(job.id, consentRow.rowId, state, fileIds, note),
              state === 'match' ? t('verifier.consentRowConfirmed', { nama: consentRow.nama }) : t('verifier.consentRowMarkedMismatch', { nama: consentRow.nama }),
            );
            setConsentRow(null);
          }}
        />
      )}
    </div>
  );
}

function RowConsentModal({
  row,
  jobId,
  consentFiles,
  t,
  onClose,
  onVerdict,
}: {
  row: BulkRowResolution;
  jobId: string;
  consentFiles: ConsentFileRef[];
  t: (key: string, params?: Record<string, unknown>) => string;
  onClose: () => void;
  onVerdict: (state: 'unverified' | 'match' | 'mismatch', fileIds: string[], note?: string) => void;
}) {
  const [opened, setOpened] = useState<Set<string>>(new Set());
  const [note, setNote] = useState('');
  const [preview, setPreview] = useState<{ name: string; url: string; type: string } | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview.url);
    };
  }, [preview]);

  if (!row) return null;
  const state = row.consent?.state ?? 'unverified';
  const canDecide = opened.size > 0;

  const openDoc = async (file: ConsentFileRef) => {
    setLoadingId(file.id);
    setError('');
    try {
      const content = await getConsentFile(jobId, file.id);
      if (preview) URL.revokeObjectURL(preview.url);
      setPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return { name: file.name, url: URL.createObjectURL(content), type: file.type };
      });
      setOpened((prev) => new Set(prev).add(file.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('verifier.previewFailed'));
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/60 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#94A3B8]">{t('verifier.consentRowModalTitle')}</p>
            <h3 className="text-base font-bold text-[#1E293B]">{t('verifier.consentRowModalSub', { no: row.rowNo ?? '—', nama: row.nama })}</h3>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-[#94A3B8] transition hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 bg-[#F8FAFC] p-3">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#64748B]">{t('verifier.consentRowMemberData')}</p>
          <dl className="grid grid-cols-3 gap-2 text-xs">
            <div className="rounded-lg bg-white p-2.5 ring-1 ring-slate-100">
              <dt className="text-[9px] font-bold uppercase tracking-wider text-[#94A3B8]">{t('verifier.fullName')}</dt>
              <dd className="mt-0.5 font-semibold text-[#1E293B]">{row.nama}</dd>
            </div>
            <div className="rounded-lg bg-white p-2.5 ring-1 ring-slate-100">
              <dt className="text-[9px] font-bold uppercase tracking-wider text-[#94A3B8]">{t('verifier.birthDate')}</dt>
              <dd className="mt-0.5 font-semibold text-[#1E293B]">{row.tglLahir}</dd>
            </div>
            <div className="rounded-lg bg-white p-2.5 ring-1 ring-slate-100">
              <dt className="text-[9px] font-bold uppercase tracking-wider text-[#94A3B8]">{t('verifier.gender')}</dt>
              <dd className="mt-0.5 font-semibold text-[#1E293B]">{row.gender === 'M' ? t('verifier.genderM') : t('verifier.genderF')}</dd>
            </div>
          </dl>
        </div>

        <div className="mt-3">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
            {t('verifier.consentRowDocs')}
            {row.consent?.state === 'match' && <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-700">{t('verifier.consentMatch')}</span>}
            {row.consent?.state === 'mismatch' && <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-[9px] font-bold text-red-700">{t('verifier.consentMismatch')}</span>}
          </p>
          <div className="space-y-1.5">
            {consentFiles.map((file: ConsentFileRef) => (
              <div key={file.id} className={cn('flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs', opened.has(file.id) ? 'border-emerald-200 bg-emerald-50/60' : 'border-slate-200')}>
                <span className="min-w-0 flex-1 truncate font-semibold text-[#1E293B]">{file.name}</span>
                {opened.has(file.id) && <span className="text-[10px] font-bold text-emerald-600">{t('verifier.consentRowOpened')}</span>}
                <span className="shrink-0 text-[10px] text-[#94A3B8]">{(file.size / 1024).toFixed(0)} KB</span>
                <button
                  type="button"
                  onClick={() => void openDoc(file)}
                  className="shrink-0 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-[#2862E4] transition hover:bg-[#2862E4]/5"
                >
                  {loadingId === file.id ? '…' : t('verifier.consentRowOpen')}
                </button>
              </div>
            ))}
          </div>
          {!canDecide && (
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-700">{t('verifier.consentRowMustOpen')}</p>
          )}
          {error && <p className="mt-2 text-[11px] font-medium text-red-600">{error}</p>}
        </div>

        {preview && (
          <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
            {preview.type === 'application/pdf' || preview.name.toLowerCase().endsWith('.pdf') ? (
              <iframe src={preview.url} title={preview.name} className="h-64 w-full" />
            ) : (
              <img src={preview.url} alt={preview.name} className="max-h-64 w-full object-contain" />
            )}
          </div>
        )}

        <label className="mt-3 block">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">{t('verifier.consentRowNote')}</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="mt-1 w-full resize-none rounded-xl border border-slate-200 bg-[#F8FAFC] px-3 py-2 text-sm outline-none transition focus:border-[#2862E4]/40 focus:ring-2 focus:ring-[#2862E4]/10"
          />
        </label>

        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          {state !== 'unverified' && (
            <button
              type="button"
              onClick={() => onVerdict('unverified', [], undefined)}
              className="mr-auto rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-[#64748B] transition hover:bg-slate-50"
            >
              {t('verifier.consentRowReset')}
            </button>
          )}
          <button
            type="button"
            disabled={!canDecide}
            onClick={() => onVerdict('mismatch', [...opened], note.trim() || undefined)}
            className={cn(
              'rounded-xl border px-4 py-2 text-sm font-semibold transition',
              canDecide ? 'border-red-200 text-red-600 hover:bg-red-50' : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400',
            )}
          >
            {t('verifier.consentRowMismatch')}
          </button>
          <button
            type="button"
            disabled={!canDecide}
            onClick={() => onVerdict('match', [...opened], note.trim() || undefined)}
            className={cn(
              'rounded-xl px-5 py-2 text-sm font-bold text-white shadow-sm transition',
              canDecide ? 'bg-[#2862E4] hover:bg-[#2D2A7A]' : 'cursor-not-allowed bg-slate-100 text-slate-400',
            )}
          >
            {t('verifier.consentRowConfirm')}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConsentPreviewModal({ previewFile, onClose }: { previewFile: { name: string; url: string; type: string } | null; onClose: () => void }) {
  if (!previewFile) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#94A3B8]">Dokumen Persetujuan</p>
            <h3 className="text-base font-bold text-[#1E293B]">{previewFile.name}</h3>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-[#64748B] transition hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
          {previewFile.type === 'application/pdf' || previewFile.name.toLowerCase().endsWith('.pdf') ? (
            <iframe src={previewFile.url} title={previewFile.name} className="h-[70vh] w-full" />
          ) : (
            <img src={previewFile.url} alt={previewFile.name} className="max-h-[70vh] w-full object-contain" />
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Shared pieces ─── */

function Breadcrumb({ jobId, t }: { jobId: string; t: (k: string) => string }) {
  return (
    <div className="mb-3 flex items-center gap-2 text-xs text-[#64748B]">
      <Link to="/verifikasi" className="flex items-center gap-1 font-medium hover:text-[#2862E4]">
        <ArrowLeft className="h-3.5 w-3.5" />
        {t('verifier.backToQueue')}
      </Link>
      <span>/</span>
      <span className="font-mono font-semibold text-[#1E293B]">{jobId}</span>
    </div>
  );
}

function JobHeader({
  job,
  t,
  now,
  me,
  onClaim,
  onUnclaim,
}: {
  job: VerifierJob;
  t: (k: string, o?: Record<string, unknown>) => string;
  now: number;
  me: string;
  onClaim: () => void;
  onUnclaim?: () => void;
}) {
  const age = formatAge(job.createdAt, now);
  const slaLeft = 24 * 60 * 60 * 1000 - (now - job.createdAt);
  const isBulk = job.mode === 'bulk';
  const showOutcome = job.status === 'verified' || job.status === 'completed';
  const outcome = showOutcome ? outcomeChipText(job, t) : '';
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-mono text-lg font-bold text-[#1E293B]">{job.id}</h1>
          <span className={cn('rounded-full border px-2.5 py-0.5 text-[11px] font-semibold', isBulk ? 'border-violet-200 bg-violet-50 text-violet-700' : 'border-indigo-200 bg-indigo-50 text-indigo-700')}>
            {isBulk ? t('verifier.modeBulk') : t('verifier.modeIndividu')}
          </span>
          <span className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold', STATUS_CHIP[job.status])}>
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {statusChipLabel(job.status, t)}
            {job.status === 'on_progress' && job.claimedBy && (
              <span className="font-medium opacity-80">· {job.claimedBy === me ? t('verifier.you') : job.claimedBy}</span>
            )}
          </span>
          {outcome && (
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold',
                job.status === 'verified' ? 'border-orange-200 bg-orange-50 text-orange-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700',
              )}
            >
              {outcome}
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-[#64748B]">
          {isBulk
            ? t('verifier.bulkFileHeader', { rows: job.dataFile?.rows ?? 0, age, by: job.submittedBy, files: `${job.consentFiles.length} ${t('verifier.files', { count: job.consentFiles.length }).toLowerCase()}` })
            : t('verifier.submittedBy', { age, by: job.submittedBy, mode: t('verifier.modeIndividu') })}
        </p>
        <FlowStepper status={job.status} t={t} />
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">{t('verifier.aging')}</p>
          <p className={cn('text-sm font-bold', slaLeft < 0 ? 'text-red-600' : 'text-[#1E293B]')}>
            {job.status === 'completed' || job.status === 'cancelled' ? '—' : age}
            {job.status !== 'completed' && job.status !== 'cancelled' && (
              <span className={cn('ml-2 text-[11px] font-medium', slaLeft < 0 ? 'text-red-500' : 'text-emerald-600')}>
                {slaLeft < 0 ? `⚠ ${t('verifier.slaBreach')}` : `${t('verifier.slaLeft')} ${formatAge(now - Math.max(0, slaLeft))}`}
              </span>
            )}
          </p>
        </div>
        {job.status === 'submitted' ? (
          <button type="button" onClick={onClaim} className="rounded-xl bg-[#2862E4] px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-[#2D2A7A]">
            {t('verifier.claimAndProcess')}
          </button>
        ) : job.status === 'on_progress' ? (
          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-700">
              {t('verifier.processedBy')} {job.claimedBy === me ? t('verifier.you') : job.claimedBy ?? '—'}
            </div>
            {job.claimedBy === me && onUnclaim && (
              <button
                type="button"
                onClick={onUnclaim}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-[#64748B] shadow-sm transition hover:bg-slate-50"
              >
                {t('verifier.unclaim')}
              </button>
            )}
          </div>
        ) : job.status === 'verified' ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-[#64748B]">
            {t('verifier.awaitingApplicant')}
          </div>
        ) : job.status === 'completed' ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700">
            {t('verifier.closedJob')}
          </div>
        ) : (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-700">
            {t('verifier.statusCancelled')}
          </div>
        )}
      </div>
    </div>
  );
}

function FixModal({
  open, jobId, t, category, onCategory, note, onNote, onClose, onSend,
}: {
  open: boolean; jobId: string; t: (k: string, o?: Record<string, unknown>) => string;
  category: string; onCategory: (v: string) => void; note: string; onNote: (v: string) => void;
  onClose: () => void; onSend: () => void;
}) {
  if (!open) return null;
  const valid = !!category && note.trim().length > 0;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base font-bold text-[#1E293B]">{t('verifier.fixModalTitle')}</h3>
            <p className="mt-0.5 text-xs text-[#64748B]">{t('verifier.fixModalSub', { jobId })}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-[#94A3B8] transition hover:bg-slate-100"><X className="h-4 w-4" /></button>
        </div>
        <label className="mt-5 block text-xs font-bold uppercase tracking-wider text-[#64748B]">{t('verifier.fixCategory')}</label>
        <select value={category} onChange={(e) => onCategory(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-[#F8FAFC] px-3 py-2.5 text-sm outline-none focus:border-[#2862E4]/40">
          <option value="">—</option>
          <option value="consent">{t('verifier.fixCatConsent')}</option>
          <option value="incomplete">{t('verifier.fixCatIncomplete')}</option>
          <option value="name-mismatch">{t('verifier.fixCatNameMismatch')}</option>
          <option value="duplicate">{t('verifier.fixCatDuplicate')}</option>
        </select>
        <label className="mt-4 block text-xs font-bold uppercase tracking-wider text-[#64748B]">
          {t('verifier.fixNote')} <span className="text-red-500">{t('verifier.fixNoteRequired')}</span>
        </label>
        <textarea
          value={note}
          onChange={(e) => onNote(e.target.value)}
          rows={4}
          placeholder={t('verifier.fixNotePlaceholder')}
          className="mt-1.5 w-full resize-none rounded-xl border border-slate-200 bg-[#F8FAFC] px-3 py-2.5 text-sm outline-none focus:border-[#2862E4]/40"
        />
        <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-[#475569]">
          <input type="checkbox" defaultChecked className="h-3.5 w-3.5 accent-[#2862E4]" />
          {t('verifier.fixNotifyEmail')}
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-semibold text-[#64748B] transition hover:bg-slate-100">{t('verifier.cancel')}</button>
          <button
            type="button"
            disabled={!valid}
            onClick={onSend}
            className={cn('rounded-xl px-5 py-2 text-sm font-bold transition', valid ? 'bg-[#2862E4] text-white hover:bg-[#2D2A7A]' : 'cursor-not-allowed bg-slate-100 text-slate-400')}
          >
            {t('verifier.fixSend')}
          </button>
        </div>
      </div>
    </div>
  );
}

function RejectModal({
  open, t, reason, onReason, onClose, onSend,
}: {
  open: boolean; t: (k: string, o?: Record<string, unknown>) => string;
  reason: string; onReason: (v: string) => void; onClose: () => void; onSend: () => void;
}) {
  if (!open) return null;
  const valid = reason.trim().length > 0;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <h3 className="text-base font-bold text-[#1E293B]">{t('verifier.markNotFoundBtn')}</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-[#94A3B8] transition hover:bg-slate-100"><X className="h-4 w-4" /></button>
        </div>
        <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs leading-relaxed text-red-700">{t('verifier.rejectDescription')}</p>
        <label className="mt-4 block text-xs font-bold uppercase tracking-wider text-[#64748B]">
          {t('verifier.fixNote')} <span className="text-red-500">{t('verifier.fixNoteRequired')}</span>
        </label>
        <textarea
          value={reason}
          onChange={(e) => onReason(e.target.value)}
          rows={3}
          placeholder={t('verifier.fixNotePlaceholder')}
          className="mt-1.5 w-full resize-none rounded-xl border border-slate-200 bg-[#F8FAFC] px-3 py-2.5 text-sm outline-none focus:border-[#2862E4]/40"
        />
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-semibold text-[#64748B] transition hover:bg-slate-100">{t('verifier.cancel')}</button>
          <button
            type="button"
            disabled={!valid}
            onClick={onSend}
            className={cn('rounded-xl px-5 py-2 text-sm font-bold transition', valid ? 'bg-red-600 text-white hover:bg-red-700' : 'cursor-not-allowed bg-slate-100 text-slate-400')}
          >
            {t('verifier.fixSend')}
          </button>
        </div>
      </div>
    </div>
  );
}

function Toast({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2">
      <div className="flex items-center gap-2 rounded-xl bg-[#1E293B] px-4 py-2.5 text-sm font-semibold text-white shadow-xl">{message}</div>
    </div>
  );
}