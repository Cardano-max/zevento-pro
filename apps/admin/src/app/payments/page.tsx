'use client';

import { useEffect, useState } from 'react';
import { Loader2, ChevronLeft, ChevronRight, IndianRupee, AlertTriangle, CheckCircle } from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import { api } from '@/lib/api';
import { formatPaise, formatDate } from '@/lib/format';
import { cn } from '@/lib/cn';

interface Payment {
  id: string;
  type: string;
  amountPaise: number;
  commissionPaise: number;
  payoutStatus: string;
  createdAt: string;
  vendorName: string;
}

interface PaymentListResponse {
  data: Payment[];
  total: number;
  page: number;
  limit: number;
}

interface ReconciliationSummary {
  totalCollected: number;
  totalCommission: number;
  totalPaidOut: number;
  pendingPayout: number;
}

const payoutBadge: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  PROCESSING: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-green-100 text-green-700',
  FAILED: 'bg-red-100 text-red-700',
};

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const limit = 20;

  const [recon, setRecon] = useState<ReconciliationSummary | null>(null);
  const [reconLoading, setReconLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api<PaymentListResponse>(`/admin/payments?page=${page}&limit=${limit}`)
      .then((res) => {
        setPayments(res.data);
        setTotal(res.total);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [page]);

  useEffect(() => {
    api<ReconciliationSummary>('/admin/payments/reconciliation')
      .then(setRecon)
      .catch(() => {})
      .finally(() => setReconLoading(false));
  }, []);

  const totalPages = Math.ceil(total / limit);

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Payments</h1>
        <p className="text-sm text-slate-500">Payment transactions and reconciliation</p>
      </div>

      {/* Reconciliation Summary */}
      {reconLoading ? (
        <div className="mb-6 flex h-24 items-center justify-center rounded-xl border border-slate-200 bg-white">
          <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
        </div>
      ) : recon ? (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <ReconCard
            title="Total Collected"
            value={formatPaise(recon.totalCollected)}
            icon={IndianRupee}
            color="bg-blue-50 text-blue-600"
          />
          <ReconCard
            title="Total Commission"
            value={formatPaise(recon.totalCommission)}
            icon={IndianRupee}
            color="bg-indigo-50 text-indigo-600"
          />
          <ReconCard
            title="Paid Out"
            value={formatPaise(recon.totalPaidOut)}
            icon={CheckCircle}
            color="bg-green-50 text-green-600"
          />
          <ReconCard
            title="Pending Payout"
            value={formatPaise(recon.pendingPayout)}
            icon={AlertTriangle}
            color="bg-amber-50 text-amber-600"
          />
        </div>
      ) : null}

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Payments Table */}
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
                    <th className="px-6 py-3 text-left font-medium text-slate-500">Type</th>
                    <th className="px-6 py-3 text-left font-medium text-slate-500">Vendor</th>
                    <th className="px-6 py-3 text-right font-medium text-slate-500">Amount</th>
                    <th className="px-6 py-3 text-right font-medium text-slate-500">Commission</th>
                    <th className="px-6 py-3 text-left font-medium text-slate-500">Payout Status</th>
                    <th className="px-6 py-3 text-left font-medium text-slate-500">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.id} className="border-b border-slate-50">
                      <td className="px-6 py-3 font-medium text-slate-900">{payment.type}</td>
                      <td className="px-6 py-3 text-slate-600">{payment.vendorName}</td>
                      <td className="px-6 py-3 text-right font-medium text-slate-900">
                        {formatPaise(payment.amountPaise)}
                      </td>
                      <td className="px-6 py-3 text-right text-slate-600">
                        {formatPaise(payment.commissionPaise)}
                      </td>
                      <td className="px-6 py-3">
                        <span
                          className={cn(
                            'inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium',
                            payoutBadge[payment.payoutStatus] || 'bg-slate-100 text-slate-600'
                          )}
                        >
                          {payment.payoutStatus}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-slate-600">
                        {formatDate(payment.createdAt)}
                      </td>
                    </tr>
                  ))}
                  {payments.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                        No payments found
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

function ReconCard({
  title,
  value,
  icon: Icon,
  color,
}: {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">{title}</p>
          <p className="mt-1 text-xl font-bold text-slate-900">{value}</p>
        </div>
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', color)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
