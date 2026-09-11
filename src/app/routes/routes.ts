/**
 * Route configuration for sidebar and tab navigation.
 *
 * Each route has a path, label (i18n key), icon name, and allowed roles.
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
    label: 'nav.dashboard',
    icon: 'LayoutDashboard',
    roles: ['SUPER_ADMIN', 'ADMIN', 'INDEMNITY', 'MANAGECARE', 'ADSCORE'],
  },

  // ── Indemnity ──
  {
    path: '/indemnity',
    label: 'nav.indemnity',
    icon: 'BarChart3',
    roles: ['SUPER_ADMIN', 'ADMIN', 'INDEMNITY'],
    children: [
      { path: '/indemnity/overview', label: 'nav.utilizationOverview', icon: 'Eye', roles: ['SUPER_ADMIN', 'ADMIN', 'INDEMNITY'] },
      { path: '/indemnity/claims-map', label: 'nav.claimsMap', icon: 'Map', roles: ['SUPER_ADMIN', 'ADMIN', 'INDEMNITY'] },
      { path: '/indemnity/demographics', label: 'nav.demographics', icon: 'Users', roles: ['SUPER_ADMIN', 'ADMIN', 'INDEMNITY'] },
      { path: '/indemnity/diseases', label: 'nav.diseases', icon: 'Heart', roles: ['SUPER_ADMIN', 'ADMIN', 'INDEMNITY'] },
    ],
  },

  // ── Manage Care ──
  {
    path: '/managecare',
    label: 'nav.manageCare',
    icon: 'Activity',
    roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGECARE'],
  },

  // ── CMS ──
  {
    path: '/cms',
    label: 'nav.cms',
    icon: 'Settings',
    roles: ['SUPER_ADMIN', 'ADMIN'],
    children: [
      { path: '/cms/users', label: 'nav.userManagement', icon: 'UserCog', roles: ['SUPER_ADMIN', 'ADMIN'] },
      { path: '/cms/roles', label: 'nav.roleManagement', icon: 'Shield', roles: ['SUPER_ADMIN'] },
      { path: '/cms/payors', label: 'nav.payorManagement', icon: 'Building', roles: ['SUPER_ADMIN', 'ADMIN'] },
      { path: '/cms/permissions', label: 'nav.permissions', icon: 'Key', roles: ['SUPER_ADMIN'] },
    ],
  },

  // ── AdScore ──
  {
    path: '/adscore',
    label: 'nav.adScore',
    icon: 'TrendingUp',
    roles: ['SUPER_ADMIN', 'ADMIN', 'ADSCORE'],
  },

  // ── User Activity — admin only ──
  {
    path: '/activity',
    label: 'nav.userActivity',
    icon: 'Activity',
    roles: ['SUPER_ADMIN'],
  },

  // ── Settings — all authenticated users ──
  {
    path: '/settings',
    label: 'nav.settings',
    icon: 'Cog',
    roles: ['SUPER_ADMIN', 'ADMIN', 'INDEMNITY', 'MANAGECARE', 'ADSCORE'],
  },
];

/**
 * Default redirect paths per role.
 * INDEMNITY → /indemnity/overview
 * MANAGECARE → /managecare/daily-monitoring
 * ADSCORE → /adscore
 * SUPER_ADMIN/ADMIN → /dashboard
 */
export const DEFAULT_REDIRECTS: Record<string, string> = {
  SUPER_ADMIN: '/dashboard',
  ADMIN: '/dashboard',
  INDEMNITY: '/indemnity/overview',
  MANAGECARE: '/managecare/daily-monitoring',
  ADSCORE: '/adscore',
};

/**
 * Roles that should use the TabLayout instead of AppLayout.
 */
export const TAB_LAYOUT_ROLES = ['ADMIN', 'INDEMNITY', 'MANAGECARE', 'ADSCORE'] as const;
export type TabLayoutRole = (typeof TAB_LAYOUT_ROLES)[number];