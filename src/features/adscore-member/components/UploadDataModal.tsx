/**
 * UploadDataModal — Modul 2.
 *
 * Dialog with 2 tabs:
 * - Individu  : nama + tgl lahir + gender (segmented M/F) + consent files (multi)
 * - Bulk Excel: download official template + data member .xlsx + consent files (multi)
 *
 * Validation is inline; submit hands the payload to the page orchestrator.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  ShieldCheck,
  UserRound,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { LS_TOKEN_KEY } from '@/shared/constants';
import { API_URLS } from '@/shared/store/api';
import { checkMemberIdentity, previewBulkMembers, type BulkPreviewResult } from '../lib/onboardingApi';
import FileDropzone from './FileDropzone';
import type {
  BulkSubmitPayload,
  ConsentFileMeta,
  IndividuSubmitPayload,
  MemberGender,
} from '../model/onboardingTypes';

export interface UploadDataModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab: 'individu' | 'bulk';
  onSubmitIndividu: (payload: IndividuSubmitPayload, files: File[]) => Promise<void>;
  onSubmitBulk: (payload: BulkSubmitPayload, dataFile: File, consentFiles: File[]) => Promise<void>;
  submitting: boolean;
}

const TEMPLATE_URL = `${API_URLS.adscore}/onboarding/template`;
const CONSENT_ACCEPT = '.pdf,.jpg,.jpeg,.png';

/** State kartu "Cek Member AdBrief" (gerbang validasi identitas). */
type AdBriefCheckState = 'idle' | 'checking' | 'found' | 'notfound' | 'error';

function toMeta(files: File[]): ConsentFileMeta[] {
  return files.map((f) => ({ name: f.name, size: f.size, type: f.type, uploadedAt: Date.now() }));
}

