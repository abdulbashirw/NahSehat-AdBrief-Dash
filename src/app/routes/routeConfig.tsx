/**
 * Application route configuration — lazy-loaded pages with guards.
 *
 * Uses a single route tree with role-based layout switching:
 *   - SUPER_ADMIN, ADMIN → AppLayout (sidebar + topbar)
 *   - INDEMNITY, MANAGECARE, ADSCORE → TabLayout (header tabs, no sidebar)
 *
 * The LayoutSwitcher component reads the user's role from Redux
 * and renders the appropriate layout.
 */
import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';
import AuthLayout from '@/widgets/auth-layout/ui/AuthLayout';
import { ProtectedRoute, RoleGuard } from './guards/RouteGuards';
import { LayoutSwitcher } from './LayoutSwitcher';
import type { Role } from '@/shared/types';

// ── Lazy-loaded pages ───────────────────────────────────────────
const Login = lazy(() => import('@/features/login/ui/LoginPage'));

const Dashboard = lazy(() => import('@/features/dashboard/ui/DashboardPage'));

const Overview = lazy(() => import('@/features/indemnity-overview/ui/OverviewPage'));
const ClaimsMap = lazy(() => import('@/features/claims-map/ui/ClaimsMapPage'));
const Demographics = lazy(() => import('@/features/demographics/ui/DemographicsPage'));
const Diseases = lazy(() => import('@/features/diseases/ui/DiseasesPage'));

const DailyMonitoring = lazy(() => import('@/features/daily-monitoring/ui/DailyMonitoringPage'));

const UserManagement = lazy(() => import('@/features/manage-users/ui/UserManagementPage'));
const RoleManagement = lazy(() => import('@/features/manage-roles/ui/RoleManagementPage'));
const PayorManagement = lazy(() => import('@/features/manage-payors/ui/PayorManagementPage'));
const PermissionManagement = lazy(() => import('@/features/manage-permissions/ui/PermissionManagementPage'));
const Settings = lazy(() => import('@/features/manage-settings/ui/SettingsPage'));
const UserActivity = lazy(() => import('@/features/user-activity/ui/UserActivityPage'));

const AdScoreLanding = lazy(() => import('@/features/adscore/ui/AdScoreLandingPage'));
const AdScoreProvider = lazy(() => import('@/features/adscore-provider/ui/AdScoreProviderPage'));
const AdScoreMember = lazy(() => import('@/features/adscore-member/ui/AdScoreMemberPage'));
const ProcessFlow = lazy(() => import('@/features/adscore-process-flow/ui/ProcessFlowPage'));

// ── Helper to create role-guarded routes ────────────────────────
function roleRoute(path: string, roles: Role[], children: RouteObject[]): RouteObject {
  return {
    path,
    element: <RoleGuard roles={roles} />,
    children,
  };
}

// ── Route tree ──────────────────────────────────────────────────
export const routeConfig: RouteObject[] = [
  {
    path: '/',
    element: <ProtectedRoute><LayoutSwitcher /></ProtectedRoute>,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'dashboard', element: <Dashboard /> },
      // ── Indemnity ──
      roleRoute('indemnity', ['SUPER_ADMIN', 'ADMIN', 'INDEMNITY'], [
        { index: true, element: <Overview /> },
        { path: 'overview', element: <Overview /> },
        { path: 'claims-map', element: <ClaimsMap /> },
        { path: 'demographics', element: <Demographics /> },
        { path: 'diseases', element: <Diseases /> },
      ]),
      // ── Manage Care ──
      roleRoute('managecare', ['SUPER_ADMIN', 'ADMIN', 'MANAGECARE'], [
        { index: true, element: <DailyMonitoring /> },
        { path: 'daily-monitoring', element: <DailyMonitoring /> },
      ]),
      // ── AdScore ──
      roleRoute('adscore', ['SUPER_ADMIN', 'ADMIN', 'ADSCORE'], [
        { index: true, element: <AdScoreLanding /> },
        { path: 'provider', element: <AdScoreProvider /> },
        { path: 'member', element: <AdScoreMember /> },
        { path: 'process-flow', element: <ProcessFlow /> },
      ]),
      // ── CMS ──
      roleRoute('cms', ['SUPER_ADMIN'], [
        { path: 'users', element: <RoleGuard roles={['SUPER_ADMIN']}><UserManagement /></RoleGuard> },
        { path: 'roles', element: <RoleGuard roles={['SUPER_ADMIN']}><RoleManagement /></RoleGuard> },
        { path: 'payors', element: <RoleGuard roles={['SUPER_ADMIN']}><PayorManagement /></RoleGuard> },
        { path: 'permissions', element: <RoleGuard roles={['SUPER_ADMIN']}><PermissionManagement /></RoleGuard> },
      ]),
      // ── User Activity ──
      roleRoute('activity', ['SUPER_ADMIN'], [
        { index: true, element: <UserActivity /> },
      ]),
      // ── Settings ──
      { path: 'settings', element: <Settings /> },
    ],
  },
  {
    path: '/login',
    element: <AuthLayout />,
    children: [
      { index: true, element: <Login /> },
    ],
  },
];