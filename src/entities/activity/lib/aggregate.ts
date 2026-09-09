/**
 * Activity aggregation helpers — pure functions for data transformation.
 *
 * Used by the User Activity page to transform API responses into
 * chart-ready formats.
 */

import type {
  ActivitySummary,
  DetailedUserRow,
  TrendPoint,
  ModuleStat,
  HeatmapCell,
  ActivityLevel,
} from '../model/activityTypes';

/* ─── KPI formatting ─── */

export interface KpiCard {
  key: string;
  label: string;
  value: string;
  rawValue: number;
  icon: 'access' | 'login' | 'users' | 'avg-access' | 'avg-login' | 'top-user';
  accent: 'blue' | 'purple' | 'cyan' | 'orange' | 'red' | 'green';
}

export function buildKpiCards(summary: ActivitySummary | undefined): KpiCard[] {
  if (!summary) return [];
  return [
    {
      key: 'totalAccess',
      label: 'Total Aktivitas (Akses)',
      value: formatInt(summary.totalAccess),
      rawValue: summary.totalAccess,
      icon: 'access',
      accent: 'blue',
    },
    {
      key: 'totalLogins',
      label: 'Total Sesi Login',
      value: formatInt(summary.totalLogins),
      rawValue: summary.totalLogins,
      icon: 'login',
      accent: 'purple',
    },
    {
      key: 'uniqueUsers',
      label: 'Jumlah User Unik',
      value: formatInt(summary.uniqueUsers),
      rawValue: summary.uniqueUsers,
      icon: 'users',
      accent: 'cyan',
    },
    {
      key: 'avgAccessPerUser',
      label: 'Rata-rata Akses / User',
      value: formatDecimal(summary.avgAccessPerUser),
      rawValue: summary.avgAccessPerUser,
      icon: 'avg-access',
      accent: 'orange',
    },
    {
      key: 'avgLoginPerUser',
      label: 'Rata-rata Login / User',
      value: formatDecimal(summary.avgLoginPerUser),
      rawValue: summary.avgLoginPerUser,
      icon: 'avg-login',
      accent: 'red',
    },
    {
      key: 'mostActiveUser',
      label: 'User Paling Aktif',
      value: summary.mostActiveUser ?? '—',
      rawValue: 0,
      icon: 'top-user',
      accent: 'green',
    },
  ];
}

/* ─── Activity level computation ─── */

/**
 * Compute activity level from total access count.
 * Thresholds:
 *   >= 1000  → SANGAT_AKTIF
 *   >= 500   → AKTIF
 *   >= 100   → CUKUP_AKTIF
 *   < 100    → KURANG_AKTIF
 */
export function computeActivityLevel(totalAccess: number): ActivityLevel {
  if (totalAccess >= 1000) return 'SANGAT_AKTIF';
  if (totalAccess >= 500) return 'AKTIF';
  if (totalAccess >= 100) return 'CUKUP_AKTIF';
  return 'KURANG_AKTIF';
}

export const ACTIVITY_LEVEL_LABELS: Record<ActivityLevel, string> = {
  SANGAT_AKTIF: 'Sangat Aktif',
  AKTIF: 'Aktif',
  CUKUP_AKTIF: 'Cukup Aktif',
  KURANG_AKTIF: 'Kurang Aktif',
};

export const ACTIVITY_LEVEL_COLORS: Record<ActivityLevel, string> = {
  SANGAT_AKTIF: '#2E7D5B',
  AKTIF: '#2563EB',
  CUKUP_AKTIF: '#EA8C1F',
  KURANG_AKTIF: '#9CA3AF',
};

/* ─── Module distribution for donut chart ─── */

export interface DonutSlice {
  name: string;
  value: number;
  color: string;
}

const MODULE_COLORS: Record<string, string> = {
  indemnity: '#2563EB',
  managecare: '#EA8C1F',
  cms: '#2E7D5B',
  settings: '#7C3AED',
  auth: '#0891B2',
  dashboard: '#6366F1',
  adscore: '#16A34A',
};

export function buildDonutData(modules: ModuleStat[] | undefined): DonutSlice[] {
  if (!modules || modules.length === 0) return [];
  return modules
    .filter((m) => m.totalAccess > 0)
    .map((m) => ({
      name: m.menuLabel,
      value: m.totalAccess,
      color: MODULE_COLORS[m.module] ?? '#9CA3AF',
    }))
    .sort((a, b) => b.value - a.value);
}

/* ─── Trend chart formatting ─── */

export function buildTrendData(trend: TrendPoint[] | undefined) {
  if (!trend) return [];
  return trend.map((t) => ({
    date: t.date,
    Akses: t.totalAccess,
    Login: t.totalLogins,
  }));
}

/* ─── Heatmap formatting ─── */

export interface HeatmapGrid {
  cells: { day: number; hour: number; value: number }[];
  maxValue: number;
}

const DAY_LABELS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const HOUR_LABELS = Array.from({ length: 24 }, (_, i) => `${i}`);

export function buildHeatmapGrid(cells: HeatmapCell[] | undefined): HeatmapGrid {
  if (!cells || cells.length === 0) return { cells: [], maxValue: 0 };

  // Build a 7×24 grid initialized to 0
  const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  let maxValue = 0;

  for (const cell of cells) {
    grid[cell.dayOfWeek][cell.hourOfDay] = cell.totalAccess;
    if (cell.totalAccess > maxValue) maxValue = cell.totalAccess;
  }

  const flatCells: { day: number; hour: number; value: number }[] = [];
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      flatCells.push({ day, hour, value: grid[day][hour] });
    }
  }

  return { cells: flatCells, maxValue };
}

export { DAY_LABELS, HOUR_LABELS };

/* ─── Top 5 users for bar chart ─── */

export interface BarUser {
  name: string;
  value: number;
}

export function buildTopUsersBar(users: DetailedUserRow[] | undefined, limit = 5): BarUser[] {
  if (!users) return [];
  return users
    .slice(0, limit)
    .map((u) => ({
      name: u.fullName.length > 20 ? u.fullName.slice(0, 20) + '…' : u.fullName,
      value: u.totalAccess,
    }));
}

/* ─── Number formatting ─── */

function formatInt(n: number): string {
  return new Intl.NumberFormat('id-ID').format(n);
}

function formatDecimal(n: number): string {
  return new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}