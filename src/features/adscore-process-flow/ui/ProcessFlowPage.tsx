/**
 * Process Flow Page — Member Onboarding Flow Comparison:
 * Existing Process (14-30 days) vs With AdScore (1-3 days, 80% faster).
 */
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  GitBranch,
  Clock,
  Zap,
  CheckCircle2,
  FileText,
  UserCheck,
  Stethoscope,
  ShieldCheck,
  ArrowRight,
  TrendingDown,
  Sparkles,
  AlertCircle,
} from 'lucide-react';

export default function ProcessFlowPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const existingSteps = [
    {
      step: '01',
      day: 'Hari 1',
      title: 'Penawaran Agen',
      desc: 'Agen menawarkan produk asuransi & memberikan formulir fisik / formulir registrasi awal.',
      icon: FileText,
      color: 'bg-slate-100 text-slate-700 border-slate-300',
    },
    {
      step: '02',
      day: 'Hari 1 - 3',
      title: 'Pengisian Formulir & Berkas',
      desc: 'Calon member mengisi riwayat medis mandiri, melengkapi lampiran berkas identitas & keluarga.',
      icon: Clock,
      color: 'bg-slate-100 text-slate-700 border-slate-300',
    },
    {
      step: '03',
      day: 'Hari 3 - 14',
      title: 'Manual Underwriting',
      desc: 'Underwriter mereview berkas secara manual, antrean berkas menumpuk, validasi data lambat.',
      icon: UserCheck,
      color: 'bg-amber-50 text-amber-700 border-amber-300',
    },
    {
      step: '04',
      day: 'Hari 14 - 21',
      title: 'Medical Check-up Tambahan',
      desc: 'Jika ada riwayat medis yang diragukan, calon peserta dirujuk ke klinik/lab untuk MCU ulang.',
      icon: Stethoscope,
      color: 'bg-amber-50 text-amber-700 border-amber-300',
    },
    {
      step: '05',
      day: 'Hari 21 - 30',
      title: 'Keputusan & Member Aktif',
      desc: 'Polis akhirnya disetujui atau ditolak, pencetakan kartu fisik, member baru aktif setelah ~1 bulan.',
      icon: CheckCircle2,
      color: 'bg-slate-100 text-slate-700 border-slate-300',
    },
  ];

  const adscoreSteps = [
    {
      step: '01',
      day: 'Hari 1',
      title: 'Input Digital & Data Calon',
      desc: 'Agen menginput data dasar calon peserta (NIK/Nama) melalui portal digital terintegrasi.',
      icon: FileText,
      color: 'bg-blue-50 text-blue-700 border-blue-200',
    },
    {
      step: '02',
      day: 'Instant (Detik)',
      title: 'Real-time AdScore Query',
      desc: 'Sistem menganalisis histori transaksi medis di 2.500+ provider AdMedika untuk menghasilkan skor 1-20.',
      icon: Zap,
      color: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    },
    {
      step: '03',
      day: 'Hari 1 - 2',
      title: 'Automated Underwriting',
      desc: 'Skor 15-20: Instant Auto-Approval. Skor 10-14: Light Review. Skor 1-9: Targeted Medical Examination.',
      icon: ShieldCheck,
      color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    },
    {
      step: '04',
      day: 'Hari 1 - 3',
      title: 'E-Polis & Member Aktif',
      desc: 'Polis diterbitkan digital secara otomatis. E-Card langsung aktif dan bisa digunakan di provider.',
      icon: CheckCircle2,
      color: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    },
  ];

  return (
    <div className="relative min-h-[calc(100vh-5rem)] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        {/* ── Top Header Banner with Back Button ── */}
        <div className="relative mb-6 overflow-hidden rounded-2xl bg-gradient-to-r from-[#047857] via-[#059669] to-[#0D9488] p-6 text-white shadow-lg">
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
                    {t('adScore.processFlow.pageTitle', 'Alur Proses Onboarding Member')}
                  </h1>
                  <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold backdrop-blur-sm">
                    Existing vs AdScore
                  </span>
                </div>
                <p className="mt-1 text-sm text-emerald-100">
                  {t(
                    'adScore.processFlow.subtitle',
                    'Perbandingan alur proses calon member menjadi member — konvensional vs inovasi AdScore'
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-white/20 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-md">
                <Sparkles className="h-4 w-4 text-amber-300" />
                <span>Efisiensi Waktu &gt; 80%</span>
              </span>
            </div>
          </div>

          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-teal-300/20 blur-3xl" />
        </div>

        {/* ── Summary Comparison KPI Cards ── */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-5 backdrop-blur-md">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-600">
              Proses Konvensional
            </span>
            <p className="mt-2 text-3xl font-black text-rose-950">14 - 30 Hari</p>
            <p className="mt-1 text-xs text-rose-700">
              Banyak friksi formulir kertas & manual underwriting
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 backdrop-blur-md">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">
              Proses dengan AdScore
            </span>
            <p className="mt-2 text-3xl font-black text-emerald-950">1 - 3 Hari</p>
            <p className="mt-1 text-xs text-emerald-700">
              Real-time scoring & automated underwriting decision
            </p>
          </div>

          <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-5 backdrop-blur-md">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
              Keunggulan Utama
            </span>
            <p className="mt-2 text-3xl font-black text-blue-950">80% - 90%</p>
            <p className="mt-1 text-xs text-blue-700">
              Waktu tunggu terpangkas & zero paper fraud
            </p>
          </div>
        </div>

        {/* ── Section 1: Existing Process (14-30 Days) ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mt-8 rounded-2xl border border-slate-200/80 bg-white/80 p-6 shadow-sm backdrop-blur-xl"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-200 text-xs font-black text-slate-700">
                  1
                </span>
                <h2 className="text-lg font-bold text-slate-800">
                  Proses Onboarding Member Asuransi (Existing Tanpa AdScore)
                </h2>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                Alur bertahap manual dengan berbagai titik ketergantungan dokumen fisik
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600 sm:self-auto">
              <Clock className="h-3.5 w-3.5 text-slate-500" />
              <span>Waktu Proses: 14 - 30 Hari</span>
            </span>
          </div>

          {/* Steps Timeline Grid */}
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-5">
            {existingSteps.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.step}
                  className="relative flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/60 p-4 transition-all hover:bg-slate-50 hover:shadow-sm"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="rounded bg-slate-200/80 px-2 py-0.5 text-[11px] font-bold text-slate-700">
                        {item.day}
                      </span>
                      <span className="text-xs font-bold text-slate-400">
                        Langkah {item.step}
                      </span>
                    </div>

                    <div className={`mt-3 inline-flex h-9 w-9 items-center justify-center rounded-lg border ${item.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>

                    <h3 className="mt-2.5 text-sm font-bold text-slate-800">
                      {item.title}
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">
                      {item.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-5 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-800">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
            <span>
              <strong>Kelemahan alur existing:</strong> Tingkat drop-off calon nasabah mencapai 35% karena durasi tunggu berminggu-minggu serta beban biaya operasional underwriting manual.
            </span>
          </div>
        </motion.div>

        {/* ── Section 2: Process With AdScore (1-3 Days) ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.15 }}
          className="mt-8 rounded-2xl border border-emerald-200/80 bg-white/90 p-6 shadow-md backdrop-blur-xl ring-1 ring-emerald-500/20"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-emerald-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-xs font-black text-white">
                  2
                </span>
                <h2 className="text-lg font-bold text-slate-800">
                  Proses Onboarding Member dengan Inovasi AdScore
                </h2>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                Otomatisasi berbasis rekam jejak transaksi di 2.500+ fasilitas kesehatan AdMedika
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 sm:self-auto">
              <Zap className="h-3.5 w-3.5 text-emerald-600" />
              <span>Waktu Proses: 1 - 3 Hari (80% Lebih Cepat)</span>
            </span>
          </div>

          {/* AdScore Steps Grid */}
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
            {adscoreSteps.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.step}
                  className="relative flex flex-col justify-between rounded-xl border border-emerald-100 bg-emerald-50/30 p-4 transition-all hover:bg-emerald-50/60 hover:shadow-sm"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="rounded bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                        {item.day}
                      </span>
                      <span className="text-xs font-bold text-emerald-600">
                        Langkah {item.step}
                      </span>
                    </div>

                    <div className={`mt-3 inline-flex h-9 w-9 items-center justify-center rounded-lg border ${item.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>

                    <h3 className="mt-2.5 text-sm font-bold text-slate-800">
                      {item.title}
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">
                      {item.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Benefits Grid */}
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex items-start gap-2.5 rounded-xl border border-emerald-100 bg-emerald-50/50 p-3">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-slate-800">Otomatisasi Underwriting</p>
                <p className="text-[11px] text-slate-600">Skor &ge; 15 langsung disetujui tanpa antre meja analisis.</p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 rounded-xl border border-emerald-100 bg-emerald-50/50 p-3">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-slate-800">Data Transaksi Otentik</p>
                <p className="text-[11px] text-slate-600">Verifikasi langsung dari sistem klaim riil AdMedika.</p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 rounded-xl border border-emerald-100 bg-emerald-50/50 p-3">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-slate-800">Kepuasan Nasabah Meningkat</p>
                <p className="text-[11px] text-slate-600">Member langsung terlindungi dalam hitungan hari.</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
