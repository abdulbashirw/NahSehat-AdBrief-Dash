/**
 * DashboardPage.tsx — Healthcare Utilization & Operational Intelligence Dashboard
 *
 * Design & Architecture:
 * - Ultra-Modern Glassmorphism & Framer-Motion Animations: Rich aesthetics with soft radiant glowing orbs,
 *   smooth elevation transitions, interactive hover dynamics, and sleek typography.
 * - Dynamic Role-Based Columns: Strictly conditionally renders INDEMNITY, MANAGECARE,
 *   ADSCORE, and CMS (Super Admin only) modules based on user RBAC privileges.
 * - Redesigned Interactive Command Tiles: Pintasan Navigasi redesigned into modern command tiles
 *   with vivid gradient icon pods, launch pills, and responsive layout.
 * - Real Product Data: Bound to useIndemnityData, useDailyMonitoringData, and auth state.
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Activity,
  ArrowRight,
  BarChart3,
  Building2,
  ChevronRight,
  Clock,
  Compass,
  FileText,
  RefreshCw,
  Settings,
  Shield,
  Sparkles,
  TrendingUp,
  UserCog,
  Users,
  Zap,
} from 'lucide-react';
import { useAuth } from '@/entities/auth/model/useAuth';
import { useHasRole, useCanAccessCallback } from '@/entities/auth/model/useRbac';
import { useIndemnityData } from '@/features/indemnity-overview/hooks/useIndemnityData';
import { useDailyMonitoringData } from '@/features/daily-monitoring/hooks/useDailyMonitoringData';
import DashboardBackground from '@/shared/components/common/DashboardBackground';
import {
  formatCompactIDR,
  formatDateTime,
  formatNumber,
} from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';

// ── Motion Animation Variants ──
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: 'easeOut' as const },
  },
};

export default function Dashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();

  // ── Role Permissions & Granular Access ──
  const isSuperAdmin = useHasRole('SUPER_ADMIN');
  const isAdmin = useHasRole('ADMIN');
  const isIndemnityRole = useHasRole('INDEMNITY');
  const isManageCareRole = useHasRole('MANAGECARE');
  const isAdScoreRole = useHasRole('ADSCORE');
  const canAccess = useCanAccessCallback();

  const showIndemnity = isSuperAdmin || isAdmin || isIndemnityRole || canAccess('/indemnity');
  const showManageCare = isSuperAdmin || isAdmin || isManageCareRole || canAccess('/managecare');
  const showAdScore = isSuperAdmin || isAdmin || isAdScoreRole || canAccess('/adscore');
  const showCms = isSuperAdmin; // Strictly Super Admin only as instructed
  const showActivity = isSuperAdmin || canAccess('/activity');

  // ── Real Indemnity Claims Data ──
  const {
    data: indemnityData,
    isLoading: indemnityLoading,
    isFetching: indemnityFetching,
    refetch: refetchIndemnity,
    lastUpdated: indemnityLastUpdated,
  } = useIndemnityData();

  const kpis = useMemo(() => {
    if (!indemnityData) return null;
    const { claims } = indemnityData;
    const totalClaims = claims.length;
    const totalIncurred = claims.reduce((s: number, c: { INCURRED: number }) => s + (c.INCURRED || 0), 0);
    const totalApproved = claims.reduce((s: number, c: { APPROVED: number }) => s + (c.APPROVED || 0), 0);
    const approvalRate = totalIncurred > 0 ? (totalApproved / totalIncurred) * 100 : 0;
    const uniqueMembers = new Set(claims.map((c: { MEMBERNO: string }) => c.MEMBERNO)).size;
    return { totalClaims, totalIncurred, totalApproved, approvalRate, uniqueMembers };
  }, [indemnityData]);

  // ── Real Manage Care (Daily Monitoring) Data ──
  const {
    items: monitoringItems,
    isLoading: monitoringLoading,
    isFetching: monitoringFetching,
    refetch: refetchMonitoring,
    lastUpdated: monitoringLastUpdated,
  } = useDailyMonitoringData();

  const monitoringStats = useMemo(() => {
    if (!monitoringItems || monitoringItems.length === 0) {
      return { total: 0, dmo: 0, dhc: 0, avgDays: '0' };
    }
    let dmo = 0;
    let dhc = 0;
    let totalDays = 0;
    let daysCount = 0;
    for (const item of monitoringItems) {
      const status = item.header?.ClaimStatus?.toUpperCase();
      if (status === 'DMO') dmo++;
      else if (status === 'DHC') dhc++;
      const days = item.header?.Days;
      if (typeof days === 'number' && !isNaN(days)) {
        totalDays += days;
        daysCount++;
      }
    }
    const avgDays = daysCount > 0 ? (totalDays / daysCount).toFixed(1) : '0';
    return { total: monitoringItems.length, dmo, dhc, avgDays };
  }, [monitoringItems]);

  // ── Refresh & Timestamp Handlers ──
  const isRefreshing = indemnityFetching || monitoringFetching;
  const lastUpdated = indemnityLastUpdated || monitoringLastUpdated;

  const handleRefresh = () => {
    if (showIndemnity) refetchIndemnity();
    if (showManageCare) refetchMonitoring();
  };

  // ── Role Badge Token Helper ──
  const roleBadge = useMemo(() => {
    switch (user?.role) {
      case 'SUPER_ADMIN':
        return { label: 'SUPER ADMIN', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'ADMIN':
        return { label: 'ADMINISTRATOR', className: 'bg-blue-50 text-blue-700 border-blue-200' };
      case 'INDEMNITY':
        return { label: 'INDEMNITY', className: 'bg-cyan-50 text-cyan-700 border-cyan-200' };
      case 'MANAGECARE':
        return { label: 'MANAGE CARE', className: 'bg-sky-50 text-sky-700 border-sky-200' };
      case 'ADSCORE':
        return { label: 'ADSCORE', className: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
      default:
        return { label: user?.role || 'USER', className: 'bg-slate-50 text-slate-700 border-slate-200' };
    }
  }, [user?.role]);

  // Count active modules to determine layout grid columns
  const activeModuleCount = [showIndemnity, showManageCare, showAdScore, showCms].filter(Boolean).length;

  return (
    <div className="relative min-h-full">
      {/* ── Layered Animated Background ── */}
      <DashboardBackground variant="dashboard" />

      {/* ── Main Container ── */}
      <div className="relative z-10 flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
        {/* ─────────────────────────────────────────────────────────────────
            1. HERO HEADER: Greeting & Realtime Status
        ─────────────────────────────────────────────────────────────────── */}
        <motion.header
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-[0_4px_24px_rgba(15,23,42,0.04)] backdrop-blur-xl"
        >
          {/* Top illuminated line */}
          <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-[#2563EB] via-[#06B6D4] to-[#6366F1]" />

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            {/* Left: Branding & Welcome Message */}
            <div className="flex items-center gap-3.5">
              <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#0F172A] via-[#1E3A8A] to-[#06B6D4] text-white shadow-md shadow-cyan-500/20">
                <span className="font-mono text-base font-black tracking-wider">AB</span>
                <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-white">
                  <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                </span>
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-extrabold tracking-tight text-[#0F172A] sm:text-2xl">
                    {t('dashboard.welcome', { name: user?.fullName || 'User' })}
                  </h1>
                  <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-wider', roleBadge.className)}>
                    {roleBadge.label}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-[#64748B] sm:text-sm">
                  {t('dashboard.overview', 'Berikut ringkasan operasional dan pemanfaatan kesehatan Anda')}
                </p>
              </div>
            </div>

            {/* Right: Last Updated & Refresh Button */}
            <div className="flex items-center gap-3 self-end sm:self-center">
              {lastUpdated && (
                <div className="hidden items-center gap-1.5 rounded-xl border border-slate-200/70 bg-slate-50/80 px-3 py-1.5 text-xs text-[#64748B] sm:flex">
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                  <span>
                    {t('dashboard.lastUpdated', 'Diperbarui')}:{' '}
                    <strong className="font-semibold text-slate-800">{formatDateTime(lastUpdated)}</strong>
                  </span>
                </div>
              )}

              <button
                type="button"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-xs transition-all hover:border-[#06B6D4] hover:text-[#06B6D4] active:scale-95 disabled:opacity-50"
                title={t('dashboard.refresh', 'Muat ulang data')}
              >
                <RefreshCw className={cn('h-3.5 w-3.5', isRefreshing && 'animate-spin text-[#06B6D4]')} />
                <span>{isRefreshing ? t('dashboard.refreshing', 'Memuat...') : t('dashboard.refresh', 'Refresh')}</span>
              </button>
            </div>
          </div>
        </motion.header>

        {/* ─────────────────────────────────────────────────────────────────
            2. EXPLORE MODULES: Ultra-Modern Role-Based Operational Hub
        ─────────────────────────────────────────────────────────────────── */}
        <section>
          {/* Section Header */}
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-tr from-[#2563EB] to-[#06B6D4] text-white shadow-xs">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-extrabold uppercase tracking-wider text-[#0F172A] sm:text-base">
                  {t('dashboard.exploreModules', 'Modul Operasional & Analisis')}
                </h2>
                <p className="text-xs text-slate-500">
                  {t('dashboard.exploreModulesDesc', 'Intelijen dan pemanfaatan aktif berdasarkan otorisasi profil Anda')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-200 bg-cyan-50/80 px-3 py-1 text-[11px] font-bold text-cyan-800 shadow-xs backdrop-blur-sm">
                <span className="h-2 w-2 rounded-full bg-cyan-500 animate-pulse" />
                {t('dashboard.activeModules', { count: activeModuleCount, defaultValue: '{{count}} Modul Otorisasi Aktif' })}
              </span>
            </div>
          </div>

          {/* Dynamic Animated Grid */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className={cn(
              'grid grid-cols-1 gap-5',
              activeModuleCount === 4 && 'md:grid-cols-2 xl:grid-cols-4',
              activeModuleCount === 3 && 'md:grid-cols-3',
              activeModuleCount === 2 && 'md:grid-cols-2',
              activeModuleCount === 1 && 'md:grid-cols-1',
            )}
          >
            {/* ─── MODULE 1: INDEMNITY ───────────────────────────────── */}
            {showIndemnity && (
              <motion.div
                variants={itemVariants}
                whileHover={{ y: -6, transition: { duration: 0.25 } }}
                className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-cyan-200/60 bg-gradient-to-b from-white via-white/95 to-cyan-50/20 p-5 shadow-[0_4px_20px_rgba(6,182,212,0.06)] backdrop-blur-xl transition-all duration-300 hover:border-cyan-400 hover:shadow-[0_16px_36px_rgba(6,182,212,0.18)]"
              >
                {/* Radial Glow Orb */}
                <div className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-cyan-400/10 blur-2xl transition-opacity duration-300 group-hover:opacity-100" />
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#06B6D4] via-[#0284C7] to-[#2563EB]" />

                <div>
                  {/* Card Header */}
                  <div className="mb-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-50 to-cyan-100/80 text-cyan-600 shadow-sm transition-all duration-300 group-hover:scale-110 group-hover:bg-gradient-to-br group-hover:from-cyan-500 group-hover:to-blue-600 group-hover:text-white group-hover:shadow-md group-hover:shadow-cyan-500/25">
                        <BarChart3 className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-extrabold tracking-tight text-[#0F172A] group-hover:text-cyan-700 transition-colors">
                          INDEMNITY
                        </h3>
                        <p className="text-[10.5px] font-medium text-[#64748B]">{t('dashboard.indemnitySubtitle', 'Klaim & Utilisasi')}</p>
                      </div>
                    </div>
                    <span className="rounded-full bg-cyan-100/70 border border-cyan-200 px-2.5 py-0.5 text-[10px] font-bold text-cyan-800">
                      {t('dashboard.badgeFinancial', 'Financial')}
                    </span>
                  </div>

                  <p className="mb-4 text-xs text-slate-600 leading-relaxed">
                    {t('dashboard.indemnityDesc', 'Analisis klaim komprehensif, volume transaksi, rasio persetujuan biaya, dan tren morbiditas.')}
                  </p>

                  {/* Real Stats Metrics Panel */}
                  <div className="space-y-2.5 rounded-xl border border-cyan-100/80 bg-white/75 p-3.5 shadow-2xs backdrop-blur-sm">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs font-semibold text-slate-500">{t('dashboard.totalClaimsRecorded', 'Total Klaim Terdata:')}</span>
                      <span className="font-mono text-sm font-extrabold text-[#0F172A]">
                        {indemnityLoading ? '...' : kpis ? formatNumber(kpis.totalClaims) : '-'}
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between">
                      <span className="text-xs font-semibold text-slate-500">{t('dashboard.approvedAmount', 'Biaya Disetujui:')}</span>
                      <span className="font-mono text-sm font-extrabold text-cyan-700">
                        {indemnityLoading ? '...' : kpis ? formatCompactIDR(kpis.totalApproved) : '-'}
                      </span>
                    </div>

                    {/* Interactive Approval Rate Bar */}
                    <div className="pt-1">
                      <div className="mb-1 flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-slate-500">{t('dashboard.approvalRateLabel', 'Approval Rate')}</span>
                        <span className="font-mono font-bold text-emerald-600">
                          {kpis ? `${kpis.approvalRate.toFixed(1)}%` : '0%'}
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#06B6D4] to-emerald-500 transition-all duration-700"
                          style={{ width: `${Math.min(100, Math.max(5, kpis ? kpis.approvalRate : 0))}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Action */}
                <div className="mt-4 pt-3 border-t border-slate-100">
                  <Link
                    to="/indemnity/overview"
                    className="flex w-full items-center justify-between rounded-xl bg-gradient-to-r from-slate-100 to-cyan-50/50 px-3.5 py-2.5 text-xs font-bold text-slate-800 transition-all duration-200 group-hover:from-cyan-600 group-hover:to-blue-600 group-hover:text-white group-hover:shadow-md group-hover:shadow-cyan-600/20"
                  >
                    <span>{t('dashboard.openIndemnity', 'Buka Analitik Indemnity')}</span>
                    <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                  </Link>
                </div>
              </motion.div>
            )}

            {/* ─── MODULE 2: MANAGE CARE ─────────────────────────────── */}
            {showManageCare && (
              <motion.div
                variants={itemVariants}
                whileHover={{ y: -6, transition: { duration: 0.25 } }}
                className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-blue-200/60 bg-gradient-to-b from-white via-white/95 to-blue-50/20 p-5 shadow-[0_4px_20px_rgba(37,99,235,0.06)] backdrop-blur-xl transition-all duration-300 hover:border-blue-400 hover:shadow-[0_16px_36px_rgba(37,99,235,0.18)]"
              >
                {/* Radial Glow Orb */}
                <div className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-blue-500/10 blur-2xl transition-opacity duration-300 group-hover:opacity-100" />
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#2563EB] via-[#0284C7] to-[#38BDF8]" />

                <div>
                  {/* Card Header */}
                  <div className="mb-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-50 to-blue-100/80 text-[#2563EB] shadow-sm transition-all duration-300 group-hover:scale-110 group-hover:bg-gradient-to-br group-hover:from-blue-600 group-hover:to-sky-500 group-hover:text-white group-hover:shadow-md group-hover:shadow-blue-500/25">
                        <Activity className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-extrabold tracking-tight text-[#0F172A] group-hover:text-blue-700 transition-colors">
                          MANAGE CARE
                        </h3>
                        <p className="text-[10.5px] font-medium text-[#64748B]">{t('dashboard.inpatientSubtitle', 'Monitoring Rawat Inap')}</p>
                      </div>
                    </div>
                    <span className="flex items-center gap-1 rounded-full bg-emerald-100/70 border border-emerald-200 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                      {t('dashboard.badgeLiveInpatient', 'Live Inpatient')}
                    </span>
                  </div>

                  <p className="mb-4 text-xs text-slate-600 leading-relaxed">
                    {t('dashboard.manageCareDesc', 'Pemantauan harian pasien rawat inap aktif, penjaminan DMO/DHC, dan efisiensi hari rawat.')}
                  </p>

                  {/* Real Stats Metrics Panel */}
                  <div className="space-y-2.5 rounded-xl border border-blue-100/80 bg-white/75 p-3.5 shadow-2xs backdrop-blur-sm">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs font-semibold text-slate-500">{t('dashboard.inpatientCount', 'Pasien Rawat Inap:')}</span>
                      <span className="font-mono text-sm font-extrabold text-[#0F172A]">
                        {monitoringLoading ? '...' : `${formatNumber(monitoringStats.total)} ${t('dashboard.patientUnit', 'Pasien')}`}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-0.5">
                      <div className="rounded-lg bg-blue-50/70 p-2 text-center border border-blue-100/60">
                        <span className="block text-[10px] font-semibold text-blue-600 uppercase">{t('dashboard.dmoCases', 'Kasus DMO')}</span>
                        <span className="font-mono text-xs font-extrabold text-blue-800">
                          {monitoringLoading ? '...' : formatNumber(monitoringStats.dmo)}
                        </span>
                      </div>
                      <div className="rounded-lg bg-emerald-50/70 p-2 text-center border border-emerald-100/60">
                        <span className="block text-[10px] font-semibold text-emerald-600 uppercase">{t('dashboard.dhcCases', 'Kasus DHC')}</span>
                        <span className="font-mono text-xs font-extrabold text-emerald-800">
                          {monitoringLoading ? '...' : formatNumber(monitoringStats.dhc)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] pt-0.5">
                      <span className="font-semibold text-slate-500">{t('dashboard.avgLos', 'Rata-rata Hari Rawat (ALOS):')}</span>
                      <span className="font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                        {monitoringLoading ? '...' : `${monitoringStats.avgDays} ${t('dashboard.dayUnit', 'Hari')}`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer Action */}
                <div className="mt-4 pt-3 border-t border-slate-100">
                  <Link
                    to="/managecare/daily-monitoring"
                    className="flex w-full items-center justify-between rounded-xl bg-gradient-to-r from-slate-100 to-blue-50/50 px-3.5 py-2.5 text-xs font-bold text-slate-800 transition-all duration-200 group-hover:from-blue-600 group-hover:to-sky-500 group-hover:text-white group-hover:shadow-md group-hover:shadow-blue-600/20"
                  >
                    <span>{t('dashboard.openDailyMonitoring', 'Buka Daily Monitoring')}</span>
                    <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                  </Link>
                </div>
              </motion.div>
            )}

            {/* ─── MODULE 3: ADSCORE ─────────────────────────────────── */}
            {showAdScore && (
              <motion.div
                variants={itemVariants}
                whileHover={{ y: -6, transition: { duration: 0.25 } }}
                className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-indigo-200/60 bg-gradient-to-b from-white via-white/95 to-indigo-50/20 p-5 shadow-[0_4px_20px_rgba(99,102,241,0.06)] backdrop-blur-xl transition-all duration-300 hover:border-indigo-400 hover:shadow-[0_16px_36px_rgba(99,102,241,0.18)]"
              >
                {/* Radial Glow Orb */}
                <div className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-indigo-500/10 blur-2xl transition-opacity duration-300 group-hover:opacity-100" />
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500" />

                <div>
                  {/* Card Header */}
                  <div className="mb-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-50 to-indigo-100/80 text-indigo-600 shadow-sm transition-all duration-300 group-hover:scale-110 group-hover:bg-gradient-to-br group-hover:from-indigo-600 group-hover:to-purple-600 group-hover:text-white group-hover:shadow-md group-hover:shadow-indigo-500/25">
                        <TrendingUp className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-extrabold tracking-tight text-[#0F172A] group-hover:text-indigo-700 transition-colors">
                          ADSCORE
                        </h3>
                        <p className="text-[10.5px] font-medium text-[#64748B]">{t('dashboard.adScoreSubtitle', 'Scoring & Benchmarking')}</p>
                      </div>
                    </div>
                    <span className="rounded-full bg-indigo-100/70 border border-indigo-200 px-2.5 py-0.5 text-[10px] font-bold text-indigo-800">
                      {t('dashboard.badgeScale', 'Skala 1 - 20')}
                    </span>
                  </div>

                  <p className="mb-4 text-xs text-slate-600 leading-relaxed">
                    {t('dashboard.adScoreDesc', 'Evaluasi scoring standar provider, penilaian risiko klaim member, serta akselerasi alur onboarding.')}
                  </p>

                  {/* Feature Highlights Panel */}
                  <div className="space-y-2 rounded-xl border border-indigo-100/80 bg-white/75 p-3.5 shadow-2xs backdrop-blur-sm text-xs">
                    <div className="flex items-center gap-2 text-slate-700">
                      <div className="flex h-5 w-5 items-center justify-center rounded-md bg-indigo-50 text-indigo-600 shrink-0">
                        <Building2 className="h-3.5 w-3.5" />
                      </div>
                      <span className="font-medium truncate">{t('dashboard.slaServiceTime', 'SLA & Waktu Layanan Provider')}</span>
                    </div>

                    <div className="flex items-center gap-2 text-slate-700">
                      <div className="flex h-5 w-5 items-center justify-center rounded-md bg-purple-50 text-purple-600 shrink-0">
                        <Users className="h-3.5 w-3.5" />
                      </div>
                      <span className="font-medium truncate">{t('dashboard.memberRiskHistory', 'Profil Risiko & Histori Member')}</span>
                    </div>

                    <div className="flex items-center gap-2 text-slate-700">
                      <div className="flex h-5 w-5 items-center justify-center rounded-md bg-emerald-50 text-emerald-600 shrink-0">
                        <Zap className="h-3.5 w-3.5" />
                      </div>
                      <span className="font-medium truncate text-emerald-700 font-bold">{t('dashboard.onboardingSpeed', 'Onboarding 1-3 Hari (80% Cepat)')}</span>
                    </div>
                  </div>
                </div>

                {/* Footer Action */}
                <div className="mt-4 pt-3 border-t border-slate-100">
                  <Link
                    to="/adscore"
                    className="flex w-full items-center justify-between rounded-xl bg-gradient-to-r from-slate-100 to-indigo-50/50 px-3.5 py-2.5 text-xs font-bold text-slate-800 transition-all duration-200 group-hover:from-indigo-600 group-hover:to-purple-600 group-hover:text-white group-hover:shadow-md group-hover:shadow-indigo-600/20"
                  >
                    <span>{t('dashboard.openAdScoreHub', 'Buka Hub AdScore')}</span>
                    <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                  </Link>
                </div>
              </motion.div>
            )}

            {/* ─── MODULE 4: CMS (SUPER ADMIN ONLY) ─────────────────── */}
            {showCms && (
              <motion.div
                variants={itemVariants}
                whileHover={{ y: -6, transition: { duration: 0.25 } }}
                className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-amber-200/60 bg-gradient-to-b from-white via-white/95 to-amber-50/20 p-5 shadow-[0_4px_20px_rgba(245,158,11,0.06)] backdrop-blur-xl transition-all duration-300 hover:border-amber-400 hover:shadow-[0_16px_36px_rgba(245,158,11,0.18)]"
              >
                {/* Radial Glow Orb */}
                <div className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-amber-500/10 blur-2xl transition-opacity duration-300 group-hover:opacity-100" />
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-teal-500" />

                <div>
                  {/* Card Header */}
                  <div className="mb-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-50 to-amber-100/80 text-amber-600 shadow-sm transition-all duration-300 group-hover:scale-110 group-hover:bg-gradient-to-br group-hover:from-amber-600 group-hover:to-orange-500 group-hover:text-white group-hover:shadow-md group-hover:shadow-amber-500/25">
                        <Shield className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-extrabold tracking-tight text-[#0F172A] group-hover:text-amber-700 transition-colors">
                          {t('dashboard.cmsAdministration', 'CMS ADMINISTRASI')}
                        </h3>
                        <p className="text-[10.5px] font-medium text-[#64748B]">{t('dashboard.cmsSubtitle', 'Identitas & Hak Akses')}</p>
                      </div>
                    </div>
                    <span className="rounded-full bg-amber-100/70 border border-amber-200 px-2.5 py-0.5 text-[10px] font-bold text-amber-800">
                      {t('dashboard.badgeSuperAdmin', 'Super Admin')}
                    </span>
                  </div>

                  <p className="mb-4 text-xs text-slate-600 leading-relaxed">
                    {t('dashboard.cmsDesc', 'Pusat kendali pengguna sistem, konfigurasi peran RBAC, penetapan payor, dan matriks izin.')}
                  </p>

                  {/* Administrative Features Panel */}
                  <div className="space-y-2 rounded-xl border border-amber-100/80 bg-white/75 p-3.5 shadow-2xs backdrop-blur-sm text-xs">
                    <div className="flex items-center gap-2 text-slate-700">
                      <div className="flex h-5 w-5 items-center justify-center rounded-md bg-amber-50 text-amber-600 shrink-0">
                        <UserCog className="h-3.5 w-3.5" />
                      </div>
                      <span className="font-medium truncate">{t('dashboard.manageUserAccounts', 'Kelola Akun & Identitas Pengguna')}</span>
                    </div>

                    <div className="flex items-center gap-2 text-slate-700">
                      <div className="flex h-5 w-5 items-center justify-center rounded-md bg-teal-50 text-teal-600 shrink-0">
                        <Shield className="h-3.5 w-3.5" />
                      </div>
                      <span className="font-medium truncate">{t('dashboard.rbacMatrix', 'Matriks Hak Akses & Peran RBAC')}</span>
                    </div>

                    <div className="flex items-center gap-2 text-slate-700">
                      <div className="flex h-5 w-5 items-center justify-center rounded-md bg-blue-50 text-blue-600 shrink-0">
                        <Building2 className="h-3.5 w-3.5" />
                      </div>
                      <span className="font-medium truncate">{t('dashboard.payorConfiguration', 'Konfigurasi Payor Asuransi & Korporat')}</span>
                    </div>
                  </div>
                </div>

                {/* Footer Action */}
                <div className="mt-4 pt-3 border-t border-slate-100">
                  <Link
                    to="/cms/users"
                    className="flex w-full items-center justify-between rounded-xl bg-gradient-to-r from-slate-100 to-amber-50/50 px-3.5 py-2.5 text-xs font-bold text-slate-800 transition-all duration-200 group-hover:from-amber-600 group-hover:to-orange-500 group-hover:text-white group-hover:shadow-md group-hover:shadow-amber-600/20"
                  >
                    <span>{t('dashboard.manageCms', 'Kelola CMS Sistem')}</span>
                    <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                  </Link>
                </div>
              </motion.div>
            )}
          </motion.div>
        </section>

        {/* ─────────────────────────────────────────────────────────────────
            3. PINTASAN NAVIGASI: Redesigned Interactive Command Tiles
        ─────────────────────────────────────────────────────────────────── */}
        <section className="mt-2">
          {/* Section Header */}
          <div className="mb-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <Compass className="h-3.5 w-3.5" />
              </div>
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 sm:text-sm">
                {t('dashboard.quickNavigation', 'Pintasan Navigasi Cepat')}
              </h2>
            </div>
            <span className="text-[11px] font-medium text-slate-400">
              {t('dashboard.quickNavSubtitle', 'Akses instan halaman kerja Anda')}
            </span>
          </div>

          {/* Futuristic Command Tiles Grid */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          >
            {/* 1. Indemnity Tile */}
            {showIndemnity && (
              <motion.div variants={itemVariants} whileHover={{ y: -4 }} whileTap={{ scale: 0.98 }}>
                <Link
                  to="/indemnity/overview"
                  className="group relative flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-[0_2px_12px_rgba(15,23,42,0.03)] backdrop-blur-xl transition-all duration-300 hover:border-cyan-400 hover:bg-white hover:shadow-[0_12px_28px_rgba(6,182,212,0.15)]"
                >
                  <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-cyan-400 to-blue-500 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                  
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/25 transition-transform duration-300 group-hover:scale-110">
                      <BarChart3 className="h-5 w-5" />
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 transition-colors group-hover:bg-cyan-50 group-hover:text-cyan-700">
                      <span>{t('dashboard.tileOpen', 'Buka')}</span>
                      <ChevronRight className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-0.5" />
                    </span>
                  </div>

                  <div className="mt-3">
                    <h4 className="text-sm font-bold text-[#0F172A] group-hover:text-cyan-700 transition-colors">
                      {t('dashboard.indemnityAnalytics', 'Analitik Indemnity')}
                    </h4>
                    <p className="mt-0.5 text-xs text-slate-500 line-clamp-1">
                      {t('dashboard.indemnityTileDesc', 'Dashboard utilisasi, peta klaim & demografi')}
                    </p>
                  </div>
                </Link>
              </motion.div>
            )}

            {/* 2. Manage Care Tile */}
            {showManageCare && (
              <motion.div variants={itemVariants} whileHover={{ y: -4 }} whileTap={{ scale: 0.98 }}>
                <Link
                  to="/managecare/daily-monitoring"
                  className="group relative flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-[0_2px_12px_rgba(15,23,42,0.03)] backdrop-blur-xl transition-all duration-300 hover:border-blue-400 hover:bg-white hover:shadow-[0_12px_28px_rgba(37,99,235,0.15)]"
                >
                  <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-blue-500 to-sky-400 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                  
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-sky-500 text-white shadow-md shadow-blue-500/25 transition-transform duration-300 group-hover:scale-110">
                      <Activity className="h-5 w-5" />
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 transition-colors group-hover:bg-blue-50 group-hover:text-blue-700">
                      <span>{t('dashboard.tileOpen', 'Buka')}</span>
                      <ChevronRight className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-0.5" />
                    </span>
                  </div>

                  <div className="mt-3">
                    <h4 className="text-sm font-bold text-[#0F172A] group-hover:text-blue-700 transition-colors">
                      {t('dashboard.manageCare', 'Daily Monitoring')}
                    </h4>
                    <p className="mt-0.5 text-xs text-slate-500 line-clamp-1">
                      {t('dashboard.manageCareTileDesc', 'Monitoring harian rawat inap & status DMO')}
                    </p>
                  </div>
                </Link>
              </motion.div>
            )}

            {/* 3. AdScore Tile */}
            {showAdScore && (
              <motion.div variants={itemVariants} whileHover={{ y: -4 }} whileTap={{ scale: 0.98 }}>
                <Link
                  to="/adscore"
                  className="group relative flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-[0_2px_12px_rgba(15,23,42,0.03)] backdrop-blur-xl transition-all duration-300 hover:border-indigo-400 hover:bg-white hover:shadow-[0_12px_28px_rgba(99,102,241,0.15)]"
                >
                  <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-indigo-500 to-purple-600 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                  
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/25 transition-transform duration-300 group-hover:scale-110">
                      <TrendingUp className="h-5 w-5" />
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 transition-colors group-hover:bg-indigo-50 group-hover:text-indigo-700">
                      <span>{t('dashboard.tileOpen', 'Buka')}</span>
                      <ChevronRight className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-0.5" />
                    </span>
                  </div>

                  <div className="mt-3">
                    <h4 className="text-sm font-bold text-[#0F172A] group-hover:text-indigo-700 transition-colors">
                      {t('nav.adScore', 'AdScore Analytics')}
                    </h4>
                    <p className="mt-0.5 text-xs text-slate-500 line-clamp-1">
                      {t('dashboard.adScoreTileDesc', 'Provider SLA, member scoring & flow')}
                    </p>
                  </div>
                </Link>
              </motion.div>
            )}

            {/* 4. CMS Tile (Super Admin Only) */}
            {showCms && (
              <motion.div variants={itemVariants} whileHover={{ y: -4 }} whileTap={{ scale: 0.98 }}>
                <Link
                  to="/cms/users"
                  className="group relative flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-[0_2px_12px_rgba(15,23,42,0.03)] backdrop-blur-xl transition-all duration-300 hover:border-amber-400 hover:bg-white hover:shadow-[0_12px_28px_rgba(245,158,11,0.15)]"
                >
                  <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-amber-500 to-orange-500 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                  
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md shadow-amber-500/25 transition-transform duration-300 group-hover:scale-110">
                      <Shield className="h-5 w-5" />
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 transition-colors group-hover:bg-amber-50 group-hover:text-amber-700">
                      <span>{t('dashboard.tileManage', 'Kelola')}</span>
                      <ChevronRight className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-0.5" />
                    </span>
                  </div>

                  <div className="mt-3">
                    <h4 className="text-sm font-bold text-[#0F172A] group-hover:text-amber-700 transition-colors">
                      {t('dashboard.cms', 'CMS Identity & Payor')}
                    </h4>
                    <p className="mt-0.5 text-xs text-slate-500 line-clamp-1">
                      {t('dashboard.cmsTileDesc', 'Manajemen pengguna, peran RBAC & payor')}
                    </p>
                  </div>
                </Link>
              </motion.div>
            )}

            {/* 5. Activity Log Tile (Super Admin Only) */}
            {showActivity && (
              <motion.div variants={itemVariants} whileHover={{ y: -4 }} whileTap={{ scale: 0.98 }}>
                <Link
                  to="/activity"
                  className="group relative flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-[0_2px_12px_rgba(15,23,42,0.03)] backdrop-blur-xl transition-all duration-300 hover:border-emerald-400 hover:bg-white hover:shadow-[0_12px_28px_rgba(16,185,129,0.15)]"
                >
                  <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-emerald-500 to-teal-500 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                  
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/25 transition-transform duration-300 group-hover:scale-110">
                      <FileText className="h-5 w-5" />
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 transition-colors group-hover:bg-emerald-50 group-hover:text-emerald-700">
                      <span>{t('dashboard.tileView', 'Lihat')}</span>
                      <ChevronRight className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-0.5" />
                    </span>
                  </div>

                  <div className="mt-3">
                    <h4 className="text-sm font-bold text-[#0F172A] group-hover:text-emerald-700 transition-colors">
                      {t('dashboard.activityLog', 'Log Aktivitas')}
                    </h4>
                    <p className="mt-0.5 text-xs text-slate-500 line-clamp-1">
                      {t('dashboard.activityLogDesc', 'Audit trail & riwayat aktivitas pengguna')}
                    </p>
                  </div>
                </Link>
              </motion.div>
            )}

            {/* 6. Settings Tile (All Users) */}
            <motion.div variants={itemVariants} whileHover={{ y: -4 }} whileTap={{ scale: 0.98 }}>
              <Link
                to="/settings"
                className="group relative flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-[0_2px_12px_rgba(15,23,42,0.03)] backdrop-blur-xl transition-all duration-300 hover:border-slate-400 hover:bg-white hover:shadow-[0_12px_28px_rgba(15,23,42,0.12)]"
              >
                <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-slate-600 to-slate-800 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 text-white shadow-md shadow-slate-900/25 transition-transform duration-300 group-hover:scale-110">
                    <Settings className="h-5 w-5" />
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 transition-colors group-hover:bg-slate-200 group-hover:text-slate-900">
                    <span>{t('dashboard.tileConfigure', 'Atur')}</span>
                    <ChevronRight className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-0.5" />
                  </span>
                </div>

                <div className="mt-3">
                  <h4 className="text-sm font-bold text-[#0F172A] group-hover:text-slate-900 transition-colors">
                    {t('dashboard.settings', 'Pengaturan Akun')}
                  </h4>
                  <p className="mt-0.5 text-xs text-slate-500 line-clamp-1">
                    {t('dashboard.appConfig', 'Konfigurasi akun & preferensi')}
                  </p>
                </div>
              </Link>
            </motion.div>
          </motion.div>
        </section>
      </div>
    </div>
  );
}