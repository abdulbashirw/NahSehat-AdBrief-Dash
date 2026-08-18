/**
 * AppLayout — main authenticated layout with sidebar, topbar, and content area.
 * Used by SUPER_ADMIN and ADMIN roles.
 */
import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import Sidebar from '@/widgets/sidebar/ui/Sidebar';
import Topbar from '@/widgets/topbar/ui/Topbar';
import type { RootState } from '@/shared/store';
import { setSidebarOpen, toggleSidebarCollapsed } from '@/shared/store/slices/dashboardSlice';

export default function AppLayout() {
  const dispatch = useDispatch();
  const { sidebarOpen, sidebarCollapsed } = useSelector(
    (state: RootState) => state.dashboard,
  );

  return (
    <div className="flex h-screen overflow-hidden bg-[#F4F6F8]">
      {/* Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => dispatch(toggleSidebarCollapsed())}
        mobileOpen={sidebarOpen}
        onMobileClose={() => dispatch(setSidebarOpen(false))}
      />

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <Topbar onMenuClick={() => dispatch(setSidebarOpen(true))} />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-transparent p-4 lg:p-6">
          <Suspense
            fallback={
              <div className="flex h-64 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#2E7D5B]" />
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}