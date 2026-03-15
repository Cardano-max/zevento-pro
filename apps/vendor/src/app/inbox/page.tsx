'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Loader2,
  Check,
  X,
  Phone,
  MapPin,
  Tag,
  Calendar,
  SendHorizonal,
  IndianRupee,
  MessageSquare,
  ChevronLeft,
  Send,
} from 'lucide-react';
import { VendorLayout } from '@/components/layout';
import { api } from '@/lib/api';
import { formatDate, formatDateTime } from '@/lib/format';
import { cn } from '@/lib/cn';

// ── Lead Assignment interfaces (existing) ──────────────────────────────────

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

// ── Messaging interfaces ───────────────────────────────────────────────────

interface ConversationPreview {
  id: string;
  updatedAt: string;
  customer: { id: string; name: string | null; phone: string | null };
  messages: Array<{ body: string; senderRole: string; createdAt: string }>;
}

interface MessageItem {
  id: string;
  body: string;
  senderRole: string; // CUSTOMER | VENDOR
  createdAt: string;
  readAt: string | null;
}

type ActiveTab = 'LEADS' | 'MESSAGES';

// ── Main Component ─────────────────────────────────────────────────────────

export default function InboxPage() {
  // ─ Tab ─
  const [activeTab, setActiveTab] = useState<ActiveTab>('LEADS');

  // ─ Leads state ─
  const [data, setData] = useState<InboxResponse | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [declineId, setDeclineId] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [quoteAssignmentId, setQuoteAssignmentId] = useState<string | null>(null);
  const [quoteAmount, setQuoteAmount] = useState('');
  const [quoteNotes, setQuoteNotes] = useState('');
  const [quoteLoading, setQuoteLoading] = useState(false);

  // ─ Messaging state ─
  const [convLoaded, setConvLoaded] = useState(false);
  const [conversations, setConversations] = useState<ConversationPreview[]>([]);
  const [convLoading, setConvLoading] = useState(false);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replySending, setReplySending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Leads fetch ────────────────────────────────────────────────────────

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

  // ── Lead actions ───────────────────────────────────────────────────────

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

  // ── Messaging functions ────────────────────────────────────────────────

  async function fetchConversations() {
    setConvLoading(true);
    try {
      const data = await api<ConversationPreview[]>('/vendor/conversations');
      setConversations(data);
    } catch {
      // silently ignore
    } finally {
      setConvLoading(false);
    }
  }

  async function fetchMessages(convId: string) {
    setMsgLoading(true);
    try {
      const data = await api<MessageItem[]>(`/vendor/conversations/${convId}/messages`);
      setMessages(data);
    } catch {
      // silently ignore
    } finally {
      setMsgLoading(false);
    }
  }

  // Load conversations when Messages tab first opened
  useEffect(() => {
    if (activeTab === 'MESSAGES' && !convLoaded) {
      setConvLoaded(true);
      fetchConversations();
    }
  }, [activeTab, convLoaded]);

  // Auto-scroll messages to bottom
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Polling for new messages every 10 seconds
  useEffect(() => {
    if (activeTab === 'MESSAGES' && selectedConvId) {
      pollingRef.current = setInterval(() => {
        fetchMessages(selectedConvId);
      }, 10000);
    }
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [activeTab, selectedConvId]);

  async function handleSelectConversation(convId: string) {
    setSelectedConvId(convId);
    setMessages([]);
    setReplyText('');
    await fetchMessages(convId);
  }

  async function handleSendReply() {
    if (!replyText.trim() || !selectedConvId || replySending) return;
    setReplySending(true);
    try {
      await api(`/vendor/conversations/${selectedConvId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body: replyText.trim() }),
      });
      setReplyText('');
      await fetchMessages(selectedConvId);
      // Also refresh conversation list to update last message preview
      await fetchConversations();
    } catch {
      // silently ignore
    } finally {
      setReplySending(false);
    }
  }

  // ── Leads computed values ──────────────────────────────────────────────

  const filteredItems = !data
    ? []
    : statusFilter === 'ALL'
      ? data.items
      : data.items.filter((item) => item.status === statusFilter);

  const totalPages = data ? Math.ceil(data.total / 20) : 0;

  const counts: Record<string, number> = {};
  if (data) {
    data.items.forEach((item) => {
      counts[item.status] = (counts[item.status] || 0) + 1;
    });
  }

  const selectedConv = conversations.find((c) => c.id === selectedConvId);

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <VendorLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Inbox</h1>
        <p className="text-sm text-slate-500">
          {activeTab === 'LEADS'
            ? `Lead assignments${data ? ` (${data.total} total)` : ''}`
            : 'Customer messages and conversations'}
        </p>
      </div>

      {/* ── Main Tabs ── */}
      <div className="mb-5 flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('LEADS')}
          className={cn(
            'flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors',
            activeTab === 'LEADS'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          )}
        >
          Lead Assignments
          {data && data.total > 0 && (
            <span className={cn(
              'flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1 text-[10px] font-bold',
              activeTab === 'LEADS' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
            )}>
              {data.total}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('MESSAGES')}
          className={cn(
            'flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors',
            activeTab === 'MESSAGES'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          )}
        >
          <MessageSquare className="h-4 w-4" />
          Messages
          {conversations.length > 0 && (
            <span className={cn(
              'flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1 text-[10px] font-bold',
              activeTab === 'MESSAGES' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
            )}>
              {conversations.length}
            </span>
          )}
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          LEADS TAB
      ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'LEADS' && (
        <>
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

                      {item.status === 'ACCEPTED' &&
                        !item.quoteId &&
                        quoteAssignmentId !== item.id && (
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
                        {actionLoading === item.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          'Confirm'
                        )}
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
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          MESSAGES TAB
      ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'MESSAGES' && (
        <div className="flex h-[calc(100vh-220px)] overflow-hidden rounded-xl border border-slate-200 bg-white">
          {/* Conversation List — hidden on mobile when a conv is selected */}
          <div
            className={cn(
              'flex w-full flex-col border-r border-slate-200 md:w-80 md:flex-shrink-0',
              selectedConvId ? 'hidden md:flex' : 'flex'
            )}
          >
            <div className="border-b border-slate-200 px-4 py-3">
              <h3 className="text-sm font-semibold text-slate-900">Conversations</h3>
            </div>

            {convLoading && (
              <div className="flex flex-1 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
              </div>
            )}

            {!convLoading && conversations.length === 0 && (
              <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
                <MessageSquare className="mb-3 h-10 w-10 text-slate-300" />
                <p className="text-sm font-medium text-slate-500">No messages yet</p>
                <p className="mt-1 text-xs text-slate-400">
                  Messages appear here when customers contact you from your profile.
                </p>
              </div>
            )}

            {!convLoading && conversations.length > 0 && (
              <div className="flex-1 overflow-y-auto">
                {conversations.map((conv) => {
                  const lastMsg = conv.messages[0];
                  const displayName =
                    conv.customer.name || conv.customer.phone || 'Customer';
                  return (
                    <button
                      key={conv.id}
                      onClick={() => handleSelectConversation(conv.id)}
                      className={cn(
                        'flex w-full items-start gap-3 border-b border-slate-100 px-4 py-3 text-left transition-colors hover:bg-slate-50',
                        selectedConvId === conv.id && 'bg-emerald-50 border-emerald-100'
                      )}
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-200 text-sm font-bold text-slate-600">
                        {displayName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-1">
                          <span className="truncate text-sm font-semibold text-slate-900">
                            {displayName}
                          </span>
                          <span className="shrink-0 text-[10px] text-slate-400">
                            {formatDateTime(conv.updatedAt)}
                          </span>
                        </div>
                        {lastMsg && (
                          <p className="mt-0.5 truncate text-xs text-slate-500">
                            {lastMsg.senderRole === 'VENDOR' ? 'You: ' : ''}
                            {lastMsg.body}
                          </p>
                        )}
                        {conv.customer.phone && (
                          <p className="mt-0.5 text-[10px] text-slate-400">
                            {conv.customer.phone}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Message Thread Panel */}
          <div
            className={cn(
              'flex flex-1 flex-col',
              !selectedConvId ? 'hidden md:flex' : 'flex'
            )}
          >
            {!selectedConvId ? (
              <div className="flex flex-1 flex-col items-center justify-center text-center p-8">
                <MessageSquare className="mb-3 h-10 w-10 text-slate-300" />
                <p className="text-sm text-slate-400">Select a conversation to view messages</p>
              </div>
            ) : (
              <>
                {/* Thread header */}
                <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
                  <button
                    onClick={() => setSelectedConvId(null)}
                    className="flex items-center gap-1 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 md:hidden"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-sm font-bold text-slate-600">
                    {(selectedConv?.customer.name || selectedConv?.customer.phone || 'C')
                      .charAt(0)
                      .toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {selectedConv?.customer.name ||
                        selectedConv?.customer.phone ||
                        'Customer'}
                    </p>
                    {selectedConv?.customer.phone && (
                      <p className="text-xs text-slate-400">{selectedConv.customer.phone}</p>
                    )}
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {msgLoading && messages.length === 0 && (
                    <div className="flex h-full items-center justify-center">
                      <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
                    </div>
                  )}
                  {messages.map((msg) => {
                    const isVendor = msg.senderRole === 'VENDOR';
                    return (
                      <div
                        key={msg.id}
                        className={cn('flex', isVendor ? 'justify-end' : 'justify-start')}
                      >
                        <div
                          className={cn(
                            'max-w-[75%] rounded-2xl px-4 py-2.5',
                            isVendor
                              ? 'bg-emerald-600 text-white rounded-br-sm'
                              : 'bg-slate-100 text-slate-800 rounded-bl-sm'
                          )}
                        >
                          <p className="text-sm leading-relaxed">{msg.body}</p>
                          <p
                            className={cn(
                              'mt-1 text-[10px]',
                              isVendor ? 'text-emerald-200' : 'text-slate-400'
                            )}
                          >
                            {formatDateTime(msg.createdAt)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Compose box */}
                <div className="border-t border-slate-200 p-3">
                  <div className="flex items-end gap-2">
                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendReply();
                        }
                      }}
                      rows={2}
                      placeholder="Type a message... (Enter to send)"
                      className="flex-1 resize-none rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                    <button
                      onClick={handleSendReply}
                      disabled={!replyText.trim() || replySending}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {replySending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </VendorLayout>
  );
}
