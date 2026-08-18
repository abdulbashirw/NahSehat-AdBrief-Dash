/**
 * Topbar — header bar with breadcrumb, notifications, and user profile.
 * Used inside AppLayout for SUPER_ADMIN and ADMIN roles.
 * Adapts styling based on the current route:
 *   - Dashboard: frosted-glass with light text over animated background
 *   - Other routes: standard white header
 */
import { useLocation, useNavigate } from 'react-router-dom';
import { Bell, Menu, Search } from 'lucide-react';
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

  // Build breadcrumb from path
  const segments = location.pathname.split('/').filter(Boolean);
  const breadcrumb = segments.map((seg, i) => ({
    label: seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' '),
    path: '/' + segments.slice(0, i + 1).join('/'),
  }));

  return (
    <header className={cn(
      'flex h-16 items-center justify-between px-4 lg:px-6',
      isDashboard
        ? 'border-b border-white/40 bg-white/60 backdrop-blur-xl shadow-[0_1px_12px_rgba(37,99,235,0.06)]'
        : 'border-b border-[#E5E8EC]/60 bg-white/80 backdrop-blur-md',
    )}>
      {/* Left — breadcrumb */}
      <div className="flex items-center gap-3">
        <button
          className="lg:hidden"
          onClick={onMenuClick}
          aria-label="Open menu"
        >
          <Menu className={cn('h-5 w-5', isDashboard ? 'text-[#475569]' : 'text-[#4B5563]')} />
        </button>
        <nav className="hidden items-center gap-1.5 text-sm sm:flex">
          <button
            onClick={() => navigate('/dashboard')}
            className={isDashboard ? 'text-[#64748B] hover:text-[#2563EB]' : 'text-[#9CA3AF] hover:text-[#4B5563]'}
          >
            Home
          </button>
          {breadcrumb.map((crumb, i) => (
            <span key={crumb.path} className="flex items-center gap-1.5">
              <span className={isDashboard ? 'text-[#94A3B8]' : 'text-[#9CA3AF]'}>/</span>
              <button
                onClick={() => navigate(crumb.path)}
                className={cn(
                  i === breadcrumb.length - 1
                    ? isDashboard ? 'font-semibold text-[#1E293B]' : 'font-semibold text-[#1F2A37]'
                    : isDashboard ? 'text-[#64748B] hover:text-[#2563EB]' : 'text-[#9CA3AF] hover:text-[#4B5563]',
                )}
              >
                {crumb.label}
              </button>
            </span>
          ))}
        </nav>
      </div>

      {/* Right — search, notifications, user */}
      <div className="flex items-center gap-3">
        <button className={cn(
          'flex h-9 w-9 items-center justify-center rounded-lg transition-colors',
          isDashboard ? 'hover:bg-white/60' : 'hover:bg-[#F4F6F8]',
        )} aria-label="Search">
          <Search className={cn('h-4 w-4', isDashboard ? 'text-[#475569]' : 'text-[#4B5563]')} />
        </button>
        <button className={cn(
          'relative flex h-9 w-9 items-center justify-center rounded-lg transition-colors',
          isDashboard ? 'hover:bg-white/60' : 'hover:bg-[#F4F6F8]',
        )} aria-label="Notifications">
          <Bell className={cn('h-4 w-4', isDashboard ? 'text-[#475569]' : 'text-[#4B5563]')} />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[#EF4444]" />
        </button>
        <div className={cn(
          'flex items-center gap-2 rounded-lg px-2 py-1 transition-colors',
          isDashboard ? 'hover:bg-white/60' : 'hover:bg-[#F4F6F8]',
        )}>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#2563EB] to-[#06B6D4] text-sm font-bold text-white shadow-[0_2px_8px_rgba(37,99,235,0.25)]">
            {user?.username?.charAt(0).toUpperCase() ?? 'U'}
          </div>
          <div className="hidden sm:block">
            <p className={cn('text-sm font-semibold', isDashboard ? 'text-[#1E293B]' : 'text-[#1F2A37]')}>{user?.username ?? 'User'}</p>
            <p className={cn('text-[11px]', isDashboard ? 'text-[#64748B]' : 'text-[#9CA3AF]')}>{user?.role ?? '—'}</p>
          </div>
        </div>
      </div>
    </header>
  );
}