/**
 * TabLayout — header-based navigation layout for INDEMNITY & MANAGECARE roles.
 *
 * Premium animated background with flowing data-flow SVG,
 * pulsing glow orbs, data streams, floating particles, and shimmer sparkles.
 * Visual concept: "Data in Motion. Intelligence in Focus."
 * Color DNA: Light Blue + Electric Blue + Cyan + Teal
 */
import { Suspense } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '@/shared/lib/utils';
import { useAuth } from '@/entities/auth';
import { ROUTES } from '@/app/routes/routes';
import { useAutoRotateTabs } from '@/widgets/tab-layout/model/useAutoRotateTabs';
import type { RouteConfig } from '@/shared/types';
import DashboardBackground from '@/shared/components/common/DashboardBackground';
import {
  BarChart3,
  Activity,
  LogOut,
  Bell,
  Eye,
  Map,
  Users,
  Heart,
  CalendarDays,
  TrendingUp,
  Building2,
  GitBranch,
} from 'lucide-react';

/** Icon mapping for tab items */
const TAB_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Eye,
  Map,
  Users,
  Heart,
  CalendarDays,
  BarChart3,
  Activity,
  TrendingUp,
  Building2,
  GitBranch,
};

/** Route configs for tab-based roles */
const INDEMNITY_TAB_ROUTES = ROUTES.find((r) => r.path === '/indemnity')?.children ?? [];
const MANAGECARE_TAB_ROUTES: RouteConfig[] = [
  {
    path: '/managecare/daily-monitoring',
    label: 'nav.dailyMonitoring',
    icon: 'Activity',
    roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGECARE'],
  },
];
const ADSCORE_TAB_ROUTES: RouteConfig[] = [
  {
    path: '/adscore',
    label: 'nav.adScore',
    icon: 'TrendingUp',
    roles: ['SUPER_ADMIN', 'ADMIN', 'ADSCORE'],
  },
];

const TAB_ROUTES: Record<string, RouteConfig[]> = {
  ADMIN: [],
  INDEMNITY: INDEMNITY_TAB_ROUTES,
  MANAGECARE: MANAGECARE_TAB_ROUTES,
  ADSCORE: ADSCORE_TAB_ROUTES,
};

function getTabItems(role: string | undefined, pathname: string): RouteConfig[] {
  if (!role || pathname === '/dashboard') return [];
  if (role !== 'ADMIN') return TAB_ROUTES[role] ?? [];
  if (pathname.startsWith('/indemnity')) return INDEMNITY_TAB_ROUTES;
  if (pathname.startsWith('/managecare')) return MANAGECARE_TAB_ROUTES;
  if (pathname.startsWith('/adscore')) return ADSCORE_TAB_ROUTES;
  return [];
}

export default function TabLayout() {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

  // Determine which tab set to show based on role
  const tabItems = getTabItems(user?.role, location.pathname);
  const moduleName = user?.role === 'INDEMNITY' ? t('nav.indemnityModule') : user?.role === 'MANAGECARE' ? t('nav.manageCareModule') : user?.role === 'ADSCORE' ? t('nav.adScoreModule') : '';

  // Auto-rotate tabs every 2 min 30 sec (INDEMNITY only has effect — MANAGECARE has 1 tab).
  useAutoRotateTabs(tabItems.map((tab) => tab.path));

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* ── Animated background ── */}
      <DashboardBackground variant="fullscreen" />

      {/* ── Frosted-glass header ── */}
      <header className="relative z-20 flex h-16 items-center justify-between border-b border-white/40 bg-white/60 px-4 shadow-[0_1px_12px_rgba(37,99,235,0.06)] backdrop-blur-xl lg:px-6">
        {/* Left — Logo + Module Name */}
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl bg-gradient-to-br from-[#2563EB] to-[#06B6D4] shadow-[0_2px_10px_rgba(37,99,235,0.3)] transition-shadow hover:shadow-[0_4px_16px_rgba(37,99,235,0.4)]"
            onClick={() => navigate('/dashboard')}
            title="NahSehat"
          >
            <span className="text-sm font-bold text-white">AB</span>
          </div>
          <span className="text-lg font-bold text-[#1E293B]">AdBrief</span>
          {moduleName && (
            <>
              <span className="text-[#94A3B8]">/</span>
              <span className="bg-gradient-to-r from-[#2563EB] to-[#06B6D4] bg-clip-text text-sm font-semibold text-transparent">{moduleName}</span>
            </>
          )}
        </div>

        {/* Center — Navigation Tabs */}
        <nav className="flex items-center gap-1">
          {tabItems.map((tab) => {
            const isActive = location.pathname === tab.path || location.pathname.startsWith(tab.path + '/');
            const Icon = TAB_ICON_MAP[tab.icon ?? ''] ?? BarChart3;
            return (
              <NavLink
                key={tab.path}
                to={tab.path}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-[#2563EB]/10 text-[#2563EB] shadow-[0_1px_6px_rgba(37,99,235,0.15)]'
                    : 'text-[#475569] hover:bg-white/60 hover:text-[#1E293B]',
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{t(tab.label)}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Right — Notifications, User */}
        <div className="flex items-center gap-2">
          <button className="relative flex h-9 w-9 items-center justify-center rounded-lg text-[#475569] transition-colors hover:bg-white/60" aria-label="Notifications">
            <Bell className="h-[18px] w-[18px]" />
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[#EF4444] shadow-[0_0_6px_rgba(239,68,68,0.4)]" />
          </button>
          <div className="flex items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-white/60">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#2563EB] to-[#06B6D4] text-sm font-bold text-white shadow-[0_2px_8px_rgba(37,99,235,0.25)]">
              {user?.username?.charAt(0).toUpperCase() ?? 'U'}
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-semibold text-[#1E293B]">{user?.username ?? 'User'}</p>
              <p className="text-[11px] text-[#64748B]">{user?.role ?? '—'}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-[#DC2626] transition-colors hover:bg-red-50/80"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">{t('tabLayout.logout')}</span>
          </button>
        </div>
      </header>

      {/* ── Page content ── */}
      <main className="relative z-10 min-h-0 flex-1 overflow-y-auto">
        <div className="h-full p-3 lg:p-4">
          <Suspense
            fallback={
              <div className="flex h-64 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#BFDBFE] border-t-[#2563EB]" />
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </div>
      </main>
    </div>
  );
}