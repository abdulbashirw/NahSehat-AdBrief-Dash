/**
 * VerifierHistoryPage — Riwayat & Audit Trail.
 *
 * Every verification action (claim / consent check / match / approve /
 * reject / request fix) with actor, timestamp, detail and outcome.
 * Source: features/adscore-verifier/lib/verifierApi.ts (single swap point).
 */
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Search } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { downloadCsv } from '@/shared/components/common/ExportButton';
import { listAudit } from '../lib/verifierApi';
import type { AuditEntry } from '../model/verifierTypes';

const ACTION_BADGE: Record<AuditEntry['action'], string> = {
  approve: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  consent_check: 'bg-blue-50 text-blue-700 border-blue-200',
  consent_uncheck: 'bg-amber-50 text-amber-700 border-amber-200',
  consent_row_check: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  consent_row_mismatch: 'bg-red-50 text-red-700 border-red-200',
  request_fix: 'bg-amber-50 text-amber-700 border-amber-200',
  reject: 'bg-red-50 text-red-700 border-red-200',
  bulk_submit: 'bg-violet-50 text-violet-700 border-violet-200',
  claim: 'bg-slate-100 text-slate-600 border-slate-200',
  unclaim: 'bg-amber-50 text-amber-700 border-amber-200',
  cancel: 'bg-rose-50 text-rose-700 border-rose-200',
  match: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  export: 'bg-slate-100 text-slate-600 border-slate-200',
};

const ACTION_LABEL_KEY: Record<AuditEntry['action'], string> = {
  approve: 'verifier.auditApprove',
  consent_check: 'verifier.auditConsentCheck',
  consent_uncheck: 'verifier.auditConsentUncheck',
  consent_row_check: 'verifier.auditConsentRowCheck',
  consent_row_mismatch: 'verifier.auditConsentRowMismatch',
  request_fix: 'verifier.auditRequestFix',
  reject: 'verifier.auditReject',
  bulk_submit: 'verifier.auditBulkSubmit',
  claim: 'verifier.auditClaim',
  unclaim: 'verifier.auditUnclaim',
  cancel: 'verifier.auditCancel',
  match: 'verifier.auditApprove',
  export: 'verifier.auditExport',
};

