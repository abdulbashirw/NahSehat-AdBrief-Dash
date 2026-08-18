/**
 * Application-wide constants.
 */

export const APP_NAME = import.meta.env.VITE_APP_NAME ?? 'NahSehat Dashboard';

/** API base URLs from environment */
export const API_BASE = import.meta.env.VITE_BE_API ?? '';
export const API_V3 = import.meta.env.VITE_NAHSEHAT_API_V3 ?? '';

/** Local storage keys */
export const LS_TOKEN_KEY = 'nahsehat_token';
export const LS_USER_KEY = 'nahsehat_user';
export const LS_REFRESH_KEY = 'nahsehat_refresh';

/** Default pagination */
export const DEFAULT_PAGE_SIZE = 20;

/** Role display names */
export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  INDEMNITY: 'Indemnity',
  MANAGECARE: 'Manage Care',
};

/** Role-based menu access */
export const ROLE_MENUS: Record<string, string[]> = {
  SUPER_ADMIN: ['dashboard', 'indemnity', 'managecare', 'cms', 'settings'],
  ADMIN: ['dashboard', 'indemnity', 'managecare', 'cms', 'settings'],
  INDEMNITY: ['dashboard', 'indemnity'],
  MANAGECARE: ['dashboard', 'managecare'],
};

/** Role-based permissions — maps role to accessible route keys */
export const ROLE_PERMISSIONS: Record<string, string[]> = {
  SUPER_ADMIN: ['dashboard', 'indemnity', 'managecare', 'cms', 'settings'],
  ADMIN: ['dashboard', 'indemnity', 'managecare', 'cms', 'settings'],
  INDEMNITY: ['dashboard', 'indemnity'],
  MANAGECARE: ['dashboard', 'managecare'],
};

/** Route paths */
export const ROUTES = {
  LOGIN: '/login',
  DASHBOARD: '/',
  INDEMNITY_OVERVIEW: '/indemnity/overview',
  INDEMNITY_CLAIMS_MAP: '/indemnity/claims-map',
  INDEMNITY_DEMOGRAPHICS: '/indemnity/demographics',
  INDEMNITY_DISEASES: '/indemnity/diseases',
  MANAGECARE_DAILY: '/managecare/daily-monitoring',
  MANAGECARE_DMO: '/managecare/dmo',
  MANAGECARE_DHC: '/managecare/dhc',
  MANAGECARE_REJECT: '/managecare/reject-monitoring',
  CMS_USERS: '/cms/users',
  CMS_ROLES: '/cms/roles',
  CMS_PAYORS: '/cms/payors',
  CMS_PERMISSIONS: '/cms/permissions',
  CMS_SETTINGS: '/cms/settings',
  SETTINGS: '/settings',
  PROFILE: '/settings/profile',
} as const;

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES];