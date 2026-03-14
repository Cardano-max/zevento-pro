'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ChartBar,
  Users,
  IndianRupee,
  TrendingUp,
  LoaderCircle,
  Store,
  BookOpen,
  Flag,
  MessageSquare,
  CheckCircle,
} from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import { api } from '@/lib/api';
import { formatPaise, formatDate } from '@/lib/format';
import { cn } from '@/lib/cn';

// Matches the actual API response from /admin/analytics/dashboard
interface DashboardData {
  window: { from: string; to: string };
  activeVendorCount: number;
  conversionFunnel: Array<{ status: string; count: number }>;
  leadsPerCity: Array<{ city: string; count: number }>;
  revenueByStream: Array<{ type: string; count: number; totalAmountPaise: number }>;
}

interface Vendor {
  id: string;
  businessName: string;
  status: string;
  city: string;
  role: string;
  user?: { phone?: string; name?: string };
  createdAt?: string;
}

interface VendorListResponse {
  data: Vendor[];
  total: number;
  page: number;
  totalPages: number;
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

const vendorStatusBadge: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  PENDING_KYC: 'bg-amber-100 text-amber-700',
  KYC_SUBMITTED: 'bg-blue-100 text-blue-700',
  SUSPENDED: 'bg-red-100 text-red-700',
  REJECTED: 'bg-red-100 text-red-700',
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [recentVendors, setRecentVendors] = useState<Vendor[]>([]);
  const [vendorsLoading, setVendorsLoading] = useState(true);

  useEffect(() => {
    api<DashboardData>('/admin/analytics/dashboard')
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));

