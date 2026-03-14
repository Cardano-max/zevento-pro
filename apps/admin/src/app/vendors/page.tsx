'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';

interface Vendor {
  id: string;
  businessName: string;
  status: string;
  city: string;
  vendorRole: string;
  phone: string;
}

interface VendorListResponse {
  data: Vendor[];
  total: number;
  page: number;
  limit: number;
}

const statusBadge: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  PENDING_KYC: 'bg-amber-100 text-amber-700',
  KYC_SUBMITTED: 'bg-blue-100 text-blue-700',
  SUSPENDED: 'bg-red-100 text-red-700',
  REJECTED: 'bg-red-100 text-red-700',
  INACTIVE: 'bg-slate-100 text-slate-600',
};

export default function VendorsPage() {
  const router = useRouter();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const limit = 20;

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (statusFilter) params.set('status', statusFilter);

    api<VendorListResponse>(`/admin/vendors?${params}`)
      .then((res) => {
        setVendors(res.data);
        setTotal(res.total);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [page, statusFilter]);

  const totalPages = Math.ceil(total / limit);

  return (
    <AdminLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Vendors</h1>
          <p className="text-sm text-slate-500">{total} vendor{total !== 1 ? 's' : ''} registered</p>
        </div>
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

      <div className="rounded-xl border border-slate-200 bg-white">
        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
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
                  </tr>
                </thead>
                <tbody>
                  {vendors.map((vendor) => (
                    <tr
                      key={vendor.id}
                      onClick={() => router.push(`/vendors/${vendor.id}`)}
                      className="cursor-pointer border-b border-slate-50 transition-colors hover:bg-slate-50"
                    >
                      <td className="px-6 py-3 font-medium text-slate-900">
                        {vendor.businessName}
                      </td>
                      <td className="px-6 py-3 text-slate-600">{vendor.vendorRole}</td>
                      <td className="px-6 py-3 text-slate-600">{vendor.city}</td>
                      <td className="px-6 py-3 text-slate-600">{vendor.phone}</td>
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
                    </tr>
                  ))}
                  {vendors.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
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
