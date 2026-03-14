'use client';

import { useEffect, useState } from 'react';
import { BarChart3, Users, IndianRupee, TrendingUp, Loader2 } from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import { api } from '@/lib/api';
import { formatPaise } from '@/lib/format';
import { cn } from '@/lib/cn';

interface DashboardData {
  summary: {
    totalLeads: number;
    activeVendors: number;
    totalRevenuePaise: number;
    conversionRate: number;
  };
  conversionFunnel: Array<{
    status: string;
    count: number;
  }>;
  leadsPerCity: Array<{
    city: string;
    count: number;
  }>;
  revenueByStream: Array<{
    type: string;
    count: number;
    totalPaise: number;
  }>;
}

const statusColors: Record<string, string> = {
  NEW: 'bg-blue-500',
  CONTACTED: 'bg-cyan-500',
  QUALIFIED: 'bg-teal-500',
  PROPOSAL_SENT: 'bg-amber-500',
  NEGOTIATION: 'bg-orange-500',
  WON: 'bg-green-500',
  LOST: 'bg-red-500',
  EXPIRED: 'bg-slate-400',
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api<DashboardData>('/admin/analytics/dashboard')
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500">Analytics overview for your platform</p>
      </div>

      {loading && (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {data && (
        <div className="space-y-6">
          {/* Metric Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              title="Total Leads"
              value={data.summary.totalLeads.toLocaleString('en-IN')}
              icon={BarChart3}
              color="bg-blue-50 text-blue-600"
            />
            <MetricCard
              title="Active Vendors"
              value={data.summary.activeVendors.toLocaleString('en-IN')}
              icon={Users}
              color="bg-green-50 text-green-600"
            />
            <MetricCard
              title="Revenue"
              value={formatPaise(data.summary.totalRevenuePaise)}
              icon={IndianRupee}
              color="bg-indigo-50 text-indigo-600"
            />
            <MetricCard
              title="Conversion Rate"
              value={`${data.summary.conversionRate.toFixed(1)}%`}
              icon={TrendingUp}
              color="bg-amber-50 text-amber-600"
            />
          </div>

          {/* Conversion Funnel */}
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Conversion Funnel</h2>
            <div className="space-y-3">
              {data.conversionFunnel.map((item) => {
                const maxCount = Math.max(...data.conversionFunnel.map((f) => f.count), 1);
                const pct = (item.count / maxCount) * 100;

                return (
                  <div key={item.status} className="flex items-center gap-4">
                    <span className="w-36 shrink-0 text-sm font-medium text-slate-600">
                      {item.status.replace(/_/g, ' ')}
                    </span>
                    <div className="relative flex-1">
                      <div className="h-8 w-full rounded-md bg-slate-100" />
                      <div
                        className={cn(
                          'absolute left-0 top-0 h-8 rounded-md transition-all',
                          statusColors[item.status] || 'bg-indigo-500'
                        )}
                        style={{ width: `${Math.max(pct, 2)}%` }}
                      />
                      <span className="absolute inset-y-0 left-3 flex items-center text-xs font-semibold text-white mix-blend-difference">
                        {item.count}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Leads Per City */}
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">Leads Per City</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="pb-3 text-left font-medium text-slate-500">City</th>
                      <th className="pb-3 text-right font-medium text-slate-500">Leads</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.leadsPerCity.map((row) => (
                      <tr key={row.city} className="border-b border-slate-50">
                        <td className="py-2.5 text-slate-700">{row.city}</td>
                        <td className="py-2.5 text-right font-medium text-slate-900">
                          {row.count.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))}
                    {data.leadsPerCity.length === 0 && (
                      <tr>
                        <td colSpan={2} className="py-4 text-center text-slate-400">
                          No data available
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Revenue By Stream */}
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">Revenue By Stream</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="pb-3 text-left font-medium text-slate-500">Type</th>
                      <th className="pb-3 text-right font-medium text-slate-500">Count</th>
                      <th className="pb-3 text-right font-medium text-slate-500">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.revenueByStream.map((row) => (
                      <tr key={row.type} className="border-b border-slate-50">
                        <td className="py-2.5 text-slate-700">{row.type}</td>
                        <td className="py-2.5 text-right text-slate-600">
                          {row.count.toLocaleString('en-IN')}
                        </td>
                        <td className="py-2.5 text-right font-medium text-slate-900">
                          {formatPaise(row.totalPaise)}
                        </td>
                      </tr>
                    ))}
                    {data.revenueByStream.length === 0 && (
                      <tr>
                        <td colSpan={3} className="py-4 text-center text-slate-400">
                          No data available
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

function MetricCard({
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
