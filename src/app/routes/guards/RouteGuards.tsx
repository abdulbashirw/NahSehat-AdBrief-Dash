/**
 * Route guards — authentication and role-based access control.
 *
 * ProtectedRoute — redirects unauthenticated users to /login.
 *   Shows a loading spinner while auth state is being initialized.
 *   For INDEMNITY/MANAGECARE, redirects to their module page instead of /dashboard.
 *
 * RoleGuard — restricts access based on user roles.
 *   Redirects unauthorized users to /dashboard (or their module default).
 */
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth, useCanAccess } from '@/entities/auth';
import { DEFAULT_REDIRECTS } from '@/app/routes/routes';
import type { Role } from '@/shared/types';

interface ProtectedRouteProps {
  children?: React.ReactNode;
}

/**
 * Wraps routes that require authentication.
 * Shows a loading spinner while auth state is being initialized.
 * Redirects to /login if no valid token exists.
 * Redirects to role-specific default page if at root path.
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, user, loading } = useAuth();
  const location = useLocation();

  // Show loading spinner while auth state is being initialized
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F4F6F8]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#2E7D5B] border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If no children and at root path, redirect based on role
  if (!children && location.pathname === '/') {
    const redirectPath = (user?.role && DEFAULT_REDIRECTS[user.role]) || '/dashboard';
    return <Navigate to={redirectPath} replace />;
  }

  return <>{children}</>;
}

interface RoleGuardProps {
  roles: Role[];
  children?: React.ReactNode;
}

/**
 * Restricts access to users with the required role.
 * Redirects unauthorized users to their default page based on role.
 * When used as a layout route (with nested children), renders <Outlet />.
 * When used as a wrapper (with children prop), renders the children.
 */
export function RoleGuard({ roles, children }: RoleGuardProps) {
  const { user } = useAuth();
  const location = useLocation();
  const canAccess = useCanAccess(location.pathname);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Allow if SUPER_ADMIN, or role in allowed roles, or user has granular read permission
  const isAllowed = user.role === 'SUPER_ADMIN' || roles.includes(user.role as Role) || canAccess;

  if (!isAllowed) {
    // Redirect to role-specific default page
    const redirectPath = DEFAULT_REDIRECTS[user.role] || '/dashboard';
    return <Navigate to={redirectPath} replace />;
  }

  // If no explicit children, render Outlet for nested routes
  if (!children) {
    return <Outlet />;
  }

  return <>{children}</>;
}