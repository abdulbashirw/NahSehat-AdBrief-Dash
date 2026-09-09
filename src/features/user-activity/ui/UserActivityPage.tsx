/**
 * User Monitoring Page — "User Monitoring — AdBrief Analytics Dashboard"
 *
 * Fully redesigned to match executive minimalist healthcare theme:
 *   1. Header — clean title, badge, live pulse indicator, segmented days selector, refresh
 *   2. KPI Grid — 6 modern executive cards with top accent borders & pastel icon badges
 *   3. Charts Row 1 — Trend area chart with Cartesian grid & gradients (2/3) + Interactive Donut (1/3)
 *   4. Charts Row 2 — Top 5 Users Bar chart (2/5) + Refined 24h×7d Heatmap (3/5)
 *   5. DAFTAR USER TERAKTIF — DataTable with avatar, status badges, medals, search & filters in header
 *   6. Footer — Clean data sources & system copyright
 */
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  BarChart3,
  Calendar,
  Clock,
  Eye,
  Globe,
  LogIn,
  MapPin,
  Monitor,
  RefreshCw,
  Search,
  Sparkles,
  TrendingUp,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { formatNumber } from '@/shared/lib/format';
import SectionCard from '@/shared/components/common/SectionCard';
import DataTable from '@/shared/components/common/DataTable';
import type { DataColumn } from '@/shared/components/common/DataTable';
import ExportButton from '@/shared/components/common/ExportButton';
import EmptyState from '@/shared/components/common/EmptyState';
import ApiError from '@/shared/components/error/ApiError';
import PageLoader from '@/shared/components/loading/PageLoader';
import { useExportEnabled } from '@/entities/settings/model/useSettings';
import { ANALYTICS_CATEGORIES, type AnalyticsCategory } from '@/shared/types';
import { useActivityData } from '@/features/user-activity/hooks/useActivityData';
import {
  buildKpiCards,
  buildDonutData,
  buildTrendData,
  buildHeatmapGrid,
  buildTopUsersBar,
  ACTIVITY_LEVEL_LABELS,
  ACTIVITY_LEVEL_COLORS,
  DAY_LABELS,
  HOUR_LABELS,
} from '@/entities/activity';
import type { DetailedUserRow, ActivityLevel, KpiCard as KpiCardData } from '@/entities/activity';
import type { Variants } from 'framer-motion';

/* ─── Animation variants ─── */
const sectionVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } },
};

/* ─── Modern Healthcare Color Palettes ─── */
const PALETTE = {
  blue: '#2563EB',
  blueLight: '#3B82F6',
  orange: '#EA8C1F',
  orangeLight: '#F59E0B',
  green: '#059669',
  greenLight: '#10B981',
  purple: '#7C3AED',
  purpleLight: '#8B5CF6',
  cyan: '#0284C7',
  cyanLight: '#0EA5E9',
  rose: '#E11D48',
  slate: '#64748B',
};

/* ─── Analytics Category Badge Colors ─── */
const ANALYTICS_CATEGORY_BADGES: Record<string, { bg: string; border: string; text: string }> = {
  INS: { bg: '#FFFBEB', border: '#FDE68A', text: '#B45309' },
  GES: { bg: '#F0FDFA', border: '#99F6E4', text: '#0F766E' },
  PS: { bg: '#F5F3FF', border: '#DDD6FE', text: '#6D28D9' },
  Internal: { bg: '#F8FAFC', border: '#E2E8F0', text: '#475569' },
};

/* ─── Heatmap intensity ramp ─── */
function getHeatmapColor(value: number, max: number): string {
  if (value === 0 || max === 0) return '#F8FAFC';
  const ratio = value / max;
  if (ratio > 0.8) return '#1E3A8A'; // deepest navy
  if (ratio > 0.6) return '#1D4ED8';
  if (ratio > 0.4) return '#3B82F6';
  if (ratio > 0.2) return '#93C5FD';
  if (ratio > 0.05) return '#DBEAFE';
  return '#EFF6FF';
}

/* ─── KPI Theme Configurations ─── */
interface KpiThemeConfig {
  topBorder: string;
  iconBg: string;
  iconColor: string;
  dotColor: string;
  sublabel: string;
}

