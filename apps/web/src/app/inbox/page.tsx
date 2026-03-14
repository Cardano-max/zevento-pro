'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  MessageCircle, MapPin, Calendar, Clock, ArrowRight,
  LoaderCircle, CircleCheck, TriangleAlert, Users, ChevronDown, ChevronUp
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

export default function InboxPage() {
  const router = useRouter();
  const { isLoggedIn, initialize } = useAuthStore();
  const [inquiries, setInquiries] = useState<InquiryWithAssignments[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [initialized, setInitialized] = useState(false);

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
            Inquiries
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">My Inquiries &amp; Messages</h1>
          <p className="text-white/70 text-sm">
            Track your vendor inquiries and see who responded
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 -mt-5 pb-16">
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
      </div>
    </div>
  );
}
