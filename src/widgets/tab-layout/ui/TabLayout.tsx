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
import { toast } from 'sonner';
import { useAuth, useCanAccessCallback } from '@/entities/auth';
import { ROUTES } from '@/app/routes/routes';
import { useAutoRotateTabs } from '@/widgets/tab-layout/model/useAutoRotateTabs';
import type { RouteConfig } from '@/shared/types';
import DashboardBackground from '@/shared/components/common/DashboardBackground';
import {
  BarChart3,
  Activity,
  LogOut,
  Eye,
  Map,
  Users,
  Heart,
  CalendarDays,
  TrendingUp,
  Building2,
  GitBranch,
  Home,
  ClipboardCheck,
  History,
  Lock,
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
  ClipboardCheck,
  History,
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
const ADSCORE_TAB_ROUTES = ROUTES.find((r) => r.path === '/adscore')?.children ?? [];
const VERIFIER_TAB_ROUTES = ROUTES.find((r) => r.path === '/verifikasi')?.children ?? [];

const TAB_ROUTES: Record<string, RouteConfig[]> = {
  ADMIN: [],
  INDEMNITY: INDEMNITY_TAB_ROUTES,
  MANAGECARE: MANAGECARE_TAB_ROUTES,
  ADSCORE: ADSCORE_TAB_ROUTES,
  ADSCORE_VERIFIER: VERIFIER_TAB_ROUTES,
};

function getTabItems(role: string | undefined, pathname: string): RouteConfig[] {
  if (!role || pathname === '/dashboard') return [];
  if (pathname.startsWith('/verifikasi')) return VERIFIER_TAB_ROUTES;
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
  const canAccess = useCanAccessCallback();

  // Determine which tab set to show based on role
  const tabItems = getTabItems(user?.role, location.pathname);
  const moduleName = user?.role === 'INDEMNITY' ? t('nav.indemnityModule') : user?.role === 'MANAGECARE' ? t('nav.manageCareModule') : user?.role === 'ADSCORE' ? t('nav.adScoreModule') : location.pathname.startsWith('/verifikasi') ? t('nav.verification') : '';
  const activeTabPath = tabItems.reduce((activePath, tab) => {
    const matches = location.pathname === tab.path || location.pathname.startsWith(tab.path + '/');
    return matches && tab.path.length > activePath.length ? tab.path : activePath;
  }, '');

  // Auto-rotate tabs — INDEMNITY only (original concept). Other roles pass an
  // empty path list, which disables rotation via the hook's < 2 tabs guard.
  // Rotation only cycles tabs the user can actually access (fail-safe).
  useAutoRotateTabs(user?.role === 'INDEMNITY' ? tabItems.filter((tab) => canAccess(tab.path)).map((tab) => tab.path) : []);

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* ── Animated background ── */}
      <DashboardBackground variant="fullscreen" />

      {/* ── Brand accent gradient ── */}
      <div className="relative z-30 h-[2px] shrink-0 bg-gradient-to-r from-[#2862E4] via-[#3B5ADB] to-[#2D2A7A]" />

      {/* ── Frosted-glass header ── */}
      <header className="relative z-20 flex h-16 items-center justify-between border-b border-white/40 bg-white/60 px-4 shadow-[0_1px_12px_rgba(40,98,228,0.06)] backdrop-blur-xl lg:px-6">
        {/* Left — Logo + Module Name */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            title="Home"
            aria-label="Home"
            className="group relative flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-[#2862E4]/15 bg-gradient-to-br from-[#2862E4]/[0.08] to-[#2D2A7A]/[0.04] text-[#2862E4] shadow-sm transition-all duration-300 hover:border-[#2862E4]/30 hover:bg-[#2862E4] hover:text-white hover:shadow-[0_4px_12px_rgba(40,98,228,0.25)] active:scale-95"
          >
            <Home className="h-[18px] w-[18px] transition-transform duration-300 group-hover:scale-110" />
          </button>
          <img
            src="/adbrief-only.png"
            alt="AdBrief"
            onClick={() => navigate('/dashboard')}
            className="h-6 w-auto cursor-pointer object-contain transition-opacity hover:opacity-85"
            title="AdBrief"
          />
          {moduleName && (
            <>
              <span className="text-[#94A3B8]">/</span>
              <span className="bg-gradient-to-r from-[#2862E4] to-[#2D2A7A] bg-clip-text text-sm font-semibold text-transparent">{moduleName}</span>
            </>
          )}
        </div>

        {/* Center — Navigation Tabs */}
        <nav className="flex items-center gap-1">
          {tabItems.map((tab) => {
            const isActive = activeTabPath === tab.path;
            const Icon = TAB_ICON_MAP[tab.icon ?? ''] ?? BarChart3;
            // Konsep landing AdScore: tab modul /adscore tanpa permission 'read'
            // tampil terkunci (Akses Terbatas) — klik memunculkan toast, bukan navigasi.
            const available = !tab.path.startsWith('/adscore') || canAccess(tab.path);
            if (!available) {
              return (
                <button
                  key={tab.path}
                  type="button"
                  title={t('adScore.landing.statusRestricted', 'Akses Terbatas')}
                  onClick={() =>
                    toast.warning(
                      t('adScore.landing.toastNoAccessTitle', 'Akses Modul {{title}} Terbatas', {
                        title: t(tab.label),
                      }),
                      {
                        description: t(
                          'adScore.landing.toastNoAccessDesc',
                          'Anda tidak memiliki izin untuk mengakses modul ini. Hubungi administrator untuk meminta akses.'
                        ),
                        duration: 4000,
                      }
                    )
                  }
                  className="flex cursor-default items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium text-[#94A3B8] transition-all duration-200"
                >
                  <Icon className="h-4 w-4" />
                  <span>{t(tab.label)}</span>
                  <Lock className="h-3.5 w-3.5" />
                </button>
              );
            }
            return (
              <NavLink
                key={tab.path}
                to={tab.path}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-[#2862E4]/10 text-[#2862E4] shadow-[0_1px_6px_rgba(40,98,228,0.15)]'
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
          <div className="flex items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-white/60">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#2862E4] to-[#2D2A7A] text-sm font-bold text-white shadow-[0_2px_8px_rgba(40,98,228,0.25)]">
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
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#BFDBFE] border-t-[#2862E4]" />
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