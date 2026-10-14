/**
 * VerifierQueuePage — Antrian Verifikasi Member.
 *
 * KPI cards + filter bar + job table for the ADSCORE_VERIFIER console.
 * Data source: features/adscore-verifier/lib/verifierApi.ts (mock store, single swap point).
 */
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ClipboardCheck, Download, ListChecks, Search, XCircle } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { useAuth } from '@/entities/auth';
import { downloadCsv } from '@/shared/components/common/ExportButton';
import {
  computeStats,
  filterJobs,
  listJobs,
  subscribeQueue,
} from '../lib/verifierApi';
import { formatAge, type QueueFilters, type VerifierJob, type VerifierJobStatus } from '../model/verifierTypes';

const STATUS_BADGE: Record<VerifierJobStatus | 'needs_action', string> = {
  submitted: 'bg-blue-50 text-blue-700 border-blue-200',
  on_progress: 'bg-amber-50 text-amber-700 border-amber-200',
  verified: 'bg-red-50 text-red-700 border-red-200',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelled: 'bg-rose-50 text-rose-700 border-rose-200',
  needs_action: 'bg-red-50 text-red-700 border-red-200',
};

function StatusBadge({ job, me, t }: { job: VerifierJob; me: string; t: (k: string, o?: Record<string, unknown>) => string }) {
  const key = job.status === 'verified' ? 'needs_action' : job.status;
  const label = job.status === 'submitted'
    ? t('verifier.statusSubmitted')
    : job.status === 'on_progress'
      ? t('verifier.statusOnProgress')
      : job.status === 'verified'
        ? t('verifier.statusNeedsAction')
        : job.status === 'cancelled'
          ? t('verifier.statusCancelledByApplicant')
          : t('verifier.statusCompleted');
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold', STATUS_BADGE[key])}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
      {job.status === 'on_progress' && job.claimedBy && (
        <span className="font-medium opacity-80">· {job.claimedBy === me ? t('verifier.you') : job.claimedBy}</span>
      )}
    </span>
  );
}

function ModeBadge({ mode, t }: { mode: VerifierJob['mode']; t: (k: string) => string }) {
  return (
    <span className={cn('rounded-full border px-2 py-0.5 text-[11px] font-semibold', mode === 'bulk' ? 'border-violet-200 bg-violet-50 text-violet-700' : 'border-indigo-200 bg-indigo-50 text-indigo-700')}>
      {mode === 'bulk' ? t('verifier.modeBulk') : t('verifier.modeIndividu')}
    </span>
  );
}

