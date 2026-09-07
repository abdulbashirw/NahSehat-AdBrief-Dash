/**
 * Daily Monitoring Page — Manage Care dashboard.
 *
 * Hybrid architecture:
 *   ADOPT from Indemnity pattern:
 *     - Data fetching via `useDailyMonitoringData` hook (not inline)
 *     - Aggregation via pure functions in `entities/monitoring/lib/aggregate.ts`
 *     - `SectionCard` shared component for Trend / Donut / Patient table
 *     - `DataTable` shared component for Daftar Pasien (sortable + footer)
 *     - `Recharts` donut for Claim Status Distribution
 *     - `ExportButton` for CSV export
 *     - `EmptyState` + `Skeleton` for loading/empty states
 *     - `framer-motion` section animations
 *     - RTK Query `pollingInterval` for auto-refresh (native, no manual setInterval)
 *
 *   KEEP from original DailyMonitoring (TV display board feel):
 *     - 30-day fixed date range (no user-selectable date picker)
 *     - Fullscreen toggle for patient table
 *     - Live clock (updates every second)
 *     - Auto-scroll for Trend Diagnosa + Patient table
 *     - Rolling digits animation (RollingDigit / RollingCounter)
 *     - Gradient KPI cards (custom, NOT KpiCard shared)
 */
import { useEffect, useRef, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import {
  Building2,
  LogOut,
  Maximize2,
  Minimize2,
  PlusCircle,
  Search,
  ShieldAlert,
  UserCheck,
  X,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import ApiError from '@/shared/components/error/ApiError';
import PageLoader from '@/shared/components/loading/PageLoader';
import SectionCard from '@/shared/components/common/SectionCard';
import DataTable from '@/shared/components/common/DataTable';
import type { DataColumn } from '@/shared/components/common/DataTable';
import EmptyState from '@/shared/components/common/EmptyState';
import ExportButton from '@/shared/components/common/ExportButton';
import { useExportEnabled } from '@/entities/settings/model/useSettings';
import { useDailyMonitoringData } from '@/features/daily-monitoring/hooks/useDailyMonitoringData';
import {
  kpiSummary,
  byDiagnosis,
  claimStatusSplit,
  dmoPatients,
} from '@/entities/monitoring/lib/aggregate';
import type { PatientRow } from '@/entities/monitoring/lib/aggregate';
import { formatNumber, formatRatioPct } from '@/shared/lib/format';

/* ─── Rolling Digit (KEEP from original) ──────────────────────── */

function RollingDigit({ digit, delay }: { digit: string; delay: number }) {
  const [target, setTarget] = useState(0);

  useEffect(() => {
    const num = parseInt(digit, 10);
    if (!isNaN(num)) {
      const timer = setTimeout(() => setTarget(num), 50);
      return () => clearTimeout(timer);
    }
  }, [digit]);

  if (isNaN(parseInt(digit, 10))) {
    return <span className="inline-block">{digit}</span>;
  }

  return (
    <div className="relative inline-block h-[1em] overflow-hidden leading-none">
      <div
        className="flex flex-col transition-transform transition-duration-[2000ms] cubic-bezier(0.34,1.56,0.64,1)"
        style={{
          transform: `translateY(-${target * 10}%)`,
          transitionDelay: `${delay}s`,
        }}
      >
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
          <span key={num} className="flex h-[1em] items-center justify-center">
            {num}
          </span>
        ))}
      </div>
    </div>
  );
}

function RollingCounter({ value }: { value: string | number }) {
  const digits = value.toString().split('');
  return (
    <div className="inline-flex items-center">
      {digits.map((digit, index) => (
        <RollingDigit key={index} digit={digit} delay={index * 0.1} />
      ))}
    </div>
  );
}

/* ─── Animation variants (ADOPT from Indemnity) ───────────────── */

const sectionVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' as const } },
};

/* ─── Status Theme & Colors (Minimalist Healthcare Palette) ──── */

interface StatusThemeItem {
  label: string;
  sublabel: string;
  solid: string;
  gradientFrom: string;
  gradientTo: string;
  gradientId: string;
  bgLight: string;
  borderLight: string;
  badgeBg: string;
  badgeText: string;
}

