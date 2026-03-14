'use client';

import { useEffect, useState, useCallback } from 'react';
import { Loader2, Check, X, Phone, MapPin, Tag } from 'lucide-react';
import { VendorLayout } from '@/components/layout';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/cn';

interface LeadAssignment {
  id: string;
  status: string;
  assignedAt: string;
  lead: {
    id: string;
    customerName: string;
    customerPhone: string | null;
    city: string;
    eventDate: string | null;
    category: { name: string } | null;
    message: string | null;
  };
  quoteId: string | null;
}

interface InboxResponse {
  items: LeadAssignment[];
  total: number;
  page: number;
  limit: number;
}

const statusBadge: Record<string, string> = {
  NOTIFIED: 'bg-blue-100 text-blue-700',
  ACCEPTED: 'bg-green-100 text-green-700',
  DECLINED: 'bg-red-100 text-red-700',
  EXPIRED: 'bg-slate-100 text-slate-500',
};

export default function InboxPage() {
  const [data, setData] = useState<InboxResponse | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [declineId, setDeclineId] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState('');

  const fetchInbox = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res = await api<InboxResponse>(`/inbox?page=${p}&limit=15`);
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load inbox');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInbox(page);
  }, [page, fetchInbox]);

  async function handleAccept(assignmentId: string) {
    setActionLoading(assignmentId);
    try {
      await api(`/inbox/assignments/${assignmentId}/accept`, { method: 'PATCH' });
      fetchInbox(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept lead');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDecline(assignmentId: string) {
    if (!declineReason.trim()) return;
    setActionLoading(assignmentId);
    try {
      await api(`/inbox/assignments/${assignmentId}/decline`, {
        method: 'PATCH',
        body: JSON.stringify({ reason: declineReason }),
      });
      setDeclineId(null);
      setDeclineReason('');
      fetchInbox(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to decline lead');
    } finally {
      setActionLoading(null);
    }
  }

  const totalPages = data ? Math.ceil(data.total / data.limit) : 0;

  return (
    <VendorLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Lead Inbox</h1>
        <p className="text-sm text-slate-500">
          New leads assigned to you{data ? ` (${data.total} total)` : ''}
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
          <button onClick={() => setError('')} className="ml-2 underline">
            Dismiss
          </button>
        </div>
      )}

      {loading && !data && (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        </div>
      )}

      {data && (
        <div className="space-y-4">
          {data.items.length === 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-400">
              No leads in your inbox yet. They will appear here when customers inquire in your category and area.
            </div>
          )}

          {data.items.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-slate-200 bg-white p-5 transition-shadow hover:shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-base font-semibold text-slate-900">
                      {item.lead.customerName}
                    </h3>
                    <span
                      className={cn(
                        'inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium',
                        statusBadge[item.status] || 'bg-slate-100 text-slate-500'
                      )}
                    >
                      {item.status}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-4 text-sm text-slate-500">
                    {item.lead.city && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {item.lead.city}
                      </span>
                    )}
                    {item.lead.category && (
                      <span className="flex items-center gap-1">
                        <Tag className="h-3.5 w-3.5" />
                        {item.lead.category.name}
                      </span>
                    )}
                    {item.lead.eventDate && (
                      <span>Event: {formatDateTime(item.lead.eventDate)}</span>
                    )}
                    <span>Received: {formatDateTime(item.assignedAt)}</span>
                  </div>

                  {item.lead.message && (
                    <p className="mt-2 text-sm text-slate-600 line-clamp-2">{item.lead.message}</p>
                  )}

                  {item.lead.customerPhone && (
                    <div className="mt-2 flex items-center gap-1 text-sm font-medium text-emerald-600">
                      <Phone className="h-3.5 w-3.5" />
                      {item.lead.customerPhone}
                    </div>
                  )}
                </div>

                {item.status === 'NOTIFIED' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAccept(item.id)}
                      disabled={actionLoading === item.id}
                      className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {actionLoading === item.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                      Accept
                    </button>
                    <button
                      onClick={() => setDeclineId(item.id)}
                      disabled={actionLoading === item.id}
                      className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                    >
                      <X className="h-4 w-4" />
                      Decline
                    </button>
                  </div>
                )}

                {item.status === 'ACCEPTED' && !item.quoteId && (
                  <a
                    href={`/inbox?quote=${item.lead.id}`}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    Send Quote
                  </a>
                )}
              </div>

              {/* Decline reason form */}
              {declineId === item.id && (
                <div className="mt-4 flex items-center gap-3 border-t border-slate-100 pt-4">
                  <input
                    type="text"
                    value={declineReason}
                    onChange={(e) => setDeclineReason(e.target.value)}
                    placeholder="Reason for declining..."
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    autoFocus
                  />
                  <button
                    onClick={() => handleDecline(item.id)}
                    disabled={!declineReason.trim() || actionLoading === item.id}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => {
                      setDeclineId(null);
                      setDeclineReason('');
                    }}
                    className="text-sm text-slate-500 hover:text-slate-700"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-5 py-3">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="text-sm font-medium text-slate-600 hover:text-slate-900 disabled:text-slate-300"
              >
                Previous
              </button>
              <span className="text-sm text-slate-500">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="text-sm font-medium text-slate-600 hover:text-slate-900 disabled:text-slate-300"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </VendorLayout>
  );
}
