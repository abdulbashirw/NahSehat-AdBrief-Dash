/**
 * Topbar — header bar with breadcrumb, notifications, and user profile.
 * Used inside AppLayout for SUPER_ADMIN and ADMIN roles.
 * Adapts styling based on the current route:
 *   - Dashboard: frosted-glass with light text over animated background
 *   - Other routes: standard white header
 */
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronRight, Home, Menu } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { useAuth } from '@/entities/auth';

interface TopbarProps {
  onMenuClick?: () => void;
}

export default function Topbar({ onMenuClick }: TopbarProps) {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const isDashboard = location.pathname === '/dashboard';

  // Build breadcrumb from path (excluding 'dashboard' since Home points to /dashboard)
  const segments = location.pathname.split('/').filter((s) => Boolean(s) && s !== 'dashboard');
  const breadcrumb = segments.map((seg, i) => ({
    label: seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' '),
    path: '/' + segments.slice(0, i + 1).join('/'),
  }));

  return (
    <div className="relative z-20 flex flex-col">
      {/* ── Brand accent gradient ── */}
      <div className="h-[2px] shrink-0 bg-gradient-to-r from-[#2862E4] via-[#3B5ADB] to-[#2D2A7A]" />

      <header
        className={cn(
          'flex h-16 items-center justify-between px-4 lg:px-6 transition-colors duration-200',
          isDashboard
            ? 'border-b border-white/40 bg-white/60 backdrop-blur-xl shadow-[0_1px_12px_rgba(40,98,228,0.06)]'
            : 'border-b border-[#E5E8EC]/80 bg-white/90 backdrop-blur-md shadow-xs',
        )}
      >
        {/* Left — Breadcrumb */}
        <div className="flex items-center gap-3">
          <button
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#2862E4]/15 bg-gradient-to-br from-[#2862E4]/[0.08] to-[#2D2A7A]/[0.04] text-[#2862E4] transition-all hover:bg-[#2862E4] hover:text-white lg:hidden"
            onClick={onMenuClick}
            aria-label="Open menu"
          >
            <Menu className="h-4 w-4" />
          </button>

          <nav className="hidden items-center gap-1.5 text-sm sm:flex">
            <button
              onClick={() => navigate('/dashboard')}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all',
                isDashboard
                  ? 'bg-[#2862E4]/10 text-[#2862E4] font-semibold shadow-xs'
                  : 'text-[#64748B] hover:bg-slate-100 hover:text-[#1E293B]',
              )}
            >
              <Home className="h-3.5 w-3.5" />
              <span>Home</span>
            </button>
            {breadcrumb.map((crumb, i) => (
              <span key={crumb.path} className="flex items-center gap-1.5">
                <ChevronRight className="h-3.5 w-3.5 text-[#94A3B8]" />
                <button
                  onClick={() => navigate(crumb.path)}
                  className={cn(
                    'rounded-lg px-2.5 py-1 text-xs transition-all',
                    i === breadcrumb.length - 1
                      ? 'font-bold text-[#1E293B] bg-slate-100/90'
                      : 'font-medium text-[#64748B] hover:bg-slate-100 hover:text-[#1E293B]',
                  )}
                >
                  {crumb.label}
                </button>
              </span>
            ))}
          </nav>
        </div>

        {/* Right — User profile */}
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 transition-all',
              isDashboard ? 'hover:bg-white/60' : 'hover:bg-[#F4F6F8]',
            )}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#2862E4] to-[#2D2A7A] text-xs font-bold text-white shadow-[0_2px_8px_rgba(40,98,228,0.25)]">
              {user?.username?.charAt(0).toUpperCase() ?? 'U'}
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-semibold text-[#1E293B] leading-tight">{user?.username ?? 'User'}</p>
              <p className="text-[11px] font-medium text-[#64748B] leading-tight">{user?.role ?? '—'}</p>
            </div>
          </div>
        </div>
      </header>
    </div>
  );
}