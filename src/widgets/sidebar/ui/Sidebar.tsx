/**
 * Sidebar — dynamic navigation based on user role.
 *
 * Shows/hides menu items based on RBAC rules.
 * Only rendered for SUPER_ADMIN and ADMIN roles.
 * Collapsible on desktop, overlay on mobile.
 */
import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '@/shared/lib/utils';
import { useAuth } from '@/entities/auth';
import { useHasAnyRole, useCanAccessCallback } from '@/entities/auth';
import { ROUTES } from '@/app/routes/routes';
import type { RouteConfig, Role } from '@/shared/types';
import {
  LayoutDashboard,
  BarChart3,
  Activity,
  Settings,
  ChevronDown,
  ChevronRight,
  LogOut,
  X,
  Eye,
  Map,
  Users,
  Heart,
  CalendarDays,
  Building2,
  Hospital,
  ShieldAlert,
  UserCog,
  Shield,
  Building,
  Key,
  Cog,
  TrendingUp,
  GitBranch,
} from 'lucide-react';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  BarChart3,
  Activity,
  Settings,
  Cog,
  Eye,
  Map,
  Users,
  Heart,
  CalendarDays,
  Building2,
  Hospital,
  ShieldAlert,
  UserCog,
  Shield,
  Building,
  Key,
  TrendingUp,
  GitBranch,
};


interface SidebarProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export default function Sidebar({
  collapsed = false,
  onToggleCollapse,
  mobileOpen = false,
  onMobileClose,
}: SidebarProps) {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const location = useLocation();
  const hasAnyRole = useHasAnyRole();
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const toggleExpand = (path: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const canAccess = useCanAccessCallback();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  // Filter routes for sidebar roles only, then by user role or granular permissions
  const filteredRoutes = ROUTES.filter((route) => {
    if (isSuperAdmin) return true;
    const roles = route.roles as Role[];
    const hasRole = hasAnyRole(roles);
    const hasPermission = canAccess(route.path);
    if (!hasRole && !hasPermission) return false;

    // If route has children, verify that at least one child is accessible
    if (route.children && route.children.length > 0) {
      return route.children.some((child) => {
        const childRoles = child.roles as Role[] | undefined;
        return (childRoles ? hasAnyRole(childRoles) : true) && canAccess(child.path);
      });
    }

    return true;
  });

  // Auto-expand parent if current path is a child
  useEffect(() => {
    const currentParent = ROUTES.find(
      (r) => r.children?.some((c) => location.pathname.startsWith(c.path)),
    );
    if (currentParent && !expandedItems.has(currentParent.path)) {
      setExpandedItems((prev) => new Set([...prev, currentParent.path]));
    }
  }, [location.pathname]);

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onMobileClose}
        />
      )}

      <aside
        className={cn(
          'flex h-full flex-col bg-white transition-all duration-300 ease-in-out',
          collapsed ? 'w-[68px]' : 'w-60',
          // Desktop: always visible
          'lg:relative lg:z-0',
          // Mobile: overlay mode
          mobileOpen
            ? 'fixed inset-y-0 left-0 z-50 translate-x-0'
            : 'fixed inset-y-0 left-0 z-50 -translate-x-full lg:translate-x-0',
        )}
      >
        {/* ── Brand accent gradient ── */}
        <div className="h-[2px] shrink-0 bg-gradient-to-r from-[#2862E4] via-[#3B5ADB] to-[#2D2A7A]" />

        {/* ── Header ── */}
        <div className={cn(
          'relative flex items-center px-4',
          collapsed ? 'h-14 justify-center' : 'h-16 justify-between',
        )}>
          {/* Subtle brand wash */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#2862E4]/[0.02] to-transparent" />

          {/* Logo area */}
          <div className={cn('relative z-10 flex items-center', collapsed ? '' : 'flex-1 gap-2.5')}>
            {/* Logo mark */}
            <a
              href="/"
              className="group relative flex shrink-0 items-center justify-center transition-all duration-200 active:scale-[0.96]"
            >
              <div className={cn(
                'flex items-center justify-center rounded-xl transition-all duration-300',
                collapsed ? 'h-8 w-8' : 'h-9 w-9',
                'bg-gradient-to-br from-[#2862E4]/[0.08] to-[#2D2A7A]/[0.04]',
                'group-hover:from-[#2862E4]/[0.15] group-hover:to-[#2D2A7A]/[0.08]',
                'group-hover:shadow-sm group-hover:shadow-[#2862E4]/[0.08]',
              )}>
                <img
                  src="/logo-mark.svg"
                  alt=""
                  className={cn('w-auto transition-all duration-300', collapsed ? 'h-4' : 'h-[18px]')}
                />
              </div>
            </a>

            {/* Logo text — expanded only */}
            {!collapsed && (
              <a
                href="/"
                className="relative z-10 min-w-0 flex-1 transition-opacity duration-200 hover:opacity-80"
              >
                <span className="block truncate font-display text-[24px] font-extrabold leading-none tracking-[0.01em] bg-gradient-to-r from-[#2862E4] to-[#2D2A7A] bg-clip-text text-transparent">
                  AdBrief
                </span>
              </a>
            )}
          </div>

          {/* Mobile close button */}
          <button
            onClick={onMobileClose}
            className="relative z-10 ml-auto rounded-lg p-1.5 text-[#9CA3AF] transition-colors hover:bg-[#F4F6F8] hover:text-[#4B5563] lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Desktop collapse toggle */}
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="relative z-10 ml-auto hidden rounded-lg p-1.5 text-[#9CA3AF] transition-colors hover:bg-[#F4F6F8] hover:text-[#4B5563] lg:block"
            >
              <ChevronRight
                className={cn(
                  'h-4 w-4 transition-transform duration-300',
                  collapsed ? 'rotate-180' : '',
                )}
              />
            </button>
          )}

          {/* Bottom separator — gradient fade */}
          <div className="absolute bottom-0 left-3 right-3 h-px bg-gradient-to-r from-transparent via-[#E5E8EC] to-transparent" />
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-3">
          <ul className="space-y-1">
            {filteredRoutes.map((route) => (
              <NavItem
                key={route.path}
                route={route}
                collapsed={collapsed}
                expanded={expandedItems.has(route.path)}
                onToggle={() => toggleExpand(route.path)}
                currentPath={location.pathname}
                canAccess={canAccess}
                hasAnyRole={hasAnyRole}
                isSuperAdmin={isSuperAdmin}
              />
            ))}
          </ul>
        </nav>

        {/* ── Footer ── */}
        <div className="relative p-3">
          {/* Top separator — gradient fade */}
          <div className="absolute left-3 right-3 top-0 h-px bg-gradient-to-r from-transparent via-[#E5E8EC] to-transparent" />

          {!collapsed && user && (
            <div className="mb-2 rounded-lg bg-[#F9FAFB]/80 px-3 py-2">
              <p className="text-sm font-semibold text-[#1F2A37]">{user.username}</p>
              <p className="text-xs text-[#9CA3AF]">{user.role}</p>
            </div>
          )}
          <button
            onClick={logout}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[#DC2626] transition-colors hover:bg-red-50"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && t('nav.logout')}
          </button>
        </div>
      </aside>
    </>
  );
}

