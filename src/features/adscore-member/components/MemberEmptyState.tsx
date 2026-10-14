/**
 * MemberEmptyState — Modul 1b.
 *
 * Three variants:
 * - 'no-data'              : registry is empty → invite first upload.
 * - 'not-found'            : member not found for the searched name → suggest fixing data / upload.
 * - 'verification-pending' : member found but its verification job is still active →
 *                            dashboard AdScore diblokir sampai verifikasi dokumen selesai.
 */
import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle2, Clock, Loader2, SearchX, ShieldCheck, Upload, XCircle } from 'lucide-react';
import type { EmptyVariant } from '../model/onboardingTypes';

export interface MemberEmptyStateProps {
  variant: EmptyVariant;
  searchedName?: string;
  /** Hanya untuk varian verification-blocked: alasan keputusan verifikator terakhir. */
  blockedReason?: string;
  onUploadClick: () => void;
  /** Fase 5: hasil cek eksplisit ke registry AdBrief (opsional). */
  adbriefCheck?: { state: 'checking' | 'found' | 'notfound' | 'error'; message?: string };
  onAdBriefCheck?: () => void;
  /** Hanya untuk varian verification-pending: buka tracking verifikasi bila
   * job aktif milik user ini. */
  onTrackingClick?: () => void;
}

const FLOW_STEPS = [
  'Isi pencarian member',
  'Unggah data & consent',
  'Verifikasi otomatis',
  'Lihat dashboard AdScore',
];

