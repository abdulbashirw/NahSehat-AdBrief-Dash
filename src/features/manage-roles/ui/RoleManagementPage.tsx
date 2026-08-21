/**
 * Role Management Page — International standard minimalist & professional design.
 */
import { useState } from 'react';
import {
  useGetRolesQuery,
  useCreateRoleMutation,
  useUpdateRoleMutation,
  useDeleteRoleMutation,
} from '@/entities/role/api/roleApi';
import type { RoleWithPermissions } from '@/shared/types';
import type { PermissionPayload } from '@/entities/role/model/roleTypes';
import LoadingSpinner from '@/shared/components/loading/LoadingSpinner';
import ApiError from '@/shared/components/error/ApiError';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/shared/ui/dialog';
import { Shield, Edit2, Trash2, Search, CheckCircle2, ShieldCheck, Key } from 'lucide-react';
import ConfirmDialog from '@/shared/components/common/ConfirmDialog';

const MENU_ITEMS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'indemnity', label: 'Indemnity' },
  { key: 'indemnity-overview', label: 'Utilization Overview' },
  { key: 'indemnity-claims-map', label: 'Claims Map' },
  { key: 'indemnity-demographics', label: 'Demographics' },
  { key: 'indemnity-diseases', label: 'Diseases' },
  { key: 'managecare', label: 'Manage Care' },
  { key: 'managecare-daily-monitoring', label: 'Daily Monitoring' },
  { key: 'cms', label: 'CMS' },
  { key: 'cms-users', label: 'User Management' },
  { key: 'cms-roles', label: 'Role Management' },
  { key: 'cms-payors', label: 'Payor Management' },
  { key: 'cms-permissions', label: 'Permission Management' },
  { key: 'settings', label: 'Settings' },
];

const PERMISSION_ACTIONS: PermissionPayload['action'][] = ['create', 'read', 'update', 'delete', 'export'];

