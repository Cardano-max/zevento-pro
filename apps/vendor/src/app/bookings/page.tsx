'use client';

import { useEffect, useState, useCallback } from 'react';
import { Loader2, Search, Calendar, User, Tag, IndianRupee, ArrowRight } from 'lucide-react';
import { VendorLayout } from '@/components/layout';
import { api } from '@/lib/api';
import { formatPaise, formatDate } from '@/lib/format';
import { cn } from '@/lib/cn';

interface Booking {
  id: string;
  status: string;
  eventDate: string;
  totalPaise: number;
  commissionPaise: number;
  createdAt: string;
  customer: { name: string; phone: string | null };
  lead: { category: { name: string } | null };
}

const statusColor: Record<string, string> = {
  CONFIRMED: 'bg-blue-100 text-blue-700',
  DEPOSIT_PAID: 'bg-cyan-100 text-cyan-700',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  COMPLETED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
};

const vendorTransitions: Record<string, { status: string; label: string; className: string }[]> = {
  CONFIRMED: [{ status: 'IN_PROGRESS', label: 'Mark In Progress', className: 'bg-amber-600 hover:bg-amber-700 text-white' }],
  DEPOSIT_PAID: [{ status: 'IN_PROGRESS', label: 'Mark In Progress', className: 'bg-amber-600 hover:bg-amber-700 text-white' }],
  IN_PROGRESS: [{ status: 'COMPLETED', label: 'Mark Complete', className: 'bg-green-600 hover:bg-green-700 text-white' }],
};

type StatusFilter = 'ALL' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

