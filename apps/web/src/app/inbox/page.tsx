'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  MessageCircle, MapPin, Calendar, Clock, ArrowRight,
  LoaderCircle, CircleCheck, TriangleAlert, Users, ChevronDown, ChevronUp,
  Send, MessageSquare, Store
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { Inquiry } from '@/lib/types';
import { formatPaise, formatDate } from '@/lib/format';

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: any }> = {
  OPEN: { label: 'Open', color: 'text-blue-700', bgColor: 'bg-blue-50', icon: Clock },
  ASSIGNED: { label: 'Assigned', color: 'text-amber-700', bgColor: 'bg-amber-50', icon: MessageCircle },
  WON: { label: 'Confirmed', color: 'text-emerald-700', bgColor: 'bg-emerald-50', icon: CircleCheck },
  LOST: { label: 'Closed', color: 'text-gray-600', bgColor: 'bg-gray-50', icon: TriangleAlert },
};

const ASSIGNMENT_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  PENDING: { label: 'Pending', color: 'text-amber-700', bg: 'bg-amber-50' },
  ACCEPTED: { label: 'Accepted', color: 'text-emerald-700', bg: 'bg-emerald-50' },
  REJECTED: { label: 'Declined', color: 'text-red-600', bg: 'bg-red-50' },
  WON: { label: 'Confirmed', color: 'text-emerald-800', bg: 'bg-emerald-100' },
  LOST: { label: 'Lost', color: 'text-gray-500', bg: 'bg-gray-50' },
};

interface Assignment {
  id: string;
  status: string;
  vendor: {
    id: string;
    businessName: string;
    city?: string;
    categories?: { category: { name: string } }[];
  };
}

interface InquiryWithAssignments extends Inquiry {
  assignments?: Assignment[];
}

interface Message {
  id: string;
  body: string;
  createdAt: string;
  senderRole: 'CUSTOMER' | 'VENDOR';
}

interface Conversation {
  id: string;
  vendorId: string;
  vendorName: string;
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount?: number;
}

// ── Inquiry Card ──────────────────────────────────────────────────────────────
function InquiryCard({ inquiry }: { inquiry: InquiryWithAssignments }) {
  const [expanded, setExpanded] = useState(false);
  const config = STATUS_CONFIG[inquiry.status] ?? STATUS_CONFIG['OPEN'];
  const StatusIcon = config.icon;
  const assignments = inquiry.assignments ?? [];

  return (
    <div className="bg-white rounded-2xl border border-rose-50 shadow-sm hover:shadow-md transition-all">
      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${config.bgColor} ${config.color}`}>
                <StatusIcon className="w-3 h-3" />
                {config.label}
              </span>
              {inquiry.category?.name && (
                <span className="text-xs text-gray-600 bg-gray-50 px-2.5 py-1 rounded-full font-medium">
                  {inquiry.category.name}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3 text-rose-400" />
                {inquiry.city}
              </span>
              {inquiry.eventDate && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-rose-400" />
                  {formatDate(inquiry.eventDate)}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDate(inquiry.createdAt)}
              </span>
            </div>
          </div>

          <div className="text-right shrink-0">
            {inquiry.budgetPaise ? (
              <p className="text-sm font-bold text-rose-700">{formatPaise(inquiry.budgetPaise)}</p>
            ) : null}
            <p className="text-xs text-gray-400 mt-0.5">
              {assignments.length} vendor{assignments.length !== 1 ? 's' : ''} responded
            </p>
          </div>
        </div>

        {/* Description */}
        {inquiry.description && (
          <p className="text-sm text-gray-600 mb-4 leading-relaxed line-clamp-2">{inquiry.description}</p>
        )}

        {/* Toggle vendors */}
        {assignments.length > 0 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1.5 text-xs font-medium text-rose-700 hover:text-rose-800 transition-colors"
          >
            <Users className="w-3.5 h-3.5" />
            View vendor responses ({assignments.length})
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      {/* Vendor assignments */}
      {expanded && assignments.length > 0 && (
        <div className="border-t border-rose-50 px-5 py-4 space-y-3">
          {assignments.map((assignment) => {
            const aStatus = ASSIGNMENT_STATUS[assignment.status] ?? ASSIGNMENT_STATUS['PENDING'];
            return (
              <div key={assignment.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-gray-50 hover:bg-rose-50/50 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm truncate">{assignment.vendor.businessName}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {assignment.vendor.city && (
                      <span className="text-xs text-gray-500 flex items-center gap-0.5">
                        <MapPin className="w-2.5 h-2.5" />
                        {assignment.vendor.city}
                      </span>
                    )}
                    {assignment.vendor.categories?.[0]?.category?.name && (
                      <span className="text-xs text-gray-400">
                        · {assignment.vendor.categories[0].category.name}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${aStatus.bg} ${aStatus.color}`}>
                    {aStatus.label}
                  </span>
                  <Link
                    href={`/vendors/${assignment.vendor.id}`}
                    className="flex items-center gap-1 text-xs font-semibold text-rose-700 hover:text-rose-800 transition-colors"
                  >
                    View
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-rose-50 shadow-sm p-5 space-y-3">
      <div className="flex justify-between">
        <div className="space-y-2 flex-1">
          <div className="h-5 shimmer rounded w-1/4" />
          <div className="h-3 shimmer rounded w-1/2" />
        </div>
        <div className="h-5 shimmer rounded w-16" />
      </div>
      <div className="h-4 shimmer rounded w-3/4" />
      <div className="h-4 shimmer rounded w-1/3" />
    </div>
  );
}

