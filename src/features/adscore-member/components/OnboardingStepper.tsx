/**
 * OnboardingStepper — Modul 3a.
 *
 * 4-stage horizontal stepper: Submitted → On Progress → Verified → Completed.
 * States: done (indigo + check), active (pulse + spinner), pending (slate).
 * Timestamps are shown from the job timeline. Dirender per-job di dalam
 * TrackingJobCard sehingga setiap unggahan aktif punya progresnya sendiri.
 */
import { useEffect, useState } from 'react';
import { Check, CheckCircle2, Loader2, Send, ShieldCheck, Timer } from 'lucide-react';
import type { JobStatus, OnboardingJob } from '../model/onboardingTypes';

export interface OnboardingStepperProps {
  job: OnboardingJob;
}

const STEPS: Array<{
  status: JobStatus;
  label: string;
  desc: string;
  icon: typeof Send;
}> = [
  { status: 'submitted', label: 'Submitted', desc: 'Data & consent diterima', icon: Send },
  { status: 'on_progress', label: 'On Progress', desc: 'Memproses & mencocokkan data', icon: Loader2 },
  { status: 'verified', label: 'Verified', desc: 'Verifikasi keanggotaan & consent', icon: ShieldCheck },
  { status: 'completed', label: 'Completed', desc: 'Selesai — hasil tersedia', icon: CheckCircle2 },
];

const STATUS_LABEL: Record<JobStatus, string> = {
  submitted: 'Menunggu diproses',
  on_progress: 'Sedang diproses',
  verified: 'Terverifikasi — menyiapkan hasil',
  completed: 'Verifikasi selesai',
  cancelled: 'Dibatalkan',
};

function formatTime(at: number): string {
  return new Date(at).toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/** Tick jam berkala agar durasi "berjalan" tetap segar meski polling jarang. */
function useElapsedNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}

function formatElapsed(from: number, to: number): string {
  const totalSec = Math.max(0, Math.round((to - from) / 1000));
  if (totalSec < 60) return `${totalSec} dtk`;
  const min = Math.floor(totalSec / 60);
  if (min < 60) return `${min} mnt`;
  const hr = Math.floor(min / 60);
  const rem = min % 60;
  return rem > 0 ? `${hr} jam ${rem} mnt` : `${hr} jam`;
}

export default function OnboardingStepper({ job }: OnboardingStepperProps) {
  const now = useElapsedNow();
  const currentIndex = STEPS.findIndex((s) => s.status === job.status);
  const progressPct = ((currentIndex + 1) / STEPS.length) * 100;
  const isRunning = job.status !== 'completed' && job.status !== 'cancelled';

  return (
    <div>
      {/* Steps */}
      <div className="flex items-start">
        {STEPS.map((step, idx) => {
          const isDone = idx < currentIndex || job.status === 'completed';
          const isActive = idx === currentIndex && job.status !== 'completed';
          const Icon = step.icon;
          const timelineEntry = job.timeline.find((t) => t.status === step.status);

          return (
            <div key={step.status} className="flex flex-1 items-start last:flex-none">
              {/* Node */}
              <div className="flex w-20 flex-col items-center sm:w-24">
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-full transition-all ${
                    isDone
                      ? 'bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-md'
                      : isActive
                        ? 'pulse-ring bg-indigo-600 text-white shadow-md'
                        : 'border-2 border-slate-200 bg-white text-slate-300'
                  }`}
                >
                  {isDone ? (
                    <Check className="h-5 w-5" />
                  ) : isActive ? (
                    <Icon className={`h-5 w-5 ${step.status === 'on_progress' ? 'animate-spin' : ''}`} />
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                </div>
                <p
                  className={`mt-2 text-center text-[11px] font-bold leading-tight ${
                    isDone || isActive ? 'text-slate-800' : 'text-slate-400'
                  }`}
                >
                  {step.label}
                </p>
                <p className="mt-0.5 hidden text-center text-[10px] leading-tight text-slate-400 sm:block">
                  {step.desc}
                </p>
                {timelineEntry && (
                  <span
                    className={`mt-1 rounded-full px-1.5 py-0.5 font-mono text-[9px] ${
                      isDone
                        ? 'bg-indigo-50 text-indigo-600'
                        : 'bg-indigo-100 text-indigo-700'
                    }`}
                  >
                    {formatTime(timelineEntry.at)}
                  </span>
                )}
              </div>

              {/* Connector */}
              {idx < STEPS.length - 1 && (
                <div className="relative mx-1 mt-5 h-1 flex-1 overflow-hidden rounded-full bg-slate-200 sm:mx-2">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-700 ease-out"
                    style={{ width: isDone ? '100%' : isActive ? '50%' : '0%' }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="mt-6">
        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <span>{STATUS_LABEL[job.status] ?? 'Memproses…'}</span>
            {isRunning && (
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-1.5 py-0.5 font-mono text-[10px] font-medium text-indigo-600">
                <Timer className="h-3 w-3" />
                {formatElapsed(job.createdAt, now)}
              </span>
            )}
          </span>
          <span className="font-mono">
            {job.status === 'cancelled'
              ? 'Dihentikan'
              : `Tahap ${Math.max(currentIndex + 1, 1)}/${STEPS.length} · ${Math.round(progressPct)}%`}
          </span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-700 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>
    </div>
  );
}