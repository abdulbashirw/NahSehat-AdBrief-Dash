/**
 * Role Management Page — Master System Roles.
 * Manages role definitions and provides direct configuration into Permission Matrix.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useGetRolesQuery,
  useCreateRoleMutation,
  useUpdateRoleMutation,
  useDeleteRoleMutation,
} from '@/entities/role/api/roleApi';
import type { RoleWithPermissions } from '@/shared/types';
import LoadingSpinner from '@/shared/components/loading/LoadingSpinner';
import ApiError from '@/shared/components/error/ApiError';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/shared/ui/dialog';
import { Shield, Edit2, Trash2, Search, CheckCircle2, ShieldCheck, Key, ArrowRight } from 'lucide-react';
import { useHasPermission } from '@/entities/auth';
import ConfirmDialog from '@/shared/components/common/ConfirmDialog';

export default function RoleManagement() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleWithPermissions | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const [form, setForm] = useState<{
    name: string;
    description: string;
  }>({
    name: '',
    description: '',
  });

  const { data, isLoading, isError, refetch } = useGetRolesQuery({ page, pageSize: 10, search });
  const [createRole] = useCreateRoleMutation();
  const [updateRole] = useUpdateRoleMutation();
  const [deleteRole] = useDeleteRoleMutation();

  const canCreate = useHasPermission('cms-roles', 'create');
  const canUpdate = useHasPermission('cms-roles', 'update');
  const canDelete = useHasPermission('cms-roles', 'delete');
  const canConfigurePermissions = useHasPermission('cms-permissions', 'read');

  const openCreateDialog = () => {
    setEditingRole(null);
    setForm({ name: '', description: '' });
    setDialogOpen(true);
  };

  const openEditDialog = (role: RoleWithPermissions) => {
    setEditingRole(role);
    setForm({
      name: role.name,
      description: role.description,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    try {
      if (editingRole) {
        await updateRole({
          id: editingRole.id,
          body: {
            name: form.name.trim(),
            description: form.description.trim(),
          },
        }).unwrap();
      } else {
        await createRole({
          name: form.name.trim(),
          description: form.description.trim(),
          accessibleMenus: [],
          permissions: [],
        }).unwrap();
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
            <p className="text-xs text-[#6B7280]">
              Define master system roles and navigate to the Permission Matrix for granular access policies
            </p>
          </div>
        </div>

        {canCreate && (
          <Button onClick={openCreateDialog} className="gap-2 bg-[#2E7D5B] hover:bg-[#245A47] text-white shadow-sm font-semibold rounded-lg">
            <Shield className="h-4 w-4" />
            Add New Role
          </Button>
        )}
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
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-[#2E7D5B] font-bold border border-emerald-200">
                    <Shield className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#1F2A37]">{role.name}</h3>
                    <p className="text-xs text-[#6B7280]">{role.description || 'No description provided'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {canUpdate && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(role)}
                      className="h-8 w-8 p-0 text-[#4B5563] hover:bg-[#E7F4EE] hover:text-[#2E7D5B]"
                      title="Edit Role Info"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  )}
                  {canDelete && role.name !== 'SUPER_ADMIN' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteConfirm(role.id)}
                      className="h-8 w-8 p-0 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                      title="Delete Role"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Accessible Menus Tags */}
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wider">Accessible Modules</p>
                  <span className="text-[11px] text-gray-500 font-medium">
                    {role.permissions.length} action privileges
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
                  {role.accessibleMenus.length > 0 ? (
                    role.accessibleMenus.map((menu) => (
                      <span key={menu} className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800 border border-emerald-200">
                        <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                        {menu}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-gray-400 italic">No module access assigned yet</span>
                  )}
                </div>
              </div>
            </div>

            {/* Matrix Quick Link Button */}
            <div className="mt-5 border-t border-gray-100 pt-4 flex items-center justify-between">
              <span className="text-xs text-gray-400 font-mono">ID: {role.id}</span>
              {canConfigurePermissions && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate(`/cms/permissions?roleId=${role.id}`)}
                  className="gap-1.5 text-xs font-semibold text-[#2E7D5B] border-[#2E7D5B]/30 hover:bg-[#E7F4EE] hover:text-[#245A47]"
                >
                  <Key className="h-3.5 w-3.5" />
                  Configure in Matrix
                  <ArrowRight className="h-3.5 w-3.5 ml-0.5" />
                </Button>
              )}
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
        <DialogContent className="sm:max-w-[480px] rounded-xl p-6">
          <DialogHeader className="pb-3 border-b border-gray-100">
            <DialogTitle className="text-lg font-bold text-[#1F2A37] flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-[#2E7D5B]" />
              {editingRole ? 'Edit Role Details' : 'Create New System Role'}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div>
              <label className="mb-1.5 block text-xs font-bold text-[#4B5563]">Role Title</label>
              <Input
                placeholder="e.g. AUDITOR or INDEMNITY_MANAGER"
                value={form.name}
                disabled={editingRole?.name === 'SUPER_ADMIN'}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value.toUpperCase().replace(/\s+/g, '_') }))}
                className="text-sm border-[#E5E8EC] uppercase font-semibold"
              />
              <p className="mt-1 text-[11px] text-gray-400">Unique identifier for this role (e.g. CLAIMS_OFFICER)</p>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold text-[#4B5563]">Role Description</label>
              <Input
                placeholder="Brief summary of duties and responsibilities"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="text-sm border-[#E5E8EC]"
              />
            </div>

            <div className="rounded-lg bg-emerald-50/60 p-3 border border-emerald-100 text-xs text-emerald-900 flex items-start gap-2">
              <Key className="h-4 w-4 text-[#2E7D5B] shrink-0 mt-0.5" />
              <span>
                Detailed navigation module permissions and action privileges are managed granularly in the <strong>Permission Matrix</strong>.
              </span>
            </div>
          </div>

          <DialogFooter className="border-t border-gray-100 pt-3">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="text-xs">Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={!form.name.trim()}
              className="bg-[#2E7D5B] hover:bg-[#245A47] text-white text-xs font-semibold"
            >
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
        description="Are you sure you want to delete this role? Users assigned to this role will lose their access."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => deleteConfirm && handleDelete(deleteConfirm)}
      />
    </div>
  );
}