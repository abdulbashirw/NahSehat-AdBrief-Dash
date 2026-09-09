/**
 * LayoutSwitcher — selects the appropriate layout based on user role.
 *
 * SUPER_ADMIN, ADMIN → AppLayout (sidebar + topbar)
 * INDEMNITY, MANAGECARE → TabLayout (header tabs, no sidebar)
 */
import { useAuth } from '@/entities/auth';
import { usePageViewLogger } from '@/features/user-activity/hooks/usePageViewLogger';
import AppLayout from '@/widgets/app-layout/ui/AppLayout';
import TabLayout from '@/widgets/tab-layout/ui/TabLayout';

const TAB_LAYOUT_ROLES = ['INDEMNITY', 'MANAGECARE', 'ADSCORE'];

export function LayoutSwitcher() {
  const { user } = useAuth();

  // Log page views for all authenticated routes (captures Indemnity,
  // ManageCare, and other modules whose data comes from external APIs)
  usePageViewLogger();

  if (user?.role && TAB_LAYOUT_ROLES.includes(user.role)) {
    return <TabLayout />;
  }

  return <AppLayout />;
}