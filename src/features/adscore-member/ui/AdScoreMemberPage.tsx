/**
 * AdScore Member & Corporate Page — Member & Corporate Risk Scoring.
 *
 * Allows switching between:
 * 1. Member tab (Full Name + Date of Birth)
 * 2. Corporate tab (Company Name + Industry Sector)
 *
 * Displays:
 * - 1-20 scale circular AdScore gauge
 * - Underwriting Risk Recommendation (Fast-Track vs Standard vs Full Review)
 * - Utilization & Claim Risk Breakdown Indicators
 * - Recent Transaction / Claim Profile Highlights
 */
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Users,
  Building,
  Search,
  Calendar,
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Info,
  Sparkles,
  CreditCard,
  Briefcase,
} from 'lucide-react';
import {
  SCORE_RANGES,
  computeScoreLevel,
  getScoreRange,
  generateDemoScore,
  useGetAdScoreQuery,
} from '@/entities/adscore';

export default function AdScoreMemberPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  // Active Tab: 'member' or 'corporate'
  const [activeTab, setActiveTab] = useState<'member' | 'corporate'>('member');

  // Member form state
  const [memberName, setMemberName] = useState('Budi Santoso');
  const [birthDate, setBirthDate] = useState('1988-06-21');
  const [memberId, setMemberId] = useState('ADM-9842109');

  // Corporate form state
  const [companyName, setCompanyName] = useState('PT Telkom Indonesia');
  const [industry, setIndustry] = useState('Teknologi & Telekomunikasi');
  const [employeeCount, setEmployeeCount] = useState('5000+');

  // Active submitted query
  const [submittedQuery, setSubmittedQuery] = useState({
    tab: 'member' as 'member' | 'corporate',
    title: 'Budi Santoso',
    subtitle: 'Lahir: 21 Juni 1988 • ID: ADM-9842109',
  });

  // RTK Query call (in development fallback)
  const { data: apiData } = useGetAdScoreQuery(
    { query: submittedQuery.title, tab: submittedQuery.tab },
    { refetchOnMountOrArgChange: true }
  );

  const handleMemberSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberName.trim()) return;
    setSubmittedQuery({
      tab: 'member',
      title: memberName.trim(),
      subtitle: `Lahir: ${birthDate || 'Tidak diisi'} • ID: ${memberId || 'ADM-NEW'}`,
    });
  };

  const handleCorporateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) return;
    setSubmittedQuery({
      tab: 'corporate',
      title: companyName.trim(),
      subtitle: `${industry} • ${employeeCount} Karyawan`,
    });
  };

  // Compute score deterministically or from API
  const scoreResult = useMemo(() => {
    let score = 16;
    if (apiData?.data && apiData.data.length > 0 && apiData.data[0]?.header?.Score) {
      score = Number(apiData.data[0].header.Score);
    } else {
      score = generateDemoScore(submittedQuery.title + submittedQuery.tab);
    }

    const range = getScoreRange(score);
    const level = computeScoreLevel(score);

    const isMember = submittedQuery.tab === 'member';

    // Underwriting status recommendations
    const recommendation =
      level === 'good'
        ? {
            title: 'Fast-Track Underwriting (Approved)',
            badge: 'Risiko Rendah',
            desc: 'Rekam jejak klaim sangat baik. Pemrosesan polis otomatis tanpa medical check-up wajib.',
            color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
          }
        : level === 'moderate'
        ? {
            title: 'Standard Review (Light Underwriting)',
            badge: 'Risiko Sedang',
            desc: 'Rasio klaim dalam batas wajar. Dokumen standar cukup untuk verifikasi polis.',
            color: 'text-amber-700 bg-amber-50 border-amber-200',
          }
        : {
            title: 'Enhanced Medical Review Required',
            badge: 'Risiko Tinggi',
            desc: 'Ditemukan riwayat klaim berulang atau rasio loss tinggi. Diperlukan evaluasi spesifik.',
            color: 'text-rose-700 bg-rose-50 border-rose-200',
          };

    // Indicators
    const lossRatio = isMember
      ? Math.max(22, Math.round(105 - (score / 20) * 75))
      : Math.max(38, Math.round(118 - (score / 20) * 70));

    const claimFrequency = isMember
      ? Math.max(1, Math.round(8 - (score / 20) * 6))
      : Math.max(12, Math.round(85 - (score / 20) * 65));

    const chronicRisk =
      level === 'good' ? 'Rendah (0 Diagnosa Aktif)' : level === 'moderate' ? 'Sedang (Hipertensi Terkontrol)' : 'Tinggi (Komorbid)';

    const preventiveEngagement =
      level === 'good' ? 'Tinggi (Vaksin & Check-up Rutin)' : level === 'moderate' ? 'Moderat' : 'Jarang';

    return {
      score,
      level,
      range,
      recommendation,
      lossRatio,
      claimFrequency,
      chronicRisk,
      preventiveEngagement,
      transactionHistory: isMember
        ? [
            {
              date: '14 Feb 2026',
              provider: 'RS Siloam Kebon Jeruk',
              service: 'Rawat Jalan (Spesialis Penyakit Dalam)',
              amount: 'Rp 850.000',
              status: 'Approved AdMedika',
            },
            {
              date: '02 Des 2025',
              provider: 'Klinik Kimia Farma',
              service: 'Farmasi & Konsultasi',
              amount: 'Rp 320.000',
              status: 'Approved AdMedika',
            },
            {
              date: '18 Agu 2025',
              provider: 'Lab Pramita Jakarta',
              service: 'Annual Medical Check-up',
              amount: 'Rp 1.450.000',
              status: 'Approved AdMedika',
            },
          ]
        : [
            {
              date: 'Jan 2026',
              provider: 'Seluruh Jaringan AdMedika',
              service: 'Total Klaim Bulanan Korporasi',
              amount: 'Rp 148.500.000',
              status: 'Settled',
            },
            {
              date: 'Des 2025',
              provider: 'Seluruh Jaringan AdMedika',
              service: 'Total Klaim Bulanan Korporasi',
              amount: 'Rp 132.800.000',
              status: 'Settled',
            },
            {
              date: 'Nov 2025',
              provider: 'Seluruh Jaringan AdMedika',
              service: 'Total Klaim Bulanan Korporasi',
              amount: 'Rp 155.200.000',
              status: 'Settled',
            },
          ],
    };
  }, [submittedQuery, apiData]);

  return (
    <div className="relative min-h-[calc(100vh-5rem)] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        {/* ── Top Header Banner with Back Button ── */}
        <div className="relative mb-6 overflow-hidden rounded-2xl bg-gradient-to-r from-[#3730A3] via-[#4F46E5] to-[#7C3AED] p-6 text-white shadow-lg">
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
                    AdScore Member & Corporate
                  </h1>
                  <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold backdrop-blur-sm">
                    Risk & Underwriting
                  </span>
                </div>
                <p className="mt-1 text-sm text-indigo-100">
                  {t(
                    'adScore.member.subtitle',
                    'Masukkan data untuk analisis AdScore berdasarkan riwayat transaksi di jaringan AdMedika'
                  )}
                </p>
              </div>
            </div>

            {/* Tab Pill Switcher in Header */}
            <div className="flex items-center rounded-xl bg-black/20 p-1 backdrop-blur-md">
              <button
                type="button"
                onClick={() => setActiveTab('member')}
                className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold transition-all ${
                  activeTab === 'member'
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-white/80 hover:text-white'
                }`}
              >
                <Users className="h-4 w-4" />
                <span>Individu Member</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('corporate')}
                className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold transition-all ${
                  activeTab === 'corporate'
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-white/80 hover:text-white'
                }`}
              >
                <Building className="h-4 w-4" />
                <span>Corporate</span>
              </button>
            </div>
          </div>

          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-purple-400/20 blur-3xl" />
        </div>

        {/* ── Form Card ── */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-white/60 bg-white/80 p-6 shadow-sm backdrop-blur-xl"
        >
          {activeTab === 'member' ? (
            <form onSubmit={handleMemberSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-12 sm:items-end">
              <div className="sm:col-span-5">
                <label className="block text-xs font-semibold text-slate-600">
                  Nama Lengkap Member
                </label>
                <div className="relative mt-1.5">
                  <Users className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={memberName}
                    onChange={(e) => setMemberName(e.target.value)}
                    placeholder="Contoh: Budi Santoso"
                    className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-semibold text-slate-600">
                  Tanggal Lahir
                </label>
                <div className="relative mt-1.5">
                  <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2.5 text-sm text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-600">
                  ID Kartu / NIK
                </label>
                <div className="relative mt-1.5">
                  <CreditCard className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={memberId}
                    onChange={(e) => setMemberId(e.target.value)}
                    placeholder="ADM-0000"
                    className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <button
                  type="submit"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:from-indigo-700 hover:to-purple-700 hover:shadow-lg active:scale-95"
                >
                  <Search className="h-4 w-4" />
                  <span>Lihat AdScore</span>
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleCorporateSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-12 sm:items-end">
              <div className="sm:col-span-5">
                <label className="block text-xs font-semibold text-slate-600">
                  Nama Perusahaan / Korporasi
                </label>
                <div className="relative mt-1.5">
                  <Building className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Contoh: PT Telkom Indonesia"
                    className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-semibold text-slate-600">
                  Sektor Industri
                </label>
                <select
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="Teknologi & Telekomunikasi">Teknologi & Telekomunikasi</option>
                  <option value="Perbankan & Jasa Keuangan">Perbankan & Jasa Keuangan</option>
                  <option value="Manufaktur & Energi">Manufaktur & Energi</option>
                  <option value="Ritel & FMCG">Ritel & FMCG</option>
                  <option value="Kesehatan & Farmasi">Kesehatan & Farmasi</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-600">
                  Jumlah Peserta
                </label>
                <div className="relative mt-1.5">
                  <Briefcase className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={employeeCount}
                    onChange={(e) => setEmployeeCount(e.target.value)}
                    placeholder="5000+"
                    className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <button
                  type="submit"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:from-indigo-700 hover:to-purple-700 hover:shadow-lg active:scale-95"
                >
                  <Search className="h-4 w-4" />
                  <span>Lihat AdScore</span>
                </button>
              </div>
            </form>
          )}

          {/* Tip Demo */}
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-indigo-100 bg-indigo-50/70 p-3 text-xs text-indigo-800">
            <Info className="h-4 w-4 shrink-0 text-indigo-600 mt-0.5" />
            <p>
              <strong>Tip Demo:</strong> Masukkan data nama calon member atau nama perusahaan untuk melihat simulasi profil risiko AdScore (skala 1 - 20) dan rekomendasi underwriting otomatis.
            </p>
          </div>
        </motion.div>

        {/* ── Score Range Legend ── */}
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {SCORE_RANGES.map((r) => {
            const isSelected = r.level === scoreResult.level;
            return (
              <div
                key={r.level}
                style={{
                  backgroundColor: r.bgColor,
                  borderColor: isSelected ? r.color : r.borderColor,
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
            key={submittedQuery.title + submittedQuery.tab}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="mt-6 space-y-6"
          >
            {/* Top Row: Score Meter + Underwriting Card */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              {/* Left Score Meter Card (5 cols) */}
              <div className="flex flex-col items-center justify-center rounded-2xl border border-white/60 bg-white/80 p-6 text-center shadow-sm backdrop-blur-xl lg:col-span-5">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  <Sparkles className="h-4 w-4 text-indigo-500" />
                  <span>
                    {submittedQuery.tab === 'member' ? 'Member Risk Score' : 'Corporate Risk Score'}
                  </span>
                </div>

                <h2 className="mt-2 text-xl font-bold text-slate-800">
                  {submittedQuery.title}
                </h2>
                <p className="text-xs text-slate-500">{submittedQuery.subtitle}</p>

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

              {/* Right: Recommendation + Key Risk Indicators (7 cols) */}
              <div className="space-y-4 lg:col-span-7">
                {/* Recommendation Box */}
                <div
                  className={`rounded-2xl border p-5 backdrop-blur-xl ${scoreResult.recommendation.color}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5" />
                      <h3 className="text-base font-bold">
                        {scoreResult.recommendation.title}
                      </h3>
                    </div>
                    <span className="rounded-full bg-white/70 px-2.5 py-0.5 text-xs font-extrabold shadow-sm">
                      {scoreResult.recommendation.badge}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed opacity-90">
                    {scoreResult.recommendation.desc}
                  </p>
                </div>

                {/* 4 Risk Metrics */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/60 bg-white/80 p-4 shadow-sm backdrop-blur-xl">
                    <span className="text-xs font-semibold text-slate-500">
                      Rasio Klaim vs Premi (Loss Ratio)
                    </span>
                    <p className="mt-2 text-2xl font-black text-slate-800">
                      {scoreResult.lossRatio}%
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Standar rasio sehat: &lt; 70%
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/60 bg-white/80 p-4 shadow-sm backdrop-blur-xl">
                    <span className="text-xs font-semibold text-slate-500">
                      Frekuensi Klaim Tahunan
                    </span>
                    <p className="mt-2 text-2xl font-black text-slate-800">
                      {scoreResult.claimFrequency} {submittedQuery.tab === 'member' ? 'Kunjungan' : 'Klaim/Bulan'}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Rata-rata klaim tercatat di AdMedika
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/60 bg-white/80 p-4 shadow-sm backdrop-blur-xl">
                    <span className="text-xs font-semibold text-slate-500">
                      Indikasi Penyakit Kronis
                    </span>
                    <p className="mt-2 text-sm font-bold text-slate-800">
                      {scoreResult.chronicRisk}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Berdasarkan diagnosa ICD-10
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/60 bg-white/80 p-4 shadow-sm backdrop-blur-xl">
                    <span className="text-xs font-semibold text-slate-500">
                      Aktivitas Preventive Care
                    </span>
                    <p className="mt-2 text-sm font-bold text-slate-800">
                      {scoreResult.preventiveEngagement}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Riwayat MCU & gaya hidup sehat
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Transaction History Section */}
            <div className="overflow-hidden rounded-2xl border border-white/60 bg-white/80 p-6 shadow-sm backdrop-blur-xl">
              <div className="mb-4">
                <h3 className="text-base font-bold text-slate-800">
                  {submittedQuery.tab === 'member'
                    ? 'Rekam Jejak Transaksi Pelayanan Medis'
                    : 'Histori Transaksi Klaim Korporasi'}
                </h3>
                <p className="text-xs text-slate-500">
                  Data transaksi terverifikasi melalui Electronic Health Record & Switch AdMedika
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50/75 text-xs uppercase text-slate-500 font-semibold">
                    <tr>
                      <th className="px-4 py-3">Tanggal</th>
                      <th className="px-4 py-3">Fasilitas / Unit</th>
                      <th className="px-4 py-3">Jenis Layanan</th>
                      <th className="px-4 py-3">Total Biaya</th>
                      <th className="px-4 py-3">Status Verifikasi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {scoreResult.transactionHistory.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3.5 text-xs font-medium text-slate-600 font-mono">
                          {row.date}
                        </td>
                        <td className="px-4 py-3.5 font-medium text-slate-800">
                          {row.provider}
                        </td>
                        <td className="px-4 py-3.5 text-slate-600">
                          {row.service}
                        </td>
                        <td className="px-4 py-3.5 font-mono font-semibold text-slate-900">
                          {row.amount}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="h-3 w-3" />
                            {row.status}
                          </span>
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
