/**
 * VerificationResult — Modul 3b.
 *
 * 3 UI variants after verification completes:
 * a. Success      → green card + "Lihat ADScore"
 * b. Not Found    → amber card + fix instructions + re-upload
 * c. Bulk Confirm → banner catatan verifikator + 4 seksi klasifikasi verdict
 *                  (Siap Lanjut / Consent Tidak Sesuai / Tidak Ditemukan /
 *                  Belum Dapat Diverifikasi) + pemilih member bila >1 siap
 *                  + unduh template baris gagal.
 */
import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Download,
  FileQuestion,
  FileSpreadsheet,
  FileText,
  FileX,
  SearchX,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { LS_TOKEN_KEY } from '@/shared/constants';
import { API_URLS } from '@/shared/store/api';
import type { OnboardingJob, RegisteredMember } from '../model/onboardingTypes';

export interface VerificationResultProps {
  job: OnboardingJob;
  onViewAdScore: (member: RegisteredMember) => void;
  onReupload: () => void;
  onBackToSearch: () => void;
  /** Menerima HANYA baris siap lanjut (member ditemukan + consent sesuai). */
  onConfirmBulk: (ready: RegisteredMember[]) => void;
}

function formatTanggal(iso: string): string {
  if (!iso) return '-';
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

function GenderBadge({ value }: { value: string }) {
  const isM = value === 'M';
  return (
    <span
      className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
        isM ? 'bg-blue-50 text-blue-700' : 'bg-pink-50 text-pink-700'
      }`}
    >
      {isM ? 'L' : 'P'}
    </span>
  );
}

/** Badge status verifikasi dokumen persetujuan satu baris bulk. */
function ConsentBadge({ state }: { state: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    match: { label: 'Sesuai', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
    mismatch: { label: 'Tidak Sesuai', cls: 'bg-rose-50 text-rose-700 ring-rose-200' },
    unverified: { label: 'Belum Diverifikasi', cls: 'bg-amber-50 text-amber-700 ring-amber-200' },
    none: { label: '—', cls: 'bg-slate-50 text-slate-400 ring-slate-200' },
  };
  const v = map[state] ?? map.none;
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${v.cls}`}>
      {v.label}
    </span>
  );
}

