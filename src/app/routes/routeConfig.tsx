/**
 * Application route configuration — lazy-loaded pages with guards.
 *
 * Uses a single route tree with role-based layout switching:
 *   - SUPER_ADMIN, ADMIN → AppLayout (sidebar + topbar)
 *   - INDEMNITY, MANAGECARE → TabLayout (header tabs, no sidebar)
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
      // ── CMS ──
      roleRoute('cms', ['SUPER_ADMIN', 'ADMIN'], [
        { path: 'users', element: <UserManagement /> },
        { path: 'roles', element: <RoleGuard roles={['SUPER_ADMIN']}><RoleManagement /></RoleGuard> },
        { path: 'payors', element: <PayorManagement /> },
        { path: 'permissions', element: <RoleGuard roles={['SUPER_ADMIN']}><PermissionManagement /></RoleGuard> },
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