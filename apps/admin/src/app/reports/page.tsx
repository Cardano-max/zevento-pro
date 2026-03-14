'use client';

import { useEffect, useState } from 'react';
import { LoaderCircle, ChevronLeft, ChevronRight, Flag } from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/cn';

interface Report {
  id: string;
  targetType: string;
  targetId: string;
  reason: string;
  status: string;
  adminNote?: string;
  createdAt: string;
  reporter?: { name?: string; phone?: string };
  reporterId?: string;
}

interface ReportListResponse {
  data: Report[];
  total?: number;
  pagination?: { page: number; limit: number; total: number; totalPages: number };
}

const statusBadge: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  REVIEWED: 'bg-blue-100 text-blue-700',
  ACTIONED: 'bg-green-100 text-green-700',
  DISMISSED: 'bg-slate-100 text-slate-500',
};

type StatusFilter = '' | 'PENDING' | 'REVIEWED' | 'ACTIONED' | 'DISMISSED';

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [actioningId, setActioningId] = useState<string | null>(null);
  const limit = 20;

  function fetchReports() {
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (statusFilter) params.set('status', statusFilter);

    api<ReportListResponse | Report[]>(`/admin/reports?${params}`)
      .then((res) => {
        if (Array.isArray(res)) {
          setReports(res);
          setTotal(res.length);
          setTotalPages(1);
        } else {
          const data = (res as ReportListResponse).data ?? [];
          const pagination = (res as ReportListResponse).pagination;
          setReports(data);
          setTotal(pagination?.total ?? (res as ReportListResponse).total ?? data.length);
          setTotalPages(pagination?.totalPages ?? 1);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter]);

  const pendingCount = reports.filter((r) => r.status === 'PENDING').length;

  async function updateStatus(id: string, status: string, adminNote?: string) {
    setActioningId(id);
    try {
      const updatedReport = await api<Report>(`/admin/reports/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, adminNote: adminNote ?? '' }),
      });
      setReports((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...updatedReport } : r))
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActioningId(null);
    }
  }

  function getReporterName(report: Report) {
    return report.reporter?.name ?? report.reporter?.phone ?? report.reporterId ?? 'Unknown';
  }

  return (
    <AdminLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
          <p className="text-sm text-slate-500">
            {total} report{total !== 1 ? 's' : ''}
            {pendingCount > 0 && (
              <span className="ml-2 inline-flex rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold text-white">
                {pendingCount} pending
              </span>
            )}
          </p>
        </div>

        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value as StatusFilter); setPage(1); }}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        >
          <option value="">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="REVIEWED">Reviewed</option>
          <option value="ACTIONED">Actioned</option>
          <option value="DISMISSED">Dismissed</option>
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
            <LoaderCircle className="h-6 w-6 animate-spin text-indigo-600" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="px-6 py-3 text-left font-medium text-slate-500">Reporter</th>
                    <th className="px-6 py-3 text-left font-medium text-slate-500">Target Type</th>
                    <th className="px-6 py-3 text-left font-medium text-slate-500">Target ID</th>
                    <th className="px-6 py-3 text-left font-medium text-slate-500">Reason</th>
                    <th className="px-6 py-3 text-left font-medium text-slate-500">Status</th>
                    <th className="px-6 py-3 text-left font-medium text-slate-500">Date</th>
                    <th className="px-6 py-3 text-left font-medium text-slate-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((report) => (
                    <tr key={report.id} className="border-b border-slate-50 hover:bg-slate-50/30">
                      <td className="px-6 py-3 text-slate-700">{getReporterName(report)}</td>
                      <td className="px-6 py-3">
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                          {report.targetType}
                        </span>
                      </td>
                      <td className="px-6 py-3 font-mono text-xs text-slate-500 max-w-[120px] truncate">
                        {report.targetId}
                      </td>
                      <td className="px-6 py-3 text-slate-700 max-w-[200px]">
                        <p className="line-clamp-2">{report.reason}</p>
                        {report.adminNote && (
                          <p className="mt-1 text-xs text-slate-400 italic">Note: {report.adminNote}</p>
                        )}
                      </td>
                      <td className="px-6 py-3">
                        <span
                          className={cn(
                            'inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium',
                            statusBadge[report.status] || 'bg-slate-100 text-slate-600'
                          )}
                        >
                          {report.status}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-slate-600">{formatDate(report.createdAt)}</td>
                      <td className="px-6 py-3">
                        <div className="flex gap-1.5">
                          {report.status === 'PENDING' && (
                            <button
                              onClick={() => updateStatus(report.id, 'REVIEWED')}
                              disabled={actioningId === report.id}
                              className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 disabled:opacity-50"
                            >
                              {actioningId === report.id && (
                                <LoaderCircle className="h-3 w-3 animate-spin" />
                              )}
                              Review
                            </button>
                          )}
                          {(report.status === 'PENDING' || report.status === 'REVIEWED') && (
                            <button
                              onClick={() => updateStatus(report.id, 'ACTIONED', 'Actioned by admin')}
                              disabled={actioningId === report.id}
                              className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-50"
                            >
                              Action
                            </button>
                          )}
                          {report.status !== 'DISMISSED' && (
                            <button
                              onClick={() => updateStatus(report.id, 'DISMISSED')}
                              disabled={actioningId === report.id}
                              className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-50"
                            >
                              Dismiss
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {reports.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-6 py-16 text-center">
                        <Flag className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                        <p className="text-slate-400">No reports found</p>
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
                    <ChevronLeft className="h-4 w-4" /> Prev
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Next <ChevronRight className="h-4 w-4" />
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