export default function MemberEmptyState({
  variant,
  searchedName,
  blockedReason,
  onUploadClick,
  adbriefCheck,
  onAdBriefCheck,
  onTrackingClick,
}: MemberEmptyStateProps) {
  const isNoData = variant === 'no-data';
  const isPending = variant === 'verification-pending';
  const isBlocked = variant === 'verification-blocked';

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm"
    >
      {/* Illustration header */}
      <div className="relative flex flex-col items-center overflow-hidden bg-gradient-to-b from-indigo-50/80 to-white px-6 pb-6 pt-8">
        <div className="pointer-events-none absolute -left-10 -top-10 h-32 w-32 rounded-full bg-indigo-200/30 blur-2xl" />
        <div className="pointer-events-none absolute -right-10 top-6 h-24 w-24 rounded-full bg-purple-200/30 blur-2xl" />

        {/* Upload illustration (inline SVG) */}
        <svg viewBox="0 0 160 120" className="h-28 w-40" aria-hidden="true">
          <defs>
            <linearGradient id="emptyG1" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#6366F1" />
              <stop offset="100%" stopColor="#8B5CF6" />
            </linearGradient>
          </defs>
          {/* cloud */}
          <path
            d="M45 62a18 18 0 0 1 2.5-35.8A24 24 0 0 1 92 20a20 20 0 0 1 23 19.6A16 16 0 0 1 112 62H45z"
            fill="url(#emptyG1)"
            opacity="0.16"
          />
          <path
            d="M45 62a18 18 0 0 1 2.5-35.8A24 24 0 0 1 92 20a20 20 0 0 1 23 19.6A16 16 0 0 1 112 62H45z"
            fill="none"
            stroke="#6366F1"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          {/* arrow up */}
          <path d="M78 96V64" stroke="#7C3AED" strokeWidth="3.5" strokeLinecap="round" />
          <path d="m66 76 12-13 12 13" fill="none" stroke="#7C3AED" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
          {/* base line */}
          <path d="M52 104h56" stroke="#C7D2FE" strokeWidth="6" strokeLinecap="round" />
          {/* sparkle dots */}
          <circle cx="34" cy="30" r="3" fill="#A5B4FC" />
          <circle cx="128" cy="44" r="4" fill="#C4B5FD" />
          <circle cx="120" cy="90" r="2.5" fill="#A5B4FC" />
        </svg>

        <h3 className="mt-2 text-base font-bold text-slate-900">
          {isNoData
            ? 'Belum Ada Data Member'
            : isPending
              ? 'Verifikasi Dokumen Masih Dalam Proses'
              : isBlocked
                ? 'Verifikasi Tidak Lolos — Perlu Perbaikan'
                : 'Data Member Tidak Ditemukan'}
        </h3>
        <p className="mt-1.5 max-w-md text-center text-xs leading-relaxed text-slate-500">
          {isNoData
            ? 'Data member belum tersedia di jaringan AdMedika. Unggah data member beserta form consent untuk memulai analisis AdScore.'
            : isPending
              ? `Member "${searchedName || '-'}" terdaftar tetapi masih dalam proses verifikasi dokumen. Dashboard AdScore dapat dibuka setelah hasil verifikasi dokumen selesai.`
              : isBlocked
                ? `Member "${searchedName || '-'}" terdaftar, tetapi keputusan verifikasi terakhir belum lolos. Dashboard AdScore diblokir sampai dokumen diperbaiki dan diajukan ulang.`
                : `Member dengan nama "${searchedName || '-'}" tidak ditemukan. Periksa ejaan nama, tanggal lahir, dan gender lalu coba cari lagi atau unggah data member baru.`}
        </p>

        {isPending ? (
          onTrackingClick ? (
            <button
              type="button"
              onClick={onTrackingClick}
              className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:from-indigo-700 hover:to-purple-700 active:scale-95"
            >
              <ShieldCheck className="h-4 w-4" />
              Buka Tracking Verifikasi
            </button>
          ) : null
        ) : (
        <button
          type="button"
          onClick={onUploadClick}
          className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:from-indigo-700 hover:to-purple-700 hover:shadow-lg active:scale-95"
        >
          <Upload className="h-4 w-4" />
          <span>Upload Data Member</span>
          <ArrowRight className="h-4 w-4" />
        </button>
        )}
      </div>

      {/* Flow steps */}
      <div className="grid grid-cols-2 gap-3 border-t border-slate-100 bg-slate-50/50 px-6 py-4 sm:grid-cols-4">
        {FLOW_STEPS.map((step, idx) => (
          <div key={step} className="flex items-center gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-700">
              {idx + 1}
            </span>
            <span className="text-[11px] font-medium text-slate-600">{step}</span>
          </div>
        ))}
      </div>

      {/* Fase 5: panel Cek Member AdBrief — cek eksplisit ke registry keanggotaan */}
      {!isNoData && !isPending && onAdBriefCheck && (
        <div className="border-t border-slate-100 px-6 py-4">
          {adbriefCheck?.state === 'checking' ? (
            <div className="flex items-center gap-2 rounded-lg border border-indigo-100 bg-indigo-50/60 px-3 py-2.5">
              <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
              <p className="text-xs font-semibold text-indigo-700">Memeriksa registry keanggotaan AdMedika (AdBrief)…</p>
            </div>
          ) : adbriefCheck?.state === 'found' ? (
            <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2.5">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <div>
                <p className="text-xs font-bold text-emerald-800">✓ Member terverifikasi di AdBrief</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-emerald-700">
                  Identitas terdaftar di registry keanggotaan AdMedika, tetapi belum memiliki data di dashboard ini. Unggah data member beserta form consent untuk mendaftarkannya.
                </p>
              </div>
            </div>
          ) : adbriefCheck?.state === 'notfound' ? (
            <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50/70 px-3 py-2.5">
              <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
              <div>
                <p className="text-xs font-bold text-rose-800">Data Member Tidak Ada di AdBrief</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-rose-700">
                  Identitas tidak terdaftar di registry keanggotaan AdMedika. Periksa ejaan nama, tanggal lahir, dan gender lalu coba lagi.
                </p>
              </div>
            </div>
          ) : adbriefCheck?.state === 'error' ? (
            <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50/70 px-3 py-2.5">
              <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
              <div className="flex-1">
                <p className="text-xs font-bold text-rose-800">Gagal memeriksa member</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-rose-700">{adbriefCheck.message || 'Layanan cek member tidak dapat dihubungi.'}</p>
              </div>
            </div>
          ) : null}
          {(!adbriefCheck || adbriefCheck.state === 'error') && (
            <button
              type="button"
              onClick={onAdBriefCheck}
              className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-white px-4 py-2.5 text-xs font-bold text-indigo-700 shadow-sm transition hover:bg-indigo-50 active:scale-95"
            >
              <ShieldCheck className="h-4 w-4" />
              <span>Cek Member di AdBrief</span>
            </button>
          )}
        </div>
      )}

      {/* not-found hint */}
      {variant === 'not-found' && (
        <div className="flex items-start gap-2 border-t border-amber-100 bg-amber-50/60 px-6 py-3 text-[11px] text-amber-800">
          <SearchX className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
          <p>
            <strong>Saran:</strong> pastikan nama sesuai KTP, format tanggal YYYY-MM-DD, dan jenis kelamin benar — lalu coba cari lagi atau unggah data member.
          </p>
        </div>
      )}

      {/* verification-blocked hint — keputusan verifikator terakhir bukan siap lanjut */}
      {isBlocked && (
        <div className="flex items-start gap-2 border-t border-rose-100 bg-rose-50/60 px-6 py-3 text-[11px] text-rose-800">
          <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-600" />
          <p>
            <strong>Alasan verifikator:</strong> {blockedReason || 'Hasil verifikasi terakhir belum siap lanjut.'}{' '}
            Perbaiki dokumen persetujuan / data yang ditandai, lalu unggah ulang untuk verifikasi baru.
          </p>
        </div>
      )}

      {/* verification-pending hint */}
      {isPending && (
        <div className="flex items-start gap-2 border-t border-indigo-100 bg-indigo-50/60 px-6 py-3 text-[11px] text-indigo-800">
          <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-600" />
          <p>
            <strong>Alur:</strong> dokumen consent sedang diverifikasi admin. Setelah verifikasi selesai, cari kembali member ini untuk membuka dashboard AdScore.
          </p>
        </div>
      )}
    </motion.div>
  );
}