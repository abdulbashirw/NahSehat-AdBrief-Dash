/**
 * Permission Management Page — Granular Access Matrix.
 * Configures per-module and per-action privileges per role.
 */
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  useGetPermissionGroupsQuery,
  useGetRolePermissionsQuery,
  useUpdatePermissionsMutation,
} from '@/entities/permission/api/permissionApi';
import { useGetRolesQuery } from '@/entities/role/api/roleApi';
import type { PermissionAction } from '@/entities/permission/model/permissionTypes';
import LoadingSpinner from '@/shared/components/loading/LoadingSpinner';
import ApiError from '@/shared/components/error/ApiError';
import { Button } from '@/shared/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { useHasPermission } from '@/entities/auth';
import { Save, Key, ShieldCheck, CheckSquare, Sparkles, CheckCircle, AlertCircle } from 'lucide-react';

const PERMISSION_ACTIONS: PermissionAction[] = ['create', 'read', 'update', 'delete', 'export'];

interface ModuleItem {
  key: string;
  label: string;
}

interface ModuleSection {
  group: string;
  menus: ModuleItem[];
}

/** Structured menu categories covering all application features */
const BASE_MODULE_SECTIONS: ModuleSection[] = [
  {
    group: 'Dashboard Overview',
    menus: [{ key: 'dashboard', label: 'Dashboard Overview' }],
  },
  {
    group: 'Indemnity Analytics',
    menus: [
      { key: 'indemnity-overview', label: 'Utilization Overview' },
      { key: 'indemnity-claims-map', label: 'Claims Geographic Map' },
      { key: 'indemnity-demographics', label: 'Member Demographics' },
      { key: 'indemnity-diseases', label: 'Diseases & Diagnoses' },
    ],
  },
  {
    group: 'Manage Care',
    menus: [{ key: 'managecare-daily-monitoring', label: 'Daily Inpatient Monitoring' }],
  },
  {
    group: 'AdScore Intelligence',
    menus: [{ key: 'adscore', label: 'AdScore Analytics & Underwriting' }],
  },
  {
    group: 'CMS Administration',
    menus: [
      { key: 'cms-users', label: 'User Management' },
      { key: 'cms-roles', label: 'Role Management' },
      { key: 'cms-payors', label: 'Payor Management' },
      { key: 'cms-permissions', label: 'Permission Matrix' },
    ],
  },
  {
    group: 'Security & Audit',
    menus: [{ key: 'activity', label: 'User Activity Logs' }],
  },
  {
    group: 'System Settings',
    menus: [{ key: 'settings', label: 'System Configuration' }],
  },
];