function fmtTime(at: number, locale: string): string {
  return new Date(at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function VerifierHistoryPage() {
  const { t, i18n } = useTranslation();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let alive = true;
    listAudit()
      .then((data) => {
        if (alive) setEntries(data);
      })
      .catch((e) => {
        if (alive) setLoadError(e instanceof Error ? e.message : t('verifier.loadAuditFailed'));
      });
    return () => {
      alive = false;
    };
  }, [t]);
  const [q, setQ] = useState('');
  const [actor, setActor] = useState('');
  const [action, setAction] = useState('');

  const filtered = useMemo(
    () =>
      entries.filter((e) => {
        if (actor && e.actor !== actor) return false;
        if (action && e.action !== action) return false;
        if (q) {
          const hay = [e.jobId, e.detail, e.outcome, e.actor].join(' ').toLowerCase();
          if (!hay.includes(q.toLowerCase())) return false;
        }
        return true;
      }),
    [entries, q, actor, action],
  );

  const actors = useMemo(() => [...new Set(entries.map((e) => e.actor))], [entries]);

  return (
    <div className="mx-auto max-w-[1400px]">
      {/* ── Header ── */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#1E293B]">{t('verifier.historyTitle')}</h1>
          <p className="text-sm text-[#64748B]">{t('verifier.historySubtitle')}</p>
        </div>
        <button
          type="button"
          onClick={() => downloadCsv({
            headers: [t('verifier.colTime'), t('verifier.colJob'), t('verifier.colAction'), t('verifier.colBy'), t('verifier.colDetail'), t('verifier.colResult')],
            rows: filtered.map((entry) => [
              new Date(entry.at).toISOString(),
              entry.jobId,
              t(ACTION_LABEL_KEY[entry.action]),
              entry.actor,
              entry.detail,
              entry.outcome,
            ]),
          }, 'adscore-verification-audit.csv')}
          className="flex items-center gap-2 rounded-xl border border-[#2862E4]/20 bg-white px-4 py-2 text-sm font-semibold text-[#2862E4] shadow-sm transition hover:bg-[#2862E4]/5"
        >
          <Download className="h-4 w-4" />
          {t('verifier.exportCsv')}
        </button>
      </div>

      {/* ── Filters ── */}
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#94A3B8]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('verifier.searchPlaceholder')}
            className="w-full rounded-xl border border-slate-200 bg-[#F8FAFC] py-2 pl-9 pr-3 text-sm outline-none transition focus:border-[#2862E4]/40 focus:ring-2 focus:ring-[#2862E4]/10"
          />
        </div>
        <select value={actor} onChange={(e) => setActor(e.target.value)} className="rounded-xl border border-slate-200 bg-[#F8FAFC] px-3 py-2 text-sm outline-none">
          <option value="">{t('verifier.allVerifiers')}</option>
          {actors.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <select value={action} onChange={(e) => setAction(e.target.value)} className="rounded-xl border border-slate-200 bg-[#F8FAFC] px-3 py-2 text-sm outline-none">
          <option value="">{t('verifier.allActions')}</option>
          <option value="approve">{t('verifier.auditApprove')}</option>
          <option value="consent_check">{t('verifier.auditConsentCheck')}</option>
          <option value="consent_uncheck">{t('verifier.auditConsentUncheck')}</option>
          <option value="consent_row_check">{t('verifier.auditConsentRowCheck')}</option>
          <option value="consent_row_mismatch">{t('verifier.auditConsentRowMismatch')}</option>
          <option value="request_fix">{t('verifier.auditRequestFix')}</option>
          <option value="reject">{t('verifier.auditReject')}</option>
          <option value="bulk_submit">{t('verifier.auditBulkSubmit')}</option>
          <option value="claim">{t('verifier.auditClaim')}</option>
          <option value="unclaim">{t('verifier.auditUnclaim')}</option>
          <option value="cancel">{t('verifier.auditCancel')}</option>
        </select>
      </div>

      {/* ── Audit table ── */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-[#F8FAFC] text-left text-xs uppercase tracking-wide text-[#64748B]">
                <th className="px-4 py-3 font-semibold">{t('verifier.colTime')}</th>
                <th className="px-4 py-3 font-semibold">{t('verifier.colJob')}</th>
                <th className="px-4 py-3 font-semibold">{t('verifier.colAction')}</th>
                <th className="px-4 py-3 font-semibold">{t('verifier.colBy')}</th>
                <th className="px-4 py-3 font-semibold">{t('verifier.colDetail')}</th>
                <th className="px-4 py-3 font-semibold">{t('verifier.colResult')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((e) => (
                <tr key={e.id} className="transition hover:bg-[#2862E4]/[0.03]">
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-[#475569]">{fmtTime(e.at, i18n.language)}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-semibold text-[#2862E4]">{e.jobId}</td>
                  <td className="px-4 py-3">
                    <span className={cn('inline-block rounded-full border px-2.5 py-1 text-[11px] font-bold', ACTION_BADGE[e.action])}>
                      {t(ACTION_LABEL_KEY[e.action])}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-[#475569]">{e.actor}</td>
                  <td className="px-4 py-3 text-xs text-[#1E293B]">{e.detail}</td>
                  <td className="px-4 py-3 text-xs font-medium text-[#64748B]">{e.outcome}</td>
                </tr>
              ))}
              {loadError && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-red-600">
                    ⚠ {loadError}
                  </td>
                </tr>
              )}
              {!loadError && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-[#94A3B8]">
                    {t('verifier.noAuditMatches')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-slate-100 bg-[#F8FAFC] px-4 py-2.5 text-xs text-[#64748B]">
          {t('verifier.auditRows', { count: filtered.length })}
        </div>
      </div>
    </div>
  );
}