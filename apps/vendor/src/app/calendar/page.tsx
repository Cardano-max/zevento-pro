'use client';

import { useEffect, useState, useCallback } from 'react';
import { Loader2, ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import { VendorLayout } from '@/components/layout';
import { api } from '@/lib/api';
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

  return (
    <VendorLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Calendar</h1>
        <p className="text-sm text-slate-500">Block dates and view your booking schedule</p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
          <button onClick={() => setError('')} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <button onClick={prevMonth} className="rounded-lg p-2 hover:bg-slate-100">
            <ChevronLeft className="h-5 w-5 text-slate-600" />
          </button>
          <h2 className="text-lg font-semibold text-slate-900">
            {MONTHS[month - 1]} {year}
          </h2>
          <button onClick={nextMonth} className="rounded-lg p-2 hover:bg-slate-100">
            <ChevronRight className="h-5 w-5 text-slate-600" />
          </button>
        </div>

        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
          </div>
        ) : (
          <>
            {/* Day Headers */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {DAYS.map((d) => (
                <div key={d} className="py-2 text-center text-xs font-medium text-slate-400">
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

                return (
                  <button
                    key={dateStr}
                    onClick={() => !booking && toggleBlock(dateStr)}
                    disabled={!!booking || actionLoading}
                    className={cn(
                      'relative flex aspect-square flex-col items-center justify-center rounded-lg text-sm transition-colors',
                      isToday && 'ring-2 ring-emerald-500',
                      isBlocked && !booking && 'bg-red-50 text-red-600',
                      booking && 'bg-emerald-50 text-emerald-700 cursor-default',
                      !isBlocked && !booking && 'hover:bg-slate-50 text-slate-700',
                    )}
                  >
                    <span className={cn('font-medium', isToday && 'text-emerald-600')}>
                      {day}
                    </span>
                    {isBlocked && !booking && (
                      <X className="h-3 w-3 text-red-400" />
                    )}
                    {booking && (
                      <span className="text-[10px] font-medium">
                        {booking.status === 'COMPLETED' ? 'Done' : 'Booked'}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="mt-6 flex flex-wrap gap-4 border-t border-slate-100 pt-4">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <div className="h-3 w-3 rounded bg-emerald-50 ring-1 ring-emerald-200" />
                Booked
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <div className="h-3 w-3 rounded bg-red-50 ring-1 ring-red-200" />
                Blocked
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <div className="h-3 w-3 rounded ring-2 ring-emerald-500" />
                Today
              </div>
            </div>
          </>
        )}
      </div>
    </VendorLayout>
  );
}
