/**
 * Payor Management Page — International standard minimalist & professional design.
 */
import { useState, useCallback, useMemo } from 'react';
import {
  useGetPayorsQuery,
  useCreatePayorMutation,
  useUpdatePayorMutation,
  useDeletePayorMutation,
} from '@/entities/payor/api/payorApi';
import type { Payor } from '@/shared/types';
import type { CreatePayorPayload } from '@/entities/payor/model/payorTypes';
import type { PayorCategory } from '@/shared/types';
import LoadingSpinner from '@/shared/components/loading/LoadingSpinner';
import ApiError from '@/shared/components/error/ApiError';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/shared/ui/dialog';
import { Plus, Search, Edit2, Trash2, Building, CheckCircle, AlertCircle } from 'lucide-react';
import { useHasPermission } from '@/entities/auth';
import ConfirmDialog from '@/shared/components/common/ConfirmDialog';
import { toast } from 'sonner';
import { cn } from '@/shared/lib/utils';

export default function PayorManagement() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPayor, setEditingPayor] = useState<Payor | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const [form, setForm] = useState<CreatePayorPayload>({
    name: '',
    code: '',
    category: 'INDEMNITY' as PayorCategory,
    description: '',
    isActive: true,
  });

  const { data, isLoading, isError, refetch } = useGetPayorsQuery({
    page,
    pageSize: 10,
    search: debouncedSearch,
  });

  const [createPayor] = useCreatePayorMutation();
  const [updatePayor] = useUpdatePayorMutation();
  const [deletePayor] = useDeletePayorMutation();

  const canCreate = useHasPermission('cms-payors', 'create');
  const canUpdate = useHasPermission('cms-payors', 'update');
  const canDelete = useHasPermission('cms-payors', 'delete');

  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    const timer = setTimeout(() => setDebouncedSearch(value), 300);
    return () => clearTimeout(timer);
  }, []);

  const openCreateDialog = () => {
    setEditingPayor(null);
    setForm({ name: '', code: '', category: 'INDEMNITY' as PayorCategory, description: '', isActive: true });
    setDialogOpen(true);
  };

  const openEditDialog = (payor: Payor) => {
    setEditingPayor(payor);
    setForm({ name: payor.name, code: payor.code, category: payor.category, description: payor.description || '', isActive: payor.isActive });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    try {
      if (editingPayor) {
        await updatePayor({ id: editingPayor.id, body: form }).unwrap();
        toast.success('Payor updated successfully');
      } else {
        await createPayor(form).unwrap();
        toast.success('Payor created successfully');
      }
      setDialogOpen(false);
      refetch();
    } catch (_err: any) {
      const message = _err?.data?.message || _err?.message || 'Failed to save payor';
      toast.error(message);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deletePayor(id).unwrap();
      setDeleteConfirm(null);
      toast.success('Payor deleted successfully');
      refetch();
    } catch (_err: any) {
      const message = _err?.data?.message || _err?.message || 'Failed to delete payor';
      toast.error(message);
    }
  };

  const payors = data?.data ?? [];
  const totalPages = data?.totalPages ?? 1;
  const activeCount = useMemo(() => payors.filter((p) => p.isActive).length, [payors]);
  const inactiveCount = useMemo(() => payors.filter((p) => !p.isActive).length, [payors]);

  if (isLoading) return <LoadingSpinner message="Loading payor directory..." />;
  if (isError) return <ApiError onRetry={refetch} />;

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-white p-5 shadow-sm border border-[#E5E8EC]">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2E7D5B]/10 text-[#2E7D5B]">
            <Building className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-[#1F2A37]">Payor Management</h1>
            <p className="text-xs text-[#6B7280]">Directory of insurance payors, client codes, and status configurations</p>
          </div>
        </div>

        {canCreate && (
          <Button onClick={openCreateDialog} className="gap-2 bg-[#2E7D5B] hover:bg-[#245A47] text-white shadow-sm font-semibold rounded-lg">
            <Plus className="h-4 w-4" />
            Add New Payor
          </Button>
        )}
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm border border-[#E5E8EC]">
          <div>
            <p className="text-xs font-medium text-[#6B7280]">Total Payors</p>
            <p className="text-2xl font-extrabold text-[#1F2A37] mt-1">{data?.total ?? payors.length}</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <Building className="h-5 w-5" />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm border border-[#E5E8EC]">
          <div>
            <p className="text-xs font-medium text-[#6B7280]">Active Partners</p>
            <p className="text-2xl font-extrabold text-[#1F2A37] mt-1">{activeCount}</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <CheckCircle className="h-5 w-5" />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm border border-[#E5E8EC]">
          <div>
            <p className="text-xs font-medium text-[#6B7280]">Inactive / Suspended</p>
            <p className="text-2xl font-extrabold text-[#1F2A37] mt-1">{inactiveCount}</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
            <AlertCircle className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-white p-4 shadow-sm border border-[#E5E8EC]">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search by payor name or code..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-10 text-xs sm:text-sm border-[#E5E8EC] rounded-lg focus:border-[#2E7D5B]"
          />
        </div>
        <span className="text-xs font-medium text-[#6B7280]">
          Showing <strong className="text-[#1F2A37]">{payors.length}</strong> insurance partners
        </span>
      </div>

      {/* Payor Cards Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {payors.map((payor) => (
          <div
            key={payor.id}
            className="flex flex-col justify-between rounded-xl bg-white p-5 shadow-sm border border-[#E5E8EC] transition-all hover:shadow-md"
          >
            <div>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#2E7D5B] to-[#1E563F] text-sm font-bold text-white shadow-sm">
                    {payor.name ? payor.name[0].toUpperCase() : 'P'}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#1F2A37]">{payor.name}</h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="inline-block rounded bg-gray-100 px-2 py-0.5 text-[11px] font-mono font-semibold text-gray-600 border border-gray-200">
                        CODE: {payor.code}
                      </span>
                      <span
                        className={cn(
                          'inline-block rounded px-2 py-0.5 text-[11px] font-semibold border',
                          payor.category === 'INDEMNITY'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200',
                        )}
                      >
                        {payor.category === 'INDEMNITY' ? 'Indemnity' : 'Manage Care'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {canUpdate && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(payor)}
                      className="h-8 w-8 p-0 text-[#4B5563] hover:bg-[#E7F4EE] hover:text-[#2E7D5B]"
                      title="Edit Payor"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  )}
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteConfirm(payor.id)}
                      className="h-8 w-8 p-0 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                      title="Delete Payor"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              {payor.description && (
                <p className="mt-3 text-xs text-[#6B7280] line-clamp-2 leading-relaxed">
                  {payor.description}
                </p>
              )}
            </div>

            <div className="mt-4 border-t border-gray-100 pt-3 flex items-center justify-between">
              <span className="text-[11px] text-[#9CA3AF] font-medium">Integration Status</span>
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold border',
                  payor.isActive
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border-rose-200',
                )}
              >
                <span className={cn('h-1.5 w-1.5 rounded-full', payor.isActive ? 'bg-emerald-500' : 'bg-rose-500')} />
                {payor.isActive ? 'Active Partner' : 'Inactive'}
              </span>
            </div>
          </div>
        ))}

        {payors.length === 0 && (
          <div className="col-span-full rounded-xl border border-dashed border-gray-200 bg-white py-12 text-center text-sm text-[#9CA3AF]">
            No payors found matching search criteria
          </div>
        )}
      </div>

      {/* Pagination Footer */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-white p-4 shadow-sm border border-[#E5E8EC] text-xs sm:text-sm">
        <p className="text-[#6B7280]">
          Showing <span className="font-semibold text-[#1F2A37]">{((page - 1) * 10) + 1}</span>–<span className="font-semibold text-[#1F2A37]">{Math.min(page * 10, data?.total ?? 0)}</span> of <span className="font-semibold text-[#1F2A37]">{data?.total ?? 0}</span> payors
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

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[480px] rounded-xl p-6">
          <DialogHeader className="pb-3 border-b border-gray-100">
            <DialogTitle className="text-lg font-bold text-[#1F2A37] flex items-center gap-2">
              <Building className="h-5 w-5 text-[#2E7D5B]" />
              {editingPayor ? 'Edit Insurance Payor' : 'Create New Payor'}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div>
              <label className="mb-1.5 block text-xs font-bold text-[#4B5563]">Payor Name</label>
              <Input
                placeholder="e.g. PT Asuransi Jiwa Nusantara"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="text-sm border-[#E5E8EC]"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold text-[#4B5563]">Payor Client Code</label>
              <Input
                placeholder="e.g. CH0022"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                className="text-sm border-[#E5E8EC] font-mono"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold text-[#4B5563]">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as PayorCategory }))}
                className="w-full rounded-lg border border-[#E5E8EC] bg-white px-3 py-2 text-sm text-[#1F2A37] focus:border-[#2E7D5B] focus:outline-none focus:ring-1 focus:ring-[#2E7D5B]"
              >
                <option value="INDEMNITY">Indemnity</option>
                <option value="MANAGE_CARE">Manage Care</option>
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold text-[#4B5563]">Description / Remarks</label>
              <Input
                placeholder="Optional notes or partner details"
                value={form.description || ''}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="text-sm border-[#E5E8EC]"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <input
                type="checkbox"
                id="payorActiveToggle"
                checked={form.isActive}
                onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                className="h-4 w-4 rounded border-gray-300 text-[#2E7D5B] focus:ring-[#2E7D5B]"
              />
              <label htmlFor="payorActiveToggle" className="text-xs font-semibold text-[#1F2A37] cursor-pointer">
                Active Partner (Enable data access & claims integration)
              </label>
            </div>
          </div>

          <DialogFooter className="border-t border-gray-100 pt-3">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="text-xs">Cancel</Button>
            <Button onClick={handleSubmit} className="bg-[#2E7D5B] hover:bg-[#245A47] text-white text-xs font-semibold">
              {editingPayor ? 'Save Changes' : 'Create Payor'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
        title="Delete Payor"
        description="Are you sure you want to delete this payor? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => deleteConfirm && handleDelete(deleteConfirm)}
      />
    </div>
  );
}