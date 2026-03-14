'use client';

import { useEffect, useState, useCallback } from 'react';
import { Loader2, Search } from 'lucide-react';
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

const vendorTransitions: Record<string, string[]> = {
  CONFIRMED: ['IN_PROGRESS'],
  DEPOSIT_PAID: ['IN_PROGRESS'],
  IN_PROGRESS: ['COMPLETED'],
};

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [transitionLoading, setTransitionLoading] = useState<string | null>(null);
  const [searchId, setSearchId] = useState('');
  const [searchResult, setSearchResult] = useState<Booking | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);

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

  return (
    <VendorLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Bookings</h1>
        <p className="text-sm text-slate-500">Manage your confirmed bookings</p>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="mb-6 flex gap-3">
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
      </form>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
          <button onClick={() => setError('')} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      {loading && (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        </div>
      )}

      {!loading && allBookings.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-400">
          No bookings yet. Accept leads and send quotes to get bookings.
        </div>
      )}

      {!loading && allBookings.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="px-5 py-3 text-left font-medium text-slate-500">Customer</th>
                  <th className="px-5 py-3 text-left font-medium text-slate-500">Category</th>
                  <th className="px-5 py-3 text-left font-medium text-slate-500">Event Date</th>
                  <th className="px-5 py-3 text-right font-medium text-slate-500">Amount</th>
                  <th className="px-5 py-3 text-center font-medium text-slate-500">Status</th>
                  <th className="px-5 py-3 text-right font-medium text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {allBookings.map((booking) => {
                  const transitions = vendorTransitions[booking.status] ?? [];
                  return (
                    <tr key={booking.id} className="border-b border-slate-50">
                      <td className="px-5 py-3">
                        <div className="font-medium text-slate-900">{booking.customer.name}</div>
                        {booking.customer.phone && (
                          <div className="text-xs text-slate-400">{booking.customer.phone}</div>
                        )}
                      </td>
                      <td className="px-5 py-3 text-slate-600">
                        {booking.lead?.category?.name ?? '-'}
                      </td>
                      <td className="px-5 py-3 text-slate-600">
                        {booking.eventDate ? formatDate(booking.eventDate) : '-'}
                      </td>
                      <td className="px-5 py-3 text-right font-medium text-slate-900">
                        {formatPaise(booking.totalPaise)}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span
                          className={cn(
                            'inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium',
                            statusColor[booking.status] || 'bg-slate-100 text-slate-500'
                          )}
                        >
                          {booking.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        {transitions.map((t) => (
                          <button
                            key={t}
                            onClick={() => handleTransition(booking.id, t)}
                            disabled={transitionLoading === booking.id}
                            className="ml-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                          >
                            {transitionLoading === booking.id ? (
                              <Loader2 className="inline h-3 w-3 animate-spin" />
                            ) : (
                              t.replace(/_/g, ' ')
                            )}
                          </button>
                        ))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </VendorLayout>
  );
}