const STATUS_THEME: Record<string, StatusThemeItem> = {
  DMO: {
    label: 'DMO',
    sublabel: 'Monitoring',
    solid: '#2563EB',
    gradientFrom: '#60A5FA',
    gradientTo: '#2563EB',
    gradientId: 'gradient-status-dmo',
    bgLight: 'bg-[#EFF6FF]',
    borderLight: 'border-[#BFDBFE]',
    badgeBg: 'bg-[#DBEAFE]',
    badgeText: 'text-[#1D4ED8]',
  },
  DHC: {
    label: 'DHC',
    sublabel: 'Discharge',
    solid: '#059669',
    gradientFrom: '#34D399',
    gradientTo: '#059669',
    gradientId: 'gradient-status-dhc',
    bgLight: 'bg-[#ECFDF5]',
    borderLight: 'border-[#A7F3D0]',
    badgeBg: 'bg-[#D1FAE5]',
    badgeText: 'text-[#065F46]',
  },
  REJECT: {
    label: 'REJECT',
    sublabel: 'Ditolak',
    solid: '#E11D48',
    gradientFrom: '#FB7185',
    gradientTo: '#E11D48',
    gradientId: 'gradient-status-reject',
    bgLight: 'bg-[#FFF1F2]',
    borderLight: 'border-[#FECDD3]',
    badgeBg: 'bg-[#FFE4E6]',
    badgeText: 'text-[#9F1239]',
  },
};

const STATUS_COLORS: Record<string, string> = {
  DMO: STATUS_THEME.DMO.solid,
  DHC: STATUS_THEME.DHC.solid,
  REJECT: STATUS_THEME.REJECT.solid,
};

/* ─── KPI Card config type ────────────────────────────────────── */

interface KpiCardConfig {
  id: string;
  label: string;
  value: number;
  icon: typeof UserCheck;
  sublabel: string;
  iconBg: string;
  iconColor: string;
  dotColor: string;
  topBorder: string;
}

/* ─── Main Component ──────────────────────────────────────────── */

