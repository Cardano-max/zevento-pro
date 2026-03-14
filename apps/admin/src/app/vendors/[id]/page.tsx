'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, LoaderCircle, CircleCheck, CircleX, Ban, RotateCcw } from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format';

interface VendorDetail {
  id: string;
  businessName: string;
  status: string;
  city: string;
  state: string;
  vendorRole: string;
  phone: string;
  email: string;
  address: string;
  description: string;
  createdAt: string;
  kyc: {
    id: string;
    status: string;
    panNumber: string;
    gstNumber: string;
    bankAccountNumber: string;
    bankIfsc: string;
    documentsUrl: string;
    submittedAt: string;
    reviewedAt: string | null;
    rejectionReason: string | null;
  } | null;
}

export default function VendorDetailPage() {
  const params = useParams();
  const router = useRouter();
  const vendorId = params.id as string;

  const [vendor, setVendor] = useState<VendorDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [kycDecision, setKycDecision] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
  const [rejectionReason, setRejectionReason] = useState('');
  const [kycLoading, setKycLoading] = useState(false);
  const [kycMessage, setKycMessage] = useState('');

  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState('');

  useEffect(() => {
    api<VendorDetail>(`/admin/vendors/${vendorId}`)
      .then(setVendor)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [vendorId]);

  async function handleKycReview(e: React.FormEvent) {
    e.preventDefault();
    setKycLoading(true);
    setKycMessage('');

    try {
      await api(`/admin/vendors/${vendorId}/kyc-review`, {
        method: 'POST',
        body: JSON.stringify({
          decision: kycDecision,
          ...(kycDecision === 'REJECTED' ? { rejectionReason } : {}),
        }),
      });
      setKycMessage(`KYC ${kycDecision.toLowerCase()} successfully`);
      const updated = await api<VendorDetail>(`/admin/vendors/${vendorId}`);
      setVendor(updated);
    } catch (err) {
      setKycMessage(err instanceof Error ? err.message : 'KYC review failed');
    } finally {
      setKycLoading(false);
    }
  }

  async function handleSuspend() {
    setActionLoading(true);
    setActionMessage('');
    try {
      await api(`/admin/vendors/${vendorId}/suspend`, { method: 'PATCH' });
      setActionMessage('Vendor suspended');
      const updated = await api<VendorDetail>(`/admin/vendors/${vendorId}`);
      setVendor(updated);
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : 'Failed to suspend');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReactivate() {
    setActionLoading(true);
    setActionMessage('');
    try {
      await api(`/admin/vendors/${vendorId}/reactivate`, { method: 'PATCH' });
      setActionMessage('Vendor reactivated');
      const updated = await api<VendorDetail>(`/admin/vendors/${vendorId}`);
      setVendor(updated);
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : 'Failed to reactivate');
    } finally {
      setActionLoading(false);
    }
  }

  const statusBadge: Record<string, string> = {
    ACTIVE: 'bg-green-100 text-green-700',
    PENDING_KYC: 'bg-amber-100 text-amber-700',
    KYC_SUBMITTED: 'bg-blue-100 text-blue-700',
    SUSPENDED: 'bg-red-100 text-red-700',
    REJECTED: 'bg-red-100 text-red-700',
    INACTIVE: 'bg-slate-100 text-slate-600',
  };

  return (
    <AdminLayout>
      <button
        onClick={() => router.push('/vendors')}
        className="mb-4 flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Vendors
      </button>

      {loading && (
        <div className="flex h-64 items-center justify-center">
          <LoaderCircle className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {vendor && (
        <div className="space-y-6">
          {/* Vendor Info Header */}
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">{vendor.businessName}</h1>
                <p className="mt-1 text-sm text-slate-500">{vendor.vendorRole}</p>
              </div>
              <span
                className={cn(
                  'inline-flex rounded-full px-3 py-1 text-xs font-medium',
                  statusBadge[vendor.status] || 'bg-slate-100 text-slate-600'
                )}
              >
                {vendor.status.replace(/_/g, ' ')}
              </span>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <InfoField label="Phone" value={vendor.phone} />
              <InfoField label="Email" value={vendor.email || '-'} />
              <InfoField label="City" value={`${vendor.city}, ${vendor.state}`} />
              <InfoField label="Address" value={vendor.address || '-'} />
              <InfoField label="Registered" value={formatDate(vendor.createdAt)} />
              <InfoField label="Vendor ID" value={vendor.id} mono />
            </div>

            {vendor.description && (
              <div className="mt-4">
                <span className="text-xs font-medium text-slate-400 uppercase">Description</span>
                <p className="mt-1 text-sm text-slate-700">{vendor.description}</p>
              </div>
            )}
          </div>

          {/* Vendor Actions */}
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Actions</h2>
            <div className="flex flex-wrap gap-3">
              {vendor.status !== 'SUSPENDED' && (
                <button
                  onClick={handleSuspend}
                  disabled={actionLoading}
                  className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                >
                  {actionLoading ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <Ban className="h-4 w-4" />
                  )}
                  Suspend Vendor
                </button>
              )}
              {vendor.status === 'SUSPENDED' && (
                <button
                  onClick={handleReactivate}
                  disabled={actionLoading}
                  className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
                >
                  {actionLoading ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <RotateCcw className="h-4 w-4" />
                  )}
                  Reactivate Vendor
                </button>
              )}
            </div>
            {actionMessage && (
              <p className="mt-3 text-sm text-slate-600">{actionMessage}</p>
            )}
          </div>

          {/* KYC Section */}
          {vendor.kyc && (
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">KYC Details</h2>

              <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <InfoField label="KYC Status" value={vendor.kyc.status.replace(/_/g, ' ')} />
                <InfoField label="PAN Number" value={vendor.kyc.panNumber || '-'} mono />
                <InfoField label="GST Number" value={vendor.kyc.gstNumber || '-'} mono />
                <InfoField label="Bank Account" value={vendor.kyc.bankAccountNumber || '-'} mono />
                <InfoField label="Bank IFSC" value={vendor.kyc.bankIfsc || '-'} mono />
                <InfoField label="Submitted" value={vendor.kyc.submittedAt ? formatDate(vendor.kyc.submittedAt) : '-'} />
                {vendor.kyc.reviewedAt && (
                  <InfoField label="Reviewed" value={formatDate(vendor.kyc.reviewedAt)} />
                )}
                {vendor.kyc.rejectionReason && (
                  <InfoField label="Rejection Reason" value={vendor.kyc.rejectionReason} />
                )}
              </div>

              {(vendor.kyc.status === 'SUBMITTED' || vendor.kyc.status === 'PENDING') && (
                <form onSubmit={handleKycReview} className="border-t border-slate-100 pt-4">
                  <h3 className="mb-3 text-sm font-semibold text-slate-700">Review KYC</h3>
                  <div className="flex flex-wrap items-end gap-4">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-500">Decision</label>
                      <select
                        value={kycDecision}
                        onChange={(e) => setKycDecision(e.target.value as 'APPROVED' | 'REJECTED')}
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      >
                        <option value="APPROVED">Approve</option>
                        <option value="REJECTED">Reject</option>
                      </select>
                    </div>

                    {kycDecision === 'REJECTED' && (
                      <div className="flex-1">
                        <label className="mb-1 block text-xs font-medium text-slate-500">
                          Rejection Reason
                        </label>
                        <input
                          type="text"
                          value={rejectionReason}
                          onChange={(e) => setRejectionReason(e.target.value)}
                          required
                          placeholder="Reason for rejection"
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={kycLoading}
                      className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {kycLoading ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                      ) : kycDecision === 'APPROVED' ? (
                        <CircleCheck className="h-4 w-4" />
                      ) : (
                        <CircleX className="h-4 w-4" />
                      )}
                      Submit Review
                    </button>
                  </div>

                  {kycMessage && (
                    <p className="mt-3 text-sm text-slate-600">{kycMessage}</p>
                  )}
                </form>
              )}
            </div>
          )}
        </div>
      )}
    </AdminLayout>
  );
}

function InfoField({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <span className="text-xs font-medium uppercase text-slate-400">{label}</span>
      <p className={cn('mt-0.5 text-sm text-slate-700', mono && 'font-mono')}>{value}</p>
    </div>
  );
}