const KPI_THEMES: Record<string, KpiThemeConfig> = {
  access: {
    topBorder: 'border-t-[#2563EB]',
    iconBg: 'bg-[#EFF6FF]',
    iconColor: 'text-[#2563EB]',
    dotColor: 'bg-[#2563EB]',
    sublabel: 'Volume permintaan API & Web',
  },
  login: {
    topBorder: 'border-t-[#7C3AED]',
    iconBg: 'bg-[#F5F3FF]',
    iconColor: 'text-[#7C3AED]',
    dotColor: 'bg-[#7C3AED]',
    sublabel: 'Autentikasi terverifikasi',
  },
  users: {
    topBorder: 'border-t-[#0284C7]',
    iconBg: 'bg-[#F0F9FF]',
    iconColor: 'text-[#0284C7]',
    dotColor: 'bg-[#0284C7]',
    sublabel: 'Total pengguna terdaftar',
  },
  'avg-access': {
    topBorder: 'border-t-[#EA8C1F]',
    iconBg: 'bg-[#FFFBEB]',
    iconColor: 'text-[#D97706]',
    dotColor: 'bg-[#EA8C1F]',
    sublabel: 'Rata-rata aktivitas harian',
  },
  'avg-login': {
    topBorder: 'border-t-[#059669]',
    iconBg: 'bg-[#ECFDF5]',
    iconColor: 'text-[#059669]',
    dotColor: 'bg-[#059669]',
    sublabel: 'Frekuensi login per hari',
  },
  'top-user': {
    topBorder: 'border-t-[#E11D48]',
    iconBg: 'bg-[#FFF1F2]',
    iconColor: 'text-[#E11D48]',
    dotColor: 'bg-[#E11D48]',
    sublabel: 'Kontributor akses terbanyak',
  },
};

const KPI_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  access: Eye,
  login: LogIn,
  users: Users,
  'avg-access': TrendingUp,
  'avg-login': BarChart3,
  'top-user': UserCheck,
};

/* ─── Executive KPI Card ─── */
function ActivityKpiCard({ kpi, index }: { kpi: KpiCardData; index: number }) {
  const Icon = KPI_ICONS[kpi.icon] ?? Eye;
  const theme = KPI_THEMES[kpi.icon] ?? KPI_THEMES.access;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut', delay: index * 0.04 }}
      whileHover={{ y: -2, transition: { duration: 0.15 } }}
      className={cn(
        'group relative flex flex-col justify-between overflow-hidden rounded-xl border border-[#E5E8EC] bg-white p-3.5 shadow-xs transition-all duration-200 hover:shadow-md',
        'border-t-[3px]',
        theme.topBorder,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">
          {kpi.label}
        </span>
        <div
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-110',
            theme.iconBg,
          )}
        >
          <Icon className={cn('h-3.5 w-3.5', theme.iconColor)} />
        </div>
      </div>

      <div className="mt-2 font-display text-[22px] font-extrabold tabular-nums tracking-tight text-[#1F2A37] xl:text-[24px]">
        {kpi.value}
      </div>

      <div className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-[#9CA3AF]">
        <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', theme.dotColor)} />
        <span className="truncate">{theme.sublabel}</span>
      </div>
    </motion.div>
  );
}

/* ─── Table Badges & Helpers ─── */
function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-amber-300 bg-amber-100 text-[11px] font-extrabold text-amber-800 shadow-2xs">
        1
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-300 bg-slate-100 text-[11px] font-bold text-slate-700">
        2
      </span>
    );
  }
  if (rank === 3) {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-orange-300 bg-orange-100 text-[11px] font-bold text-orange-800">
        3
      </span>
    );
  }
  return (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[#E5E8EC] bg-[#F3F4F6] text-[11px] font-semibold text-[#6B7280]">
      {rank}
    </span>
  );
}

function OnlineBadge({ status }: { status: 'ONLINE' | 'OFFLINE' }) {
  if (status === 'ONLINE') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#A7F3D0] bg-[#ECFDF5] px-2.5 py-0.5 text-[11px] font-bold text-[#065F46]">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#10B981] opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-[#059669]" />
        </span>
        Online
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E5E8EC] bg-[#F4F6F8] px-2.5 py-0.5 text-[11px] font-medium text-[#6B7280]">
      <span className="h-1.5 w-1.5 rounded-full bg-[#9CA3AF]" />
      Offline
    </span>
  );
}

