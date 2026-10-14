/**
 * TrackingJobCard — kartu tracking untuk SATU job onboarding.
 *
 * Bagian dari "Tracking Unggahan & Consent" (stage processing): SEMUA job
 * yang dilacak memiliki kartunya sendiri — meta job, stepper 4-tahap, dan
 * daftar dokumen — sehingga beberapa unggahan paralel tampil sekaligus.
 * Job selesai tampil sebagai kartu "hasil siap" dengan tombol Lihat Hasil,
 * sehingga tidak menutupi antrean lain yang masih proses.
 */
import { useState } from 'react';
import {
  CalendarClock,
  ChevronDown,
  Eye,
  FileSpreadsheet,
  FileText,
  User,
  X,
} from 'lucide-react';
import type { ActiveTrackingDetails } from '../lib/activeTracking';
import type { JobStatus } from '../model/onboardingTypes';
import OnboardingStepper from './OnboardingStepper';

export interface TrackingJobCardProps {
  details: ActiveTrackingDetails;
  /** Dipasang saat job belum selesai — menampilkan tombol batalkan per-job. */
  onCancel?: () => void;
  /** Dipasang saat job selesai & hasil tersedia — tombol "Lihat Hasil". */
  onViewResult?: () => void;
  cancelling?: boolean;
  /** Kartu teratas (job terbaru) terbuka secara default. */
  defaultExpanded?: boolean;
}

const STATUS_CHIP: Record<JobStatus, { label: string; chip: string; dot: string }> = {
  submitted: {
    label: 'Menunggu diproses',
    chip: 'border-amber-200 bg-amber-50 text-amber-700',
    dot: 'bg-amber-500',
  },
  on_progress: {
    label: 'Sedang diproses',
    chip: 'border-indigo-200 bg-indigo-50 text-indigo-700',
    dot: 'bg-indigo-500 animate-pulse',
  },
  verified: {
    label: 'Terverifikasi',
    chip: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    dot: 'bg-emerald-500',
  },
  completed: {
    label: 'Selesai',
    chip: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    dot: 'bg-emerald-500',
  },
  cancelled: {
    label: 'Dibatalkan',
    chip: 'border-slate-200 bg-slate-100 text-slate-500',
    dot: 'bg-slate-400',
  },
};

function formatDateTime(at: number): string {
  return new Date(at).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function TrackingJobCard({
  details,
  onCancel,
  onViewResult,
  cancelling = false,
  defaultExpanded = false,
}: TrackingJobCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const { job, dataFileName, consentFiles } = details;
  const chip = STATUS_CHIP[job.status] ?? STATUS_CHIP.submitted;
  const isBulk = job.mode === 'bulk';
  const ModeIcon = isBulk ? FileSpreadsheet : User;
  const canCancel = Boolean(onCancel) && job.status !== 'completed' && job.status !== 'cancelled';
  const canViewResult = Boolean(onViewResult) && job.status === 'completed';

  return (
    <div
      className={`overflow-hidden rounded-xl border bg-white shadow-sm transition-shadow hover:shadow-md ${
        canViewResult ? 'border-emerald-200' : 'border-slate-200'
      }`}
    >
      {/* ── Header ringkas: mode, status, ID, waktu pengajuan ── */}
      <div className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
        >
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
              isBulk ? 'bg-indigo-50 text-indigo-600' : 'bg-violet-50 text-violet-600'
            }`}
          >
            <ModeIcon className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold text-slate-800">
                {isBulk ? 'Verifikasi Bulk Excel' : 'Verifikasi Individu'}
              </span>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${chip.chip}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${chip.dot}`} />
                {chip.label}
              </span>
            </span>
            <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-400">
              <span className="font-mono">ID {job.id}</span>
              <span className="inline-flex items-center gap-1">
                <CalendarClock className="h-3 w-3" />
                Diajukan {formatDateTime(job.createdAt)}
              </span>
              {consentFiles.length > 0 && <span>{consentFiles.length} dokumen consent</span>}
            </span>
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          {canViewResult && (
            <button
              type="button"
              onClick={onViewResult}
              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            >
              <Eye className="h-3.5 w-3.5" />
              Lihat Hasil
            </button>
          )}
          {canCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={cancelling}
              className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50/70 px-2.5 py-1.5 text-[11px] font-semibold text-red-600 transition-colors hover:bg-red-100/70 focus:outline-none focus:ring-2 focus:ring-red-400/30 disabled:opacity-50"
            >
              <X className="h-3.5 w-3.5" />
              Batalkan
            </button>
          )}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-label={expanded ? 'Ringkas detail job' : 'Buka detail job'}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── Detail: stepper 4-tahap + dokumen ── */}
      {expanded && (
        <div className="border-t border-slate-100 px-4 pb-4 pt-4">
          <OnboardingStepper job={job} />
          <div className="mt-5 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
            {dataFileName && (
              <div className="min-w-0 rounded-lg bg-slate-50 px-3.5 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">File data member</p>
                <p className="mt-1 flex items-center gap-1.5 truncate text-sm font-medium text-slate-700">
                  <FileSpreadsheet className="h-4 w-4 shrink-0 text-emerald-600" />
                  <span className="truncate">{dataFileName}</span>
                </p>
              </div>
            )}
            <div className="min-w-0 rounded-lg bg-slate-50 px-3.5 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Dokumen consent</p>
              {consentFiles.length ? (
                <ul className="mt-2 space-y-2">
                  {consentFiles.map((file) => (
                    <li
                      key={`${file.name}-${file.uploadedAt}`}
                      className="flex min-w-0 items-center justify-between gap-3 text-sm"
                    >
                      <span className="flex min-w-0 items-center gap-1.5">
                        <FileText className="h-4 w-4 shrink-0 text-indigo-500" />
                        <span className="truncate font-medium text-slate-700">{file.name}</span>
                        {formatFileSize(file.size) && (
                          <span className="shrink-0 text-[10px] text-slate-400">{formatFileSize(file.size)}</span>
                        )}
                      </span>
                      <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                        {job.status === 'completed' ? 'Terverifikasi' : 'Dalam verifikasi'}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-sm text-slate-500">Menunggu detail dokumen</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}