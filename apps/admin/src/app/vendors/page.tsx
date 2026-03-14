'use client';

import { useEffect, useState } from 'react';
import { LoaderCircle, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Search } from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';

interface Vendor {
  id: string;
  businessName: string;
  status: string;
  city: string;
  role: string;
  onboardingStep?: string;
  subscriptionPlan?: { name?: string };
  user?: { phone?: string; name?: string; email?: string };
}

interface VendorListResponse {
  data: Vendor[];
  total: number;
  page: number;
  totalPages: number;
}

const statusBadge: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  PENDING_KYC: 'bg-amber-100 text-amber-700',
  KYC_SUBMITTED: 'bg-blue-100 text-blue-700',
  SUSPENDED: 'bg-red-100 text-red-700',
  REJECTED: 'bg-red-100 text-red-700',
  INACTIVE: 'bg-slate-100 text-slate-600',
};

type ConfirmAction = { vendorId: string; action: 'approve' | 'suspend' | 'reject' } | null;

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [filtered, setFiltered] = useState<Vendor[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');
  const limit = 20;

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (statusFilter) params.set('status', statusFilter);

    api<VendorListResponse>(`/admin/vendors?${params}`)
      .then((res) => {
        setVendors(res.data);
        setTotal(res.total);
        setFiltered(res.data);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [page, statusFilter]);

  // Client-side search filter
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFiltered(vendors);
      return;
    }
    const q = searchQuery.toLowerCase();
    setFiltered(
      vendors.filter(
        (v) =>
          v.businessName.toLowerCase().includes(q) ||
          (v.city ?? '').toLowerCase().includes(q) ||
          (v.user?.phone ?? '').includes(q) ||
          (v.user?.name ?? '').toLowerCase().includes(q)
      )
    );
  }, [searchQuery, vendors]);

  const totalPages = Math.ceil(total / limit);

  async function handleAction() {
    if (!confirmAction) return;
    setActionLoading(true);
    setActionError('');

    const { vendorId, action } = confirmAction;
    const endpoint =
      action === 'approve'
        ? `/admin/vendors/${vendorId}/reactivate`
        : action === 'suspend'
        ? `/admin/vendors/${vendorId}/suspend`
        : `/admin/vendors/${vendorId}/kyc-review`;

    try {
      if (action === 'reject') {
        await api(`/admin/vendors/${vendorId}/kyc-review`, {
          method: 'POST',
          body: JSON.stringify({ action: 'REJECT', adminNote: 'Rejected by admin' }),
        });
      } else {
        await api(endpoint, { method: 'PATCH' });
      }
      // Re-fetch current page
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (statusFilter) params.set('status', statusFilter);
      const res = await api<VendorListResponse>(`/admin/vendors?${params}`);
      setVendors(res.data);
      setTotal(res.total);
      setConfirmAction(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActionLoading(false);
    }
  }

  const actionLabels: Record<string, { label: string; color: string }> = {
    approve: { label: 'Approve', color: 'bg-green-600 hover:bg-green-700' },
    suspend: { label: 'Suspend', color: 'bg-amber-600 hover:bg-amber-700' },
    reject: { label: 'Reject', color: 'bg-red-600 hover:bg-red-700' },
  };

  return (
    <AdminLayout>
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900">Vendors</h1>
          <p className="text-sm text-slate-500">{total} vendor{total !== 1 ? 's' : ''} registered</p>
        </div>

        {/* Search */}
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Search className="h-4 w-4 text-slate-400" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search vendors..."
            className="w-56 rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        >
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="PENDING_KYC">Pending KYC</option>
          <option value="KYC_SUBMITTED">KYC Submitted</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Confirmation Dialog */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Confirm Action</h3>
            <p className="text-sm text-slate-600 mb-4">
              Are you sure you want to{' '}
              <span className="font-medium">{confirmAction.action}</span> this vendor?
            </p>
            {actionError && (
              <p className="mb-3 text-sm text-red-600">{actionError}</p>
            )}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setConfirmAction(null); setActionError(''); }}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAction}
                disabled={actionLoading}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50',
                  actionLabels[confirmAction.action]?.color
                )}
              >
                {actionLoading && <LoaderCircle className="h-4 w-4 animate-spin" />}
                {actionLabels[confirmAction.action]?.label}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white">
        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <LoaderCircle className="h-6 w-6 animate-spin text-indigo-600" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="px-6 py-3 text-left font-medium text-slate-500">Business Name</th>
                    <th className="px-6 py-3 text-left font-medium text-slate-500">Role</th>
                    <th className="px-6 py-3 text-left font-medium text-slate-500">City</th>
                    <th className="px-6 py-3 text-left font-medium text-slate-500">Phone</th>
                    <th className="px-6 py-3 text-left font-medium text-slate-500">Status</th>
                    <th className="px-6 py-3 text-left font-medium text-slate-500">Actions</th>
                    <th className="px-6 py-3 w-8" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((vendor) => (
                    <>
                      <tr
                        key={vendor.id}
                        className="border-b border-slate-50 hover:bg-slate-50/50"
                      >
                        <td className="px-6 py-3 font-medium text-slate-900">
                          {vendor.businessName}
                        </td>
                        <td className="px-6 py-3 text-slate-600">{vendor.role}</td>
                        <td className="px-6 py-3 text-slate-600">{vendor.city}</td>
                        <td className="px-6 py-3 text-slate-600">{vendor.user?.phone ?? '—'}</td>
                        <td className="px-6 py-3">
                          <span
                            className={cn(
                              'inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium',
                              statusBadge[vendor.status] || 'bg-slate-100 text-slate-600'
                            )}
                          >
                            {vendor.status.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-3">
                          <div className="flex gap-1.5">
                            <button
                              onClick={(e) => { e.stopPropagation(); setConfirmAction({ vendorId: vendor.id, action: 'approve' }); }}
                              className="rounded px-2 py-1 text-xs font-medium bg-green-100 text-green-700 hover:bg-green-200"
                            >
                              Approve
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setConfirmAction({ vendorId: vendor.id, action: 'suspend' }); }}
                              className="rounded px-2 py-1 text-xs font-medium bg-amber-100 text-amber-700 hover:bg-amber-200"
                            >
                              Suspend
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setConfirmAction({ vendorId: vendor.id, action: 'reject' }); }}
                              className="rounded px-2 py-1 text-xs font-medium bg-red-100 text-red-700 hover:bg-red-200"
                            >
                              Reject
                            </button>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <button
                            onClick={() => setExpandedId(expandedId === vendor.id ? null : vendor.id)}
                            className="text-slate-400 hover:text-slate-700"
                          >
                            {expandedId === vendor.id ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </button>
                        </td>
                      </tr>
                      {expandedId === vendor.id && (
                        <tr key={`${vendor.id}-detail`} className="border-b border-slate-100 bg-slate-50/30">
                          <td colSpan={7} className="px-6 py-4">
                            <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm sm:grid-cols-4">
                              <DetailField label="Name" value={vendor.user?.name ?? '—'} />
                              <DetailField label="Email" value={vendor.user?.email ?? '—'} />
                              <DetailField label="Phone" value={vendor.user?.phone ?? '—'} />
                              <DetailField label="City" value={vendor.city} />
                              <DetailField label="Role" value={vendor.role} />
                              <DetailField label="Onboarding Step" value={vendor.onboardingStep ?? '—'} />
                              <DetailField label="Subscription" value={vendor.subscriptionPlan?.name ?? 'None'} />
                              <DetailField label="Status" value={vendor.status.replace(/_/g, ' ')} />
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                        No vendors found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-100 px-6 py-3">
                <span className="text-sm text-slate-500">
                  Page {page} of {totalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Prev
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</span>
      <p className="mt-0.5 text-slate-700">{value}</p>
    </div>
  );
}