export default function VerifierQueuePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const me = user?.username ?? '';
  const [jobs, setJobs] = useState<VerifierJob[]>(() => listJobs());
  const [filters, setFilters] = useState<QueueFilters>({ q: '', status: '', mode: '', date: '' });
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => subscribeQueue(setJobs), []);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const stats = useMemo(() => computeStats(jobs, now), [jobs, now]);
  const filtered = useMemo(() => filterJobs(jobs, filters), [jobs, filters]);

  interface Kpi {
    key: string;
    label: string;
    value: number;
    dot: string;
    pulse: boolean;
    warn: boolean;
    sub?: string;
  }

  const kpis: Kpi[] = [
    { key: 'waiting', label: t('verifier.waiting'), value: stats.waiting, dot: 'bg-[#2862E4]', pulse: true, warn: false },
    { key: 'processing', label: t('verifier.processing'), value: stats.processing, dot: 'bg-amber-500', pulse: true, warn: false, sub: jobs.some((j) => j.status === 'on_progress' && j.claimedBy === me) ? t('verifier.byYou') : undefined },
    { key: 'needsAction', label: t('verifier.needsAction'), value: stats.needsAction, dot: 'bg-red-500', pulse: false, warn: true },
    { key: 'doneToday', label: t('verifier.doneToday'), value: stats.doneToday, dot: 'bg-emerald-500', pulse: false, warn: false },
    { key: 'slaBreach', label: t('verifier.slaBreach'), value: stats.slaBreach, dot: 'bg-red-500', pulse: true, warn: true },
  ];

  const summary = (job: VerifierJob): string =>
    job.mode === 'individu' ? job.identity?.nama ?? '—' : `${job.dataFile?.name ?? '—'} · ${job.dataFile?.rows ?? 0} ${t('verifier.name').toLowerCase()}`;

  return (
    <div className="mx-auto max-w-[1400px]">
      {/* ── Header ── */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#1E293B]">{t('verifier.queueTitle')}</h1>
          <p className="text-sm text-[#64748B]">{t('verifier.queueSubtitle')}</p>
        </div>
        <button
          type="button"
          onClick={() => downloadCsv({
            headers: [t('verifier.colJob'), t('verifier.colMode'), t('verifier.colBy'), t('verifier.name'), t('verifier.consentFiles'), t('verifier.aging'), t('verifier.statusCol'), t('verifier.colResult')],
            rows: filtered.map((job) => [
              job.id,
              job.mode === 'bulk' ? t('verifier.modeBulk') : t('verifier.modeIndividu'),
              job.submittedBy,
              summary(job),
              job.consentFiles.length,
              job.status === 'completed' || job.status === 'cancelled' ? '—' : formatAge(job.createdAt, now),
              job.status === 'submitted'
                ? t('verifier.statusSubmitted')
                : job.status === 'on_progress'
                  ? t('verifier.statusOnProgress')
                  : job.status === 'verified'
                    ? t('verifier.statusNeedsAction')
                    : job.status === 'cancelled'
                      ? t('verifier.statusCancelled')
                      : t('verifier.statusCompleted'),
              job.outcome ?? '',
            ]),
          }, 'adscore-verification-queue.csv')}
          className="flex items-center gap-2 rounded-xl border border-[#2862E4]/20 bg-white px-4 py-2 text-sm font-semibold text-[#2862E4] shadow-sm transition hover:bg-[#2862E4]/5"
        >
          <Download className="h-4 w-4" />
          {t('verifier.export')}
        </button>
      </div>

      {/* ── KPI cards ── */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {kpis.map((k) => (
          <div key={k.key} className={cn('rounded-2xl border bg-white p-4 shadow-sm', k.warn ? 'border-red-200 bg-red-50/60' : 'border-slate-200')}>
            <div className="flex items-center gap-2 text-xs font-semibold text-[#64748B]">
              <span className={cn('h-2 w-2 rounded-full', k.dot, k.pulse && 'animate-pulse')} />
              {k.label}
            </div>
            <p className={cn('mt-1 text-2xl font-bold', k.warn && k.value > 0 ? 'text-red-600' : 'text-[#1E293B]')}>{k.value}</p>
            {k.sub && <p className="text-[11px] text-[#94A3B8]">{k.sub}</p>}
          </div>
        ))}
      </div>

      {/* ── Filter bar ── */}
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#94A3B8]" />
          <input
            value={filters.q}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
            placeholder={t('verifier.searchPlaceholder')}
            className="w-full rounded-xl border border-slate-200 bg-[#F8FAFC] py-2 pl-9 pr-3 text-sm outline-none transition focus:border-[#2862E4]/40 focus:ring-2 focus:ring-[#2862E4]/10"
          />
        </div>
        <select
          value={filters.status}
          onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value as QueueFilters['status'] }))}
          className="rounded-xl border border-slate-200 bg-[#F8FAFC] px-3 py-2 text-sm outline-none"
        >
          <option value="">{t('verifier.allStatuses')}</option>
          <option value="submitted">{t('verifier.statusSubmitted')}</option>
          <option value="on_progress">{t('verifier.statusOnProgress')}</option>
          <option value="needs_action">{t('verifier.statusNeedsAction')}</option>
          <option value="completed">{t('verifier.statusCompleted')}</option>
          <option value="cancelled">{t('verifier.statusCancelledByApplicant')}</option>
        </select>
        <select
          value={filters.mode}
          onChange={(e) => setFilters((f) => ({ ...f, mode: e.target.value as QueueFilters['mode'] }))}
          className="rounded-xl border border-slate-200 bg-[#F8FAFC] px-3 py-2 text-sm outline-none"
        >
          <option value="">{t('verifier.allModes')}</option>
          <option value="individu">{t('verifier.modeIndividu')}</option>
          <option value="bulk">{t('verifier.modeBulk')}</option>
        </select>
        <input
          type="date"
          value={filters.date}
          onChange={(e) => setFilters((f) => ({ ...f, date: e.target.value }))}
          className="rounded-xl border border-slate-200 bg-[#F8FAFC] px-3 py-2 text-sm outline-none"
        />
        <button
          type="button"
          onClick={() => setFilters({ q: '', status: '', mode: '', date: '' })}
          className="rounded-xl px-3 py-2 text-sm font-medium text-[#64748B] transition hover:bg-slate-100"
        >
          {t('verifier.reset')}
        </button>
      </div>

      {/* ── Queue table ── */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-[#F8FAFC] text-left text-xs uppercase tracking-wide text-[#64748B]">
                <th className="px-4 py-3 font-semibold">{t('verifier.colJob')}</th>
                <th className="px-4 py-3 font-semibold">{t('verifier.colMode')}</th>
                <th className="px-4 py-3 font-semibold">{t('verifier.colBy')}</th>
                <th className="px-4 py-3 font-semibold">{t('verifier.name')}</th>
                <th className="px-4 py-3 font-semibold">{t('verifier.consentFiles')}</th>
                <th className="px-4 py-3 font-semibold">{t('verifier.aging')}</th>
                <th className="px-4 py-3 font-semibold">{t('verifier.statusCol')}</th>
                <th className="px-4 py-3 text-right font-semibold">{t('verifier.action')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((job) => {
                const ageMs = now - job.createdAt;
                const slaBreach = (job.status === 'submitted' || job.status === 'on_progress') && ageMs > 24 * 60 * 60 * 1000;
                return (
                  <tr key={job.id} className={cn('transition hover:bg-[#2862E4]/[0.03]', slaBreach && 'border-l-4 border-red-400')}>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Link to={`/verifikasi/jobs/${job.id}`} className="font-mono text-xs font-semibold text-[#2862E4] hover:underline">
                        {job.id}
                      </Link>
                    </td>
                    <td className="px-4 py-3"><ModeBadge mode={job.mode} t={t} /></td>
                    <td className="px-4 py-3 text-xs text-[#475569]">{job.submittedBy}</td>
                    <td className="px-4 py-3">{summary(job)}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                        <ClipboardCheck className="h-3 w-3" />
                        {t('verifier.files', { count: job.consentFiles.length })}
                      </span>
                    </td>
                    <td className={cn('whitespace-nowrap px-4 py-3 font-medium', slaBreach ? 'font-semibold text-red-600' : 'text-[#1E293B]')}>
                      {job.status === 'completed' || job.status === 'cancelled' ? '—' : `${formatAge(job.createdAt, now)}${slaBreach ? ` ⚠ ${t('verifier.slaFlag')}` : ''}`}
                    </td>
                    <td className="px-4 py-3"><StatusBadge job={job} me={me} t={t} /></td>
                    <td className="px-4 py-3 text-right">
                      {job.status === 'completed' ? (
                        <span className="text-xs text-[#94A3B8]">{job.outcome ?? ''}</span>
                      ) : job.status === 'cancelled' ? (
                        <div className="flex items-center justify-end gap-2">
                          <span
                            className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700"
                            title={job.outcome || t('verifier.cancelledByApplicant')}
                          >
                            <XCircle className="h-3 w-3 text-rose-500 shrink-0" />
                            {job.outcome || t('verifier.cancelledByApplicant')}
                          </span>
                          <Link
                            to={`/verifikasi/jobs/${job.id}`}
                            className="inline-block rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-[#64748B] hover:bg-slate-50 transition shadow-sm"
                          >
                            Lihat
                          </Link>
                        </div>
                      ) : job.status === 'on_progress' && job.claimedBy && job.claimedBy !== me ? (
                        <span className="text-xs text-[#94A3B8]">{t('verifier.claimedBy', { name: job.claimedBy })}</span>
                      ) : (
                        <Link
                          to={`/verifikasi/jobs/${job.id}`}
                          className={cn(
                            'inline-block rounded-lg px-3 py-1.5 text-xs font-semibold shadow-sm transition',
                            job.status === 'verified'
                              ? 'border border-red-200 bg-white text-red-600 hover:bg-red-50'
                              : 'bg-[#2862E4] text-white hover:bg-[#2D2A7A]',
                          )}
                        >
                          {job.status === 'submitted' ? t('verifier.process') : t('verifier.continue')} →
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm text-[#94A3B8]">
                    <ListChecks className="mx-auto mb-2 h-8 w-8 opacity-40" />
                      {t('verifier.noMatches')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-slate-100 bg-[#F8FAFC] px-4 py-2.5 text-xs text-[#64748B]">
          <span>{t('verifier.showing', { shown: filtered.length, total: jobs.length })}</span>
          <span className="flex items-center gap-1.5">
            {t('verifier.autoRefresh')}
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
          </span>
        </div>
      </div>
    </div>
  );
}