    api<VendorListResponse>('/admin/vendors?limit=5&page=1')
      .then((res) => setRecentVendors(res.data))
      .catch(() => {})
      .finally(() => setVendorsLoading(false));
  }, []);

  const totalLeads = data ? data.conversionFunnel.reduce((s, r) => s + r.count, 0) : 0;
  const totalRevenuePaise = data ? data.revenueByStream.reduce((s, r) => s + r.totalAmountPaise, 0) : 0;
  const wonLeads = data ? (data.conversionFunnel.find((r) => r.status === 'WON')?.count ?? 0) : 0;
  const conversionRate = totalLeads > 0 ? (wonLeads / totalLeads) * 100 : 0;

  const pendingKycVendors = recentVendors.filter((v) => v.status === 'PENDING_KYC').length;

  const topCities = data
    ? [...data.leadsPerCity].sort((a, b) => b.count - a.count).slice(0, 10)
    : [];
  const maxCityCount = topCities.length > 0 ? Math.max(...topCities.map((c) => c.count), 1) : 1;

  return (
    <AdminLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500">Platform analytics overview</p>
        </div>
        {data && (
          <p className="text-xs text-slate-400">
            Data window: {formatDate(data.window.from)} — {formatDate(data.window.to)}
          </p>
        )}
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
          {/* Top Metric Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <MetricCard
              title="Total Leads"
              value={totalLeads.toLocaleString('en-IN')}
              icon={ChartBar}
              color="bg-blue-50 text-blue-600"
            />
            <MetricCard
              title="Active Vendors"
              value={data.activeVendorCount.toLocaleString('en-IN')}
              icon={Store}
              color="bg-green-50 text-green-600"
            />
            <MetricCard
              title="Bookings (Won)"
              value={wonLeads.toLocaleString('en-IN')}
              icon={BookOpen}
              color="bg-teal-50 text-teal-600"
            />
            <MetricCard
              title="Platform Revenue"
              value={formatPaise(totalRevenuePaise)}
              icon={IndianRupee}
              color="bg-indigo-50 text-indigo-600"
            />
            <MetricCard
              title="Conversion Rate"
              value={`${conversionRate.toFixed(1)}%`}
              icon={TrendingUp}
              color="bg-amber-50 text-amber-600"
            />
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Link
              href="/vendors?status=PENDING_KYC"
              className="flex items-center gap-4 rounded-xl border border-amber-200 bg-amber-50 p-4 hover:bg-amber-100 transition-colors"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500 text-white">
                <CheckCircle className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-900">Pending Approvals</p>
                <p className="text-xs text-amber-700">Review vendor KYC applications</p>
              </div>
              {pendingKycVendors > 0 && (
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white">
                  {pendingKycVendors}
                </span>
              )}
            </Link>

            <Link
              href="/reports"
              className="flex items-center gap-4 rounded-xl border border-red-200 bg-red-50 p-4 hover:bg-red-100 transition-colors"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500 text-white">
                <Flag className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-red-900">Pending Reports</p>
                <p className="text-xs text-red-700">Review user-submitted reports</p>
              </div>
            </Link>

            <Link
              href="/feed"
              className="flex items-center gap-4 rounded-xl border border-purple-200 bg-purple-50 p-4 hover:bg-purple-100 transition-colors"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500 text-white">
                <MessageSquare className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-purple-900">Feed Moderation</p>
                <p className="text-xs text-purple-700">Hide or remove feed posts</p>
              </div>
            </Link>
          </div>

          {/* Conversion Funnel */}
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Conversion Funnel</h2>
            <div className="space-y-3">
              {data.conversionFunnel.map((item) => {
                const maxCount = Math.max(...data.conversionFunnel.map((f) => f.count), 1);
                const pct = (item.count / maxCount) * 100;
                const totalPct = totalLeads > 0 ? ((item.count / totalLeads) * 100).toFixed(1) : '0.0';

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
                    <span className="w-12 shrink-0 text-right text-xs text-slate-500">
                      {totalPct}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Leads Per City — horizontal bar chart */}
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">Leads Per City (Top 10)</h2>
              {topCities.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">No data yet</p>
              ) : (
                <div className="space-y-2.5">
                  {topCities.map((row) => {
                    const pct = (row.count / maxCityCount) * 100;
                    return (
                      <div key={row.city} className="flex items-center gap-3">
                        <span className="w-24 shrink-0 truncate text-xs font-medium text-slate-600">
                          {row.city}
                        </span>
                        <div className="relative flex-1 h-6 rounded bg-slate-100">
                          <div
                            className="absolute left-0 top-0 h-6 rounded bg-indigo-500 transition-all"
                            style={{ width: `${Math.max(pct, 3)}%` }}
                          />
                          <span className="absolute inset-y-0 left-2 flex items-center text-xs font-semibold text-white mix-blend-difference">
                            {row.count}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
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
                          {formatPaise(row.totalAmountPaise)}
                        </td>
                      </tr>
                    ))}
                    {data.revenueByStream.length === 0 && (
                      <tr>
                        <td colSpan={3} className="py-4 text-center text-slate-400">
                          No data yet
                        </td>
                      </tr>
                    )}
                    {data.revenueByStream.length > 0 && (
                      <tr className="border-t border-slate-200 font-semibold">
                        <td className="py-2.5 text-slate-900">Total</td>
                        <td className="py-2.5 text-right text-slate-900">
                          {data.revenueByStream.reduce((s, r) => s + r.count, 0).toLocaleString('en-IN')}
                        </td>
                        <td className="py-2.5 text-right text-indigo-700">
                          {formatPaise(totalRevenuePaise)}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Recent Vendor Registrations */}
          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">Recent Vendor Registrations</h2>
              <Link href="/vendors" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
                View all
              </Link>
            </div>
            {vendorsLoading ? (
              <div className="flex h-32 items-center justify-center">
                <LoaderCircle className="h-5 w-5 animate-spin text-indigo-600" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50">
                      <th className="px-6 py-3 text-left font-medium text-slate-500">Business</th>
                      <th className="px-6 py-3 text-left font-medium text-slate-500">Role</th>
                      <th className="px-6 py-3 text-left font-medium text-slate-500">City</th>
                      <th className="px-6 py-3 text-left font-medium text-slate-500">Phone</th>
                      <th className="px-6 py-3 text-left font-medium text-slate-500">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentVendors.map((vendor) => (
                      <tr key={vendor.id} className="border-b border-slate-50">
                        <td className="px-6 py-3 font-medium text-slate-900">{vendor.businessName}</td>
                        <td className="px-6 py-3 text-slate-600">{vendor.role}</td>
                        <td className="px-6 py-3 text-slate-600">{vendor.city}</td>
                        <td className="px-6 py-3 text-slate-600">{vendor.user?.phone ?? '—'}</td>
                        <td className="px-6 py-3">
                          <span
                            className={cn(
                              'inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium',
                              vendorStatusBadge[vendor.status] || 'bg-slate-100 text-slate-600'
                            )}
                          >
                            {vendor.status.replace(/_/g, ' ')}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {recentVendors.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                          No vendors yet
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
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
