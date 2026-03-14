'use client';

import { useEffect, useState, useCallback } from 'react';
import { Loader2, ChevronLeft, ChevronRight, X, CalendarDays } from 'lucide-react';
import { VendorLayout } from '@/components/layout';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/cn';

interface CalendarData {
  blockedDates: string[];
  bookingDates: Array<{ date: string; bookingId: string; status: string }>;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function CalendarPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<CalendarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

  const fetchCalendar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<CalendarData>(`/vendor/calendar?year=${year}&month=${month}`);
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load calendar');
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    fetchCalendar();
  }, [fetchCalendar]);

  function prevMonth() {
    if (month === 1) {
      setYear(year - 1);
      setMonth(12);
    } else {
      setMonth(month - 1);
    }
  }

  function nextMonth() {
    if (month === 12) {
      setYear(year + 1);
      setMonth(1);
    } else {
      setMonth(month + 1);
    }
  }

  async function toggleBlock(dateStr: string) {
    if (!data) return;
    setActionLoading(true);
    try {
      if (data.blockedDates.includes(dateStr)) {
        await api(`/vendor/calendar/block?date=${dateStr}`, { method: 'DELETE' });
      } else {
        await api('/vendor/calendar/block', {
          method: 'POST',
          body: JSON.stringify({ date: dateStr }),
        });
      }
      fetchCalendar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setActionLoading(false);
    }
  }

  // Build calendar grid
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const blockedSet = new Set(data?.blockedDates ?? []);
  const bookingMap = new Map<string, { bookingId: string; status: string }>();
  data?.bookingDates.forEach((b) => bookingMap.set(b.date, b));

  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  // Upcoming bookings in current month (not completed/cancelled)
  const upcomingBookings = (data?.bookingDates ?? [])
    .filter((b) => b.date >= todayStr && !['COMPLETED', 'CANCELLED'].includes(b.status))
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <VendorLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Calendar</h1>
        <p className="text-sm text-slate-500">
          Manage your availability — click a date to block or unblock it
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Calendar */}
        <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-6">
          {/* Month Navigation */}
          <div className="mb-6 flex items-center justify-between">
            <button
              onClick={prevMonth}
              className="flex items-center justify-center rounded-lg p-2 text-slate-600 hover:bg-slate-100"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <h2 className="text-lg font-bold text-slate-900">
              {MONTHS[month - 1]} {year}
            </h2>
            <button
              onClick={nextMonth}
              className="flex items-center justify-center rounded-lg p-2 text-slate-600 hover:bg-slate-100"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            </div>
          ) : (
            <>
              {/* Day Headers */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {DAYS.map((d) => (
                  <div key={d} className="py-1.5 text-center text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {d}
                  </div>
                ))}
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-1">
                {cells.map((day, i) => {
                  if (day === null) {
                    return <div key={`e-${i}`} className="aspect-square" />;
                  }

                  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const isBlocked = blockedSet.has(dateStr);
                  const booking = bookingMap.get(dateStr);
                  const isToday = dateStr === todayStr;
                  const isPast = dateStr < todayStr;
                  const isHovered = hoveredDate === dateStr;

                  return (
                    <button
                      key={dateStr}
                      onClick={() => !booking && !isPast && toggleBlock(dateStr)}
                      disabled={!!booking || actionLoading || isPast}
                      onMouseEnter={() => setHoveredDate(dateStr)}
                      onMouseLeave={() => setHoveredDate(null)}
                      title={
                        booking
                          ? `Booking ${booking.bookingId.slice(-8)} (${booking.status})`
                          : isBlocked
                            ? 'Click to unblock'
                            : isPast
                              ? 'Past date'
                              : 'Click to block'
                      }
                      className={cn(
                        'relative flex aspect-square flex-col items-center justify-center rounded-xl text-sm transition-all',
                        // Today ring
                        isToday && 'ring-2 ring-emerald-500 ring-offset-1',
                        // Booking — blue
                        booking && 'bg-blue-100 text-blue-800 cursor-default',
                        // Blocked by vendor — red
                        isBlocked && !booking && 'bg-red-100 text-red-700',
                        // Available — green-ish hover
                        !isBlocked && !booking && !isPast && 'hover:bg-green-50 hover:border hover:border-green-300 text-slate-700',
                        // Past dates — dim
                        isPast && !booking && 'text-slate-300 cursor-default',
                        // Default
                        !isBlocked && !booking && !isPast && !isToday && 'border border-transparent',
                      )}
                    >
                      <span className={cn(
                        'text-sm font-semibold',
                        isToday && 'text-emerald-600',
                        booking && 'text-blue-700',
                        isBlocked && !booking && 'text-red-600',
                      )}>
                        {day}
                      </span>
                      {isBlocked && !booking && (
                        <X className="h-3 w-3 text-red-400 mt-0.5" />
                      )}
                      {booking && (
                        <span className="mt-0.5 text-[9px] font-bold text-blue-600 uppercase">
                          {booking.status === 'COMPLETED' ? 'Done' : 'Booked'}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="mt-5 flex flex-wrap gap-4 border-t border-slate-100 pt-4">
                <LegendItem color="bg-green-100 border border-green-300" label="Available (click to block)" />
                <LegendItem color="bg-red-100" label="Blocked by you" />
                <LegendItem color="bg-blue-100" label="Booking confirmed" />
                <LegendItem color="ring-2 ring-emerald-500" label="Today" />
              </div>

              {/* Tip */}
              <p className="mt-3 text-xs text-slate-400">
                Tip: Click any available date to block it. Click a blocked date to unblock it.
              </p>
            </>
          )}
        </div>

        {/* Sidebar: Upcoming Bookings */}
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="mb-4 flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-slate-500" />
              <h2 className="text-base font-semibold text-slate-900">Upcoming Bookings</h2>
            </div>

            {upcomingBookings.length === 0 ? (
              <p className="text-sm text-slate-400">
                No upcoming bookings this month.
              </p>
            ) : (
              <div className="space-y-3">
                {upcomingBookings.map((b) => (
                  <div
                    key={b.bookingId}
                    className="flex items-start gap-3 rounded-lg border border-blue-100 bg-blue-50 p-3"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
                      <CalendarDays className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-blue-900">
                        {formatDate(b.date)}
                      </p>
                      <p className="text-xs text-blue-600">
                        Booking #{b.bookingId.slice(-8).toUpperCase()}
                      </p>
                      <span className={cn(
                        'mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium',
                        b.status === 'IN_PROGRESS' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                      )}>
                        {b.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Blocked Dates Summary */}
          {data && data.blockedDates.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="mb-3 text-base font-semibold text-slate-900">
                Blocked Dates ({data.blockedDates.length})
              </h2>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {data.blockedDates
                  .filter((d) => d >= todayStr)
                  .sort()
                  .map((dateStr) => (
                    <div key={dateStr} className="flex items-center justify-between py-1">
                      <span className="text-sm text-slate-600">{formatDate(dateStr)}</span>
                      <button
                        onClick={() => toggleBlock(dateStr)}
                        disabled={actionLoading}
                        className="text-xs font-medium text-red-500 hover:text-red-700 disabled:opacity-50"
                      >
                        Unblock
                      </button>
                    </div>
                  ))}
                {data.blockedDates.filter((d) => d >= todayStr).length === 0 && (
                  <p className="text-xs text-slate-400">No upcoming blocked dates.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </VendorLayout>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs text-slate-500">
      <div className={cn('h-4 w-4 rounded-lg', color)} />
      {label}
    </div>
  );
}