// ── Message Thread ────────────────────────────────────────────────────────────
function MessageThread({ vendorId, vendorName }: { vendorId: string; vendorName: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    api<{ messages?: Message[]; data?: Message[] } | Message[]>(`/customer/messages/${vendorId}`)
      .then((res) => {
        const list = Array.isArray(res)
          ? res
          : (res as any).messages ?? (res as any).data ?? [];
        setMessages(list);
      })
      .catch(() => setMessages([]))
      .finally(() => setLoading(false));
  }, [vendorId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || sending) return;
    setSending(true);
    try {
      await api(`/customer/messages/${vendorId}`, {
        method: 'POST',
        body: JSON.stringify({ body: newMessage.trim() }),
      });
      const optimistic: Message = {
        id: Date.now().toString(),
        body: newMessage.trim(),
        createdAt: new Date().toISOString(),
        senderRole: 'CUSTOMER',
      };
      setMessages((prev) => [...prev, optimistic]);
      setNewMessage('');
    } catch (e: any) {
      alert(e.message || 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <LoaderCircle className="w-6 h-6 animate-spin text-rose-600" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Vendor header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-rose-50">
        <div className="w-9 h-9 rounded-full bg-rose-100 flex items-center justify-center">
          <Store className="w-4 h-4 text-rose-600" />
        </div>
        <div>
          <p className="font-semibold text-gray-900 text-sm">{vendorName}</p>
          <Link href={`/vendors/${vendorId}`} className="text-xs text-rose-600 hover:underline">
            View profile →
          </Link>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0">
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <MessageCircle className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400">No messages yet. Say hello!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isCustomer = msg.senderRole === 'CUSTOMER' || !(msg as any).senderRole;
            return (
              <div key={msg.id} className={`flex ${isCustomer ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                    isCustomer
                      ? 'bg-rose-700 text-white rounded-br-sm'
                      : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                  }`}
                >
                  <p className="leading-relaxed">{msg.body}</p>
                  <p className={`text-xs mt-1 ${isCustomer ? 'text-rose-200' : 'text-gray-400'}`}>
                    {formatDate(msg.createdAt)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Compose */}
      <div className="border-t border-rose-50 p-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Type a message..."
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 outline-none focus:border-rose-400 transition-colors"
          />
          <button
            onClick={handleSend}
            disabled={sending || !newMessage.trim()}
            className="flex items-center justify-center w-10 h-10 rounded-xl bg-rose-700 text-white hover:bg-rose-800 disabled:opacity-50 transition-colors shrink-0"
          >
            {sending ? (
              <LoaderCircle className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Messages Tab ──────────────────────────────────────────────────────────────
function MessagesTab() {
  const searchParams = useSearchParams();
  const convVendorId = searchParams.get('conv');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [noConvEndpoint, setNoConvEndpoint] = useState(false);

  useEffect(() => {
    // Try to fetch conversations list — may not exist, fall back gracefully
    api<Conversation[] | { data: Conversation[] }>('/customer/conversations')
      .then((res) => {
        const list = Array.isArray(res) ? res : (res as any).data ?? [];
        setConversations(list);

        // If URL has ?conv=vendorId, auto-open that one
        if (convVendorId) {
          const match = list.find((c: Conversation) => c.vendorId === convVendorId || c.id === convVendorId);
          if (match) setSelected(match);
        }
      })
      .catch(() => {
        setNoConvEndpoint(true);

        // If URL has ?conv=vendorId, still open it as a stub
        if (convVendorId) {
          setSelected({ id: convVendorId, vendorId: convVendorId, vendorName: 'Vendor' });
        }
      })
      .finally(() => setLoading(false));
  }, [convVendorId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <LoaderCircle className="w-6 h-6 animate-spin text-rose-600" />
      </div>
    );
  }

  if (noConvEndpoint && !convVendorId) {
    return (
      <div className="text-center py-20">
        <div className="w-20 h-20 rounded-full bg-rose-50 flex items-center justify-center mx-auto mb-5">
          <MessageSquare className="w-10 h-10 text-rose-300" />
        </div>
        <h3 className="text-xl font-bold text-gray-800 mb-2">Start a Conversation</h3>
        <p className="text-gray-500 mb-8 text-sm max-w-sm mx-auto">
          You can start a direct conversation from any vendor&apos;s profile page.
        </p>
        <Link
          href="/vendors"
          className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-rose-700 to-rose-500 text-white font-semibold hover:from-rose-800 hover:to-rose-600 transition-all shadow-md"
        >
          Browse Vendors
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  if (selected) {
    return (
      <div className="bg-white rounded-2xl border border-rose-50 shadow-sm overflow-hidden" style={{ height: '520px' }}>
        <div className="flex items-center gap-2 px-4 py-2 bg-rose-50 border-b border-rose-100">
          <button
            onClick={() => setSelected(null)}
            className="text-xs text-rose-700 font-semibold hover:underline flex items-center gap-1"
          >
            ← Back
          </button>
          <span className="text-xs text-gray-400">|</span>
          <span className="text-xs text-gray-600 font-medium">{selected.vendorName}</span>
        </div>
        <div style={{ height: 'calc(100% - 36px)' }}>
          <MessageThread vendorId={selected.vendorId} vendorName={selected.vendorName} />
        </div>
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="w-20 h-20 rounded-full bg-rose-50 flex items-center justify-center mx-auto mb-5">
          <MessageSquare className="w-10 h-10 text-rose-300" />
        </div>
        <h3 className="text-xl font-bold text-gray-800 mb-2">No messages yet</h3>
        <p className="text-gray-500 mb-8 text-sm max-w-sm mx-auto">
          Visit a vendor profile and tap &quot;Send Message&quot; to start chatting.
        </p>
        <Link
          href="/vendors"
          className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-rose-700 to-rose-500 text-white font-semibold hover:from-rose-800 hover:to-rose-600 transition-all shadow-md"
        >
          Browse Vendors
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {conversations.map((conv) => (
        <button
          key={conv.id}
          onClick={() => setSelected(conv)}
          className="w-full bg-white rounded-2xl border border-rose-50 shadow-sm hover:shadow-md transition-all p-4 text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
              <Store className="w-5 h-5 text-rose-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <p className="font-semibold text-gray-900 text-sm truncate">{conv.vendorName}</p>
                {conv.lastMessageAt && (
                  <p className="text-xs text-gray-400 shrink-0">{formatDate(conv.lastMessageAt)}</p>
                )}
              </div>
              {conv.lastMessage && (
                <p className="text-xs text-gray-500 truncate">{conv.lastMessage}</p>
              )}
            </div>
            {conv.unreadCount && conv.unreadCount > 0 ? (
              <div className="w-5 h-5 rounded-full bg-rose-600 flex items-center justify-center shrink-0">
                <span className="text-xs text-white font-bold">{conv.unreadCount}</span>
              </div>
            ) : null}
          </div>
        </button>
      ))}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function InboxPage() {
  const router = useRouter();
  const { isLoggedIn, initialize } = useAuthStore();
  const [inquiries, setInquiries] = useState<InquiryWithAssignments[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [activeTab, setActiveTab] = useState<'inquiries' | 'messages'>('inquiries');

  useEffect(() => {
    initialize();
    setInitialized(true);
  }, [initialize]);

  useEffect(() => {
    if (!initialized) return;
    if (!isLoggedIn) {
      router.push('/login?redirect=/inbox');
      return;
    }
    loadInquiries(1);
  }, [initialized, isLoggedIn, router]);

  const loadInquiries = async (pg: number) => {
    setLoading(true);
    try {
      const res = await api<{ data: InquiryWithAssignments[]; total?: number } | InquiryWithAssignments[]>(
        `/leads/inquiries?page=${pg}&limit=10`
      );
      const list = Array.isArray(res) ? res : (res as any).data ?? [];
      const total = Array.isArray(res) ? list.length : (res as any).total ?? list.length;

      if (pg === 1) {
        setInquiries(list);
      } else {
        setInquiries((prev) => [...prev, ...list]);
      }
      setHasMore(list.length === 10 && pg * 10 < total);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMore = () => {
    const next = page + 1;
    setPage(next);
    loadInquiries(next);
  };

  if (!initialized || (!isLoggedIn && initialized)) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-16">
        <LoaderCircle className="w-6 h-6 animate-spin text-rose-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf8f5] pt-16">
      {/* Header */}
      <div className="gradient-bg pt-10 pb-12 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/3 w-64 h-64 rounded-full bg-rose-500/10 blur-3xl" />
        </div>
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6">
          <div className="inline-flex items-center gap-2 bg-white/10 text-white/80 text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
            <MessageCircle className="w-3.5 h-3.5" />
            Inbox
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">My Inquiries &amp; Messages</h1>
          <p className="text-white/70 text-sm">
            Track your vendor inquiries and direct conversations
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 -mt-5 pb-16">
        {/* Tabs */}
        <div className="flex gap-1 bg-white rounded-2xl p-1 shadow-sm border border-rose-50 mb-6">
          <button
            onClick={() => setActiveTab('inquiries')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'inquiries'
                ? 'bg-rose-700 text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <MessageCircle className="w-4 h-4" />
            Inquiries
            {inquiries.length > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                activeTab === 'inquiries' ? 'bg-white/20 text-white' : 'bg-rose-50 text-rose-700'
              }`}>
                {inquiries.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('messages')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'messages'
                ? 'bg-rose-700 text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            Messages
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'inquiries' && (
          <>
            {loading && page === 1 ? (
              <div className="space-y-4">
                {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
              </div>
            ) : inquiries.length === 0 ? (
              <div className="text-center py-24">
                <div className="w-20 h-20 rounded-full bg-rose-50 flex items-center justify-center mx-auto mb-5">
                  <MessageCircle className="w-10 h-10 text-rose-300" />
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">No inquiries yet</h3>
                <p className="text-gray-500 mb-8 text-sm max-w-sm mx-auto">
                  Browse vendors and send inquiries to start connecting with wedding professionals.
                </p>
                <Link
                  href="/vendors"
                  className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-rose-700 to-rose-500 text-white font-semibold hover:from-rose-800 hover:to-rose-600 transition-all shadow-md"
                >
                  Browse Vendors
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between py-4 mb-2">
                  <p className="text-sm text-gray-500">
                    {inquiries.length} inquir{inquiries.length !== 1 ? 'ies' : 'y'}
                  </p>
                  <Link
                    href="/dashboard"
                    className="text-sm font-semibold text-rose-700 hover:text-rose-800 flex items-center gap-1"
                  >
                    Dashboard <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                <div className="space-y-4">
                  {inquiries.map((inquiry) => (
                    <InquiryCard key={inquiry.id} inquiry={inquiry} />
                  ))}
                </div>

                {loading && page > 1 && (
                  <div className="flex justify-center py-6">
                    <LoaderCircle className="w-6 h-6 animate-spin text-rose-600" />
                  </div>
                )}

                {hasMore && !loading && (
                  <div className="flex justify-center mt-6">
                    <button
                      onClick={handleLoadMore}
                      className="flex items-center gap-2 px-6 py-3 rounded-2xl border-2 border-rose-200 text-rose-700 font-semibold hover:bg-rose-50 transition-all text-sm"
                    >
                      <ChevronDown className="w-4 h-4" />
                      Load More
                    </button>
                  </div>
                )}

                {!hasMore && inquiries.length > 0 && (
                  <p className="text-center text-xs text-gray-400 py-6">All inquiries loaded</p>
                )}
              </>
            )}
          </>
        )}

        {activeTab === 'messages' && <MessagesTab />}
      </div>
    </div>
  );
}
