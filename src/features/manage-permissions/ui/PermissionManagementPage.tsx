/**
 * Permission Management Page — International standard minimalist & professional design.
 */
import { useState, useEffect } from 'react';
import {
  useGetPermissionGroupsQuery,
  useGetRolePermissionsQuery,
  useUpdatePermissionsMutation,
} from '@/entities/permission/api/permissionApi';
import type { PermissionAction } from '@/entities/permission/model/permissionTypes';
import LoadingSpinner from '@/shared/components/loading/LoadingSpinner';
import ApiError from '@/shared/components/error/ApiError';
import { Button } from '@/shared/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { ROLES } from '@/shared/types';
import { useHasPermission } from '@/entities/auth';
import { Save, Key, ShieldCheck, CheckSquare, Sparkles } from 'lucide-react';

const PERMISSION_ACTIONS: PermissionAction[] = ['create', 'read', 'update', 'delete', 'export'];

/** Default menu groups used when API doesn't return groups yet */
const DEFAULT_MENU_GROUPS = [
  { group: 'Dashboard', menus: ['dashboard'], label: 'Dashboard Overview' },
  { group: 'Indemnity Module', menus: ['indemnity-overview', 'indemnity-claims-map', 'indemnity-demographics', 'indemnity-diseases'], label: 'Indemnity Analytics' },
  { group: 'Manage Care', menus: ['managecare-daily-monitoring'], label: 'Daily Monitoring' },
  { group: 'CMS Administration', menus: ['cms-users', 'cms-roles', 'cms-payors', 'cms-permissions'], label: 'System Admin' },
  { group: 'Settings', menus: ['settings'], label: 'System Settings' },
];

export default function PermissionManagement() {
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [permissions, setPermissions] = useState<Record<string, PermissionAction[]>>({});
  const [hasChanges, setHasChanges] = useState(false);

  const { data: groups, isLoading: groupsLoading, isError: groupsError, refetch: refetchGroups } = useGetPermissionGroupsQuery();
  const { data: rolePermissions } = useGetRolePermissionsQuery(selectedRole, { skip: !selectedRole });
  const [updatePermissions] = useUpdatePermissionsMutation();

  const canUpdate = useHasPermission('cms-permissions', 'update');

  // Initialize permissions when role data loads
  useEffect(() => {
    if (rolePermissions && !hasChanges) {
      const initial: Record<string, PermissionAction[]> = {};
      rolePermissions.permissions.forEach((p) => {
        if (!initial[p.menu]) initial[p.menu] = [];
        if (!initial[p.menu].includes(p.action)) initial[p.menu].push(p.action);
      });
      setPermissions(initial);
    }
  }, [rolePermissions, hasChanges]);

  const togglePermission = (menu: string, action: PermissionAction) => {
    setPermissions((prev) => {
      const current = prev[menu] || [];
      const updated = current.includes(action)
        ? current.filter((a) => a !== action)
        : [...current, action];
      return { ...prev, [menu]: updated };
    });
    setHasChanges(true);
  };

  const toggleSelectAll = (menu: string) => {
    const current = permissions[menu] || [];
    const allSelected = PERMISSION_ACTIONS.every((a) => current.includes(a));
    setPermissions((prev) => ({
      ...prev,
      [menu]: allSelected ? [] : [...PERMISSION_ACTIONS],
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!selectedRole) return;
    try {
      const permList = Object.entries(permissions).map(([menu, actions]) => ({
        menu,
        actions,
      }));
      await updatePermissions({ roleId: selectedRole, permissions: permList }).unwrap();
      setHasChanges(false);
    } catch (_err) {
      // Failed to update permissions — error silently handled
    }
  };

  if (groupsLoading && !groups) return <LoadingSpinner message="Loading permission matrix..." />;
  if (groupsError && !groups) return <ApiError onRetry={refetchGroups} />;

  // Use API groups if available, otherwise fall back to defaults
  const menuGroups = groups && groups.length > 0
    ? groups.map((g) => ({ group: g.label, menus: [g.menu], label: g.label }))
    : DEFAULT_MENU_GROUPS;

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-white p-5 shadow-sm border border-[#E5E8EC]">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2E7D5B]/10 text-[#2E7D5B]">
            <Key className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-[#1F2A37]">Permission Matrix</h1>
            <p className="text-xs text-[#6B7280]">Configure granular feature access and action privileges per role</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Select
            value={selectedRole}
            onValueChange={(v) => {
              setSelectedRole(v);
              setHasChanges(false);
            }}
          >
            <SelectTrigger className="w-[220px] text-xs sm:text-sm border-[#E5E8EC] font-semibold">
              <SelectValue placeholder="Select Target Role" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(ROLES).map(([key, value]) => (
                <SelectItem key={key} value={value} className="text-xs sm:text-sm">
                  {key.replace(/_/g, ' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasChanges && canUpdate && (
            <Button
              onClick={handleSave}
              className="gap-2 bg-[#2E7D5B] hover:bg-[#245A47] text-white text-xs font-semibold shadow-sm animate-pulse"
            >
              <Save className="h-4 w-4" />
              Save Matrix Changes
            </Button>
          )}
        </div>
      </div>

      {!selectedRole ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-white py-16 text-center shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-[#2E7D5B] mb-3">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-[#1F2A37]">Select a Role to Configure</h3>
          <p className="mt-1 text-xs text-[#6B7280] max-w-sm">
            Choose a system role from the dropdown above to view and edit its granular access permissions.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {menuGroups.map((group) => (
            <div key={group.group} className="rounded-xl border border-[#E5E8EC] bg-white p-5 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[#2E7D5B]" />
                  <h2 className="text-base font-bold text-[#1F2A37]">{group.group}</h2>
                </div>
                <span className="text-xs font-medium text-[#9CA3AF]">
                  {group.menus.length} module{group.menus.length > 1 ? 's' : ''}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/50">
                      <th className="py-2.5 px-3 font-semibold text-[#6B7280]">Navigation Module</th>
                      <th className="py-2.5 px-3 font-semibold text-[#6B7280] text-center w-24">Select All</th>
                      {PERMISSION_ACTIONS.map((action) => (
                        <th key={action} className="py-2.5 px-3 font-semibold text-[#6B7280] text-center capitalize w-24">
                          {action}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {group.menus.map((menu: string) => {
                      const currentActions = permissions[menu] || [];
                      const isAllChecked = PERMISSION_ACTIONS.every((a) => currentActions.includes(a));

                      return (
                        <tr key={menu} className="hover:bg-[#E7F4EE]/30 transition-colors">
                          <td className="py-3 px-3">
                            <span className="font-semibold text-[#1F2A37] block text-xs sm:text-sm">{menu}</span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => toggleSelectAll(menu)}
                              className="text-xs text-[#2E7D5B] font-semibold hover:underline flex items-center justify-center gap-1 mx-auto"
                            >
                              <CheckSquare className="h-3.5 w-3.5" />
                              {isAllChecked ? 'Clear' : 'All'}
                            </button>
                          </td>
                          {PERMISSION_ACTIONS.map((action) => {
                            const isChecked = currentActions.includes(action);
                            return (
                              <td key={`${menu}-${action}`} className="py-3 px-3 text-center">
                                <label className="inline-flex items-center justify-center p-1 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => togglePermission(menu, action)}
                                    className="h-4 w-4 rounded border-gray-300 text-[#2E7D5B] focus:ring-[#2E7D5B] cursor-pointer"
                                  />
                                </label>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}