export default function RoleManagement() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleWithPermissions | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const [form, setForm] = useState<{
    name: string;
    description: string;
    accessibleMenus: string[];
    permissions: PermissionPayload[];
  }>({
    name: '',
    description: '',
    accessibleMenus: [],
    permissions: [],
  });

  const { data, isLoading, isError, refetch } = useGetRolesQuery({ page, pageSize: 10, search });
  const [createRole] = useCreateRoleMutation();
  const [updateRole] = useUpdateRoleMutation();
  const [deleteRole] = useDeleteRoleMutation();

  const openCreateDialog = () => {
    setEditingRole(null);
    setForm({ name: '', description: '', accessibleMenus: [], permissions: [] });
    setDialogOpen(true);
  };

  const openEditDialog = (role: RoleWithPermissions) => {
    setEditingRole(role);
    // Extract unique actions from existing permissions.
    // The `menu` is a placeholder here — it will be expanded into a
    // cross-product of accessibleMenus × actions at save time (handleSubmit).
    const uniqueActions = Array.from(new Set(role.permissions.map((p) => p.action))) as PermissionPayload['action'][];
    setForm({
      name: role.name,
      description: role.description,
      accessibleMenus: role.accessibleMenus,
      permissions: uniqueActions.map((action) => ({ menu: '', action })),
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    try {
      // Expand the selected action privileges across every accessible menu
      // to form proper per-menu { menu, action } permission pairs — this is
      // the shape the backend expects (role_permissions table). The backend
      // derives `accessibleMenus` from DISTINCT menu of these rows.
      const selectedActions = form.permissions.map((p) => p.action);
      const expandedPermissions = form.accessibleMenus.flatMap((menu) =>
        selectedActions.map((action) => ({ menu, action })),
      );
      const payload = {
        name: form.name,
        description: form.description,
        accessibleMenus: form.accessibleMenus,
        permissions: expandedPermissions,
      };
      if (editingRole) {
        await updateRole({ id: editingRole.id, body: payload }).unwrap();
      } else {
        await createRole(payload).unwrap();
      }
      setDialogOpen(false);
      refetch();
    } catch (_err) {
      // Failed to save role — error silently handled
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteRole(id).unwrap();
      setDeleteConfirm(null);
      refetch();
    } catch (_err) {
      // Failed to delete role — error silently handled
    }
  };

  const toggleMenu = (menuKey: string) => {
    setForm((f) => ({
      ...f,
      accessibleMenus: f.accessibleMenus.includes(menuKey)
        ? f.accessibleMenus.filter((m) => m !== menuKey)
        : [...f.accessibleMenus, menuKey],
    }));
  };

  const togglePermission = (action: PermissionPayload['action']) => {
    setForm((f) => {
      const exists = f.permissions.some((p) => p.action === action);
      return {
        ...f,
        permissions: exists
          ? f.permissions.filter((p) => p.action !== action)
          : [...f.permissions, { menu: '', action }],
      };
    });
  };

  if (isLoading) return <LoadingSpinner message="Loading role directory..." />;
  if (isError) return <ApiError onRetry={refetch} />;

  const roles = data?.data ?? [];
  const totalPages = data?.totalPages ?? 1;

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-white p-5 shadow-sm border border-[#E5E8EC]">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2E7D5B]/10 text-[#2E7D5B]">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-[#1F2A37]">Role Management</h1>
            <p className="text-xs text-[#6B7280]">Configure system roles, access policies, and operational privileges</p>
          </div>
        </div>

        <Button onClick={openCreateDialog} className="gap-2 bg-[#2E7D5B] hover:bg-[#245A47] text-white shadow-sm font-semibold rounded-lg">
          <Shield className="h-4 w-4" />
          Add New Role
        </Button>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-white p-4 shadow-sm border border-[#E5E8EC]">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search roles by title or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 text-xs sm:text-sm border-[#E5E8EC] rounded-lg focus:border-[#2E7D5B]"
          />
        </div>
        <span className="text-xs font-medium text-[#6B7280]">
          Total <strong className="text-[#1F2A37]">{roles.length}</strong> Roles Defined
        </span>
      </div>

      {/* Roles Grid Cards */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {roles.map((role) => (
          <div
            key={role.id}
            className="flex flex-col justify-between rounded-xl bg-white p-5 shadow-sm border border-[#E5E8EC] transition-all hover:shadow-md"
          >
            <div>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-700 font-bold border border-purple-200">
                    <Shield className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#1F2A37]">{role.name}</h3>
                    <p className="text-xs text-[#6B7280]">{role.description || 'No description provided'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEditDialog(role)}
                    className="h-8 w-8 p-0 text-[#4B5563] hover:bg-[#E7F4EE] hover:text-[#2E7D5B]"
                    title="Edit Role"
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteConfirm(role.id)}
                    className="h-8 w-8 p-0 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                    title="Delete Role"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Accessible Menus Tags */}
              <div className="mt-4">
                <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wider mb-2">Accessible Modules</p>
                <div className="flex flex-wrap gap-1.5">
                  {role.accessibleMenus.length > 0 ? (
                    role.accessibleMenus.map((menu) => (
                      <span key={menu} className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800 border border-emerald-200">
                        <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                        {menu}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-gray-400 italic">No module access assigned</span>
                  )}
                </div>
              </div>

              {/* Action Permissions Tags */}
              <div className="mt-4 border-t border-gray-100 pt-3">
                <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wider mb-2">Permission Actions</p>
                <div className="flex flex-wrap gap-1.5">
                  {role.permissions.length > 0 ? (
                    role.permissions.map((p) => (
                      <span key={`${p.menu}-${p.action}`} className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700 border border-gray-200">
                        <Key className="h-3 w-3 text-gray-500" />
                        {p.action}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-gray-400 italic">No explicit actions configured</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}

        {roles.length === 0 && (
          <div className="col-span-full rounded-xl border border-dashed border-gray-200 bg-white py-12 text-center text-sm text-[#9CA3AF]">
            No roles configured yet. Click "Add New Role" to create one.
          </div>
        )}
      </div>

      {/* Pagination Footer */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-white p-4 shadow-sm border border-[#E5E8EC] text-xs sm:text-sm">
        <p className="text-[#6B7280]">
          Showing Page <span className="font-semibold text-[#1F2A37]">{page}</span> of <span className="font-semibold text-[#1F2A37]">{totalPages}</span>
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="text-xs font-semibold"
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="text-xs font-semibold"
          >
            Next
          </Button>
        </div>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[620px] max-h-[85vh] overflow-y-auto rounded-xl p-6">
          <DialogHeader className="pb-3 border-b border-gray-100">
            <DialogTitle className="text-lg font-bold text-[#1F2A37] flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-[#2E7D5B]" />
              {editingRole ? 'Edit Role Configuration' : 'Create New System Role'}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div>
              <label className="mb-1.5 block text-xs font-bold text-[#4B5563]">Role Title</label>
              <Input
                placeholder="e.g. INDEMNITY_MANAGER"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="text-sm border-[#E5E8EC]"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold text-[#4B5563]">Role Description</label>
              <Input
                placeholder="Brief summary of duties and permissions"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="text-sm border-[#E5E8EC]"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold text-[#4B5563]">Accessible Navigation Modules</label>
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto rounded-lg border border-[#E5E8EC] p-3 bg-gray-50/50">
                {MENU_ITEMS.map((menu) => (
                  <label key={menu.key} className="flex items-center gap-2 text-xs font-medium text-[#1F2A37] cursor-pointer hover:text-[#2E7D5B]">
                    <input
                      type="checkbox"
                      checked={form.accessibleMenus.includes(menu.key)}
                      onChange={() => toggleMenu(menu.key)}
                      className="rounded border-gray-300 text-[#2E7D5B] focus:ring-[#2E7D5B]"
                    />
                    <span>{menu.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold text-[#4B5563]">Granted Action Privileges</label>
              <div className="flex flex-wrap gap-3 rounded-lg border border-[#E5E8EC] p-3 bg-gray-50/50">
                {PERMISSION_ACTIONS.map((action) => (
                  <label key={action} className="flex items-center gap-2 text-xs font-medium text-[#1F2A37] cursor-pointer hover:text-[#2E7D5B]">
                    <input
                      type="checkbox"
                      checked={form.permissions.some((p) => p.action === action)}
                      onChange={() => togglePermission(action)}
                      className="rounded border-gray-300 text-[#2E7D5B] focus:ring-[#2E7D5B]"
                    />
                    <span className="capitalize">{action}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="border-t border-gray-100 pt-3">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="text-xs">Cancel</Button>
            <Button onClick={handleSubmit} className="bg-[#2E7D5B] hover:bg-[#245A47] text-white text-xs font-semibold">
              {editingRole ? 'Save Changes' : 'Create Role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
        title="Delete Role"
        description="Are you sure you want to delete this role? Users with this role will lose their access."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => deleteConfirm && handleDelete(deleteConfirm)}
      />
    </div>
  );
}