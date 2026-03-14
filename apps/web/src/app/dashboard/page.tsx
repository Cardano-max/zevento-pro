'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  User, Sparkles, MessageCircle, Calendar, MapPin,
  ArrowRight, LoaderCircle, Clock, CircleCheck,
  TriangleAlert, ChevronRight, Heart, Star, RefreshCw
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

function InquiryCard({ inquiry }: { inquiry: Inquiry }) {
  const config = STATUS_CONFIG[inquiry.status] ?? STATUS_CONFIG['OPEN'];
  const StatusIcon = config.icon;

  return (
    <div className="bg-white rounded-2xl border border-rose-50 shadow-sm hover:shadow-md transition-all p-5">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${config.bgColor} ${config.color}`}>
              <StatusIcon className="w-3 h-3" />
              {config.label}
            </span>
            {inquiry.category?.name && (
              <span className="text-xs text-gray-500 bg-gray-50 px-2.5 py-1 rounded-full">
                {inquiry.category.name}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {inquiry.city}
            </span>
            {inquiry.eventDate && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {formatDate(inquiry.eventDate)}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDate(inquiry.createdAt)}
            </span>
          </div>
        </div>
        {inquiry.budgetPaise && (
          <div className="text-right shrink-0">
            <p className="text-xs text-gray-400">Budget</p>
            <p className="font-bold text-rose-700 text-sm">{formatPaise(inquiry.budgetPaise)}</p>
          </div>
        )}
      </div>

      {inquiry.description && (
        <p className="text-sm text-gray-600 mb-4 line-clamp-2 leading-relaxed">{inquiry.description}</p>
      )}

      {inquiry.assignments && inquiry.assignments.length > 0 && (
        <div className="pt-4 border-t border-gray-50">
          <p className="text-xs text-gray-400 mb-2 font-medium">Vendor Responses</p>
          <div className="flex flex-wrap gap-2">
            {inquiry.assignments.slice(0, 3).map((assignment, i) => (
              <div
                key={i}
                className="flex items-center gap-1.5 text-xs bg-rose-50 text-rose-800 px-2.5 py-1 rounded-full"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                {assignment.vendor.businessName}
                <span className="text-rose-400">· {assignment.status.toLowerCase()}</span>
              </div>
            ))}
            {inquiry.assignments.length > 3 && (
              <span className="text-xs text-gray-400 px-2 py-1">
                +{inquiry.assignments.length - 3} more
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { isLoggedIn, user, initialize } = useAuthStore();
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (!isLoggedIn) {
      router.push('/login');
      return;
    }
    fetchInquiries();
  }, [isLoggedIn, page]);

  const fetchInquiries = () => {
    setLoading(true);
    api<{ data: Inquiry[]; inquiries?: Inquiry[]; pagination?: { totalPages: number } }>(
      `/leads/inquiries?page=${page}&limit=10`
    )
      .then((res) => {
        setInquiries(res.data ?? res.inquiries ?? []);
        setTotalPages(res.pagination?.totalPages ?? 1);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message || 'Failed to load inquiries');
        setLoading(false);
      });
  };

  const stats = {
    total: inquiries.length,
    active: inquiries.filter((i) => ['OPEN', 'ASSIGNED'].includes(i.status)).length,
    confirmed: inquiries.filter((i) => i.status === 'WON').length,
  };

  if (!isLoggedIn && !loading) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#faf8f5] pt-16">
      {/* Header */}
      <div className="gradient-bg pt-14 pb-20 px-4 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-1/4 w-64 h-64 rounded-full bg-rose-500/10 blur-3xl" />
        </div>
        <div className="relative max-w-5xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-500 to-rose-700 flex items-center justify-center shadow-xl">
              <User className="w-7 h-7 text-white" />
            </div>
            <div>
              <p className="text-white/60 text-sm">Welcome back</p>
              <h1 className="text-2xl font-bold text-white">
                {user?.name || `+91 ${user?.phone?.slice(3) || ''}`} 👋
              </h1>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Total Inquiries', value: stats.total, color: 'text-white' },
              { label: 'Active', value: stats.active, color: 'text-amber-400' },
              { label: 'Confirmed', value: stats.confirmed, color: 'text-emerald-400' },
            ].map((stat) => (
              <div key={stat.label} className="glass rounded-2xl p-4 text-center">
                <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                <p className="text-white/60 text-xs mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 pb-16">
        {/* Quick Actions */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[
            { href: '/plan', icon: Sparkles, label: 'AI Planner', color: 'bg-amber-50 text-amber-700 border-amber-100' },
            { href: '/vendors', icon: Heart, label: 'Browse Vendors', color: 'bg-rose-50 text-rose-700 border-rose-100' },
            { href: '/vendors', icon: Star, label: 'Top Rated', color: 'bg-blue-50 text-blue-700 border-blue-100' },
            { href: '/plan', icon: Calendar, label: 'Set Date', color: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
          ].map((action) => (
            <Link
              key={action.label}
              href={action.href}
              className={`flex flex-col items-center gap-2 p-4 rounded-2xl border shadow-sm hover:shadow-md transition-all ${action.color}`}
            >
              <action.icon className="w-5 h-5" />
              <span className="text-xs font-semibold text-center">{action.label}</span>
            </Link>
          ))}
        </div>

        {/* Inquiries */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">My Inquiries</h2>
          <button
            onClick={fetchInquiries}
            className="flex items-center gap-1 text-sm text-rose-700 hover:text-rose-800 font-medium transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="flex flex-col items-center gap-3">
              <LoaderCircle className="w-8 h-8 animate-spin text-rose-600" />
              <p className="text-gray-500 text-sm">Loading your inquiries...</p>
            </div>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-100 rounded-2xl p-6 text-center">
            <TriangleAlert className="w-8 h-8 text-red-400 mx-auto mb-2" />
            <p className="text-red-700 font-medium">{error}</p>
            <button
              onClick={fetchInquiries}
              className="mt-4 px-4 py-2 rounded-xl bg-red-100 text-red-700 text-sm font-medium hover:bg-red-200"
            >
              Retry
            </button>
          </div>
        ) : inquiries.length === 0 ? (
          <div className="bg-white rounded-3xl border border-rose-50 shadow-sm p-12 text-center">
            <div className="text-5xl mb-4">💍</div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">No inquiries yet</h3>
            <p className="text-gray-500 mb-8 max-w-xs mx-auto">
              Start planning your wedding! Browse vendors and send your first inquiry.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/plan"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-rose-700 to-rose-500 text-white font-semibold hover:from-rose-800 hover:to-rose-600 transition-all shadow-md"
              >
                <Sparkles className="w-4 h-4" />
                Plan with AI
              </Link>
              <Link
                href="/vendors"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl border-2 border-rose-200 text-rose-700 font-semibold hover:bg-rose-50 transition-all"
              >
                Browse Vendors
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {inquiries.map((inquiry) => (
              <InquiryCard key={inquiry.id} inquiry={inquiry} />
            ))}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center gap-2 pt-4">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:border-rose-300 disabled:opacity-30"
                >
                  Previous
                </button>
                <span className="px-4 py-2 text-sm text-gray-500">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:border-rose-300 disabled:opacity-30"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}

        {/* Suggestion Panel */}
        {!loading && inquiries.length > 0 && (
          <div className="mt-8 gradient-bg rounded-3xl p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-4">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <h3 className="font-bold text-white">Complete Your Wedding Planning</h3>
            </div>
            <p className="text-white/70 text-sm mb-5">
              Based on your inquiries, here are some services you might still need:
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {['DJ & Music', 'Mehndi Artist', 'Wedding Cake', 'Bridal Wear'].map((service) => (
                <Link
                  key={service}
                  href={`/vendors?search=${encodeURIComponent(service)}`}
                  className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors group"
                >
                  <span className="text-white text-xs font-medium">{service}</span>
                  <ChevronRight className="w-3 h-3 text-white/50 group-hover:text-white transition-colors" />
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
