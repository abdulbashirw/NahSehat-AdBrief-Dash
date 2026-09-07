/**
 * User Management Page — International standard minimalist & professional design.
 */
import { useState, useCallback, useMemo } from 'react';
import {
  useGetUsersQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useDeleteUserMutation,
  useResetPasswordMutation,
  useToggleUserStatusMutation,
} from '@/entities/user/api/userApi';
import { useGetPayorsQuery } from '@/entities/payor/api/payorApi';
import { useHasPermission } from '@/entities/auth';
import { ROLES, type Role, type AuthUser } from '@/shared/types';
import type { CreateUserPayload } from '@/entities/user/model/userTypes';
import DataTable, { type DataColumn } from '@/shared/components/common/DataTable';
import ExportButton from '@/shared/components/common/ExportButton';
import LoadingSpinner from '@/shared/components/loading/LoadingSpinner';
import ApiError from '@/shared/components/error/ApiError';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/shared/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import {
  UserPlus,
  Search,
  Edit2,
  Trash2,
  KeyRound,
  Power,
  Users,
  UserCheck,
  UserX,
  ShieldCheck,
  Building2,
  Copy,
  Check,
  AlertTriangle,
} from 'lucide-react';
import ConfirmDialog from '@/shared/components/common/ConfirmDialog';
import { cn } from '@/shared/lib/utils';
import { generateRandomPassword } from '@/shared/lib/password';
import { toast } from 'sonner';

const roleLabels: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  INDEMNITY: 'Indemnity',
  MANAGECARE: 'Manage Care',
};

const roleBadgeColors: Record<string, string> = {
  SUPER_ADMIN: 'bg-purple-50 text-purple-700 border-purple-200',
  ADMIN: 'bg-blue-50 text-blue-700 border-blue-200',
  INDEMNITY: 'bg-amber-50 text-amber-700 border-amber-200',
  MANAGECARE: 'bg-teal-50 text-teal-700 border-teal-200',
};