const FILTER_TABS: { key: StatusFilter; label: string; statuses: string[] }[] = [
  { key: 'ALL', label: 'All', statuses: [] },
  { key: 'ACTIVE', label: 'Active', statuses: ['CONFIRMED', 'DEPOSIT_PAID', 'IN_PROGRESS'] },
  { key: 'COMPLETED', label: 'Completed', statuses: ['COMPLETED'] },
  { key: 'CANCELLED', label: 'Cancelled', statuses: ['CANCELLED'] },
];

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [transitionLoading, setTransitionLoading] = useState<string | null>(null);
  const [searchId, setSearchId] = useState('');
  const [searchResult, setSearchResult] = useState<Booking | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

  const fetchEarnings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<{ recentBookings?: Booking[] }>('/vendor/earnings');
      setBookings(res.recentBookings ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bookings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEarnings();
  }, [fetchEarnings]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!searchId.trim()) return;
    setSearchLoading(true);
    setSearchResult(null);
    try {
      const res = await api<Booking>(`/bookings/${searchId.trim()}`);
      setSearchResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Booking not found');
    } finally {
      setSearchLoading(false);
    }
  }

  async function handleTransition(bookingId: string, status: string) {
    setTransitionLoading(bookingId);
    try {
      await api(`/bookings/${bookingId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      fetchEarnings();
      if (searchResult?.id === bookingId) {
        const res = await api<Booking>(`/bookings/${bookingId}`);
        setSearchResult(res);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setTransitionLoading(null);
    }
  }

  const allBookings = searchResult
    ? [searchResult, ...bookings.filter((b) => b.id !== searchResult.id)]
    : bookings;

  const currentTabDef = FILTER_TABS.find((t) => t.key === statusFilter)!;
  const filteredBookings =
    statusFilter === 'ALL'
      ? allBookings
      : allBookings.filter((b) => currentTabDef.statuses.includes(b.status));

  // Count per filter
  const counts: Record<StatusFilter, number> = {
    ALL: allBookings.length,
    ACTIVE: allBookings.filter((b) => FILTER_TABS.find((t) => t.key === 'ACTIVE')!.statuses.includes(b.status)).length,
    COMPLETED: allBookings.filter((b) => b.status === 'COMPLETED').length,
    CANCELLED: allBookings.filter((b) => b.status === 'CANCELLED').length,
  };

  return (
    <VendorLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Bookings</h1>
        <p className="text-sm text-slate-500">Manage your confirmed bookings and track earnings</p>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="mb-5 flex gap-3">
        <div className="relative max-w-md flex-1">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Search className="h-4 w-4 text-slate-400" />
          </div>
          <input
            type="text"
            value={searchId}
            onChange={(e) => setSearchId(e.target.value)}
            placeholder="Search by Booking ID"
            className="block w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>
        <button
          type="submit"
          disabled={searchLoading}
          className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {searchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
        </button>
        {searchResult && (
          <button
            type="button"
            onClick={() => setSearchResult(null)}
            className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Clear
          </button>
        )}
      </form>

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
        {FILTER_TABS.map((tab) => (
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
            {counts[tab.key] > 0 && (
              <span
                className={cn(
                  'flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 text-[10px] font-bold',
                  statusFilter === tab.key
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-100 text-slate-500'
                )}
              >
                {counts[tab.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        </div>
      )}

      {!loading && filteredBookings.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
            <Calendar className="h-6 w-6 text-slate-400" />
          </div>
          <p className="text-sm text-slate-400">
            {statusFilter === 'ALL'
              ? 'No bookings yet. Accept leads and send quotes to get bookings.'
              : `No ${statusFilter.toLowerCase()} bookings found.`}
          </p>
        </div>
      )}

      {!loading && filteredBookings.length > 0 && (
        <div className="space-y-4">
          {filteredBookings.map((booking) => {
            const transitions = vendorTransitions[booking.status] ?? [];
            const vendorPayout = booking.totalPaise - booking.commissionPaise;

            return (
              <div
                key={booking.id}
                className="rounded-xl border border-slate-200 bg-white p-5 transition-shadow hover:shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  {/* Left: Booking Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-600">
                        {booking.customer.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-slate-900">{booking.customer.name}</p>
                          <span
                            className={cn(
                              'inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium',
                              statusColor[booking.status] || 'bg-slate-100 text-slate-500'
                            )}
                          >
                            {booking.status.replace(/_/g, ' ')}
                          </span>
                        </div>
                        {booking.customer.phone && (
                          <p className="text-xs text-slate-400">{booking.customer.phone}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-4 text-sm text-slate-500">
                      {booking.lead?.category?.name && (
                        <span className="flex items-center gap-1">
                          <Tag className="h-3.5 w-3.5" />
                          {booking.lead.category.name}
                        </span>
                      )}
                      {booking.eventDate && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          Event: {formatDate(booking.eventDate)}
                        </span>
                      )}
                    </div>

                    {/* Payout Breakdown */}
                    <div className="mt-3 flex flex-wrap items-center gap-4">
                      <div className="flex items-center gap-1.5 text-sm">
                        <IndianRupee className="h-4 w-4 text-slate-400" />
                        <span className="text-slate-500">Total:</span>
                        <span className="font-semibold text-slate-900">{formatPaise(booking.totalPaise)}</span>
                      </div>
                      {booking.commissionPaise > 0 && (
                        <>
                          <span className="text-slate-300">·</span>
                          <div className="flex items-center gap-1 text-sm">
                            <span className="text-slate-500">Commission:</span>
                            <span className="font-medium text-red-600">-{formatPaise(booking.commissionPaise)}</span>
                          </div>
                          <span className="text-slate-300">·</span>
                          <div className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 text-sm">
                            <span className="font-medium text-slate-600">Your payout:</span>
                            <span className="font-bold text-emerald-700">{formatPaise(vendorPayout)}</span>
                          </div>
                        </>
                      )}
                    </div>

                    <p className="mt-2 text-xs text-slate-400">
                      Booking #{booking.id.slice(-12).toUpperCase()}
                    </p>
                  </div>

                  {/* Right: Actions */}
                  {transitions.length > 0 && (
                    <div className="flex flex-col gap-2">
                      {transitions.map((t) => (
                        <button
                          key={t.status}
                          onClick={() => handleTransition(booking.id, t.status)}
                          disabled={transitionLoading === booking.id}
                          className={cn(
                            'flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50',
                            t.className
                          )}
                        >
                          {transitionLoading === booking.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <ArrowRight className="h-4 w-4" />
                          )}
                          {t.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </VendorLayout>
  );
}