export default function PermissionManagement() {
  const [searchParams] = useSearchParams();
  const initialRoleId = searchParams.get('roleId') || '';

  const [selectedRole, setSelectedRole] = useState<string>(initialRoleId);
  const [permissions, setPermissions] = useState<Record<string, PermissionAction[]>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  // Fetch dynamic roles list from DB
  const { data: rolesData, isLoading: rolesLoading } = useGetRolesQuery({ page: 1, pageSize: 100 });
  const { data: groupsData, isLoading: groupsLoading, isError: groupsError, refetch: refetchGroups } = useGetPermissionGroupsQuery();
  const { data: rolePermissions, isFetching: rolePermissionsLoading } = useGetRolePermissionsQuery(selectedRole, { skip: !selectedRole });
  const [updatePermissions] = useUpdatePermissionsMutation();

  const canUpdate = useHasPermission('cms-permissions', 'update');

  const roles = rolesData?.data || [];

  // If initialRoleId is provided or roles load, select first role if none selected
  useEffect(() => {
    if (!selectedRole && initialRoleId) {
      setSelectedRole(initialRoleId);
    } else if (!selectedRole && roles.length > 0) {
      setSelectedRole(roles[0].id);
    }
  }, [roles, initialRoleId, selectedRole]);

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
    setSaveStatus('idle');
  };

  const toggleSelectAll = (menu: string) => {
    const current = permissions[menu] || [];
    const allSelected = PERMISSION_ACTIONS.every((a) => current.includes(a));
    setPermissions((prev) => ({
      ...prev,
      [menu]: allSelected ? [] : [...PERMISSION_ACTIONS],
    }));
    setHasChanges(true);
    setSaveStatus('idle');
  };

  const handleSave = async () => {
    if (!selectedRole) return;
    try {
      setSaveStatus('saving');
      const permList = Object.entries(permissions).map(([menu, actions]) => ({
        menu,
        actions,
      }));
      await updatePermissions({ roleId: selectedRole, permissions: permList }).unwrap();
      setHasChanges(false);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 4000);
    } catch (_err) {
      setSaveStatus('error');
    }
  };

  if (groupsLoading && !groupsData && rolesLoading) {
    return <LoadingSpinner message="Loading permission matrix..." />;
  }
  if (groupsError && !groupsData) {
    return <ApiError onRetry={refetchGroups} />;
  }

  // Merge any extra dynamic menus from DB that aren't in BASE_MODULE_SECTIONS
  const knownKeys = new Set(BASE_MODULE_SECTIONS.flatMap((s) => s.menus.map((m) => m.key)));
  const extraMenus: ModuleItem[] = (groupsData || [])
    .filter((g) => !knownKeys.has(g.menu))
    .map((g) => ({ key: g.menu, label: g.label }));

  const sections: ModuleSection[] = extraMenus.length > 0
    ? [...BASE_MODULE_SECTIONS, { group: 'Additional Modules', menus: extraMenus }]
    : BASE_MODULE_SECTIONS;

  const currentRoleObj = roles.find((r) => r.id === selectedRole || r.name === selectedRole);

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
            <p className="text-xs text-[#6B7280]">
              Configure granular navigation module access and action privileges per role
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Select
            value={selectedRole}
            onValueChange={(v) => {
              setSelectedRole(v);
              setHasChanges(false);
              setSaveStatus('idle');
            }}
          >
            <SelectTrigger className="w-[240px] text-xs sm:text-sm border-[#E5E8EC] font-semibold">
              <SelectValue placeholder="Select Target Role" />
            </SelectTrigger>
            <SelectContent>
              {roles.map((r) => (
                <SelectItem key={r.id} value={r.id} className="text-xs sm:text-sm">
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasChanges && canUpdate && (
            <Button
              onClick={handleSave}
              disabled={saveStatus === 'saving'}
              className="gap-2 bg-[#2E7D5B] hover:bg-[#245A47] text-white text-xs font-semibold shadow-sm animate-pulse"
            >
              <Save className="h-4 w-4" />
              {saveStatus === 'saving' ? 'Saving...' : 'Save Matrix Changes'}
            </Button>
          )}
        </div>
      </div>

      {/* Save feedback alert */}
      {saveStatus === 'success' && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-xs font-semibold text-emerald-800 border border-emerald-200">
          <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>Permissions successfully saved and updated for role <strong>{currentRoleObj?.name || selectedRole}</strong>.</span>
        </div>
      )}

      {saveStatus === 'error' && (
        <div className="flex items-center gap-2 rounded-lg bg-rose-50 p-3 text-xs font-semibold text-rose-800 border border-rose-200">
          <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
          <span>Failed to save matrix changes. Please try again.</span>
        </div>
      )}

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
      ) : rolePermissionsLoading ? (
        <LoadingSpinner message={`Loading permissions for ${currentRoleObj?.name || 'role'}...`} />
      ) : (
        <div className="space-y-5">
          {sections.map((section) => (
            <div key={section.group} className="rounded-xl border border-[#E5E8EC] bg-white p-5 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[#2E7D5B]" />
                  <h2 className="text-base font-bold text-[#1F2A37]">{section.group}</h2>
                </div>
                <span className="text-xs font-medium text-[#9CA3AF]">
                  {section.menus.length} module{section.menus.length > 1 ? 's' : ''}
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
                    {section.menus.map((item) => {
                      const currentActions = permissions[item.key] || [];
                      const isAllChecked = PERMISSION_ACTIONS.every((a) => currentActions.includes(a));

                      return (
                        <tr key={item.key} className="hover:bg-[#E7F4EE]/30 transition-colors">
                          <td className="py-3 px-3">
                            <span className="font-semibold text-[#1F2A37] block text-xs sm:text-sm">{item.label}</span>
                            <span className="text-[11px] text-gray-400 font-mono">{item.key}</span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => toggleSelectAll(item.key)}
                              className="text-xs text-[#2E7D5B] font-semibold hover:underline flex items-center justify-center gap-1 mx-auto"
                            >
                              <CheckSquare className="h-3.5 w-3.5" />
                              {isAllChecked ? 'Clear' : 'All'}
                            </button>
                          </td>
                          {PERMISSION_ACTIONS.map((action) => {
                            const isChecked = currentActions.includes(action);
                            return (
                              <td key={`${item.key}-${action}`} className="py-3 px-3 text-center">
                                <label className="inline-flex items-center justify-center p-1 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => togglePermission(item.key, action)}
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