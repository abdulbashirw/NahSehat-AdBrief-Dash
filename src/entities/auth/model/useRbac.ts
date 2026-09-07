/**
 * Role-based access control hooks.
 *
 * Permission checks read from `user.permissions[]` — the array fetched
 * from the backend at login (and refreshed on token validation) and stored
 * in the Redux auth slice. Each entry is `{ id, menu, action }` where:
 *   - `menu`   is a menu key (e.g. 'cms-users', 'indemnity-overview')
 *   - `action` is one of 'create' | 'read' | 'update' | 'delete' | 'export'
 *
 * SUPER_ADMIN bypasses all permission checks and always returns true.
 *
 * This replaces the previous hardcoded ROLE_PERMISSIONS constant approach —
 * permissions are now driven entirely by the role_permissions database
 * table, configurable via the Permission Management page.
 */
import { useAppSelector } from '@/shared/store';
import type { Role, Permission } from '@/shared/types';

/** All valid permission actions. */
export type PermissionAction = Permission['action'];

/**
 * Maps a route path to its permission menu key.
 * Used by `useCanAccess` to determine which menu a path belongs to.
 */
const PATH_TO_MENU: Record<string, string> = {
  '/dashboard': 'dashboard',
  '/indemnity/overview': 'indemnity-overview',
  '/indemnity/claims-map': 'indemnity-claims-map',
  '/indemnity/demographics': 'indemnity-demographics',
  '/indemnity/diseases': 'indemnity-diseases',
  '/managecare/daily-monitoring': 'managecare-daily-monitoring',
  '/cms/users': 'cms-users',
  '/cms/roles': 'cms-roles',
  '/cms/payors': 'cms-payors',
  '/cms/permissions': 'cms-permissions',
  '/settings': 'settings',
};

/** Check if current user has a specific role. */
export function useHasRole(role: Role): boolean {
  const user = useAppSelector((s) => s.auth.user);
  return user?.role === role;
}

/**
 * Returns a function that checks if the current user has any of the given roles.
 * This is a hook that returns a callback to avoid calling hooks in loops.
 */
export function useHasAnyRole(): (roles: Role[]) => boolean {
  const user = useAppSelector((s) => s.auth.user);
  return (roles: Role[]) => !!user && roles.includes(user.role);
}

/**
 * Check if the current user has a specific permission (menu + action).
 * SUPER_ADMIN always returns true (bypasses all checks).
 *
 * @param menu   - Menu key (e.g. 'cms-users', 'indemnity-overview')
 * @param action - One of 'create' | 'read' | 'update' | 'delete' | 'export'
 */
export function useHasPermission(menu: string, action: PermissionAction): boolean {
  const user = useAppSelector((s) => s.auth.user);
  if (!user) return false;
  if (user.role === 'SUPER_ADMIN') return true;
  return user.permissions.some((p) => p.menu === menu && p.action === action);
}

/**
 * Returns a callback function that checks if the current user has a specific
 * permission. Useful when you need to check multiple permissions in a loop
 * or conditional without calling the hook multiple times.
 *
 * SUPER_ADMIN always returns true via the callback.
 */
export function useCheckPermission(): (menu: string, action: PermissionAction) => boolean {
  const user = useAppSelector((s) => s.auth.user);
  return (menu: string, action: PermissionAction) => {
    if (!user) return false;
    if (user.role === 'SUPER_ADMIN') return true;
    return user.permissions.some((p) => p.menu === menu && p.action === action);
  };
}

/** Get all permissions for the current user as Permission[] objects. */
export function usePermissions(): Permission[] {
  const user = useAppSelector((s) => s.auth.user);
  if (!user) return [];
  return user.permissions;
}

/**
 * Check if the current user can access a menu path.
 * Maps the path to a menu key and checks for 'read' permission.
 * SUPER_ADMIN always returns true.
 * Unknown paths default to accessible (returns true).
 */
export function useCanAccess(path: string): boolean {
  const user = useAppSelector((s) => s.auth.user);
  if (!user) return false;
  if (user.role === 'SUPER_ADMIN') return true;
  const menu = PATH_TO_MENU[path];
  if (!menu) return true; // unknown paths default to accessible
  return user.permissions.some((p) => p.menu === menu && p.action === 'read');
}