export default function UserManagement() {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AuthUser | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [resetConfirm, setResetConfirm] = useState<string | null>(null);
  const [resetResult, setResetResult] = useState<string | null>(null);
  const [resetLoading, setResetLoading] = useState(false);

  const [form, setForm] = useState<CreateUserPayload>({
    username: '',
    email: '',
    password: '',
    fullName: '',
    role: 'ADMIN',
    payorIds: [],
  });

  const { data, isLoading, isError, refetch } = useGetUsersQuery({
    page,
    pageSize,
    search: search || undefined,
    role: roleFilter !== 'ALL' ? roleFilter : undefined,
  });

  const { data: payorsData } = useGetPayorsQuery({ page: 1, pageSize: 100 });
  const [createUser] = useCreateUserMutation();
  const [updateUser] = useUpdateUserMutation();
  const [deleteUser] = useDeleteUserMutation();
  const [resetPassword] = useResetPasswordMutation();
  const [toggleStatus] = useToggleUserStatusMutation();

  const canCreate = useHasPermission('cms-users', 'create');
  const canUpdate = useHasPermission('cms-users', 'update');
  const canDelete = useHasPermission('cms-users', 'delete');
  const canExport = useHasPermission('cms-users', 'export');

  /** Resolve payor IDs → names for display */
  const payorNameMap = useMemo(() => {
    const map = new Map<string, string>();
    payorsData?.data?.forEach((p) => map.set(p.id, p.name));
    return map;
  }, [payorsData]);

  const users = useMemo(() => {
    let list = data?.data ?? [];
    if (statusFilter !== 'ALL') {
      const active = statusFilter === 'active';
      list = list.filter((u) => u.isActive === active);
    }
    return list;
  }, [data?.data, statusFilter]);

  const totalPages = data?.totalPages ?? 1;

  // Stats calculation
  const totalUsersCount = data?.total ?? users.length;
  const activeCount = useMemo(() => users.filter((u) => u.isActive).length, [users]);
  const inactiveCount = useMemo(() => users.filter((u) => !u.isActive).length, [users]);

  const openCreateDialog = () => {
    setEditingUser(null);
    setForm({ username: '', email: '', password: '', fullName: '', role: 'ADMIN', payorIds: [] });
    setDialogOpen(true);
  };

  const openEditDialog = useCallback((user: AuthUser) => {
    setEditingUser(user);
    setForm({
      username: user.username,
      email: user.email,
      password: '',
      fullName: user.fullName,
      role: user.role,
      payorIds: user.payorIds || [],
    });
    setDialogOpen(true);
  }, []);

  const handleSubmit = async () => {
    try {
      if (editingUser) {
        await updateUser({
          id: editingUser.id,
          body: { fullName: form.fullName, email: form.email, role: form.role as Role, payorIds: form.payorIds },
        }).unwrap();
        toast.success('User updated successfully');
      } else {
        await createUser(form).unwrap();
        toast.success('User created successfully');
      }
      setDialogOpen(false);
      refetch();
    } catch (_err: any) {
      const message = _err?.data?.message || _err?.message || 'Failed to save user';
      toast.error(message);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteUser(id).unwrap();
      setDeleteConfirm(null);
      toast.success('User deleted successfully');
      refetch();
    } catch (_err: any) {
      const message = _err?.data?.message || _err?.message || 'Failed to delete user';
      toast.error(message);
    }
  };

  const handleResetPassword = async (id: string) => {
    setResetLoading(true);
    const tempPassword = generateRandomPassword();
    try {
      await resetPassword({ id, body: { newPassword: tempPassword } }).unwrap();
      setResetConfirm(null);
      setResetResult(tempPassword);
      toast.success('Password reset successfully');
      refetch();
    } catch (_err: any) {
      const message = _err?.data?.message || _err?.message || 'Failed to reset password';
      toast.error(message);
    } finally {
      setResetLoading(false);
    }
  };

  const handleToggleStatus = useCallback(async (user: AuthUser) => {
    try {
      await toggleStatus({ id: user.id, isActive: !user.isActive }).unwrap();
      toast.success(user.isActive ? 'User deactivated' : 'User activated');
      refetch();
    } catch (_err: any) {
      const message = _err?.data?.message || _err?.message || 'Failed to update status';
      toast.error(message);
    }
  }, [toggleStatus, refetch]);

  const columns: DataColumn<AuthUser>[] = useMemo(() => [
    {
      key: 'fullName',
      label: 'User',
      minWidth: '200px',
      value: (row: AuthUser) => row.fullName,
      render: (row: AuthUser) => (
        <div className="flex items-center gap-3 py-1">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#2E7D5B] to-[#1E563F] text-sm font-bold text-white shadow-sm">
            {row.fullName ? row.fullName[0].toUpperCase() : 'U'}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-[#1F2A37] text-sm truncate">{row.fullName}</p>
            <p className="text-xs text-[#9CA3AF] truncate">@{row.username}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'email',
      label: 'Email Address',
      minWidth: '200px',
      value: (row: AuthUser) => row.email,
      render: (row: AuthUser) => (
        <span className="text-sm font-medium text-[#4B5563]">{row.email}</span>
      ),
    },
    {
      key: 'role',
      label: 'Role',
      minWidth: '120px',
      value: (row: AuthUser) => roleLabels[row.role] || row.role,
      render: (row: AuthUser) => (
        <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold', roleBadgeColors[row.role] || 'bg-gray-50 text-gray-700 border-gray-200')}>
          {roleLabels[row.role] || row.role}
        </span>
      ),
    },
    {
      key: 'payorIds',
      label: 'Payor Access',
      minWidth: '220px',
      value: (row: AuthUser) => row.payorIds.map((id) => payorNameMap.get(id) || id).join(', '),
      render: (row: AuthUser) => {
        const payorNames = row.payorIds.map((id) => payorNameMap.get(id) || id);
        if (payorNames.length === 0) {
          return <span className="text-xs text-[#9CA3AF] italic">No payor assigned</span>;
        }
        return (
          <div className="flex flex-wrap gap-1.5 py-0.5">
            {payorNames.map((name) => (
              <span
                key={name}
                className="inline-flex items-center gap-1 rounded-md bg-[#E7F4EE] px-2 py-1 text-[11px] font-medium text-[#2E7D5B] border border-[#C6E5D8]"
              >
                <Building2 className="h-3 w-3 shrink-0" />
                {name}
              </span>
            ))}
          </div>
        );
      },
    },
    {
      key: 'isActive',
      label: 'Status',
      minWidth: '100px',
      value: (row: AuthUser) => (row.isActive ? 'Active' : 'Inactive'),
      render: (row: AuthUser) => (
        <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold border', row.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200')}>
          <span className={cn('h-1.5 w-1.5 rounded-full', row.isActive ? 'bg-emerald-500' : 'bg-rose-500')} />
          {row.isActive ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      minWidth: '160px',
      align: 'center' as const,
      value: () => '',
      render: (row: AuthUser) => (
        <div className="flex items-center justify-center gap-1">
          {canUpdate && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openEditDialog(row)}
              className="h-8 w-8 p-0 text-[#4B5563] hover:bg-[#E7F4EE] hover:text-[#2E7D5B]"
              title="Edit User"
            >
              <Edit2 className="h-4 w-4" />
            </Button>
          )}
          {canUpdate && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleToggleStatus(row)}
              className={cn('h-8 w-8 p-0', row.isActive ? 'text-amber-600 hover:bg-amber-50 hover:text-amber-700' : 'text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700')}
              title={row.isActive ? 'Deactivate' : 'Activate'}
            >
              <Power className="h-4 w-4" />
            </Button>
          )}
          {canUpdate && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setResetConfirm(row.id)}
              className="h-8 w-8 p-0 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
              title="Reset Password"
            >
              <KeyRound className="h-4 w-4" />
            </Button>
          )}
          {canDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDeleteConfirm(row.id)}
              className="h-8 w-8 p-0 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
              title="Delete User"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ], [openEditDialog, handleToggleStatus, payorNameMap, canUpdate, canDelete]);

  if (isLoading) return <LoadingSpinner message="Loading user directory..." />;
  if (isError) return <ApiError onRetry={refetch} />;

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-white p-5 shadow-sm border border-[#E5E8EC]">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2E7D5B]/10 text-[#2E7D5B]">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-[#1F2A37]">User Management</h1>
            <p className="text-xs text-[#6B7280]">Directory of authorized team members, roles, and payor access</p>
          </div>
        </div>

        {canCreate && (
          <Button onClick={openCreateDialog} className="gap-2 bg-[#2E7D5B] hover:bg-[#245A47] text-white shadow-sm font-semibold rounded-lg">
            <UserPlus className="h-4 w-4" />
            Add New User
          </Button>
        )}
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm border border-[#E5E8EC]">
          <div>
            <p className="text-xs font-medium text-[#6B7280]">Total Users</p>
            <p className="text-2xl font-extrabold text-[#1F2A37] mt-1">{totalUsersCount}</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <Users className="h-5 w-5" />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm border border-[#E5E8EC]">
          <div>
            <p className="text-xs font-medium text-[#6B7280]">Active Accounts</p>
            <p className="text-2xl font-extrabold text-[#1F2A37] mt-1">{activeCount}</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <UserCheck className="h-5 w-5" />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm border border-[#E5E8EC]">
          <div>
            <p className="text-xs font-medium text-[#6B7280]">Inactive Accounts</p>
            <p className="text-2xl font-extrabold text-[#1F2A37] mt-1">{inactiveCount}</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
            <UserX className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-white p-4 shadow-sm border border-[#E5E8EC]">
        <div className="flex flex-1 flex-wrap items-center gap-3 min-w-[280px]">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search by name, username, or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 text-xs sm:text-sm border-[#E5E8EC] rounded-lg focus:border-[#2E7D5B]"
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[150px] text-xs sm:text-sm border-[#E5E8EC]">
              <SelectValue placeholder="All Roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Roles</SelectItem>
              {Object.values(ROLES).map((role) => (
                <SelectItem key={role} value={role}>{roleLabels[role]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] text-xs sm:text-sm border-[#E5E8EC]">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {canExport && (
          <ExportButton
            filename="user_directory.csv"
            getPayload={() => ({
              headers: ['Name', 'Username', 'Email', 'Role', 'Payor Access', 'Status'],
              rows: users.map((u) => [
                u.fullName,
                u.username,
                u.email,
                roleLabels[u.role] || u.role,
                u.payorIds.map((id) => payorNameMap.get(id) || id).join('; '),
                u.isActive ? 'Active' : 'Inactive',
              ]),
            })}
          />
        )}
      </div>

      {/* Main Table */}
      <div className="rounded-xl bg-white shadow-sm border border-[#E5E8EC] overflow-hidden">
        <DataTable<AuthUser>
          columns={columns}
          rows={users}
          rowKey={(row) => row.id}
          cellClassName="py-3.5"
        />

        {/* Pagination Footer */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#E5E8EC] bg-gray-50/50 p-4 text-xs sm:text-sm">
          <p className="text-[#6B7280]">
            Showing <span className="font-semibold text-[#1F2A37]">{((page - 1) * pageSize) + 1}</span>–<span className="font-semibold text-[#1F2A37]">{Math.min(page * pageSize, data?.total ?? 0)}</span> of <span className="font-semibold text-[#1F2A37]">{data?.total ?? 0}</span> users
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
            <span className="text-xs text-[#6B7280] font-medium px-2">Page {page} of {totalPages}</span>
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
      </div>

      {/* Create/Edit Modal */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[520px] rounded-xl p-6">
          <DialogHeader className="pb-3 border-b border-gray-100">
            <DialogTitle className="text-lg font-bold text-[#1F2A37] flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-[#2E7D5B]" />
              {editingUser ? 'Edit User Profile' : 'Create New User'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <label className="mb-1.5 block text-xs font-bold text-[#4B5563]">Full Name</label>
              <Input
                placeholder="e.g. John Doe"
                value={form.fullName}
                onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                className="text-sm border-[#E5E8EC]"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold text-[#4B5563]">Username</label>
              <Input
                placeholder="e.g. johndoe"
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                className="text-sm border-[#E5E8EC]"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold text-[#4B5563]">Email Address</label>
              <Input
                type="email"
                placeholder="e.g. john@admedika.co.id"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="text-sm border-[#E5E8EC]"
              />
            </div>
            {!editingUser && (
              <div>
                <label className="mb-1.5 block text-xs font-bold text-[#4B5563]">Initial Password</label>
                <Input
                  type="password"
                  placeholder="Enter initial password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  className="text-sm border-[#E5E8EC]"
                />
              </div>
            )}
            <div>
              <label className="mb-1.5 block text-xs font-bold text-[#4B5563]">Role Assignment</label>
              <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v as Role }))}>
                <SelectTrigger className="text-sm border-[#E5E8EC]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(ROLES).map((role) => (
                    <SelectItem key={role} value={role}>{roleLabels[role]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold text-[#4B5563]">Payor Access Permissions</label>
              <div className="max-h-36 overflow-y-auto rounded-lg border border-[#E5E8EC] p-3 space-y-2 bg-gray-50/50">
                {payorsData?.data?.map((payor) => (
                  <label key={payor.id} className="flex items-center gap-2 text-xs font-medium text-[#1F2A37] cursor-pointer hover:text-[#2E7D5B]">
                    <input
                      type="checkbox"
                      checked={form.payorIds.includes(payor.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setForm((f) => ({ ...f, payorIds: [...f.payorIds, payor.id] }));
                        } else {
                          setForm((f) => ({ ...f, payorIds: f.payorIds.filter((id) => id !== payor.id) }));
                        }
                      }}
                      className="rounded border-gray-300 text-[#2E7D5B] focus:ring-[#2E7D5B]"
                    />
                    <span>{payor.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="border-t border-gray-100 pt-3">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="text-xs">Cancel</Button>
            <Button onClick={handleSubmit} className="bg-[#2E7D5B] hover:bg-[#245A47] text-white text-xs font-semibold">
              {editingUser ? 'Save Changes' : 'Create User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
        title="Delete User"
        description="Are you sure you want to delete this user? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => deleteConfirm && handleDelete(deleteConfirm)}
      />

      {/* Reset Password Confirmation */}
      <ConfirmDialog
        open={!!resetConfirm}
        onOpenChange={(open) => !open && setResetConfirm(null)}
        title="Reset Password"
        description="Are you sure you want to reset this user's password? A new secure temporary password will be generated and shown to you once."
        confirmLabel="Reset Password"
        loading={resetLoading}
        onConfirm={() => resetConfirm && handleResetPassword(resetConfirm)}
      />

      {/* Reset Password Result — show generated password once */}
      <Dialog open={!!resetResult} onOpenChange={(open) => !open && setResetResult(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-blue-600" />
              Temporary Password Generated
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              The user's password has been reset. Copy this temporary password and share it with the user securely.
            </p>
            <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3">
              <code className="flex-1 select-all text-lg font-mono font-semibold tracking-wide text-blue-900">
                {resetResult}
              </code>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 shrink-0"
                onClick={() => {
                  if (resetResult) {
                    navigator.clipboard.writeText(resetResult);
                    toast.success('Password copied to clipboard');
                  }
                }}
                title="Copy password"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                <strong>Security warning:</strong> This password is shown only once. Copy it now — it cannot be retrieved again. The user should change it after logging in via Settings → Security.
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setResetResult(null)}>
              <Check className="mr-2 h-4 w-4" />
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}