/**
 * usePageViewLogger — logs page views to the backend for modules whose
 * data comes from external APIs (Indemnity, ManageCare) and would
 * otherwise never pass through the server-side accessLogger middleware.
 *
 * Fires a POST /api/v1/activity/log on every route change (fire-and-forget).
 * Skips logging for the activity dashboard itself (avoid recursive logging).
 */
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/entities/auth';
import { LS_TOKEN_KEY } from '@/shared/constants';
import { API_URLS } from '@/shared/store/api';

/* ── Frontend route → module + menu label mapping ── */
const ROUTE_MODULE_MAP: { prefix: string; module: string; label: string }[] = [
  // Indemnity
  { prefix: '/indemnity/overview', module: 'indemnity', label: 'Utilization Overview' },
  { prefix: '/indemnity/claims-map', module: 'indemnity', label: 'Claims Map' },
  { prefix: '/indemnity/demographics', module: 'indemnity', label: 'Demographics' },
  { prefix: '/indemnity/diseases', module: 'indemnity', label: 'Diseases' },
  { prefix: '/indemnity', module: 'indemnity', label: 'Indemnity' },
  // Manage Care
  { prefix: '/managecare/daily-monitoring', module: 'managecare', label: 'Daily Monitoring' },
  { prefix: '/managecare', module: 'managecare', label: 'Manage Care' },
  // CMS
  { prefix: '/cms/users', module: 'cms', label: 'User Management' },
  { prefix: '/cms/roles', module: 'cms', label: 'Role Management' },
  { prefix: '/cms/payors', module: 'cms', label: 'Payor Management' },
  { prefix: '/cms/permissions', module: 'cms', label: 'Permissions' },
  // AdScore
  { prefix: '/adscore/provider', module: 'adscore', label: 'AdScore Provider' },
  { prefix: '/adscore/member', module: 'adscore', label: 'AdScore Member' },
  { prefix: '/adscore/process-flow', module: 'adscore', label: 'Process Flow' },
  { prefix: '/adscore', module: 'adscore', label: 'AdScore' },
  // Settings
  { prefix: '/settings', module: 'settings', label: 'Settings' },
  // Dashboard
  { prefix: '/dashboard', module: 'dashboard', label: 'Dashboard' },
];

// Paths that should NOT be logged from the client side
const SKIP_PREFIXES = ['/activity', '/login'];

function resolveRouteInfo(pathname: string): { module: string; menuPath: string; menuLabel: string } | null {
  // Skip activity dashboard and login pages
  if (SKIP_PREFIXES.some((p) => pathname.startsWith(p))) return null;

  for (const entry of ROUTE_MODULE_MAP) {
    if (pathname.startsWith(entry.prefix)) {
      return {
        module: entry.module,
        menuPath: pathname,
        menuLabel: entry.label,
      };
    }
  }
  return null;
}

export function usePageViewLogger(): void {
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const lastLoggedPath = useRef<string>('');

  useEffect(() => {
    if (!isAuthenticated) return;

    const pathname = location.pathname;
    // Avoid double-logging the same path (React StrictMode double-mount in dev)
    if (pathname === lastLoggedPath.current) return;
    lastLoggedPath.current = pathname;

    const routeInfo = resolveRouteInfo(pathname);
    if (!routeInfo) return;

    const token = localStorage.getItem(LS_TOKEN_KEY);
    if (!token) return;

    // Fire-and-forget — don't await, don't block UI
    fetch(`${API_URLS.cms}/activity/log`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(routeInfo),
      // Use keepalive to ensure the request completes even if the page unloads
      keepalive: true,
    }).catch(() => {
      // Silent fail — logging should never break the UI
    });
  }, [location.pathname, isAuthenticated]);
}