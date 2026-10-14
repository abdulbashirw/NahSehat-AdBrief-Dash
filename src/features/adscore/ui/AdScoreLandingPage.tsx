/**
 * AdScore Landing Page — Main Hub for AdScore Analytics.
 *
 * Provides entry points to:
 * 1. AdScore Provider (/adscore/provider)
 * 2. AdScore Member & Corporate (/adscore/member)
 * 3. Member Onboarding Process Flow (/adscore/process-flow)
 *
 * Each card's availability is driven by the RBAC permission matrix
 * (menu key + 'read' action). SUPER_ADMIN always has full access.
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
  Lock,
} from 'lucide-react';
import { toast } from 'sonner';
import { SCORE_RANGES } from '@/entities/adscore';
import { useCheckPermission } from '@/entities/auth';

interface CardItem {
  id: string;
  path: string;
  icon: typeof Building2;
  title: string;
  description: string;
  gradient: string;
  borderColor: string;
  iconBg: string;
  shadowColor: string;
  /** Permission menu key checked against RBAC for 'read' access */
  permissionMenu: string;
  isAvailable: boolean;
  statusBadge: {
    label: string;
    variant: 'active' | 'development';
  };
}

export default function AdScoreLandingPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const checkPermission = useCheckPermission();

  // Helper: compute card availability + dynamic badge
  const makeCard = (
    base: Omit<CardItem, 'isAvailable' | 'statusBadge'>,
  ): CardItem => {
    const hasAccess = checkPermission(base.permissionMenu, 'read');
    return {
      ...base,
      isAvailable: hasAccess,
      statusBadge: hasAccess
        ? { label: t('adScore.landing.statusActive', 'Modul Aktif'), variant: 'active' as const }
        : { label: t('adScore.landing.statusRestricted', 'Akses Terbatas'), variant: 'development' as const },
    };
  };

  const cards: CardItem[] = [
    makeCard({
      id: 'provider',
      permissionMenu: 'adscore-provider',
      path: '/adscore/provider',
      icon: Building2,
      title: t('adScore.landing.providerCard.title', 'AdScore Provider'),
      description: t(
        'adScore.landing.providerCard.description',
        'Analisis performa provider berdasarkan riwayat transaksi dan kepatuhan Service Level Agreement (SLA).'
      ),
      gradient: 'from-blue-600/10 via-cyan-500/10 to-transparent',
      borderColor: 'border-slate-200 hover:border-blue-300',
      iconBg: 'bg-gradient-to-br from-blue-500 to-cyan-600',
      shadowColor: 'hover:shadow-[0_8px_30px_rgba(37,99,235,0.08)]',
    }),
    makeCard({
      id: 'member',
      permissionMenu: 'adscore-member',
      path: '/adscore/member',
      icon: Users,
      title: t('adScore.landing.memberCard.title', 'AdScore Member'),
      description: t(
        'adScore.landing.memberCard.description',
        'Masukkan data untuk analisis AdScore berdasarkan riwayat transaksi di jaringan AdMedika dengan kalkulasi skor instan.'
      ),
      gradient: 'from-indigo-600/15 via-purple-500/10 to-transparent',
      borderColor: 'border-indigo-300 hover:border-indigo-500 ring-1 ring-indigo-500/20',
      iconBg: 'bg-gradient-to-br from-indigo-500 to-purple-600',
      shadowColor: 'hover:shadow-[0_16px_36px_rgba(99,102,241,0.22)]',
    }),
    makeCard({
      id: 'process-flow',
      permissionMenu: 'adscore-process-flow',
      path: '/adscore/process-flow',
      icon: GitBranch,
      title: t('adScore.landing.processFlowCard.title', 'Alur Proses Onboarding'),
      description: t(
        'adScore.landing.processFlowCard.description',
        'Alur proses calon member menjadi member — perbandingan existing (14-30 hari) vs AdScore (1-3 hari).'
      ),
      gradient: 'from-emerald-600/10 via-teal-500/10 to-transparent',
      borderColor: 'border-slate-200 hover:border-teal-300',
      iconBg: 'bg-gradient-to-br from-teal-500 to-emerald-600',
      shadowColor: 'hover:shadow-[0_8px_30px_rgba(16,185,129,0.08)]',
    }),
  ];

  const handleCardClick = (card: CardItem) => {
    if (card.isAvailable) {
      navigate(card.path);
    } else {
      toast.warning(
        t('adScore.landing.toastNoAccessTitle', 'Akses Modul {{title}} Terbatas', {
          title: card.title,
        }),
        {
          description: t(
            'adScore.landing.toastNoAccessDesc',
            'Anda tidak memiliki izin untuk mengakses modul ini. Hubungi administrator untuk meminta akses.'
          ),
          duration: 4000,
        }
      );
    }
  };

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
          {/* Brand lockup: AdMedika logo | title + subtitle */}
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:gap-5">
            <img
              src="/Admedika.png"
              alt="AdMedika"
              draggable={false}
              className="h-14 w-auto shrink-0 object-contain sm:h-16"
            />
            {/* Vertical divider between brand and product text block */}
            <div
              aria-hidden="true"
              className="hidden h-16 w-px bg-gradient-to-b from-transparent via-slate-300 to-transparent sm:block"
            />
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-[#1E293B] sm:text-4xl">
                {t('adScore.landing.title', 'AdScore Analytics')}
              </h1>
              <p className="mt-3 max-w-3xl text-sm text-[#64748B] sm:text-base leading-relaxed">
                {t(
                  'adScore.landing.subtitle',
                  'Analisis performa provider, member, dan corporate berdasarkan riwayat transaksi di jaringan AdMedika dengan standar scoring skala 1 - 20.'
                )}
              </p>
            </div>
          </div>
        </motion.div>

        {/* ── 3 Main Action Cards ── */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {cards.map((card, idx) => {
            const Icon = card.icon;
            const isAvailable = card.isAvailable;

            return (
              <motion.div
                key={card.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: idx * 0.1 }}
                onClick={() => handleCardClick(card)}
                className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border bg-white/90 p-6 backdrop-blur-xl transition-all duration-300 ${isAvailable
                  ? `cursor-pointer ${card.borderColor} ${card.shadowColor} hover:-translate-y-1`
                  : `cursor-default border-slate-200/80 bg-slate-50/40 hover:border-slate-300`
                  }`}
              >
                {/* Subtle gradient background */}
                <div
                  className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${card.gradient} ${isAvailable ? 'opacity-60 group-hover:opacity-100' : 'opacity-30'
                    } transition-opacity duration-300`}
                />

                {/* Top Corner Ribbon / Badge for In-Development or Active State */}
                <div className="relative z-10">
                  <div className="flex items-center justify-between gap-2">
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-xl text-white shadow-md transition-transform duration-300 ${isAvailable ? 'group-hover:scale-105' : 'opacity-90'
                        } ${card.iconBg}`}
                    >
                      <Icon className="h-6 w-6" />
                    </div>

                    {/* Status Pill */}
                    {isAvailable ? (
                      <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/80 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 shadow-xs">
                        <span className="relative flex h-2 w-2">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                        </span>
                        <span>{card.statusBadge.label}</span>
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-200/80 bg-amber-50/90 px-2.5 py-1 text-xs font-medium text-amber-800 shadow-xs">
                        <Lock className="h-3 w-3 text-amber-600" />
                        <span>{card.statusBadge.label}</span>
                      </div>
                    )}
                  </div>

                  <h3
                    className={`mt-4 text-xl font-bold transition-colors ${isAvailable
                      ? 'text-[#1E293B] group-hover:text-indigo-600'
                      : 'text-[#334155]'
                      }`}
                  >
                    {card.title}
                  </h3>

                  <p className="mt-2 text-sm leading-relaxed text-[#64748B]">
                    {card.description}
                  </p>


                </div>

                {/* Card Footer / Action Status */}
                <div className="relative z-10 mt-6 flex items-center border-t border-slate-100 pt-4 text-xs font-semibold">
                  {isAvailable ? (
                    <span className="inline-flex items-center gap-1.5 font-bold text-indigo-600 transition-transform duration-300 group-hover:translate-x-1">
                      {t('adScore.landing.openModule', 'Buka Modul Analisis')}
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 font-medium text-slate-400">
                      <Lock className="h-3.5 w-3.5 text-amber-500" />
                      <span>{t('adScore.landing.comingSoon', 'Segera Hadir')}</span>
                    </span>
                  )}
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
                  {t('adScore.landing.scoringScale.title', 'Standar Skala Penilaian AdScore (1 - 20)')}
                </h3>
              </div>
              <p className="mt-1 text-xs text-[#64748B]">
                {t(
                  'adScore.landing.scoringScale.subtitle',
                  'Klasifikasi skor performa transaksi dan estimasi SLA layanan kesehatan di AdMedika'
                )}
              </p>
            </div>
            <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
              <Zap className="h-3.5 w-3.5 text-amber-500" />
              <span>{t('adScore.landing.scoringScale.badge', 'Transaksi & Underwriting Real-Time')}</span>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {SCORE_RANGES.map((r) => {
              const isGood = r.level === 'good';
              const isModerate = r.level === 'moderate';

              const labelText = isGood
                ? t('adScore.landing.scoringScale.goodScore', r.label)
                : isModerate
                  ? t('adScore.landing.scoringScale.moderateScore', r.label)
                  : t('adScore.landing.scoringScale.badScore', r.label);

              const descText = isGood
                ? t(
                  'adScore.landing.scoringScale.goodDesc',
                  'Performa optimal, pelayanan lebih cepat dari batas SLA.'
                )
                : isModerate
                  ? t(
                    'adScore.landing.scoringScale.moderateDesc',
                    'Performa sesuai SLA, pemrosesan transaksi standar.'
                  )
                  : t(
                    'adScore.landing.scoringScale.badDesc',
                    'Pelayanan melebihi SLA, membutuhkan supervisi & monitoring.'
                  );

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
                      {labelText}
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
                  <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                    {descText}
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
            <p className="mt-1 text-xs font-medium text-slate-500">
              {t('adScore.landing.stats.providerNetwork', 'Jaringan Provider')}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200/70 bg-white/60 p-4 text-center backdrop-blur-md">
            <p className="text-2xl font-black text-indigo-600">4.8M+</p>
            <p className="mt-1 text-xs font-medium text-slate-500">
              {t('adScore.landing.stats.servedMembers', 'Member Terlayani')}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200/70 bg-white/60 p-4 text-center backdrop-blur-md">
            <p className="text-2xl font-black text-emerald-600">1 - 3 Hari</p>
            <p className="mt-1 text-xs font-medium text-slate-500">
              {t('adScore.landing.stats.onboardingTime', 'Onboarding AdScore')}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200/70 bg-white/60 p-4 text-center backdrop-blur-md">
            <p className="text-2xl font-black text-amber-600">80%</p>
            <p className="mt-1 text-xs font-medium text-slate-500">
              {t('adScore.landing.stats.fasterVsManual', 'Lebih Cepat vs Manual')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

