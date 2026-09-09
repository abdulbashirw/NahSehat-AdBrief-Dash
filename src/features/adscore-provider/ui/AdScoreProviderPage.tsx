/**
 * AdScore Provider Page — Provider SLA & Performance Scoring.
 *
 * Allows searching provider by name, type, and city, and displays:
 * - 1-20 scale AdScore circular gauge
 * - SLA compliance badges (Good < SLA, Moderate ≈ SLA, Bad > SLA)
 * - Key performance metrics (Avg Turnaround, Approval Rate, SLA Compliance)
 * - Breakdown by service department (Rawat Jalan, Rawat Inap, IGD, Farmasi, Lab)
 */
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Building2,
  Search,
  MapPin,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Info,
  Activity,
  FileCheck2,
  Stethoscope,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import {
  PROVIDER_TYPES,
  SCORE_RANGES,
  computeScoreLevel,
  getScoreRange,
  generateDemoScore,
  useGetAdScoreQuery,
} from '@/entities/adscore';

export default function AdScoreProviderPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  // Search form state
  const [providerName, setProviderName] = useState('RS Medika Utama Jakarta');
  const [providerType, setProviderType] = useState('RS');
  const [city, setCity] = useState('Jakarta');

  // Submitted search query for result computation
  const [activeQuery, setActiveQuery] = useState({
    name: 'RS Medika Utama Jakarta',
    type: 'RS',
    city: 'Jakarta',
  });

  // API Call (in development, graceful fallback)
  const { data: apiData, isFetching, refetch } = useGetAdScoreQuery(
    { providerName: activeQuery.name, type: activeQuery.type, city: activeQuery.city },
    { refetchOnMountOrArgChange: true }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!providerName.trim()) return;
    setActiveQuery({
      name: providerName.trim(),
      type: providerType,
      city: city.trim(),
    });
  };

  // Derive score deterministically or from API
  const scoreResult = useMemo(() => {
    let score = 17; // default initial demo
    if (apiData?.data && apiData.data.length > 0 && apiData.data[0]?.header?.Score) {
      score = Number(apiData.data[0].header.Score);
    } else {
      score = generateDemoScore(activeQuery.name + activeQuery.city);
    }
    const range = getScoreRange(score);
    const level = computeScoreLevel(score);

    // Derived departmental breakdown
    const rawatJalanSla = 30; // mins
    const rawatJalanActual = Math.max(10, Math.round(35 - (score / 20) * 20));

    const rawatInapSla = 60; // mins admission
    const rawatInapActual = Math.max(25, Math.round(75 - (score / 20) * 35));

    const igdSla = 15; // mins triage
    const igdActual = Math.max(5, Math.round(20 - (score / 20) * 12));

    const farmasiSla = 20; // mins
    const farmasiActual = Math.max(8, Math.round(25 - (score / 20) * 14));

    const labSla = 45; // mins
    const labActual = Math.max(15, Math.round(55 - (score / 20) * 25));

    const slaCompliance = Math.min(99.4, +(80 + (score / 20) * 19).toFixed(1));
    const approvalRate = Math.min(99.1, +(85 + (score / 20) * 14).toFixed(1));
    const totalVolume = Math.round(1200 + score * 145);

    return {
      score,
      level,
      range,
      slaCompliance,
      approvalRate,
      totalVolume,
      departments: [
        {
          name: 'Rawat Jalan (Poliklinik)',
          targetSla: `${rawatJalanSla} Menit`,
          actual: `${rawatJalanActual} Menit`,
          isMet: rawatJalanActual <= rawatJalanSla,
          componentScore: Math.min(20, Math.round(score + (rawatJalanActual <= rawatJalanSla ? 1 : -2))),
        },
        {
          name: 'Rawat Inap (Admisi)',
          targetSla: `${rawatInapSla} Menit`,
          actual: `${rawatInapActual} Menit`,
          isMet: rawatInapActual <= rawatInapSla,
          componentScore: Math.min(20, Math.round(score + (rawatInapActual <= rawatInapSla ? 0 : -3))),
        },
        {
          name: 'Instalasi Gawat Darurat (IGD)',
          targetSla: `${igdSla} Menit`,
          actual: `${igdActual} Menit`,
          isMet: igdActual <= igdSla,
          componentScore: Math.min(20, Math.round(score + (igdActual <= igdSla ? 2 : -2))),
        },
        {
          name: 'Farmasi & Pengambilan Obat',
          targetSla: `${farmasiSla} Menit`,
          actual: `${farmasiActual} Menit`,
          isMet: farmasiActual <= farmasiSla,
          componentScore: Math.min(20, Math.round(score + (farmasiActual <= farmasiSla ? 1 : -1))),
        },
        {
          name: 'Laboratorium & Radiologi',
          targetSla: `${labSla} Menit`,
          actual: `${labActual} Menit`,
          isMet: labActual <= labSla,
          componentScore: Math.min(20, Math.round(score + (labActual <= labSla ? 0 : -2))),
        },
      ],
    };
  }, [activeQuery, apiData]);

  return (
    <div className="relative min-h-[calc(100vh-5rem)] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        {/* ── Top Header Banner with Back Button ── */}
        <div className="relative mb-6 overflow-hidden rounded-2xl bg-gradient-to-r from-[#1E40AF] via-[#2563EB] to-[#0284C7] p-6 text-white shadow-lg">
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
                  <h1 className="text-2xl font-bold tracking-tight">AdScore Provider</h1>
                  <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold backdrop-blur-sm">
                    SLA & Performance
                  </span>
                </div>
                <p className="mt-1 text-sm text-blue-100">
                  {t(
                    'adScore.provider.subtitle',
                    'Analisis performa provider berdasarkan riwayat transaksi dan SLA di jaringan AdMedika'
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => refetch()}
                disabled={isFetching}
                className="flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-md transition-all hover:bg-white/25 active:scale-95"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
                <span>Refresh Data</span>
              </button>
            </div>
          </div>

          {/* Decorative background glow */}
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-cyan-400/20 blur-3xl" />
        </div>

        {/* ── Search Form Card ── */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-white/60 bg-white/80 p-6 shadow-sm backdrop-blur-xl"
        >
          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-12 sm:items-end">
            <div className="sm:col-span-5">
              <label className="block text-xs font-semibold text-slate-600">
                Nama Provider
              </label>
              <div className="relative mt-1.5">
                <Building2 className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={providerName}
                  onChange={(e) => setProviderName(e.target.value)}
                  placeholder="Contoh: RS Medika Utama"
                  className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            <div className="sm:col-span-3">
              <label className="block text-xs font-semibold text-slate-600">
                Tipe Provider
              </label>
              <select
                value={providerType}
                onChange={(e) => setProviderType(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                {PROVIDER_TYPES.map((pt) => (
                  <option key={pt.value} value={pt.value}>
                    {pt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-600">
                Kota
              </label>
              <div className="relative mt-1.5">
                <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Jakarta"
                  className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:from-blue-700 hover:to-cyan-700 hover:shadow-lg active:scale-95"
              >
                <Search className="h-4 w-4" />
                <span>Lihat AdScore</span>
              </button>
            </div>
          </form>

          {/* ── Tip Demo Note ── */}
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50/70 p-3 text-xs text-blue-800">
            <Info className="h-4 w-4 shrink-0 text-blue-600 mt-0.5" />
            <p>
              <strong>Tip Demo:</strong> Masukkan nama provider apa saja untuk melihat simulasi perhitungan AdScore Provider dengan skala 1 - 20 berdasarkan histori transaksi & kepatuhan SLA.
            </p>
          </div>
        </motion.div>

        {/* ── Score Legend Strip (Good, Moderate, Bad) ── */}
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {SCORE_RANGES.map((r) => {
            const isSelected = r.level === scoreResult.level;
            return (
              <div
                key={r.level}
                style={{
                  backgroundColor: r.bgColor,
                  borderColor: isSelected ? r.color : r.borderColor,
                  ...(isSelected ? { ['--tw-ring-color' as string]: r.color } : {}),
                }}
                className={`relative flex items-center justify-between rounded-xl border p-3.5 transition-all ${
                  isSelected ? 'ring-2 ring-offset-1' : 'opacity-85'
                }`}
              >
                <div>
                  <span
                    style={{ color: r.textColor }}
                    className="text-xs font-bold uppercase tracking-wider"
                  >
                    {r.label} ({r.min} - {r.max})
                  </span>
                  <p style={{ color: r.textColor }} className="mt-0.5 text-xs font-medium">
                    {r.description}
                  </p>
                </div>
                <span
                  style={{ backgroundColor: r.color }}
                  className="rounded-full px-2.5 py-1 text-xs font-extrabold text-white shadow-sm"
                >
                  {r.min} - {r.max}
                </span>
              </div>
            );
          })}
        </div>

        {/* ── Results Container ── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeQuery.name + activeQuery.city}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="mt-6 space-y-6"
          >
            {/* Top Row: Big Score Card + Key Metrics */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              {/* Left Score Meter Card (5 cols) */}
              <div className="flex flex-col items-center justify-center rounded-2xl border border-white/60 bg-white/80 p-6 text-center shadow-sm backdrop-blur-xl lg:col-span-5">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  <Sparkles className="h-4 w-4 text-blue-500" />
                  <span>AdScore Result</span>
                </div>

                <h2 className="mt-2 text-xl font-bold text-slate-800">
                  {activeQuery.name}
                </h2>
                <p className="text-xs text-slate-500">
                  {activeQuery.city} • Tipe {activeQuery.type}
                </p>

                {/* Score Gauge Circle */}
                <div className="relative my-6 flex h-44 w-44 items-center justify-center">
                  <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
                    <circle
                      cx="60"
                      cy="60"
                      r="50"
                      className="stroke-slate-100"
                      strokeWidth="10"
                      fill="none"
                    />
                    <circle
                      cx="60"
                      cy="60"
                      r="50"
                      stroke={scoreResult.range.color}
                      strokeWidth="10"
                      strokeDasharray={314}
                      strokeDashoffset={314 - (314 * (scoreResult.score / 20))}
                      strokeLinecap="round"
                      fill="none"
                      className="transition-all duration-1000 ease-out"
                    />
                  </svg>

                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span
                      style={{ color: scoreResult.range.color }}
                      className="text-5xl font-black tracking-tight"
                    >
                      {scoreResult.score}
                    </span>
                    <span className="text-xs font-semibold text-slate-400">
                      skala 1 - 20
                    </span>
                  </div>
                </div>

                {/* Status Badges */}
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <span
                    style={{
                      backgroundColor: scoreResult.range.bgColor,
                      borderColor: scoreResult.range.borderColor,
                      color: scoreResult.range.textColor,
                    }}
                    className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-bold"
                  >
                    {scoreResult.level === 'good' ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : scoreResult.level === 'moderate' ? (
                      <Clock className="h-3.5 w-3.5" />
                    ) : (
                      <AlertTriangle className="h-3.5 w-3.5" />
                    )}
                    {scoreResult.range.label}
                  </span>

                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                    {scoreResult.range.description}
                  </span>
                </div>
              </div>

              {/* Right: Key Performance Metric Cards (7 cols) */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-7">
                <div className="rounded-2xl border border-white/60 bg-white/80 p-5 shadow-sm backdrop-blur-xl">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500">
                      Tingkat Kepatuhan SLA
                    </span>
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                      <Clock className="h-5 w-5" />
                    </div>
                  </div>
                  <p className="mt-3 text-2xl font-black text-slate-800">
                    {scoreResult.slaCompliance}%
                  </p>
                  <p className="mt-1 text-xs text-emerald-600 font-medium">
                    Target SLA: &ge; 90.0%
                  </p>
                </div>

                <div className="rounded-2xl border border-white/60 bg-white/80 p-5 shadow-sm backdrop-blur-xl">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500">
                      Rasio Approval Klaim
                    </span>
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                      <FileCheck2 className="h-5 w-5" />
                    </div>
                  </div>
                  <p className="mt-3 text-2xl font-black text-slate-800">
                    {scoreResult.approvalRate}%
                  </p>
                  <p className="mt-1 text-xs text-blue-600 font-medium">
                    Berdasarkan verifikasi AdMedika
                  </p>
                </div>

                <div className="rounded-2xl border border-white/60 bg-white/80 p-5 shadow-sm backdrop-blur-xl">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500">
                      Total Volume Transaksi
                    </span>
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                      <Activity className="h-5 w-5" />
                    </div>
                  </div>
                  <p className="mt-3 text-2xl font-black text-slate-800">
                    {scoreResult.totalVolume.toLocaleString('id-ID')}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Klaim & transaksi 12 bulan terakhir
                  </p>
                </div>

                <div className="rounded-2xl border border-white/60 bg-white/80 p-5 shadow-sm backdrop-blur-xl">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500">
                      Status Akreditasi & Network
                    </span>
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                      <Stethoscope className="h-5 w-5" />
                    </div>
                  </div>
                  <p className="mt-3 text-2xl font-black text-slate-800">
                    Paripurna
                  </p>
                  <p className="mt-1 text-xs text-amber-600 font-medium">
                    Provider Utama AdMedika
                  </p>
                </div>
              </div>
            </div>

            {/* Departmental SLA Breakdown Table */}
            <div className="overflow-hidden rounded-2xl border border-white/60 bg-white/80 p-6 shadow-sm backdrop-blur-xl">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-800">
                    Rincian Kepatuhan SLA per Unit Layanan
                  </h3>
                  <p className="text-xs text-slate-500">
                    Perbandingan standar SLA vs realisasi kecepatan pelayanan medis
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50/75 text-xs uppercase text-slate-500 font-semibold">
                    <tr>
                      <th className="px-4 py-3">Unit Layanan</th>
                      <th className="px-4 py-3">Batas Target SLA</th>
                      <th className="px-4 py-3">Realisasi Rata-rata</th>
                      <th className="px-4 py-3">Komponen Skor</th>
                      <th className="px-4 py-3">Status Kepatuhan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {scoreResult.departments.map((dept) => (
                      <tr key={dept.name} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3.5 font-medium text-slate-800">
                          {dept.name}
                        </td>
                        <td className="px-4 py-3.5 text-slate-500 font-mono">
                          {dept.targetSla}
                        </td>
                        <td className="px-4 py-3.5 text-slate-800 font-mono font-semibold">
                          {dept.actual}
                        </td>
                        <td className="px-4 py-3.5 font-mono font-bold text-blue-600">
                          {dept.componentScore} / 20
                        </td>
                        <td className="px-4 py-3.5">
                          {dept.isMet ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="h-3 w-3" />
                              Memenuhi SLA
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200">
                              <Clock className="h-3 w-3" />
                              Mendekati SLA
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