function ActivityLevelBadge({ level }: { level: ActivityLevel }) {
  const color = ACTIVITY_LEVEL_COLORS[level];
  const label = ACTIVITY_LEVEL_LABELS[level];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold"
      style={{
        backgroundColor: `${color}12`,
        borderColor: `${color}35`,
        color,
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

function formatTimestamp(ts: string | null): string {
  if (!ts) return '—';
  const d = new Date(ts);
  return (
    d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' ' +
    d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  );
}

function getInitials(name: string): string {
  if (!name) return 'U';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');
}

/* ═══════════════════════════════════════════════════════════════
 * MAIN PAGE COMPONENT
 * ═══════════════════════════════════════════════════════════════ */

export default function UserActivityPage() {
  const { t } = useTranslation();
  const exportEnabled = useExportEnabled();

  // ── State ──
  const [days, setDays] = useState(30);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ONLINE' | 'OFFLINE'>('ALL');
  const [analyticsFilter, setAnalyticsFilter] = useState<'ALL' | AnalyticsCategory>('ALL');
  const [page, setPage] = useState(1);
  const [hoveredDonutIndex, setHoveredDonutIndex] = useState<number | null>(null);
  const pageSize = 10;

  const { summary, users, trend, modules, heatmap, isLoading, isError, refresh } = useActivityData({
    days,
    page,
    pageSize,
    search,
    status: statusFilter,
    analyticsCategory: analyticsFilter !== 'ALL' ? analyticsFilter : undefined,
  });

  // ── Derived data ──
  const kpiCards = useMemo(() => buildKpiCards(summary), [summary]);
  const trendData = useMemo(() => buildTrendData(trend), [trend]);
  const donutData = useMemo(() => buildDonutData(modules), [modules]);
  const heatmapGrid = useMemo(() => buildHeatmapGrid(heatmap), [heatmap]);
  const topUsersBar = useMemo(() => buildTopUsersBar(users?.data), [users]);

  // Total accesses across modules for Donut center
  const totalModuleAccess = useMemo(() => {
    return donutData.reduce((sum, item) => sum + item.value, 0);
  }, [donutData]);

  // ── Derived user rows with calculated rank ──
  const userRowsWithRank = useMemo(() => {
    return (users?.data ?? []).map((u, idx) => ({
      ...u,
      rank: (page - 1) * pageSize + idx + 1,
    }));
  }, [users?.data, page, pageSize]);

  // ── Table columns ──
  const columns: DataColumn<DetailedUserRow & { rank: number }>[] = useMemo(
    () => [
      {
        key: 'rank',
        label: '#',
        minWidth: '55px',
        align: 'center',
        value: (r) => r.rank,
        render: (r) => <RankBadge rank={r.rank} />,
      },
      {
        key: 'username',
        label: 'User ID',
        minWidth: '120px',
        value: (r) => r.username,
        render: (r) => (
          <span className="inline-block rounded-md border border-[#E5E8EC] bg-[#F4F6F8] px-2 py-0.5 font-mono text-[11px] font-bold text-[#4B5563]">
            {r.username}
          </span>
        ),
      },
      {
        key: 'fullName',
        label: 'Nama User',
        minWidth: '180px',
        value: (r) => r.fullName,
        render: (r) => (
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#2563EB] to-[#60A5FA] text-[10px] font-bold text-white shadow-2xs">
              {getInitials(r.fullName)}
            </div>
            <span className="font-bold text-[#1F2A37]">{r.fullName}</span>
          </div>
        ),
      },
      {
        key: 'analyticsCategory',
        label: 'Kategori Analytics',
        minWidth: '130px',
        align: 'center',
        value: (r) => r.analyticsCategory ?? '',
        render: (r) => {
          if (!r.analyticsCategory) {
            return <span className="text-xs text-[#9CA3AF]">—</span>;
          }
          const colors = ANALYTICS_CATEGORY_BADGES[r.analyticsCategory] ?? {
            bg: '#F9FAFB',
            border: '#E5E8EC',
            text: '#4B5563',
          };
          return (
            <span
              className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold"
              style={{ backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }}
            >
              {r.analyticsCategory}
            </span>
          );
        },
      },
      {
        key: 'totalAccess',
        label: 'Total Akses',
        minWidth: '110px',
        align: 'right',
        value: (r) => r.totalAccess,
        render: (r) => (
          <span className="inline-block rounded-md border border-[#DBEAFE] bg-[#EFF6FF] px-2 py-0.5 font-bold tabular-nums text-[#1D4ED8]">
            {formatNumber(r.totalAccess)}
          </span>
        ),
      },
      {
        key: 'totalLogins',
        label: 'Sesi Login',
        minWidth: '95px',
        align: 'right',
        value: (r) => r.totalLogins,
        render: (r) => (
          <span className="font-semibold tabular-nums text-[#4B5563]">
            {formatNumber(r.totalLogins)}
          </span>
        ),
      },
      {
        key: 'activeDays',
        label: 'Hari Aktif',
        minWidth: '90px',
        align: 'right',
        value: (r) => r.activeDays,
        render: (r) => (
          <span className="font-semibold tabular-nums text-[#4B5563]">
            {formatNumber(r.activeDays)} hari
          </span>
        ),
      },
      {
        key: 'topModules',
        label: 'Modul Diakses',
        minWidth: '240px',
        value: (r) => r.topModules?.map((m) => m.menuLabel).join(', ') ?? '',
        render: (r) => {
          if (!r.topModules || r.topModules.length === 0) {
            return <span className="text-xs text-[#9CA3AF]">—</span>;
          }
          // Module-specific colors for badges
          const moduleColors: Record<string, { bg: string; border: string; text: string; countBg: string; countText: string }> = {
            settings:   { bg: '#F5F3FF', border: '#DDD6FE', text: '#6D28D9', countBg: '#EDE9FE', countText: '#7C3AED' },
            auth:       { bg: '#ECFEFF', border: '#A5F3FC', text: '#0369A1', countBg: '#CFFAFE', countText: '#0891B2' },
            cms:        { bg: '#ECFDF5', border: '#A7F3D0', text: '#047857', countBg: '#D1FAE5', countText: '#059669' },
            indemnity:  { bg: '#EFF6FF', border: '#BFDBFE', text: '#1D4ED8', countBg: '#DBEAFE', countText: '#2563EB' },
            managecare: { bg: '#FFFBEB', border: '#FDE68A', text: '#B45309', countBg: '#FEF3C7', countText: '#D97706' },
            adscore:    { bg: '#F0FDF4', border: '#BBF7D0', text: '#15803D', countBg: '#DCFCE7', countText: '#16A34A' },
            dashboard:  { bg: '#EEF2FF', border: '#C7D2FE', text: '#4338CA', countBg: '#E0E7FF', countText: '#6366F1' },
          };
          const defaultColor = { bg: '#F9FAFB', border: '#E5E8EC', text: '#4B5563', countBg: '#F3F4F6', countText: '#6B7280' };
          return (
            <div className="flex flex-wrap gap-1">
              {r.topModules.map((m, idx) => {
                const c = moduleColors[m.module] ?? defaultColor;
                return (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold"
                    style={{ backgroundColor: c.bg, borderColor: c.border, color: c.text }}
                  >
                    {m.menuLabel}
                    <span
                      className="rounded px-1 text-[9px] font-bold tabular-nums"
                      style={{ backgroundColor: c.countBg, color: c.countText }}
                    >
                      {formatNumber(m.totalAccess)}
                    </span>
                  </span>
                );
              })}
            </div>
          );
        },
      },
      {
        key: 'ipAddress',
        label: 'Alamat IP',
        minWidth: '130px',
        value: (r) => r.ipAddress ?? '',
        render: (r) => (
          <div className="flex items-center gap-1.5 font-mono text-[11px] text-[#6B7280]">
            <Globe className="h-3 w-3 text-[#9CA3AF]" />
            <span>{r.ipAddress ?? '—'}</span>
          </div>
        ),
      },
      {
        key: 'deviceInfo',
        label: 'Perangkat / Browser',
        minWidth: '140px',
        value: (r) => r.deviceInfo ?? '',
        render: (r) => (
          <div className="flex items-center gap-1.5 text-xs text-[#4B5563]">
            <Monitor className="h-3.5 w-3.5 shrink-0 text-[#9CA3AF]" />
            <span className="max-w-[140px] truncate">{r.deviceInfo ?? '—'}</span>
          </div>
        ),
      },
      {
        key: 'geolocation',
        label: 'Lokasi',
        minWidth: '150px',
        value: (r) => r.geolocation ?? '',
        render: (r) => (
          <div className="flex items-center gap-1.5 text-xs text-[#4B5563]">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-[#9CA3AF]" />
            <span className="max-w-[150px] truncate">{r.geolocation ?? '—'}</span>
          </div>
        ),
      },
      {
        key: 'firstActivityAt',
        label: 'Akses Pertama',
        minWidth: '135px',
        value: (r) => r.firstActivityAt ?? '',
        render: (r) => (
          <div className="flex items-center gap-1 text-[11px] text-[#6B7280]">
            <Clock className="h-3 w-3 text-[#9CA3AF]" />
            <span>{formatTimestamp(r.firstActivityAt)}</span>
          </div>
        ),
      },
      {
        key: 'lastActivityAt',
        label: 'Akses Terakhir',
        minWidth: '135px',
        value: (r) => r.lastActivityAt ?? '',
        render: (r) => (
          <div className="flex items-center gap-1 text-[11px] text-[#6B7280]">
            <Clock className="h-3 w-3 text-[#9CA3AF]" />
            <span>{formatTimestamp(r.lastActivityAt)}</span>
          </div>
        ),
      },
      {
        key: 'status',
        label: 'Status Online',
        minWidth: '110px',
        align: 'center',
        value: (r) => r.status,
        render: (r) => <OnlineBadge status={r.status} />,
      },
      {
        key: 'activityLevel',
        label: 'Status Aktivitas',
        minWidth: '125px',
        align: 'center',
        value: (r) => r.activityLevel,
        render: (r) => <ActivityLevelBadge level={r.activityLevel} />,
      },
    ],
    [page, pageSize],
  );

  // ── Loading & error states ──
  if (isLoading) return <PageLoader />;
  if (isError) return <ApiError onRetry={refresh} />;

  return (
    <div className="flex flex-col gap-4">
      {/* ── Header Section ── */}
      <motion.div
        variants={sectionVariants}
        initial="hidden"
        animate="show"
        className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"
      >
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[20px] font-extrabold tracking-tight text-[#1F2A37] sm:text-[22px]">
              {t('activity.title')}
            </h1>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-md border border-[#DBEAFE] bg-[#EFF6FF] px-2 py-0.5 text-[11px] font-semibold text-[#2563EB]">
              AdBrief Analytics
            </span>
            <span className="flex items-center gap-1.5 text-[11px] font-medium text-[#059669]">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#10B981] opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#059669]" />
              </span>
            </span>
          </div>
        </div>

        {/* Date range filter + Refresh button */}
        <div className="flex items-center gap-2">
          {/* Segmented days selector */}
          <div className="flex items-center rounded-lg border border-[#E5E8EC] bg-white p-0.5 shadow-2xs">
            {[7, 14, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => {
                  setDays(d);
                  setPage(1);
                }}
                className={cn(
                  'rounded-md px-2.5 py-1 text-xs font-semibold transition-all duration-150',
                  days === d
                    ? 'bg-[#2563EB] text-white shadow-2xs'
                    : 'text-[#6B7280] hover:text-[#1F2A37]',
                )}
              >
                {d} Hari
              </button>
            ))}
          </div>

          {/* Refresh button */}
          <button
            onClick={refresh}
            className="flex items-center gap-1.5 rounded-lg border border-[#E5E8EC] bg-white px-3 py-1.5 text-xs font-semibold text-[#4B5563] shadow-2xs transition-colors hover:bg-[#F9FAFB] hover:text-[#1F2A37]"
            title="Muat ulang data"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </motion.div>

      {/* ── ROW 1: KPI Cards Grid (6 metric cards) ── */}
      <motion.div
        variants={sectionVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"
      >
        {kpiCards.map((kpi, idx) => (
          <ActivityKpiCard key={kpi.key} kpi={kpi} index={idx} />
        ))}
      </motion.div>

      {/* ── ROW 2: Charts Row 1 — Trend (2/3) + Donut (1/3) ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Trend Area Chart */}
        <motion.div variants={sectionVariants} initial="hidden" animate="show" className="lg:col-span-2">
          <SectionCard
            title={t('activity.charts.trend')}
            right={
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 rounded-full border border-blue-400/30 bg-blue-500/20 px-2 py-0.5 text-[10px] font-bold text-blue-100">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                  Akses
                </span>
                <span className="flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-100">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  Login
                </span>
              </div>
            }
          >
            {trendData.length === 0 ? (
              <EmptyState message={t('activity.noData')} />
            ) : (
              <div className="pt-2">
                <ResponsiveContainer width="100%" height={290}>
                  <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorAkses" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={PALETTE.blue} stopOpacity={0.25} />
                        <stop offset="95%" stopColor={PALETTE.blue} stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="colorLogin" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={PALETTE.orange} stopOpacity={0.25} />
                        <stop offset="95%" stopColor={PALETTE.orange} stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={{ stroke: '#E5E8EC' }}
                      tick={{ fontSize: 11, fill: '#6B7280' }}
                      tickFormatter={(v) => {
                        const d = new Date(v);
                        return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
                      }}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11, fill: '#6B7280' }}
                      tickFormatter={(v) => formatNumber(v)}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        const d = label ? new Date(label) : null;
                        const formattedDate = d
                          ? d.toLocaleDateString('id-ID', {
                            weekday: 'long',
                            day: '2-digit',
                            month: 'long',
                            year: 'numeric',
                          })
                          : '';
                        return (
                          <div className="rounded-xl border border-[#E5E8EC] bg-white/95 p-3 shadow-xl backdrop-blur-md">
                            <div className="mb-2 flex items-center gap-1.5 border-b border-[#F3F4F6] pb-1.5 text-[11px] font-semibold text-[#6B7280]">
                              <Calendar className="h-3 w-3 text-[#9CA3AF]" />
                              <span>{formattedDate}</span>
                            </div>
                            <div className="space-y-1.5 text-xs">
                              {payload.map((entry, idx) => (
                                <div key={idx} className="flex items-center justify-between gap-4">
                                  <div className="flex items-center gap-1.5">
                                    <span
                                      className="h-2 w-2 rounded-full"
                                      style={{ backgroundColor: entry.color }}
                                    />
                                    <span className="text-[#4B5563]">{entry.name}:</span>
                                  </div>
                                  <span className="font-bold tabular-nums text-[#1F2A37]">
                                    {formatNumber(Number(entry.value))}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="Akses"
                      name="Total Akses"
                      stroke={PALETTE.blue}
                      strokeWidth={2.5}
                      fill="url(#colorAkses)"
                      activeDot={{ r: 5, stroke: '#FFFFFF', strokeWidth: 2, fill: PALETTE.blue }}
                    />
                    <Area
                      type="monotone"
                      dataKey="Login"
                      name="Sesi Login"
                      stroke={PALETTE.orange}
                      strokeWidth={2.5}
                      fill="url(#colorLogin)"
                      activeDot={{ r: 5, stroke: '#FFFFFF', strokeWidth: 2, fill: PALETTE.orange }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </SectionCard>
        </motion.div>

        {/* Module Donut */}
        <motion.div variants={sectionVariants} initial="hidden" animate="show">
          <SectionCard
            title={t('activity.charts.modules')}
            right={
              <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                {donutData.length} Modul
              </span>
            }
          >
            {donutData.length === 0 ? (
              <EmptyState message={t('activity.noData')} />
            ) : (
              <div className="flex flex-col items-center">
                <div className="relative h-[200px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={donutData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius="64%"
                        outerRadius="86%"
                        paddingAngle={3}
                        cornerRadius={5}
                        onMouseEnter={(_, index) => setHoveredDonutIndex(index)}
                        onMouseLeave={() => setHoveredDonutIndex(null)}
                      >
                        {donutData.map((entry, i) => (
                          <Cell
                            key={i}
                            fill={entry.color}
                            stroke="#FFFFFF"
                            strokeWidth={hoveredDonutIndex === i ? 2.5 : 1.5}
                            className="transition-all duration-200 outline-none cursor-pointer"
                            opacity={
                              hoveredDonutIndex === null || hoveredDonutIndex === i ? 1 : 0.6
                            }
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          borderRadius: 10,
                          border: '1px solid #E5E8EC',
                          backgroundColor: 'rgba(255, 255, 255, 0.95)',
                          boxShadow: '0 4px 12px rgba(16, 24, 40, 0.1)',
                          fontSize: 12,
                        }}
                        formatter={(v: number) => [
                          `${formatNumber(v)} akses (${((v / (totalModuleAccess || 1)) * 100).toFixed(1)}%)`,
                          'Akses',
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>

                  {/* Center metrics indicator */}
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF]">
                      {hoveredDonutIndex !== null
                        ? donutData[hoveredDonutIndex]?.name
                        : 'Total Akses'}
                    </span>
                    <span className="font-display text-[18px] font-extrabold tracking-tight text-[#1F2A37]">
                      {formatNumber(
                        hoveredDonutIndex !== null
                          ? donutData[hoveredDonutIndex]?.value ?? 0
                          : totalModuleAccess,
                      )}
                    </span>
                    <span className="text-[10px] font-semibold text-[#2563EB]">
                      {hoveredDonutIndex !== null
                        ? `${(((donutData[hoveredDonutIndex]?.value ?? 0) / (totalModuleAccess || 1)) * 100).toFixed(1)}%`
                        : '100%'}
                    </span>
                  </div>
                </div>

                {/* Minimalist Interactive Legend list */}
                <div className="mt-3 w-full space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                  {donutData.map((slice, i) => {
                    const pct = ((slice.value / (totalModuleAccess || 1)) * 100).toFixed(1);
                    const isHovered = hoveredDonutIndex === i;
                    return (
                      <div
                        key={i}
                        onMouseEnter={() => setHoveredDonutIndex(i)}
                        onMouseLeave={() => setHoveredDonutIndex(null)}
                        className={cn(
                          'flex items-center justify-between rounded-lg px-2 py-1 text-xs transition-all duration-150 cursor-pointer',
                          isHovered
                            ? 'bg-[#F4F6F8] shadow-2xs font-semibold'
                            : 'hover:bg-[#F9FAFB]',
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-sm shadow-2xs"
                            style={{ backgroundColor: slice.color }}
                          />
                          <span className="truncate text-[#4B5563] text-[11px]">
                            {slice.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="font-bold tabular-nums text-[#1F2A37] text-[11px]">
                            {formatNumber(slice.value)}
                          </span>
                          <span className="rounded bg-[#F3F4F6] px-1.5 py-0.2 text-[9px] font-medium text-[#6B7280]">
                            {pct}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </SectionCard>
        </motion.div>
      </div>

      {/* ── ROW 3: Charts Row 2 — Top 5 Bar (2/5) + Heatmap (3/5) ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* Top 5 Bar Chart */}
        <motion.div variants={sectionVariants} initial="hidden" animate="show" className="lg:col-span-2">
          <SectionCard
            title={t('activity.charts.topUsers')}
            right={
              <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                Top 5 Kontributor
              </span>
            }
          >
            {topUsersBar.length === 0 ? (
              <EmptyState message={t('activity.noData')} />
            ) : (
              <div className="pt-2">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart
                    data={topUsersBar}
                    layout="vertical"
                    margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                    <XAxis
                      type="number"
                      tickLine={false}
                      axisLine={{ stroke: '#E5E8EC' }}
                      tick={{ fontSize: 10, fill: '#6B7280' }}
                      tickFormatter={(v) => formatNumber(v)}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11, fill: '#374151', fontWeight: 600 }}
                      width={90}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 10,
                        border: '1px solid #E5E8EC',
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        boxShadow: '0 4px 12px rgba(16, 24, 40, 0.1)',
                        fontSize: 12,
                      }}
                      formatter={(v: number) => [`${formatNumber(v)} akses`, 'Total Akses']}
                    />
                    <Bar
                      dataKey="value"
                      name="Total Akses"
                      radius={[0, 6, 6, 0]}
                      barSize={18}
                      background={{ fill: '#F8FAFC' }}
                    >
                      {topUsersBar.map((_, i) => (
                        <Cell
                          key={i}
                          fill={
                            [
                              PALETTE.blue,
                              PALETTE.green,
                              PALETTE.orange,
                              PALETTE.purple,
                              PALETTE.cyan,
                            ][i % 5]
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </SectionCard>
        </motion.div>

        {/* Activity Heatmap */}
        <motion.div variants={sectionVariants} initial="hidden" animate="show" className="lg:col-span-3">
          <SectionCard
            title={t('activity.charts.heatmap')}
            right={
              <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                24 Jam × 7 Hari
              </span>
            }
          >
            {heatmapGrid.cells.length === 0 ? (
              <EmptyState message={t('activity.noData')} />
            ) : (
              <div className="overflow-x-auto pt-1">
                <div className="min-w-[560px]">
                  {/* Hour labels (top) */}
                  <div className="mb-1 flex pl-12">
                    {HOUR_LABELS.map((h) => (
                      <div key={h} className="flex-1 text-center text-[10px] font-semibold text-[#9CA3AF]">
                        {Number(h) % 3 === 0 ? h : ''}
                      </div>
                    ))}
                  </div>

                  {/* Grid rows */}
                  <div className="space-y-1">
                    {DAY_LABELS.map((day, dayIdx) => (
                      <div key={day} className="flex items-center">
                        <div className="w-12 shrink-0 text-xs font-bold text-[#4B5563]">{day}</div>
                        <div className="flex flex-1 gap-1">
                          {Array.from({ length: 24 }, (_, hour) => {
                            const cell = heatmapGrid.cells.find(
                              (c) => c.day === dayIdx && c.hour === hour,
                            );
                            const value = cell?.value ?? 0;
                            const cellBg = getHeatmapColor(value, heatmapGrid.maxValue);
                            return (
                              <div
                                key={hour}
                                className="group relative h-5 flex-1 rounded-[3px] transition-all duration-150 hover:ring-2 hover:ring-[#2563EB] hover:scale-105"
                                style={{ backgroundColor: cellBg }}
                                title={`${day} ${String(hour).padStart(2, '0')}:00 — ${formatNumber(value)} akses`}
                              />
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Legend Bar */}
                  <div className="mt-4 flex items-center justify-between border-t border-[#F3F4F6] pt-2 text-[11px] text-[#6B7280]">
                    <span className="font-medium text-[#9CA3AF]">Pola Kepadatan Akses Harian</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-[#9CA3AF]">Rendah</span>
                      {['#EFF6FF', '#DBEAFE', '#93C5FD', '#3B82F6', '#1D4ED8', '#1E3A8A'].map((c) => (
                        <span
                          key={c}
                          className="h-3 w-3.5 rounded-[2px] shadow-2xs"
                          style={{ backgroundColor: c }}
                        />
                      ))}
                      <span className="text-[10px] text-[#9CA3AF]">Tinggi</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </SectionCard>
        </motion.div>
      </div>

      {/* ── ROW 4: DAFTAR USER TERAKTIF ── */}
      <motion.div variants={sectionVariants} initial="hidden" animate="show">
        <SectionCard
          title={t('activity.userTable.title')}
          right={
            <div className="flex flex-wrap items-center gap-2">
              {/* Search in SectionCard header */}
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/60" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder={t('activity.userTable.search')}
                  className="h-7 w-36 rounded-lg border border-white/20 bg-white/10 py-1 pl-8 pr-7 text-[11px] font-medium text-white backdrop-blur-sm transition-all placeholder:text-white/60 focus:bg-white/20 focus:outline-none focus:ring-1 focus:ring-white/40 sm:w-52"
                />
                {search && (
                  <button
                    onClick={() => {
                      setSearch('');
                      setPage(1);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-white/60 hover:text-white"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>

              {/* Status filter dropdown */}
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as 'ALL' | 'ONLINE' | 'OFFLINE');
                  setPage(1);
                }}
                className="h-7 rounded-lg border border-white/20 bg-white/10 px-2.5 text-[11px] font-medium text-white backdrop-blur-sm transition-colors focus:bg-[#1E3A6E] focus:outline-none focus:ring-1 focus:ring-white/40"
              >
                <option value="ALL" className="bg-[#1E3A6E] text-white">
                  Semua Status
                </option>
                <option value="ONLINE" className="bg-[#1E3A6E] text-white">
                  Online
                </option>
                <option value="OFFLINE" className="bg-[#1E3A6E] text-white">
                  Offline
                </option>
              </select>

              {/* Analytics Category filter dropdown */}
              <select
                value={analyticsFilter}
                onChange={(e) => {
                  setAnalyticsFilter(e.target.value as 'ALL' | AnalyticsCategory);
                  setPage(1);
                }}
                className="h-7 rounded-lg border border-white/20 bg-white/10 px-2.5 text-[11px] font-medium text-white backdrop-blur-sm transition-colors focus:bg-[#1E3A6E] focus:outline-none focus:ring-1 focus:ring-white/40"
              >
                <option value="ALL" className="bg-[#1E3A6E] text-white">
                  Semua Kategori
                </option>
                {ANALYTICS_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat} className="bg-[#1E3A6E] text-white">
                    {cat}
                  </option>
                ))}
              </select>

              {/* Export Button */}
              {exportEnabled && (
                <ExportButton
                  getPayload={() => ({
                    headers: [
                      'Peringkat',
                      'User ID',
                      'Nama User',
                      'Kategori Analytics',
                      'Total Akses',
                      'Sesi Login',
                      'Hari Aktif',
                      'Modul Diakses',
                      'IP',
                      'Browser/Device',
                      'Lokasi',
                      'Akses Pertama',
                      'Akses Terakhir',
                      'Status Online',
                      'Status Aktivitas',
                    ],
                    rows: (users?.data ?? []).map((u, i) => [
                      (page - 1) * pageSize + i + 1,
                      u.username,
                      u.fullName,
                      u.analyticsCategory ?? '',
                      u.totalAccess,
                      u.totalLogins,
                      u.activeDays,
                      u.topModules?.map((m) => `${m.menuLabel} (${m.totalAccess})`).join('; ') ?? '',
                      u.ipAddress ?? '',
                      u.deviceInfo ?? '',
                      u.geolocation ?? '',
                      u.firstActivityAt ?? '',
                      u.lastActivityAt ?? '',
                      u.status,
                      ACTIVITY_LEVEL_LABELS[u.activityLevel],
                    ]),
                  })}
                  filename="daftar-user-teraktif"
                />
              )}
            </div>
          }
        >
          {users && users.data.length > 0 ? (
            <>
              <DataTable
                columns={columns}
                rows={userRowsWithRank}
                rowKey={(row) => row.userId}
                className="overflow-x-auto"
              />

              {/* Enhanced Pagination Controls */}
              <div className="mt-4 flex flex-col items-center justify-between gap-3 border-t border-[#F3F4F6] pt-3 sm:flex-row">
                <p className="text-xs font-medium text-[#6B7280]">
                  Menampilkan{' '}
                  <span className="font-semibold text-[#1F2A37]">
                    {(users.page - 1) * users.pageSize + 1}–
                    {Math.min(users.page * users.pageSize, users.total)}
                  </span>{' '}
                  dari <span className="font-semibold text-[#1F2A37]">{formatNumber(users.total)}</span>{' '}
                  pengguna terdaftar
                </p>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={users.page <= 1}
                    className="rounded-lg border border-[#E5E8EC] bg-white px-3 py-1.5 text-xs font-semibold text-[#4B5563] shadow-2xs transition-colors hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Sebelumnya
                  </button>
                  <span className="rounded-lg border border-[#E5E8EC] bg-[#F9FAFB] px-3 py-1.5 text-xs font-bold text-[#1F2A37]">
                    {users.page} / {users.totalPages || 1}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(users.totalPages, p + 1))}
                    disabled={users.page >= users.totalPages}
                    className="rounded-lg border border-[#E5E8EC] bg-white px-3 py-1.5 text-xs font-semibold text-[#4B5563] shadow-2xs transition-colors hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Berikutnya
                  </button>
                </div>
              </div>
            </>
          ) : (
            <EmptyState message={t('activity.userTable.empty')} />
          )}
        </SectionCard>
      </motion.div>

      {/* ── ROW 5: Footer ── */}
      <div className="mt-2 flex flex-col items-center justify-between gap-2.5 border-t border-[#E5E8EC] pt-4 pb-2 text-xs text-[#9CA3AF] sm:flex-row">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-md border border-[#E5E8EC] bg-white px-2.5 py-1 text-[11px] font-medium text-[#4B5563] shadow-2xs">
            <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />
            Source: <span className="font-mono font-semibold">access_logs</span>
          </span>
          <span className="inline-flex items-center gap-1 rounded-md border border-[#E5E8EC] bg-white px-2.5 py-1 text-[11px] font-medium text-[#4B5563] shadow-2xs">
            <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />
            <span className="font-mono font-semibold">login_sessions</span>
          </span>
          <span className="inline-flex items-center gap-1 rounded-md border border-[#E5E8EC] bg-white px-2.5 py-1 text-[11px] font-medium text-[#4B5563] shadow-2xs">
            <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />
            <span className="font-mono font-semibold">user_activity_daily</span>
          </span>
        </div>
        <div className="flex items-center gap-1 text-[11px] font-medium text-[#9CA3AF]">
          <Sparkles className="h-3 w-3 text-amber-500" />
          <span>© {new Date().getFullYear()} AdBrief Analytics — AdMedika NahSehat Healthcare System</span>
        </div>
      </div>
    </div>
  );
}