export default function UploadDataModal({
  open,
  onOpenChange,
  defaultTab,
  onSubmitIndividu,
  onSubmitBulk,
  submitting,
}: UploadDataModalProps) {
  const [tab, setTab] = useState<'individu' | 'bulk'>(defaultTab);

  // Individu form
  const [nama, setNama] = useState('');
  const [tglLahir, setTglLahir] = useState('');
  const [gender, setGender] = useState<MemberGender | ''>('');
  const [consentFiles, setConsentFiles] = useState<File[]>([]);

  // Bulk form
  const [dataFile, setDataFile] = useState<File | null>(null);
  const [bulkConsentFiles, setBulkConsentFiles] = useState<File[]>([]);

  // ── Fase 5: pre-check per baris file bulk ke AdBrief (preview, no job) ──
  const [bulkPreview, setBulkPreview] = useState<{ loading: boolean; error: string; result?: BulkPreviewResult }>({
    loading: false,
    error: '',
  });
  const bulkPreviewSeq = useRef(0);

  const runBulkPreview = useCallback(async (file: File) => {
    const seq = ++bulkPreviewSeq.current;
    setBulkPreview({ loading: true, error: '' });
    try {
      const result = await previewBulkMembers(file);
      if (bulkPreviewSeq.current !== seq) return; // file sudah diganti — abaikan respons basi
      setBulkPreview({ loading: false, error: '', result });
    } catch (error) {
      if (bulkPreviewSeq.current !== seq) return;
      setBulkPreview({ loading: false, error: error instanceof Error ? error.message : 'Gagal memeriksa file' });
    }
  }, []);

  // Pre-check otomatis setiap kali file data member dipilih/diganti
  useEffect(() => {
    if (tab !== 'bulk') return;
    if (!dataFile) {
      bulkPreviewSeq.current += 1;
      setBulkPreview({ loading: false, error: '' });
      return;
    }
    void runBulkPreview(dataFile);
  }, [dataFile, tab, runBulkPreview]);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submissionError, setSubmissionError] = useState('');

  // ── Cek Member AdBrief — gerbang validasi identitas (auto-check) ──
  const [checkState, setCheckState] = useState<AdBriefCheckState>('idle');
  const [checkError, setCheckError] = useState('');
  const lastCheckedRef = useRef('');

  const performCheck = useCallback(async () => {
    const key = `${nama.trim()}|${tglLahir}|${gender}`;
    if (!nama.trim() || !tglLahir || !gender) return;
    lastCheckedRef.current = key;
    setCheckState('checking');
    setCheckError('');
    try {
      const result = await checkMemberIdentity({ nama: nama.trim(), tglLahir, gender });
      if (lastCheckedRef.current !== key) return; // respons basi — identitas sudah berubah
      setCheckState(result.found ? 'found' : 'notfound');
    } catch (error) {
      if (lastCheckedRef.current !== key) return; // respons basi — identitas sudah berubah
      setCheckState('error');
      setCheckError(error instanceof Error ? error.message : 'Gagal memeriksa member');
    }
  }, [nama, tglLahir, gender]);

  // Auto-check (debounced 600ms) setiap kali ketiga field identitas lengkap
  useEffect(() => {
    if (tab !== 'individu') return;
    const key = `${nama.trim()}|${tglLahir}|${gender}`;
    if (nama.trim().length < 3 || !tglLahir || !gender) {
      lastCheckedRef.current = '';
      setCheckState('idle');
      setCheckError('');
      return;
    }
    if (lastCheckedRef.current === key) return;
    const timer = window.setTimeout(() => void performCheck(), 600);
    return () => window.clearTimeout(timer);
  }, [nama, tglLahir, gender, tab, performCheck]);

  if (!open) return null;

  const validateIndividu = (): boolean => {
    const errs: Record<string, string> = {};
    if (nama.trim().length < 3) errs.nama = 'Nama wajib diisi (min. 3 karakter)';
    if (!tglLahir) errs.tglLahir = 'Tanggal lahir wajib diisi';
    if (!gender) errs.gender = 'Pilih jenis kelamin';
    if (consentFiles.length === 0) errs.consent = 'Minimal 1 form consent wajib diunggah';
    if (consentFiles.length > 5) errs.consent = 'Maksimal 5 dokumen consent dapat diunggah';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateBulk = (): boolean => {
    const errs: Record<string, string> = {};
    if (!dataFile) errs.dataFile = 'File data member (.xlsx) wajib diunggah';
    if (bulkConsentFiles.length === 0) errs.consent = 'Minimal 1 form consent wajib diunggah';
    if (bulkConsentFiles.length > 5) errs.consent = 'Maksimal 5 dokumen consent dapat diunggah';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    setSubmissionError('');
    if (tab === 'individu') {
      if (!validateIndividu()) return;
      if (checkState === 'notfound') {
        setSubmissionError('Data Member Tidak Ada di registry AdMedika — pengajuan tidak dapat dilanjutkan.');
        return;
      }
      try {
        await onSubmitIndividu({
          nama: nama.trim(),
          tglLahir,
          gender: gender as MemberGender,
          consentFiles: toMeta(consentFiles),
        }, consentFiles);
      } catch (error) {
        setSubmissionError(error instanceof Error ? error.message : 'Gagal mengunggah dokumen');
      }
    } else {
      if (!validateBulk()) return;
      try {
        await onSubmitBulk({
          dataFileName: dataFile!.name,
          dataFileSize: dataFile!.size,
          consentFiles: toMeta(bulkConsentFiles),
        }, dataFile!, bulkConsentFiles);
      } catch (error) {
        setSubmissionError(error instanceof Error ? error.message : 'Gagal mengunggah dokumen');
      }
    }
  };

  const close = () => onOpenChange(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={close}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Upload Data Member"
        className="relative z-10 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-100 bg-white/95 px-6 py-4 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-md">
              <FileSpreadsheet className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Upload Data Member</h2>
              <p className="text-[11px] text-slate-400">
                Pilih metode input data member untuk verifikasi AdScore
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            title="Tutup"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 px-6">
          {(
            [
              { id: 'individu', label: 'Individu', icon: <Users className="h-3.5 w-3.5" /> },
              { id: 'bulk', label: 'Bulk Excel', icon: <FileSpreadsheet className="h-3.5 w-3.5" /> },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setTab(t.id);
                setErrors({});
              }}
              className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-xs font-bold transition ${
                tab === t.id
                  ? 'border-indigo-600 bg-indigo-50/50 text-indigo-700'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Tab: Individu ── */}
        {tab === 'individu' && (
          <div className="space-y-4 px-6 py-5">
            <div>
              <label className="block text-xs font-semibold text-slate-600">Nama Lengkap *</label>
              <div className="relative mt-1.5">
                <Users className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  placeholder="Sesuai KTP, contoh: Budi Santoso"
                  className={`w-full rounded-xl border bg-white py-2.5 pl-10 pr-4 text-sm text-slate-800 shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${
                    errors.nama ? 'border-rose-400' : 'border-slate-200 focus:border-indigo-500'
                  }`}
                />
              </div>
              {errors.nama && <p className="mt-1 text-[11px] font-medium text-rose-600">{errors.nama}</p>}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-slate-600">Tanggal Lahir *</label>
                <div className="relative mt-1.5">
                  <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="date"
                    value={tglLahir}
                    onChange={(e) => setTglLahir(e.target.value)}
                    className={`w-full rounded-xl border bg-white py-2.5 pl-9 pr-3 text-sm text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${
                      errors.tglLahir ? 'border-rose-400' : 'border-slate-200 focus:border-indigo-500'
                    }`}
                  />
                </div>
                {errors.tglLahir && (
                  <p className="mt-1 text-[11px] font-medium text-rose-600">{errors.tglLahir}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600">Jenis Kelamin *</label>
                <div className="mt-1.5 flex rounded-xl bg-slate-100 p-1">
                  <button
                    type="button"
                    onClick={() => setGender('M')}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold transition ${
                      gender === 'M'
                        ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-indigo-200'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <UserRound className="h-3.5 w-3.5" />
                    Laki-laki (M)
                  </button>
                  <button
                    type="button"
                    onClick={() => setGender('F')}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold transition ${
                      gender === 'F'
                        ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-indigo-200'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <UserRound className="h-3.5 w-3.5" />
                    Perempuan (F)
                  </button>
                </div>
                {errors.gender && (
                  <p className="mt-1 text-[11px] font-medium text-rose-600">{errors.gender}</p>
                )}
              </div>
            </div>

            {/* Cek Member AdBrief — gerbang validasi identitas */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <ShieldCheck className="h-3.5 w-3.5 text-indigo-500" />
                  Cek Member AdBrief
                </p>
                {(checkState === 'found' || checkState === 'notfound' || checkState === 'error') && (
                  <button
                    type="button"
                    onClick={() => void performCheck()}
                    className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Cek Ulang
                  </button>
                )}
              </div>

              {checkState === 'idle' && (
                <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
                  Lengkapi nama, tanggal lahir, dan jenis kelamin — member akan diperiksa otomatis ke registry
                  keanggotaan AdMedika.
                </p>
              )}

              {checkState === 'checking' && (
                <div className="mt-2 flex items-center gap-2 rounded-lg bg-indigo-50 px-3 py-2.5">
                  <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                  <p className="text-xs font-semibold text-indigo-700">Memeriksa registry AdMedika…</p>
                </div>
              )}

              {checkState === 'found' && (
                <div className="mt-2 flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <div>
                    <p className="text-xs font-bold text-emerald-800">✓ Member terverifikasi di AdMedika</p>
                    <p className="mt-0.5 text-[11px] text-emerald-700">
                      Data cocok dengan registry keanggotaan. Lanjutkan unggah dokumen consent.
                    </p>
                  </div>
                </div>
              )}

              {checkState === 'notfound' && (
                <div className="mt-2 flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5">
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                  <div>
                    <p className="text-xs font-bold text-rose-800">⛔ Data Member Tidak Ada</p>
                    <p className="mt-0.5 text-[11px] text-rose-700">
                      Identitas tidak terdaftar di registry AdMedika. Periksa ejaan nama / tanggal lahir — pengajuan
                      tidak dapat dilanjutkan.
                    </p>
                  </div>
                </div>
              )}

              {checkState === 'error' && (
                <div className="mt-2 flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                  <div>
                    <p className="text-xs font-bold text-rose-800">Gagal memeriksa member</p>
                    <p className="mt-0.5 text-[11px] text-rose-700">{checkError || 'Coba periksa ulang.'}</p>
                  </div>
                </div>
              )}
            </div>

            <div>
              <FileDropzone
                label="Form Consent *"
                accept={CONSENT_ACCEPT}
                multiple
                maxSizeMB={5}
                files={consentFiles}
                onFilesAdded={setConsentFiles}
                onRemoveFile={(idx) => setConsentFiles((prev) => prev.filter((_, i) => i !== idx))}
                onValidationError={(msg) => setErrors((prev) => ({ ...prev, file: msg }))}
                hint="PDF, JPG, JPEG, atau PNG · maks 5 MB per file · bisa lebih dari satu file"
              />
              {(errors.consent || errors.file) && (
                <p className="mt-1 text-[11px] font-medium text-rose-600">{errors.consent ?? errors.file}</p>
              )}
            </div>
          </div>
        )}

        {/* ── Tab: Bulk Excel ── */}
        {tab === 'bulk' && (
          <div className="space-y-4 px-6 py-5">
            {/* Download template */}
            <div className="flex flex-col gap-3 rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-indigo-600 shadow-sm ring-1 ring-indigo-200">
                  <FileSpreadsheet className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800">Gunakan template resmi</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Kolom: No. · Nama Lengkap (Sesuai KTP) · Tanggal Lahir (YYYY-MM-DD) · Gender (M/F)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={async () => {
                  setSubmissionError('');
                  try {
                    const token = localStorage.getItem(LS_TOKEN_KEY);
                    const response = await fetch(TEMPLATE_URL, {
                      headers: token ? { Authorization: `Bearer ${token}` } : {},
                    });
                    if (response.ok) {
                      const url = URL.createObjectURL(await response.blob());
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = 'AdScore-Member-Upload-Template.xlsx';
                      link.click();
                      URL.revokeObjectURL(url);
                      return;
                    }
                  } catch {
                    // Backend offline, fallback to client-generated template
                  }

                  try {
                    const csvContent =
                      'No.,Nama Lengkap (Sesuai KTP),Tanggal Lahir (YYYY-MM-DD),Gender (M/F)\n' +
                      '1,Budi Santoso,1980-05-14,M\n' +
                      '2,Siti Nurhaliza,1985-11-02,F\n' +
                      '3,Agus Wijaya,1979-03-21,M\n';
                    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = 'AdScore-Member-Upload-Template.csv';
                    link.click();
                    URL.revokeObjectURL(url);
                  } catch (error) {
                    setSubmissionError(error instanceof Error ? error.message : 'Gagal mengunduh template');
                  }
                }}
                className="flex shrink-0 items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-white px-4 py-2.5 text-xs font-bold text-indigo-700 shadow-sm transition hover:bg-indigo-50 active:scale-95"
              >
                <Download className="h-4 w-4" />
                Download Template Excel
              </button>
            </div>

            <div>
              <FileDropzone
                label="Data Member (.xlsx) *"
                accept=".xlsx"
                multiple={false}
                maxSizeMB={10}
                files={dataFile ? [dataFile] : []}
                onFilesAdded={(added) => setDataFile(added[0] ?? null)}
                onRemoveFile={() => setDataFile(null)}
                onValidationError={(msg) => setErrors((prev) => ({ ...prev, file: msg }))}
                hint="Gunakan template resmi · maks 10 MB"
                icon={<FileSpreadsheet className="h-4 w-4" />}
              />
              {(errors.dataFile || errors.file) && (
                <p className="mt-1 text-[11px] font-medium text-rose-600">
                  {errors.dataFile ?? errors.file}
                </p>
              )}
            </div>

            {/* Fase 5: Cek Member AdBrief per baris — pre-check sebelum submit */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <ShieldCheck className="h-3.5 w-3.5 text-indigo-500" />
                  Cek Member AdBrief
                </p>
                {dataFile && !bulkPreview.loading && (
                  <button
                    type="button"
                    onClick={() => void runBulkPreview(dataFile)}
                    className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Cek Ulang
                  </button>
                )}
              </div>

              {!dataFile && (
                <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
                  Pilih file data member (.xlsx) — setiap baris akan diperiksa otomatis ke registry keanggotaan
                  AdMedika sebelum pengajuan.
                </p>
              )}

              {bulkPreview.loading && (
                <div className="mt-2 flex items-center gap-2 rounded-lg bg-indigo-50 px-3 py-2.5">
                  <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                  <p className="text-xs font-semibold text-indigo-700">Memeriksa baris data member ke AdBrief…</p>
                </div>
              )}

              {!bulkPreview.loading && bulkPreview.error && (
                <div className="mt-2 flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                  <div>
                    <p className="text-xs font-bold text-rose-800">Gagal memeriksa file</p>
                    <p className="mt-0.5 text-[11px] text-rose-700">{bulkPreview.error}</p>
                  </div>
                </div>
              )}

              {!bulkPreview.loading && !bulkPreview.error && bulkPreview.result && (
                <div className="mt-2 space-y-2">
                  {bulkPreview.result.notFound === 0 ? (
                    <div className="flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      <div>
                        <p className="text-xs font-bold text-emerald-800">
                          ✓ {bulkPreview.result.found} dari {bulkPreview.result.total} baris terverifikasi di AdMedika
                        </p>
                        <p className="mt-0.5 text-[11px] text-emerald-700">
                          Semua baris terdaftar. Lanjutkan unggah dokumen consent.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                      <div>
                        <p className="text-xs font-bold text-amber-800">
                          {bulkPreview.result.found} dari {bulkPreview.result.total} baris terverifikasi
                        </p>
                        <p className="mt-0.5 text-[11px] text-amber-700">
                          {bulkPreview.result.notFound} baris tidak terdaftar di AdMedika — baris tersebut akan
                          ditandai Tidak Ditemukan dan tidak di-onboard.
                        </p>
                        <ul className="mt-1 list-inside list-disc text-[11px] text-amber-700">
                          {bulkPreview.result.rows
                            .filter((r) => !r.found)
                            .slice(0, 5)
                            .map((r, i) => (
                              <li key={i}>
                                {r.nama} · {r.tglLahir} · {r.gender === 'M' ? 'Laki-laki' : 'Perempuan'}
                              </li>
                            ))}
                          {bulkPreview.result.notFound > 5 && (
                            <li>+{bulkPreview.result.notFound - 5} baris lainnya</li>
                          )}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <FileDropzone
                label="Form Consent *"
                accept={CONSENT_ACCEPT}
                multiple
                maxSizeMB={5}
                files={bulkConsentFiles}
                onFilesAdded={setBulkConsentFiles}
                onRemoveFile={(idx) => setBulkConsentFiles((prev) => prev.filter((_, i) => i !== idx))}
                onValidationError={(msg) => setErrors((prev) => ({ ...prev, file: msg }))}
                hint="PDF, JPG, JPEG, atau PNG · maks 5 MB per file · bisa lebih dari satu file"
              />
              {errors.consent && (
                <p className="mt-1 text-[11px] font-medium text-rose-600">{errors.consent}</p>
              )}
            </div>
          </div>
        )}

        {submissionError && (
          <p role="alert" className="mx-6 mb-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
            {submissionError}
          </p>
        )}

        {/* Footer */}
        <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-slate-100 bg-white/95 px-6 py-4 backdrop-blur">
          <button
            type="button"
            onClick={close}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 transition hover:bg-slate-50"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || checkState === 'notfound'}
            className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-2.5 text-xs font-semibold text-white shadow-md transition hover:from-indigo-700 hover:to-purple-700 hover:shadow-lg active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>{checkState === 'notfound' ? 'Member Tidak Ditemukan' : 'Kirim untuk Verifikasi'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}