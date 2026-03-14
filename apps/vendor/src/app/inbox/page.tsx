'use client';

import { useEffect, useState, useCallback } from 'react';
import { Loader2, Check, X, Phone, MapPin, Tag, Calendar, SendHorizonal, IndianRupee } from 'lucide-react';
import { VendorLayout } from '@/components/layout';
import { api } from '@/lib/api';
import { formatDate, formatDateTime } from '@/lib/format';
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
    budgetPaise?: number | null;
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

type StatusFilter = 'ALL' | 'NOTIFIED' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED';

const FILTER_TABS: { key: StatusFilter; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'NOTIFIED', label: 'New' },
  { key: 'ACCEPTED', label: 'Accepted' },
  { key: 'DECLINED', label: 'Declined' },
  { key: 'EXPIRED', label: 'Expired' },
];

const EMPTY_MESSAGES: Record<StatusFilter, string> = {
  ALL: 'No leads in your inbox yet. They will appear here when customers inquire in your category and area.',
  NOTIFIED: 'No new leads waiting for your response.',
  ACCEPTED: "You haven't accepted any leads yet.",
  DECLINED: "You haven't declined any leads.",
  EXPIRED: 'No expired leads.',
};

export default function InboxPage() {
  const [data, setData] = useState<InboxResponse | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [declineId, setDeclineId] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

  // Inline quote form state
  const [quoteAssignmentId, setQuoteAssignmentId] = useState<string | null>(null);
  const [quoteAmount, setQuoteAmount] = useState('');
  const [quoteNotes, setQuoteNotes] = useState('');
  const [quoteLoading, setQuoteLoading] = useState(false);

  const fetchInbox = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res = await api<InboxResponse>(`/inbox?page=${p}&limit=20`);
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

  async function handleSubmitQuote(assignmentId: string, leadId: string) {
    const amount = parseFloat(quoteAmount);
    if (!quoteAmount || isNaN(amount) || amount <= 0) {
      setError('Please enter a valid quote amount');
      return;
    }
    setQuoteLoading(true);
    try {
      await api('/quotes', {
        method: 'POST',
        body: JSON.stringify({
          leadId,
          amountPaise: Math.round(amount * 100),
          notes: quoteNotes.trim() || undefined,
        }),
      });
      setQuoteAssignmentId(null);
      setQuoteAmount('');
      setQuoteNotes('');
      fetchInbox(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit quote');
    } finally {
      setQuoteLoading(false);
    }
  }

  const filteredItems =
    !data
      ? []
      : statusFilter === 'ALL'
        ? data.items
        : data.items.filter((item) => item.status === statusFilter);

  const totalPages = data ? Math.ceil(data.total / 20) : 0;

  // Count per status for badge
  const counts: Record<string, number> = {};
  if (data) {
    data.items.forEach((item) => {
      counts[item.status] = (counts[item.status] || 0) + 1;
    });
  }

  return (
    <VendorLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Lead Inbox</h1>
        <p className="text-sm text-slate-500">
          Respond to leads assigned to you{data ? ` (${data.total} total)` : ''}
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

      {/* Filter Tabs */}
      <div className="mb-5 flex flex-wrap gap-2">
        {FILTER_TABS.map((tab) => {
          const count = tab.key === 'ALL' ? data?.total : counts[tab.key];
          return (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
                statusFilter === tab.key
                  ? 'bg-emerald-600 text-white'
                  : 'border border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:text-emerald-700'
              )}
            >
              {tab.label}
              {count !== undefined && count > 0 && (
                <span
                  className={cn(
                    'flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 text-[10px] font-bold',
                    statusFilter === tab.key
                      ? 'bg-white/20 text-white'
                      : tab.key === 'NOTIFIED'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-slate-100 text-slate-500'
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {loading && !data && (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        </div>
      )}

      {data && (
        <div className="space-y-4">
          {filteredItems.length === 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                <Check className="h-6 w-6 text-slate-400" />
              </div>
              <p className="text-sm text-slate-400">{EMPTY_MESSAGES[statusFilter]}</p>
            </div>
          )}

          {filteredItems.map((item) => (
            <div
              key={item.id}
              className={cn(
                'rounded-xl border bg-white p-5 transition-shadow hover:shadow-sm',
                item.status === 'NOTIFIED'
                  ? 'border-blue-200 ring-1 ring-blue-100'
                  : 'border-slate-200'
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {/* Header Row */}
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-600">
                      {item.lead.customerName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-semibold text-slate-900">
                          {item.lead.customerName}
                        </h3>
                        <span
                          className={cn(
                            'inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium',
                            statusBadge[item.status] || 'bg-slate-100 text-slate-500'
                          )}
                        >
                          {item.status === 'NOTIFIED' ? 'New Lead' : item.status}
                        </span>
                        {item.quoteId && (
                          <span className="inline-flex rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-700">
                            Quote Sent
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Details Row */}
                  <div className="flex flex-wrap gap-3 text-sm text-slate-500 ml-12">
                    {item.lead.category && (
                      <span className="flex items-center gap-1">
                        <Tag className="h-3.5 w-3.5" />
                        {item.lead.category.name}
                      </span>
                    )}
                    {item.lead.city && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {item.lead.city}
                      </span>
                    )}
                    {item.lead.eventDate && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatDate(item.lead.eventDate)}
                      </span>
                    )}
                    {item.lead.budgetPaise && item.lead.budgetPaise > 0 && (
                      <span className="flex items-center gap-1 font-medium text-slate-700">
                        <IndianRupee className="h-3.5 w-3.5" />
                        Budget: ₹{(item.lead.budgetPaise / 100).toLocaleString('en-IN')}
                      </span>
                    )}
                  </div>

                  {item.lead.message && (
                    <p className="mt-2 ml-12 text-sm text-slate-600 line-clamp-2 italic">
                      &ldquo;{item.lead.message}&rdquo;
                    </p>
                  )}

                  {item.lead.customerPhone && item.status === 'ACCEPTED' && (
                    <div className="mt-2 ml-12 flex items-center gap-1 text-sm font-medium text-emerald-600">
                      <Phone className="h-3.5 w-3.5" />
                      {item.lead.customerPhone}
                    </div>
                  )}

                  <p className="mt-2 ml-12 text-xs text-slate-400">
                    Received: {formatDateTime(item.assignedAt)}
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex shrink-0 flex-col items-end gap-2">
                  {item.status === 'NOTIFIED' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAccept(item.id)}
                        disabled={actionLoading === item.id}
                        className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {actionLoading === item.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4" />
                        )}
                        Accept Lead
                      </button>
                      <button
                        onClick={() => setDeclineId(item.id)}
                        disabled={actionLoading === item.id}
                        className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                      >
                        <X className="h-4 w-4" />
                        Decline
                      </button>
                    </div>
                  )}

                  {item.status === 'ACCEPTED' && !item.quoteId && quoteAssignmentId !== item.id && (
                    <button
                      onClick={() => {
                        setQuoteAssignmentId(item.id);
                        setQuoteAmount('');
                        setQuoteNotes('');
                      }}
                      className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                    >
                      <SendHorizonal className="h-4 w-4" />
                      Send Quote
                    </button>
                  )}
                </div>
              </div>

              {/* Decline Reason Form */}
              {declineId === item.id && (
                <div className="mt-4 flex items-center gap-3 border-t border-slate-100 pt-4">
                  <input
                    type="text"
                    value={declineReason}
                    onChange={(e) => setDeclineReason(e.target.value)}
                    placeholder="Reason for declining (required)..."
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    autoFocus
                  />
                  <button
                    onClick={() => handleDecline(item.id)}
                    disabled={!declineReason.trim() || actionLoading === item.id}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {actionLoading === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm'}
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

              {/* Inline Quote Form */}
              {quoteAssignmentId === item.id && (
                <div className="mt-4 rounded-lg border border-indigo-100 bg-indigo-50 p-4">
                  <h4 className="mb-3 text-sm font-semibold text-slate-900">Submit Quote</h4>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">
                        Quote Amount (₹) *
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                          ₹
                        </span>
                        <input
                          type="number"
                          value={quoteAmount}
                          onChange={(e) => setQuoteAmount(e.target.value)}
                          placeholder="e.g. 25000"
                          min="0"
                          className="w-full rounded-lg border border-slate-300 bg-white pl-7 pr-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                          autoFocus
                        />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">
                        Notes / Terms (optional)
                      </label>
                      <input
                        type="text"
                        value={quoteNotes}
                        onChange={(e) => setQuoteNotes(e.target.value)}
                        placeholder="e.g. Includes setup and breakdown"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      onClick={() => handleSubmitQuote(item.id, item.lead.id)}
                      disabled={quoteLoading || !quoteAmount}
                      className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {quoteLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <SendHorizonal className="h-4 w-4" />
                      )}
                      Submit Quote
                    </button>
                    <button
                      onClick={() => {
                        setQuoteAssignmentId(null);
                        setQuoteAmount('');
                        setQuoteNotes('');
                      }}
                      className="text-sm text-slate-500 hover:text-slate-700"
                    >
                      Cancel
                    </button>
                  </div>
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