export default function DailyMonitoring() {
  const { t } = useTranslation();
  const exportEnabled = useExportEnabled();

  // ── Data hook (ADOPT — replaces inline fetch logic) ──
  const { items, isLoading, isFetching, isError, refetch } =
    useDailyMonitoringData();

  // ── Aggregation via pure functions (ADOPT) ──
  const kpis = useMemo(() => kpiSummary(items), [items]);
  const trends = useMemo(() => byDiagnosis(items), [items]);
  const statusSplit = useMemo(() => claimStatusSplit(items), [items]);
  const patients = useMemo(() => dmoPatients(items), [items]);

  // ── Calculations for trend proportions ──
  const maxTrendCount = useMemo(() => {
    return trends.length > 0 ? Math.max(...trends.map((t) => t.count)) : 1;
  }, [trends]);

  const totalTrendCount = useMemo(() => {
    return trends.reduce((acc, curr) => acc + curr.count, 0) || 1;
  }, [trends]);

  // ── State: live clock, fullscreen, search, hover pause ──
  const [currentTime, setCurrentTime] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [patientSearch, setPatientSearch] = useState('');
  const [activeSlice, setActiveSlice] = useState<number | null>(null);
  const [isTrendPaused, setIsTrendPaused] = useState(false);
  const [isPatientPaused, setIsPatientPaused] = useState(false);

  // ── Refs for auto-scroll (KEEP) ──
  const trendScrollRef = useRef<HTMLDivElement | null>(null);
  const patientScrollRef = useRef<HTMLDivElement | null>(null);

  // ── Live clock (KEEP — updates every second) ──
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const dd = String(now.getDate()).padStart(2, '0');
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const yyyy = now.getFullYear();
      const hh = String(now.getHours()).padStart(2, '0');
      const min = String(now.getMinutes()).padStart(2, '0');
      const ss = String(now.getSeconds()).padStart(2, '0');
      setCurrentTime(`${dd}-${mm}-${yyyy} | ${hh}:${min}:${ss}`);
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  // ── Auto-scroll Trend Diagnosa (KEEP — 5s interval, pauses on hover) ──
  useEffect(() => {
    const interval = setInterval(() => {
      if (isTrendPaused) return;
      const el = trendScrollRef.current;
      if (!el) return;
      const { scrollTop, scrollHeight, clientHeight } = el;
      if (scrollTop + clientHeight >= scrollHeight - 1) {
        el.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        el.scrollBy({ top: 50, behavior: 'smooth' });
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [isTrendPaused]);

  // ── Auto-scroll Patient table (KEEP — 8s interval, pauses on hover) ──
  useEffect(() => {
    const interval = setInterval(() => {
      if (isPatientPaused) return;
      const wrapper = patientScrollRef.current;
      if (!wrapper) return;
      const el = wrapper.firstElementChild as HTMLElement | null;
      if (!el) return;
      const { scrollTop, scrollHeight, clientHeight } = el;
      if (scrollTop + clientHeight >= scrollHeight - 1) {
        el.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        el.scrollBy({ top: 50, behavior: 'smooth' });
      }
    }, 8000);
    return () => clearInterval(interval);
  }, [isPatientPaused]);

  // ── KPI Cards config (Minimalist Corporate Healthcare Palette) ──
  const cards: KpiCardConfig[] = [
    {
      id: 'C1',
      label: t('dailyMonitoring.monitoringPasien'),
      value: kpis.dmo,
      icon: UserCheck,
      sublabel: t('dailyMonitoring.pasienDmoAktif'),
      iconBg: 'bg-[#EFF6FF]',
      iconColor: 'text-[#2563EB]',
      dotColor: 'bg-[#2563EB]',
      topBorder: 'border-t-[#2563EB]',
    },
    {
      id: 'C2',
      label: t('dailyMonitoring.totalAdmission'),
      value: kpis.admission,
      icon: PlusCircle,
      sublabel: t('dailyMonitoring.admissionLabel'),
      iconBg: 'bg-[#F0F9FF]',
      iconColor: 'text-[#0284C7]',
      dotColor: 'bg-[#0284C7]',
      topBorder: 'border-t-[#0284C7]',
    },
    {
      id: 'C3',
      label: t('dailyMonitoring.totalDischarge'),
      value: kpis.dhc,
      icon: LogOut,
      sublabel: t('dailyMonitoring.dischargeLabel'),
      iconBg: 'bg-[#ECFDF5]',
      iconColor: 'text-[#059669]',
      dotColor: 'bg-[#059669]',
      topBorder: 'border-t-[#059669]',
    },
    {
      id: 'C4',
      label: t('dailyMonitoring.totalProvider'),
      value: kpis.providerCount,
      icon: Building2,
      sublabel: t('dailyMonitoring.providerAktif'),
      iconBg: 'bg-[#EEF2FF]',
      iconColor: 'text-[#6366F1]',
      dotColor: 'bg-[#6366F1]',
      topBorder: 'border-t-[#6366F1]',
    },
    {
      id: 'C5',
      label: t('dailyMonitoring.totalRejected'),
      value: kpis.rejected,
      icon: ShieldAlert,
      sublabel: t('dailyMonitoring.claimDitolak'),
      iconBg: 'bg-[#FFF1F2]',
      iconColor: 'text-[#E11D48]',
      dotColor: 'bg-[#E11D48]',
      topBorder: 'border-t-[#E11D48]',
    },
  ];

  // ── Filtered patients (search) ──
  const visiblePatients = useMemo(() => {
    const q = patientSearch.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter(
      (p) =>
        p.memberID.toLowerCase().includes(q) ||
        p.memberName.toLowerCase().includes(q) ||
        p.providerName.toLowerCase().includes(q),
    );
  }, [patients, patientSearch]);

  // ── DataTable columns for Daftar Pasien (ADOPT) ──
  const patientColumns: DataColumn<PatientRow>[] = useMemo(
    () => [
      {
        key: 'npp',
        label: t('dailyMonitoring.npp'),
        value: (r) => r.memberID,
        render: (r) => (
          <span className="font-mono text-[11px] font-bold tracking-tight text-[#4B5563] bg-[#F4F6F8] px-2 py-0.5 rounded-md border border-[#E5E8EC] inline-block">
            {r.memberID || '-'}
          </span>
        ),
      },
      {
        key: 'nama',
        label: t('dailyMonitoring.namaPasien'),
        value: (r) => r.memberName,
        render: (r) => {
          const initials = r.memberName
            ? r.memberName
                .trim()
                .split(/\s+/)
                .slice(0, 2)
                .map((n) => n[0])
                .join('')
                .toUpperCase()
            : 'P';
          return (
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-blue-200 bg-blue-50 text-[10px] font-bold text-blue-600">
                {initials}
              </div>
              <span className="font-bold text-[#1F2A37] truncate max-w-[220px]">
                {r.memberName || '-'}
              </span>
            </div>
          );
        },
      },
      {
        key: 'pd',
        label: t('dailyMonitoring.principleDependent'),
        align: 'center',
        value: (r) => r.pd,
        render: (r) => (
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold border',
              r.pd === 'P'
                ? 'bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]'
                : 'bg-[#FFF7ED] text-[#C2410C] border-[#FFEDD5]',
            )}
          >
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                r.pd === 'P' ? 'bg-[#2563EB]' : 'bg-[#EA8C1F]',
              )}
            />
            {r.pd === 'P'
              ? t('dailyMonitoring.principle')
              : r.pd === 'D'
                ? t('dailyMonitoring.dependent')
                : '-'}
          </span>
        ),
      },
      {
        key: 'provider',
        label: t('dailyMonitoring.namaProvider'),
        value: (r) => r.providerName,
        render: (r) => (
          <div className="flex items-center gap-1.5 text-[#374151]">
            <Building2 className="h-3.5 w-3.5 shrink-0 text-[#9CA3AF]" />
            <span className="truncate max-w-[240px] font-medium text-[12px]">
              {r.providerName || '-'}
            </span>
          </div>
        ),
      },
      {
        key: 'tglMasuk',
        label: t('dailyMonitoring.tanggalMasuk'),
        value: (r) => r.admissionDate,
        render: (r) => (
          <span className="whitespace-nowrap font-medium text-[12px] text-[#4B5563]">
            {r.admissionDate || '-'}
          </span>
        ),
      },
      {
        key: 'lamaRanap',
        label: t('dailyMonitoring.lamaRanap'),
        align: 'right',
        value: (r) => r.days,
        render: (r) => {
          const days = r.days || 0;
          const isLongStay = days >= 7;
          const isMediumStay = days >= 4 && days < 7;
          return (
            <span
              className={cn(
                'inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold tabular-nums border',
                isLongStay
                  ? 'bg-[#FFF1F2] text-[#BE123C] border-[#FECDD3]'
                  : isMediumStay
                    ? 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]'
                    : 'bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]',
              )}
            >
              {days ? `${days} ${t('dailyMonitoring.hari')}` : '-'}
            </span>
          );
        },
      },
    ],
    [t],
  );

  // ── Early returns ──
  if (isLoading) return <PageLoader />;
  if (isError) return <ApiError onRetry={refetch} />;

  return (
    <motion.div
      className="flex h-full flex-col gap-3 transition-opacity duration-300"
      style={{ opacity: isFetching && !isLoading ? 0.55 : 1 }}
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.06 } } }}
    >
      {/* ── HEADER (minimal — matches Indemnity PageTitle pattern) ── */}
      <div className="flex shrink-0 flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-[24px] font-extrabold text-[#1F2A37] md:text-[28px]">{t('dailyMonitoring.title')}</h1>
            <span className="rounded-full bg-[#2563EB1F] px-2.5 py-0.5 text-[11px] font-semibold text-[#2563EB]">
              {t('dailyMonitoring.thirtyDays')}
            </span>
          </div>
          <p className="mt-0.5 text-[13px] italic text-[#9CA3AF]">{t('dailyMonitoring.subtitle')}</p>
        </div>

        <div className="flex items-center justify-end gap-3">
          {/* Live clock (KEEP — minimal) */}
          <div className="flex items-center gap-2 rounded-lg bg-[#F4F6F8] px-3 py-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#2E7D5B]" />
            <span className="text-[12px] font-bold tabular-nums text-[#4B5563]">{currentTime || t('dailyMonitoring.loading')}</span>
          </div>

          {/* Export (ADOPT) */}
          {exportEnabled && (
            <ExportButton
              filename={`daily-monitoring-patients.csv`}
              getPayload={() => ({
                headers: [
                  t('dailyMonitoring.npp'),
                  t('dailyMonitoring.namaPasien'),
                  t('dailyMonitoring.principleDependent'),
                  t('dailyMonitoring.namaProvider'),
                  t('dailyMonitoring.tanggalMasuk'),
                  t('dailyMonitoring.lamaRanap'),
                ],
                rows: visiblePatients.map((p) => [
                  p.memberID,
                  p.memberName,
                  p.pd === 'P' ? t('dailyMonitoring.principle') : p.pd === 'D' ? t('dailyMonitoring.dependent') : '-',
                  p.providerName,
                  p.admissionDate,
                  p.days ? `${p.days} ${t('dailyMonitoring.hari')}` : '-',
                ]),
              })}
            />
          )}
        </div>
      </div>

      {/* ── ROW 1: KPI Cards (Minimalist, modern executive cards with Rolling Digits) ── */}
      <motion.div variants={sectionVariants} className="grid shrink-0 grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((card) => {
          const IconComp = card.icon;
          return (
            <motion.div
              key={card.id}
              whileHover={{ y: -2, transition: { duration: 0.15 } }}
              className={cn(
                'group relative flex flex-col justify-between overflow-hidden rounded-xl border border-[#E5E8EC] bg-white p-3.5 shadow-xs transition-all duration-200 hover:shadow-md',
                'border-t-[3px]',
                card.topBorder,
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">
                  {card.label}
                </span>
                <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-110', card.iconBg)}>
                  <IconComp className={cn('h-3.5 w-3.5', card.iconColor)} />
                </div>
              </div>

              <div className="mt-2 font-display text-[26px] font-extrabold tabular-nums tracking-tight text-[#1F2A37] xl:text-[28px]">
                <RollingCounter value={card.value} />
              </div>

              <div className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-[#9CA3AF]">
                <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', card.dotColor)} />
                <span className="truncate">{card.sublabel}</span>
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* ── ROW 2: Trend Diagnosa (7/12) + Claim Status Donut (5/12) ── */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-12">
        {/* 2a: Trend Diagnosa — SectionCard + auto-scroll + pause on hover */}
        <motion.div variants={sectionVariants} className="min-h-0 lg:col-span-7">
          <SectionCard
            title={t('dailyMonitoring.trendDiagnosa')}
            className="h-full"
            bodyClassName="flex min-h-0 flex-col p-4"
            right={
              <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
                Top {trends.length} Diagnosa
              </span>
            }
          >
            <div
              ref={trendScrollRef}
              onMouseEnter={() => setIsTrendPaused(true)}
              onMouseLeave={() => setIsTrendPaused(false)}
              className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1"
            >
              {trends.length > 0 ? (
                trends.map((row, i) => {
                  const pct = (row.count / maxTrendCount) * 100;
                  const totalShare = formatRatioPct(row.count / totalTrendCount);

                  const rankBadge =
                    i === 0
                      ? 'bg-amber-100 text-amber-800 border-amber-300 font-extrabold shadow-2xs'
                      : i === 1
                        ? 'bg-slate-100 text-slate-700 border-slate-300 font-bold'
                        : i === 2
                          ? 'bg-orange-100 text-orange-800 border-orange-300 font-bold'
                          : 'bg-[#F3F4F6] text-[#6B7280] border-[#E5E8EC] font-semibold';

                  return (
                    <div
                      key={`${row.diagnosis}-${i}`}
                      className="group relative flex items-center justify-between overflow-hidden rounded-xl border border-[#E5E8EC] bg-white px-3.5 py-2.5 transition-all duration-150 hover:border-[#CBD5E1] hover:shadow-xs"
                    >
                      {/* Proportional background bar */}
                      <div
                        className="pointer-events-none absolute inset-y-0 left-0 bg-blue-50/70 transition-all duration-500 group-hover:bg-blue-100/60"
                        style={{ width: `${pct}%` }}
                      />

                      <div className="relative flex items-center gap-2.5 min-w-0">
                        <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-[10px] tabular-nums', rankBadge)}>
                          {i + 1}
                        </span>
                        <span className="truncate text-[12px] font-bold text-[#1F2A37] group-hover:text-[#2563EB] transition-colors">
                          {row.diagnosis}
                        </span>
                      </div>

                      <div className="relative ml-3 flex items-center gap-2 shrink-0">
                        <span className="rounded-md border border-[#DBEAFE] bg-white/95 px-2 py-0.5 text-[12px] font-bold tabular-nums text-[#2563EB] shadow-2xs">
                          {formatNumber(row.count)} <span className="text-[10px] font-normal text-[#6B7280]">kasus</span>
                        </span>
                        <span className="w-12 text-right text-[11px] font-medium tabular-nums text-[#9CA3AF]">
                          {totalShare}
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <EmptyState message={t('dailyMonitoring.noDiagnosisData')} />
              )}
            </div>
          </SectionCard>
        </motion.div>

        {/* 2b: Claim Status Donut — SectionCard + Recharts (ADOPT) */}
        <motion.div variants={sectionVariants} className="min-h-0 lg:col-span-5">
          <SectionCard
            title={t('dailyMonitoring.distribusiStatus')}
            className="h-full"
            bodyClassName="flex min-h-0 flex-1 flex-col sm:flex-row items-center justify-center gap-4 p-4"
          >
            {/* Donut chart */}
            <div className="relative h-[145px] w-[145px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="gradient-status-dmo" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#60A5FA" />
                      <stop offset="100%" stopColor="#2563EB" />
                    </linearGradient>
                    <linearGradient id="gradient-status-dhc" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#34D399" />
                      <stop offset="100%" stopColor="#059669" />
                    </linearGradient>
                    <linearGradient id="gradient-status-reject" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#FB7185" />
                      <stop offset="100%" stopColor="#E11D48" />
                    </linearGradient>
                  </defs>
                  <Pie
                    data={statusSplit}
                    dataKey="count"
                    nameKey="status"
                    innerRadius="64%"
                    outerRadius="86%"
                    paddingAngle={4}
                    cornerRadius={6}
                    startAngle={90}
                    endAngle={-270}
                    isAnimationActive
                    animationDuration={800}
                    onMouseEnter={(_, i) => setActiveSlice(i)}
                    onMouseLeave={() => setActiveSlice(null)}
                  >
                    {statusSplit.map((entry, i) => {
                      const theme = STATUS_THEME[entry.status];
                      const isSelected = activeSlice === i;
                      const isDimmed = activeSlice !== null && !isSelected;
                      return (
                        <Cell
                          key={entry.status}
                          fill={theme ? `url(#${theme.gradientId})` : (STATUS_COLORS[entry.status] ?? '#9CA3AF')}
                          opacity={isDimmed ? 0.35 : 1}
                          style={{
                            transform: isSelected ? 'scale(1.05)' : 'scale(1)',
                            transformOrigin: 'center',
                            transition: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
                            cursor: 'pointer',
                          }}
                        />
                      );
                    })}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const p = payload[0].payload as (typeof statusSplit)[number];
                      const theme = STATUS_THEME[p.status];
                      return (
                        <div className="flex items-center gap-2.5 rounded-xl border border-[#E5E8EC] bg-white/95 px-3 py-2 text-[11px] font-medium shadow-lg backdrop-blur-xs">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: theme?.solid ?? '#9CA3AF' }}
                          />
                          <div className="flex flex-col">
                            <span className="font-bold text-[#1F2A37]">
                              {p.status} {theme?.sublabel ? `· ${theme.sublabel}` : ''}
                            </span>
                            <span className="text-[11px] text-[#4B5563]">
                              {formatNumber(p.count)} klaim ({formatRatioPct(p.share)})
                            </span>
                          </div>
                        </div>
                      );
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center transition-all duration-200">
                {activeSlice !== null && statusSplit[activeSlice] ? (
                  <>
                    <span
                      className="text-[22px] font-extrabold tabular-nums tracking-tight transition-colors duration-200"
                      style={{ color: STATUS_THEME[statusSplit[activeSlice].status]?.solid ?? '#1F2A37' }}
                    >
                      {formatNumber(statusSplit[activeSlice].count)}
                    </span>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-[#6B7280]">
                      {statusSplit[activeSlice].status} ({formatRatioPct(statusSplit[activeSlice].share)})
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-[24px] font-extrabold text-[#1F2A37] tabular-nums tracking-tight">
                      {formatNumber(kpis.total)}
                    </span>
                    <span className="text-[9px] font-bold uppercase tracking-wide text-[#9CA3AF]">
                      {t('dailyMonitoring.totalClaim')}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Legend */}
            <ul className="flex w-full min-h-0 flex-1 flex-col justify-center gap-2">
              {statusSplit.map((entry, i) => {
                const theme = STATUS_THEME[entry.status];
                const isSelected = activeSlice === i;
                const isDimmed = activeSlice !== null && !isSelected;

                return (
                  <li
                    key={entry.status}
                    onMouseEnter={() => setActiveSlice(i)}
                    onMouseLeave={() => setActiveSlice(null)}
                    className={cn(
                      'group flex items-center justify-between gap-3 rounded-xl border px-3 py-2 transition-all duration-200 cursor-pointer',
                      isSelected
                        ? cn(theme?.bgLight ?? 'bg-slate-50', theme?.borderLight ?? 'border-slate-300', 'shadow-xs')
                        : 'border-[#E5E8EC] bg-white hover:border-[#CBD5E1] hover:bg-[#F8FAFC]',
                      isDimmed && 'opacity-40',
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full transition-transform duration-200 group-hover:scale-125"
                        style={{
                          background: theme
                            ? `linear-gradient(135deg, ${theme.gradientFrom}, ${theme.gradientTo})`
                            : (STATUS_COLORS[entry.status] ?? '#9CA3AF'),
                          boxShadow: isSelected && theme ? `0 0 8px ${theme.solid}66` : undefined,
                        }}
                      />
                      <div className="flex items-baseline gap-1.5 min-w-0">
                        <span className="text-[12px] font-bold text-[#1F2A37]">{entry.status}</span>
                        {theme?.sublabel && (
                          <span className="truncate text-[10px] font-medium text-[#6B7280]">
                            · {theme.sublabel}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[12px] font-bold text-[#1F2A37] tabular-nums">
                        {formatNumber(entry.count)}
                      </span>
                      <span
                        className={cn(
                          'min-w-[46px] rounded-md px-1.5 py-0.5 text-right text-[11px] font-bold tabular-nums transition-colors',
                          isSelected && theme
                            ? cn(theme.badgeBg, theme.badgeText)
                            : 'bg-[#F3F4F6] text-[#4B5563] group-hover:bg-[#E5E7EB]',
                        )}
                      >
                        {formatRatioPct(entry.share)}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </SectionCard>
        </motion.div>
      </div>

      {/* ── ROW 3: Daftar Pasien (FULL WIDTH — SectionCard + DataTable + auto-scroll) ── */}
      <motion.div
        variants={sectionVariants}
        className={cn(
          'min-h-0 flex-1',
          isFullscreen && 'fixed inset-0 z-50 p-4',
        )}
      >
        <SectionCard
          title={t('dailyMonitoring.pasienList')}
          className="h-full"
          bodyClassName="flex min-h-0 flex-col p-4"
          right={
            <div className="flex items-center gap-2.5">
              <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-bold text-white tabular-nums">
                {visiblePatients.length} {t('dailyMonitoring.dmoPatients')}
              </span>
              {/* Search */}
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/70" />
                <input
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  placeholder={t('dailyMonitoring.searchPasien')}
                  className="h-7 w-44 sm:w-52 rounded-lg border border-white/20 bg-white/10 pl-8 pr-7 text-[11px] font-medium text-white outline-none placeholder:text-white/60 focus:border-white/50 focus:bg-white/20 transition-all"
                />
                {patientSearch && (
                  <button
                    onClick={() => setPatientSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-white/60 hover:text-white"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
              {/* Fullscreen toggle (KEEP) */}
              <button
                onClick={() => setIsFullscreen((prev) => !prev)}
                className="flex h-7 items-center gap-1.5 rounded-lg bg-white/15 px-2 text-[11px] font-semibold text-white transition-colors hover:bg-white/25"
                title={isFullscreen ? t('dailyMonitoring.exitFullscreen') : t('dailyMonitoring.fullscreen')}
              >
                {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              </button>
            </div>
          }
        >
          {/* DataTable is the sole scroll container. We override the inner
              Table wrapper's overflow to 'visible' so that <thead sticky>
              sticks to the DataTable root (the real scroll container) instead
              of the intermediate table-container div (which has no constrained
              height, making sticky ineffective). */}
          <div
            ref={patientScrollRef}
            onMouseEnter={() => setIsPatientPaused(true)}
            onMouseLeave={() => setIsPatientPaused(false)}
            className="min-h-0 flex-1"
          >
            {visiblePatients.length > 0 ? (
              <DataTable
                columns={patientColumns}
                rows={visiblePatients}
                rowKey={(r, i) => `${r.memberID}-${i}`}
                sortable
                className="h-full min-h-0 [&_[data-slot=table-container]]:overflow-visible"
              />
            ) : (
              <EmptyState message={patientSearch ? t('dailyMonitoring.noResults') : t('dailyMonitoring.noActiveDmo')} />
            )}
          </div>
        </SectionCard>
      </motion.div>

    </motion.div>
  );
}