/**
 * Role-based access control hooks.
 */
import { useAppSelector } from '@/shared/store';
import type { Role } from '@/shared/types';
import { ROLE_PERMISSIONS } from '@/shared/constants';

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

/** Check if current user has a specific permission. */
export function useHasPermission(permission: string): boolean {
  const user = useAppSelector((s) => s.auth.user);
  if (!user) return false;
  if (user.role === 'SUPER_ADMIN') return true;
  const perms = ROLE_PERMISSIONS[user.role];
  return perms?.includes(permission) ?? false;
}

/** Get all permissions for the current user. */
export function usePermissions(): string[] {
  const user = useAppSelector((s) => s.auth.user);
  if (!user) return [];
  if (user.role === 'SUPER_ADMIN') return Object.values(ROLE_PERMISSIONS).flat();
  return ROLE_PERMISSIONS[user.role] ?? [];
}

/** Check if current user can access a menu path. */
export function useCanAccess(path: string): boolean {
  const user = useAppSelector((s) => s.auth.user);
  if (!user) return false;
  if (user.role === 'SUPER_ADMIN') return true;
  if (user.role === 'ADMIN') return true;
  if (user.role === 'INDEMNITY') return path.startsWith('/indemnity') || path === '/' || path === '/dashboard' || path === '/settings';
  if (user.role === 'MANAGECARE') return path.startsWith('/managecare') || path === '/' || path === '/dashboard' || path === '/settings';
  return false;
}