export default function VerificationResult({
  job,
  onViewAdScore,
  onReupload,
  onBackToSearch,
  onConfirmBulk,
}: VerificationResultProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const result = job.result;
  if (!result) return null;

  /* ── a. Success ── */
  if (result.kind === 'success') {
    const { member, consentFiles } = result;
    return (
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="overflow-hidden rounded-2xl border border-emerald-200/80 bg-white shadow-sm"
      >
        <div className="flex items-start gap-4 border-b border-emerald-100 bg-gradient-to-b from-emerald-50/80 to-white px-6 py-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Data Member Ditemukan & Terverifikasi
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Data <strong className="text-slate-700">{member.nama}</strong> berhasil ditemukan di
              jaringan AdMedika dan telah terverifikasi. Dashboard AdScore siap ditampilkan.
            </p>
          </div>
        </div>

        {/* Verified fields */}
        <div className="grid grid-cols-2 gap-3 px-6 py-4 sm:grid-cols-4">
          {[
            { label: 'Nama Lengkap', value: member.nama },
            { label: 'Tanggal Lahir', value: formatTanggal(member.tglLahir) },
            { label: 'Jenis Kelamin', value: member.gender === 'M' ? 'Laki-laki' : 'Perempuan' },
            {
              label: 'Form Consent',
              value: `${consentFiles.length} file terverifikasi`,
            },
          ].map((f) => (
            <div key={f.label} className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{f.label}</p>
              <p className="mt-0.5 truncate text-xs font-bold text-slate-800" title={f.value}>
                {f.value}
              </p>
            </div>
          ))}
        </div>

        {consentFiles.length > 0 && (
          <div className="border-t border-slate-100 px-6 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
              Consent terlampir
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {consentFiles.map((c, i) => (
                <span
                  key={`${c.name}-${i}`}
                  className="inline-flex max-w-[240px] items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600"
                  title={c.name}
                >
                  <FileText className="h-3 w-3 shrink-0 text-slate-400" />
                  <span className="truncate">{c.name}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Next step */}
        <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/60 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] text-slate-400">
            Langkah berikutnya: tampilkan dashboard AdScore — desain existing, tanpa perubahan.
          </p>
          <button
            type="button"
            onClick={() => onViewAdScore(member)}
            className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-2.5 text-xs font-semibold text-white shadow-md transition hover:from-indigo-700 hover:to-purple-700 hover:shadow-lg active:scale-95"
          >
            <ShieldCheck className="h-4 w-4" />
            <span>Lihat ADScore</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </motion.div>
    );
  }

  /* ── b. Not Found ── */
  if (result.kind === 'notfound') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="overflow-hidden rounded-2xl border border-amber-200/80 bg-white shadow-sm"
      >
        <div className="flex items-start gap-4 border-b border-amber-100 bg-gradient-to-b from-amber-50/80 to-white px-6 py-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white shadow-md">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Data Member Tidak Ditemukan</h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Kombinasi data <strong className="text-slate-700">{result.identity.nama}</strong>
              {result.identity.tglLahir ? ` · lahir ${formatTanggal(result.identity.tglLahir)}` : ''}
              {result.identity.gender ? ` · ${result.identity.gender === 'M' ? 'Laki-laki' : 'Perempuan'}` : ''} tidak
              cocok dengan data keanggotaan AdMedika.
            </p>
            <p className="mt-1 text-[11px] font-medium text-amber-700">Alasan: {result.reason}</p>
          </div>
        </div>

        {/* Fix instructions */}
        <div className="px-6 py-4">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
            Saran perbaikan sebelum upload ulang
          </p>
          <ul className="mt-2 space-y-1.5">
            {[
              'Pastikan nama sesuai KTP dan ejaan benar',
              'Gunakan format tanggal YYYY-MM-DD',
              'Untuk bulk, gunakan template Excel resmi',
              'Lampirkan form consent yang aktif / bertanda tangan',
            ].map((tip) => (
              <li key={tip} className="flex items-start gap-2 text-xs text-slate-600">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                {tip}
              </li>
            ))}
          </ul>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 border-t border-slate-100 bg-slate-50/60 px-6 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onBackToSearch}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 transition hover:bg-white"
          >
            Kembali ke Pencarian
          </button>
          <button
            type="button"
            onClick={onReupload}
            className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-2.5 text-xs font-semibold text-white shadow-md transition hover:from-indigo-700 hover:to-purple-700 hover:shadow-lg active:scale-95"
          >
            <SearchX className="h-4 w-4" />
            <span>Upload Ulang Data</span>
          </button>
        </div>
      </motion.div>
    );
  }

  /* ── c. Bulk Status Confirmation ── */
  const { rows, ready, fileName, totalRows } = result;
  const readyRows = ready.filter((m) => rows.some((r) => r.verdict === 'ready' && r.memberId === m.memberId));
  const consentMismatch = rows.filter((r) => r.verdict === 'consent-mismatch');
  const memberNotFound = rows.filter((r) => r.verdict === 'member-not-found');
  const unresolved = rows.filter((r) => r.verdict === 'unresolved');
  const failedRows = [...consentMismatch, ...memberNotFound, ...unresolved];
  const hasFailed = failedRows.length > 0;

  /** Unduh template Excel berisi HANYA baris gagal (server-side, ter-pra-isi). */
  const downloadFailedRowsTemplate = async () => {
    setDownloading(true);
    try {
      const token = localStorage.getItem(LS_TOKEN_KEY);
      const response = await fetch(
        `${API_URLS.adscore}/onboarding/${encodeURIComponent(job.id)}/failed-rows-template`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} },
      );
      if (response.ok) {
        const url = URL.createObjectURL(await response.blob());
        const link = document.createElement('a');
        link.href = url;
        link.download = `AdScore-Baris-Gagal-${job.id}.xlsx`;
        link.click();
        URL.revokeObjectURL(url);
      }
    } finally {
      setDownloading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm"
    >
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-slate-100 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-md">
            <FileSpreadsheet className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Konfirmasi Hasil Pencarian Bulk</h3>
            <p className="mt-0.5 truncate text-[11px] text-slate-400" title={fileName}>
              File: {fileName} · {totalRows} baris diproses
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-200">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {readyRows.length} Siap Lanjut
          </span>
          {hasFailed && (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700 ring-1 ring-rose-200">
              <SearchX className="h-3.5 w-3.5" />
              {failedRows.length} Perlu Upload Ulang
            </span>
          )}
        </div>
      </div>

      {/* Banner catatan verifikator (fixNote / fixCategory dari hasil request-fix) */}
      {(job.fixNote || job.fixCategory) && (
        <div className="flex items-start gap-3 border-b border-amber-100 bg-amber-50/70 px-6 py-3.5">
          <FileText className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wide text-amber-700">
              Catatan Verifikator
              {job.fixCategory ? ` — ${job.fixCategory}` : ''}
            </p>
            {job.fixNote && (
              <p className="mt-0.5 text-xs leading-relaxed text-amber-800">{job.fixNote}</p>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-0 lg:grid-cols-2">
        {/* ── Seksi 1: Siap Lanjut (member ditemukan + consent sesuai) ── */}
        <div className="border-b border-slate-100 lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-2 border-b border-emerald-100 bg-emerald-50/60 px-5 py-3">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <h4 className="text-xs font-bold text-emerald-800">Siap Lanjut ke Dashboard AdScore</h4>
            <span className="ml-auto rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
              {readyRows.length} member
            </span>
          </div>
          {readyRows.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <SearchX className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-2 text-xs font-semibold text-slate-500">
                Belum ada baris yang siap lanjut.
              </p>
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    <th className="px-5 py-2">Nama Lengkap</th>
                    <th className="px-3 py-2">Tgl Lahir</th>
                    <th className="px-3 py-2">JK</th>
                    <th className="px-3 py-2">Member ID</th>
                    <th className="px-5 py-2 text-right">Consent</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {readyRows.map((m) => (
                    <tr key={m.memberId} className="transition-colors hover:bg-slate-50/60">
                      <td className="px-5 py-2 font-semibold text-slate-700">{m.nama}</td>
                      <td className="px-3 py-2 text-slate-500">{formatTanggal(m.tglLahir)}</td>
                      <td className="px-3 py-2">
                        <GenderBadge value={m.gender} />
                      </td>
                      <td className="px-3 py-2 font-mono text-[10px] text-slate-500">{m.memberId}</td>
                      <td className="px-5 py-2 text-right">
                        <ConsentBadge state="match" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Seksi 2: Perlu Upload Ulang (3 kategori) ── */}
        <div>
          <div className="flex items-center gap-2 border-b border-rose-100 bg-rose-50/60 px-5 py-3">
            <SearchX className="h-4 w-4 text-rose-600" />
            <h4 className="text-xs font-bold text-rose-800">Perlu Upload Ulang</h4>
            <span className="ml-auto rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">
              {failedRows.length} baris
            </span>
          </div>
          {!hasFailed ? (
            <div className="px-5 py-8 text-center">
              <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-300" />
              <p className="mt-2 text-xs font-semibold text-slate-500">
                Semua baris lolos verifikasi — tidak ada data gagal.
              </p>
            </div>
          ) : (
            <div className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
              {[
                {
                  key: 'consent-mismatch',
                  icon: FileX,
                  title: 'Dokumen Persetujuan Tidak Sesuai',
                  cls: 'text-rose-700',
                  rows: consentMismatch,
                },
                {
                  key: 'member-not-found',
                  icon: SearchX,
                  title: 'Data Member Tidak Ditemukan',
                  cls: 'text-rose-700',
                  rows: memberNotFound,
                },
                {
                  key: 'unresolved',
                  icon: FileQuestion,
                  title: 'Belum Dapat Diverifikasi',
                  cls: 'text-amber-700',
                  rows: unresolved,
                },
              ]
                .filter((g) => g.rows.length > 0)
                .map((g) => (
                  <div key={g.key}>
                    <div className="flex items-center gap-1.5 bg-slate-50/70 px-5 py-1.5">
                      <g.icon className={`h-3.5 w-3.5 ${g.cls}`} />
                      <p className={`text-[10px] font-bold uppercase tracking-wide ${g.cls}`}>
                        {g.title}
                      </p>
                      <span className="ml-auto text-[10px] font-bold text-slate-400">
                        {g.rows.length} baris
                      </span>
                    </div>
                    <table className="w-full text-left text-xs">
                      <tbody className="divide-y divide-slate-50">
                        {g.rows.map((r) => (
                          <tr key={`r${r.rowNo}`} className="transition-colors hover:bg-slate-50/60">
                            <td className="px-3 py-2 pl-5 text-[10px] font-bold text-slate-300">
                              {r.rowNo}
                            </td>
                            <td className="px-3 py-2 font-semibold text-slate-700">{r.nama}</td>
                            <td className="px-3 py-2 text-slate-500">{formatTanggal(r.tglLahir)}</td>
                            <td className="px-5 py-2">
                              <span className="line-clamp-2 text-[10px] font-medium text-rose-600">
                                {r.note}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Pemilih member — tampil hanya bila >1 baris siap lanjut */}
      {pickerOpen && readyRows.length > 1 && (
        <div className="border-t border-indigo-100 bg-indigo-50/50 px-6 py-4">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-indigo-600" />
            <p className="text-xs font-bold text-indigo-900">
              Pilih member untuk membuka Dashboard AdScore
            </p>
            <button
              type="button"
              onClick={() => setPickerOpen(false)}
              className="ml-auto rounded-lg px-2 py-1 text-[11px] font-bold text-slate-500 transition hover:bg-white"
            >
              Tutup
            </button>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {readyRows.map((m) => (
              <button
                key={m.memberId}
                type="button"
                onClick={() => onConfirmBulk([m])}
                className="flex items-center justify-between gap-3 rounded-xl border border-indigo-200 bg-white px-4 py-3 text-left shadow-sm transition hover:border-indigo-400 hover:shadow-md active:scale-[0.98]"
              >
                <span className="min-w-0">
                  <span className="block truncate text-xs font-bold text-slate-800">{m.nama}</span>
                  <span className="block text-[10px] text-slate-400">
                    {formatTanggal(m.tglLahir)} · <span className="font-mono">{m.memberId}</span>
                  </span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-indigo-500" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Footer actions */}
      <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/60 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[11px] text-slate-400">
          Hanya baris <strong className="text-slate-600">Siap Lanjut</strong> (member ditemukan dan
          dokumen persetujuan sesuai) yang dapat dibuka di dashboard.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          {hasFailed && (
            <>
              <button
                type="button"
                onClick={downloadFailedRowsTemplate}
                disabled={downloading}
                className="flex items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-white px-4 py-2.5 text-xs font-bold text-indigo-700 shadow-sm transition hover:bg-indigo-50 disabled:opacity-60"
              >
                <Download className="h-4 w-4" />
                <span>{downloading ? 'Menyiapkan…' : 'Unduh Template Baris Gagal'}</span>
              </button>
              <button
                type="button"
                onClick={onReupload}
                className="rounded-xl border border-rose-200 bg-rose-50/60 px-4 py-2.5 text-xs font-bold text-rose-700 transition hover:bg-rose-100/60"
              >
                Upload Ulang ({failedRows.length} baris)
              </button>
            </>
          )}
          {readyRows.length > 0 && (
            <button
              type="button"
              onClick={() => (readyRows.length > 1 ? setPickerOpen(true) : onConfirmBulk(readyRows))}
              className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-2.5 text-xs font-semibold text-white shadow-md transition hover:from-indigo-700 hover:to-purple-700 hover:shadow-lg active:scale-95"
            >
              <ShieldCheck className="h-4 w-4" />
              <span>
                {readyRows.length > 1 ? `Lanjut ke Dashboard (${readyRows.length} siap)` : 'Lanjut ke Dashboard'}
              </span>
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}