interface NavItemProps {
  route: RouteConfig;
  collapsed: boolean;
  expanded: boolean;
  onToggle: () => void;
  currentPath: string;
  canAccess?: (path: string) => boolean;
  hasAnyRole?: (roles: Role[]) => boolean;
  isSuperAdmin?: boolean;
}

function NavItem({ route, collapsed, expanded, onToggle, currentPath, canAccess, hasAnyRole, isSuperAdmin }: NavItemProps) {
  const { t } = useTranslation();
  const hasChildren = route.children && route.children.length > 0;
  const isActive = currentPath === route.path || currentPath.startsWith(route.path + '/');
  const Icon = ICON_MAP[route.icon ?? ''] ?? LayoutDashboard;

  if (hasChildren) {
    const visibleChildren = route.children!.filter((child) => {
      if (isSuperAdmin) return true;
      const childRoles = child.roles as Role[] | undefined;
      const hasRole = childRoles && hasAnyRole ? hasAnyRole(childRoles) : true;
      const hasPerm = canAccess ? canAccess(child.path) : true;
      return hasRole && hasPerm;
    });

    if (visibleChildren.length === 0) return null;

    return (
      <li>
        <button
          onClick={onToggle}
          className={cn(
            'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
            isActive
              ? 'bg-[#2862E4]/[0.08] text-[#2862E4]'
              : 'text-[#4B5563] hover:bg-[#F4F6F8] hover:text-[#1F2A37]',
          )}
        >
          <Icon className="h-4 w-4 shrink-0" />
          {!collapsed && (
            <>
              <span className="flex-1 text-left">{t(route.label)}</span>
              {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </>
          )}
        </button>
        {expanded && !collapsed && (
          <ul className="mt-1 space-y-0.5 pl-6">
            {visibleChildren.map((child) => (
              <li key={child.path}>
                <NavLink
                  to={child.path}
                  className={({ isActive }) =>
                    cn(
                      'block rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-[#2862E4]/[0.08] text-[#2862E4]'
                        : 'text-[#4B5563] hover:bg-[#F4F6F8] hover:text-[#1F2A37]',
                    )
                  }
                >
                  {t(child.label)}
                </NavLink>
              </li>
            ))}
          </ul>
        )}
      </li>
    );
  }

  return (
    <li>
      <NavLink
        to={route.path}
        className={({ isActive }) =>
          cn(
            'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
            isActive
              ? 'bg-[#2862E4]/[0.08] text-[#2862E4]'
              : 'text-[#4B5563] hover:bg-[#F4F6F8] hover:text-[#1F2A37]',
          )
        }
      >
        <Icon className="h-4 w-4 shrink-0" />
        {!collapsed && <span>{t(route.label)}</span>}
      </NavLink>
    </li>
  );
}