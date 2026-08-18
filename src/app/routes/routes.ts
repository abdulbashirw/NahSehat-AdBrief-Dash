/**
 * Route configuration for sidebar and tab navigation.
 *
 * Each route has a path, label, icon name, and allowed roles.
 * Routes with children render as expandable groups in sidebar
 * or as tab items in the tab layout.
 *
 * `layout` determines which layout component renders for each top-level route:
 *   - 'sidebar' → AppLayout (SUPER_ADMIN, ADMIN)
 *   - 'tabs' → TabLayout (INDEMNITY, MANAGECARE)
 */
import type { RouteConfig } from '@/shared/types';

export const ROUTES: RouteConfig[] = [
  // ── Dashboard — all authenticated users ──
  {
    path: '/dashboard',
    label: 'Dashboard',
    icon: 'LayoutDashboard',
    roles: ['SUPER_ADMIN', 'ADMIN', 'INDEMNITY', 'MANAGECARE'],
  },

  // ── Indemnity ──
  {
    path: '/indemnity',
    label: 'Indemnity',
    icon: 'BarChart3',
    roles: ['SUPER_ADMIN', 'ADMIN', 'INDEMNITY'],
    children: [
      { path: '/indemnity/overview', label: 'Utilization Overview', icon: 'Eye', roles: ['SUPER_ADMIN', 'ADMIN', 'INDEMNITY'] },
      { path: '/indemnity/claims-map', label: 'Claims Map', icon: 'Map', roles: ['SUPER_ADMIN', 'ADMIN', 'INDEMNITY'] },
      { path: '/indemnity/demographics', label: 'Demographics', icon: 'Users', roles: ['SUPER_ADMIN', 'ADMIN', 'INDEMNITY'] },
      { path: '/indemnity/diseases', label: 'Diseases', icon: 'Heart', roles: ['SUPER_ADMIN', 'ADMIN', 'INDEMNITY'] },
    ],
  },

  // ── Manage Care ──
  {
    path: '/managecare',
    label: 'Manage Care',
    icon: 'Activity',
    roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGECARE'],
  },

  // ── CMS ──
  {
    path: '/cms',
    label: 'CMS',
    icon: 'Settings',
    roles: ['SUPER_ADMIN', 'ADMIN'],
    children: [
      { path: '/cms/users', label: 'User Management', icon: 'UserCog', roles: ['SUPER_ADMIN', 'ADMIN'] },
      { path: '/cms/roles', label: 'Role Management', icon: 'Shield', roles: ['SUPER_ADMIN'] },
      { path: '/cms/payors', label: 'Payor Management', icon: 'Building', roles: ['SUPER_ADMIN', 'ADMIN'] },
      { path: '/cms/permissions', label: 'Permissions', icon: 'Key', roles: ['SUPER_ADMIN'] },
    ],
  },

  // ── Settings — all authenticated users ──
  {
    path: '/settings',
    label: 'Settings',
    icon: 'Cog',
    roles: ['SUPER_ADMIN', 'ADMIN', 'INDEMNITY', 'MANAGECARE'],
  },
];

/**
 * Default redirect paths per role.
 * INDEMNITY → /indemnity/overview
 * MANAGECARE → /managecare/daily-monitoring
 * SUPER_ADMIN/ADMIN → /dashboard
 */
export const DEFAULT_REDIRECTS: Record<string, string> = {
  SUPER_ADMIN: '/dashboard',
  ADMIN: '/dashboard',
  INDEMNITY: '/indemnity/overview',
  MANAGECARE: '/managecare/daily-monitoring',
};

/**
 * Roles that should use the TabLayout instead of AppLayout.
 */
export const TAB_LAYOUT_ROLES = ['INDEMNITY', 'MANAGECARE'] as const;
export type TabLayoutRole = (typeof TAB_LAYOUT_ROLES)[number];