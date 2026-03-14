'use client';

import { useEffect, useState } from 'react';
import { LoaderCircle, BookOpen, TrendingUp } from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';

interface ConversionItem {
  status: string;
  count: number;
}

interface DashboardData {
  conversionFunnel: ConversionItem[];
  activeVendorCount: number;
  revenueByStream: Array<{ type: string; count: number; totalAmountPaise: number }>;
}

const statusBadge: Record<string, string> = {
  NEW: 'bg-blue-100 text-blue-700',
  CONTACTED: 'bg-cyan-100 text-cyan-700',
  QUALIFIED: 'bg-teal-100 text-teal-700',
  PROPOSAL_SENT: 'bg-amber-100 text-amber-700',
  NEGOTIATION: 'bg-orange-100 text-orange-700',
  WON: 'bg-green-100 text-green-700',
  LOST: 'bg-red-100 text-red-700',
  EXPIRED: 'bg-slate-100 text-slate-500',
};

const statusBarColors: Record<string, string> = {
  NEW: 'bg-blue-500',
  CONTACTED: 'bg-cyan-500',
  QUALIFIED: 'bg-teal-500',
  PROPOSAL_SENT: 'bg-amber-500',
  NEGOTIATION: 'bg-orange-500',
  WON: 'bg-green-500',
  LOST: 'bg-red-500',
  EXPIRED: 'bg-slate-400',
};

// Stage groupings for a booking-focused view
const BOOKING_STAGES = [
  { label: 'Inquiry Received', statuses: ['NEW', 'CONTACTED'] },
  { label: 'Qualified Leads', statuses: ['QUALIFIED'] },
  { label: 'Proposals Sent', statuses: ['PROPOSAL_SENT', 'NEGOTIATION'] },
  { label: 'Bookings Won', statuses: ['WON'] },
  { label: 'Lost / Expired', statuses: ['LOST', 'EXPIRED'] },
];

export default function BookingsPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api<DashboardData>('/admin/analytics/dashboard')
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const totalLeads = data ? data.conversionFunnel.reduce((s, r) => s + r.count, 0) : 0;
  const wonLeads = data ? (data.conversionFunnel.find((r) => r.status === 'WON')?.count ?? 0) : 0;
  const lostLeads = data ? (data.conversionFunnel.find((r) => r.status === 'LOST')?.count ?? 0) : 0;
  const pendingLeads = data
    ? data.conversionFunnel
        .filter((r) => !['WON', 'LOST', 'EXPIRED'].includes(r.status))
        .reduce((s, r) => s + r.count, 0)
    : 0;
  const conversionRate = totalLeads > 0 ? ((wonLeads / totalLeads) * 100).toFixed(1) : '0.0';

  function getStageCount(statuses: string[]) {
    if (!data) return 0;
    return data.conversionFunnel
      .filter((r) => statuses.includes(r.status))
      .reduce((s, r) => s + r.count, 0);
  }

  return (
    <AdminLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Bookings Overview</h1>
          <p className="text-sm text-slate-500">Booking and conversion analytics across the platform</p>
        </div>
      </div>

      {/* Note about endpoint availability */}
      <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
        <strong>Analytics view:</strong> Individual booking records are managed per-vendor. This page shows platform-wide booking funnel analytics from the dashboard endpoint.
      </div>

      {loading && (
        <div className="flex h-64 items-center justify-center">
          <LoaderCircle className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {data && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard
              title="Total Leads"
              value={totalLeads.toLocaleString('en-IN')}
              icon={BookOpen}
              color="bg-blue-50 text-blue-600"
            />
            <SummaryCard
              title="Bookings Won"
              value={wonLeads.toLocaleString('en-IN')}
              icon={BookOpen}
              color="bg-green-50 text-green-600"
            />
            <SummaryCard
              title="In Pipeline"
              value={pendingLeads.toLocaleString('en-IN')}
              icon={TrendingUp}
              color="bg-amber-50 text-amber-600"
            />
            <SummaryCard
              title="Conversion Rate"
              value={`${conversionRate}%`}
              icon={TrendingUp}
              color="bg-indigo-50 text-indigo-600"
            />
          </div>

          {/* Booking Stage Summary */}
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Booking Stages</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {BOOKING_STAGES.map((stage) => {
                const count = getStageCount(stage.statuses);
                const pct = totalLeads > 0 ? ((count / totalLeads) * 100).toFixed(1) : '0.0';
                return (
                  <div
                    key={stage.label}
                    className="rounded-lg border border-slate-100 bg-slate-50 p-4 text-center"
                  >
                    <p className="text-xs font-medium text-slate-500 mb-1">{stage.label}</p>
                    <p className="text-2xl font-bold text-slate-900">{count.toLocaleString('en-IN')}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{pct}% of total</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Conversion Funnel — detailed */}
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Detailed Conversion Funnel</h2>
            <div className="space-y-3">
              {data.conversionFunnel.map((item) => {
                const maxCount = Math.max(...data.conversionFunnel.map((f) => f.count), 1);
                const barPct = (item.count / maxCount) * 100;
                const totalPct = totalLeads > 0 ? ((item.count / totalLeads) * 100).toFixed(1) : '0.0';

                return (
                  <div key={item.status} className="flex items-center gap-4">
                    <div className="flex w-40 shrink-0 items-center gap-2">
                      <span
                        className={cn(
                          'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                          statusBadge[item.status] || 'bg-slate-100 text-slate-600'
                        )}
                      >
                        {item.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="relative flex-1">
                      <div className="h-8 w-full rounded-md bg-slate-100" />
                      <div
                        className={cn(
                          'absolute left-0 top-0 h-8 rounded-md transition-all',
                          statusBarColors[item.status] || 'bg-indigo-500'
                        )}
                        style={{ width: `${Math.max(barPct, 2)}%` }}
                      />
                      <span className="absolute inset-y-0 left-3 flex items-center text-xs font-bold text-white mix-blend-difference">
                        {item.count.toLocaleString('en-IN')}
                      </span>
                    </div>
                    <span className="w-14 shrink-0 text-right text-sm font-medium text-slate-600">
                      {totalPct}%
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Win / Loss summary */}
            <div className="mt-6 flex items-center gap-6 border-t border-slate-100 pt-4 text-sm">
              <div>
                <span className="text-slate-500">Won:</span>{' '}
                <span className="font-semibold text-green-700">
                  {wonLeads.toLocaleString('en-IN')} ({conversionRate}%)
                </span>
              </div>
              <div>
                <span className="text-slate-500">Lost:</span>{' '}
                <span className="font-semibold text-red-700">
                  {lostLeads.toLocaleString('en-IN')} (
                  {totalLeads > 0 ? ((lostLeads / totalLeads) * 100).toFixed(1) : '0.0'}%)
                </span>
              </div>
              <div>
                <span className="text-slate-500">Active pipeline:</span>{' '}
                <span className="font-semibold text-slate-700">
                  {pendingLeads.toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

function SummaryCard({
  title,
  value,
  icon: Icon,
  color,
}: {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">{title}</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
        </div>
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', color)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
