/**
 * AdScore Landing Page — Main Hub for AdScore Analytics.
 *
 * Provides entry points to:
 * 1. AdScore Provider (/adscore/provider)
 * 2. AdScore Member & Corporate (/adscore/member)
 * 3. Member Onboarding Process Flow (/adscore/process-flow)
 */
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  Building2,
  Users,
  GitBranch,
  ArrowRight,
  Zap,
  Award,
  CheckCircle2,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { SCORE_RANGES } from '@/entities/adscore';

export default function AdScoreLandingPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const cards = [
    {
      id: 'provider',
      path: '/adscore/provider',
      icon: Building2,
      title: t('adScore.landing.providerCard.title', 'AdScore Provider'),
      description: t(
        'adScore.landing.providerCard.description',
        'Analisis performa provider berdasarkan riwayat transaksi dan kepatuhan SLA'
      ),
      tags: ['SLA Compliance', 'Waktu Pelayanan', 'Hospital & Clinic'],
      gradient: 'from-blue-600/10 via-cyan-500/10 to-transparent',
      borderColor: 'border-blue-200 hover:border-blue-500',
      iconBg: 'bg-gradient-to-br from-blue-500 to-cyan-500',
      shadowColor: 'hover:shadow-[0_12px_32px_rgba(37,99,235,0.18)]',
      accentColor: 'text-blue-600',
    },
    {
      id: 'member',
      path: '/adscore/member',
      icon: Users,
      title: t('adScore.landing.memberCard.title', 'AdScore Member & Corporate'),
      description: t(
        'adScore.landing.memberCard.description',
        'Masukkan data untuk analisis AdScore berdasarkan riwayat transaksi di jaringan AdMedika'
      ),
      tags: ['Risk Profile', 'Claim History', 'Corporate Scoring'],
      gradient: 'from-indigo-600/10 via-purple-500/10 to-transparent',
      borderColor: 'border-indigo-200 hover:border-indigo-500',
      iconBg: 'bg-gradient-to-br from-indigo-500 to-purple-600',
      shadowColor: 'hover:shadow-[0_12px_32px_rgba(99,102,241,0.18)]',
      accentColor: 'text-indigo-600',
    },
    {
      id: 'process-flow',
      path: '/adscore/process-flow',
      icon: GitBranch,
      title: t('adScore.landing.processFlowCard.title', 'Alur Proses Onboarding'),
      description: t(
        'adScore.landing.processFlowCard.description',
        'Alur proses calon member menjadi member — perbandingan existing (14-30 hari) vs AdScore (1-3 hari)'
      ),
      tags: ['1-3 Hari', '80% Lebih Cepat', 'Instant Underwriting'],
      gradient: 'from-emerald-600/10 via-teal-500/10 to-transparent',
      borderColor: 'border-emerald-200 hover:border-emerald-500',
      iconBg: 'bg-gradient-to-br from-emerald-500 to-teal-600',
      shadowColor: 'hover:shadow-[0_12px_32px_rgba(16,185,129,0.18)]',
      accentColor: 'text-emerald-600',
    },
  ];

  return (
    <div className="relative min-h-[calc(100vh-5rem)] p-4 sm:p-6 lg:p-8">
      {/* ── Header / Hero Section ── */}
      <div className="relative mx-auto max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8 text-center sm:text-left"
        >
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-[#1E293B] sm:text-4xl">
            {t('adScore.landing.title', 'AdScore Analytics')}
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-[#64748B] sm:text-base">
            {t(
              'adScore.landing.subtitle',
              'Analisis performa provider, member, dan corporate berdasarkan riwayat transaksi di jaringan AdMedika dengan standar scoring skala 1 - 20.'
            )}
          </p>
        </motion.div>

        {/* ── 3 Main Action Cards ── */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {cards.map((card, idx) => {
            const Icon = card.icon;
            return (
              <motion.div
                key={card.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: idx * 0.1 }}
                onClick={() => navigate(card.path)}
                className={`group relative flex cursor-pointer flex-col justify-between overflow-hidden rounded-2xl border bg-white/80 p-6 backdrop-blur-xl transition-all duration-300 ${card.borderColor} ${card.shadowColor}`}
              >
                {/* Subtle gradient background shine */}
                <div
                  className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${card.gradient} opacity-50 transition-opacity duration-300 group-hover:opacity-100`}
                />

                <div className="relative z-10">
                  <div className="flex items-center justify-between">
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-xl text-white shadow-md transition-transform duration-300 group-hover:scale-110 ${card.iconBg}`}
                    >
                      <Icon className="h-6 w-6" />
                    </div>
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-all duration-300 group-hover:bg-blue-600 group-hover:text-white">
                      <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                    </span>
                  </div>

                  <h3 className="mt-5 text-xl font-bold text-[#1E293B] transition-colors group-hover:text-blue-600">
                    {card.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#64748B]">
                    {card.description}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {card.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center rounded-md border border-slate-200/80 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="relative z-10 mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold">
                  <span className={card.accentColor}>Akses Modul</span>
                  <span className="text-slate-400 group-hover:text-slate-600 transition-colors">
                    Lihat detail &rarr;
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* ── Scoring Scale Reference ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.35 }}
          className="mt-10 overflow-hidden rounded-2xl border border-white/60 bg-white/70 p-6 shadow-[0_4px_24px_rgba(0,0,0,0.04)] backdrop-blur-xl"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Award className="h-5 w-5 text-blue-600" />
                <h3 className="text-base font-bold text-[#1E293B]">
                  Standar Skala Penilaian AdScore (1 - 20)
                </h3>
              </div>
              <p className="mt-1 text-xs text-[#64748B]">
                Klasifikasi skor performa transaksi dan estimasi SLA layanan kesehatan di AdMedika
              </p>
            </div>
            <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
              <Zap className="h-3.5 w-3.5 text-amber-500" />
              <span>Real-time Transaksi & Underwriting</span>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {SCORE_RANGES.map((r) => {
              const isGood = r.level === 'good';
              const isModerate = r.level === 'moderate';

              return (
                <div
                  key={r.level}
                  style={{
                    backgroundColor: r.bgColor,
                    borderColor: r.borderColor,
                  }}
                  className="relative rounded-xl border p-4 transition-transform duration-200 hover:-translate-y-0.5"
                >
                  <div className="flex items-center justify-between">
                    <span
                      style={{ color: r.textColor }}
                      className="text-xs font-bold uppercase tracking-wider"
                    >
                      {r.label}
                    </span>
                    <span
                      style={{ backgroundColor: r.color }}
                      className="rounded-full px-2 py-0.5 text-xs font-bold text-white shadow-sm"
                    >
                      {r.min} - {r.max}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-1.5">
                    {isGood ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : isModerate ? (
                      <Clock className="h-4 w-4 text-amber-600" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-rose-600" />
                    )}
                    <span
                      style={{ color: r.textColor }}
                      className="text-sm font-semibold"
                    >
                      {r.description}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">
                    {isGood
                      ? 'Performa optimal, pelayanan lebih cepat dari batas SLA.'
                      : isModerate
                        ? 'Performa sesuai SLA, pemrosesan transaksi standar.'
                        : 'Pelayanan melebihi SLA, membutuhkan supervisi & monitoring.'}
                  </p>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* ── Key Highlights Strip ── */}
        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="rounded-xl border border-slate-200/70 bg-white/60 p-4 text-center backdrop-blur-md">
            <p className="text-2xl font-black text-blue-600">2,500+</p>
            <p className="mt-1 text-xs font-medium text-slate-500">Provider Network</p>
          </div>
          <div className="rounded-xl border border-slate-200/70 bg-white/60 p-4 text-center backdrop-blur-md">
            <p className="text-2xl font-black text-indigo-600">4.8M+</p>
            <p className="mt-1 text-xs font-medium text-slate-500">Member Terlayani</p>
          </div>
          <div className="rounded-xl border border-slate-200/70 bg-white/60 p-4 text-center backdrop-blur-md">
            <p className="text-2xl font-black text-emerald-600">1 - 3 Hari</p>
            <p className="mt-1 text-xs font-medium text-slate-500">Onboarding AdScore</p>
          </div>
          <div className="rounded-xl border border-slate-200/70 bg-white/60 p-4 text-center backdrop-blur-md">
            <p className="text-2xl font-black text-amber-600">80%</p>
            <p className="mt-1 text-xs font-medium text-slate-500">Lebih Cepat vs Manual</p>
          </div>
        </div>
      </div>
    </div>
  );
}
