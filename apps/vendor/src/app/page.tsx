'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Inbox,
  IndianRupee,
  TrendingUp,
  CheckCircle,
  Loader2,
  CalendarDays,
  UserCircle,
  Star,
  ArrowRight,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import { VendorLayout } from '@/components/layout';
import { api } from '@/lib/api';
import { formatPaise, formatDate, formatDateTime } from '@/lib/format';
import { cn } from '@/lib/cn';

interface EarningsData {
  leadsReceived: number;
  leadsWon: number;
  completedBookings: number;
  totalEarningsPaise: number;
  recentBookings?: Array<{
    id: string;
    status: string;
    eventDate: string;
    totalPaise: number;
    customer: { name: string };
    lead: { category: { name: string } | null };
  }>;
}

interface ProfileData {
  id: string;
  businessName: string;
  onboardingStep: number;
  kycStatus: string;
  vendorStats: {
    averageRating: number;
    totalReviews: number;
    responseRate: number;
  } | null;
}

interface LeadAssignment {
  id: string;
  status: string;
  assignedAt: string;
  lead: {
    id: string;
    customerName: string;
    city: string;
    eventDate: string | null;
    category: { name: string } | null;
    message: string | null;
  };
}

interface InboxResponse {
  items: LeadAssignment[];
  total: number;
}

const statusBadge: Record<string, string> = {
  NOTIFIED: 'bg-blue-100 text-blue-700',
  ACCEPTED: 'bg-green-100 text-green-700',
  DECLINED: 'bg-red-100 text-red-700',
  EXPIRED: 'bg-slate-100 text-slate-500',
};

const onboardingSteps = [
  'Business Details',
  'Portfolio Photos',
  'Service Areas',
  'KYC Documents',
  'KYC Submitted',
];

export default function DashboardPage() {
  const [earnings, setEarnings] = useState<EarningsData | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [recentLeads, setRecentLeads] = useState<LeadAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api<EarningsData>('/vendor/earnings').catch(() => null),
      api<ProfileData>('/vendor/profile/me').catch(() => null),
      api<InboxResponse>('/inbox?page=1&limit=5').catch(() => null),
    ])
      .then(([e, p, inbox]) => {
        if (e) setEarnings(e);
        if (p) setProfile(p);
        if (inbox) setRecentLeads(inbox.items.slice(0, 5));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const conversionRate =
    earnings && earnings.leadsReceived > 0
      ? ((earnings.leadsWon / earnings.leadsReceived) * 100).toFixed(1)
      : '0.0';

  const onboardingStep = profile?.onboardingStep ?? 0;
  const onboardingPct = Math.round((onboardingStep / 5) * 100);

  return (
    <VendorLayout>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {profile?.businessName ? `Welcome back, ${profile.businessName}` : 'Dashboard'}
          </h1>
          <p className="text-sm text-slate-500">Your business performance at a glance</p>
        </div>
        {profile?.vendorStats && profile.vendorStats.totalReviews > 0 && (
          <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2">
            <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
            <span className="text-sm font-bold text-slate-900">
              {profile.vendorStats.averageRating.toFixed(1)}
            </span>
            <span className="text-xs text-slate-400">
              ({profile.vendorStats.totalReviews} reviews)
            </span>
          </div>
        )}
      </div>

      {loading && (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && (
        <div className="space-y-6">
          {/* KYC / Onboarding Alert */}
          {profile && profile.kycStatus !== 'VERIFIED' && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-800">
                  {profile.kycStatus === 'PENDING'
                    ? 'KYC Verification Pending'
                    : profile.kycStatus === 'REJECTED'
                      ? 'KYC Verification Rejected'
                      : 'Complete KYC to Start Receiving Leads'}
                </p>
                <p className="mt-0.5 text-sm text-amber-700">
                  {profile.kycStatus === 'PENDING'
                    ? 'Your KYC documents are under review. You will start receiving leads once approved.'
                    : profile.kycStatus === 'REJECTED'
                      ? 'Your KYC was rejected. Please re-upload your documents on the Profile page.'
                      : 'Complete your profile and submit KYC verification to get more leads from customers.'}
                </p>
              </div>
              <Link
                href="/profile"
                className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700"
              >
                Go to Profile
              </Link>
            </div>
          )}

          {/* Onboarding Progress */}
          {profile && onboardingStep < 5 && (
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900">Profile Completion</h2>
                <span className="text-sm font-bold text-emerald-600">{onboardingPct}%</span>
              </div>
              <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${onboardingPct}%` }}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {onboardingSteps.map((label, idx) => {
                  const stepNum = idx + 1;
                  const done = onboardingStep >= stepNum;
                  return (
                    <span
                      key={label}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
                        done
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-100 text-slate-400'
                      )}
                    >
                      {done ? '✓' : stepNum}. {label}
                    </span>
                  );
                })}
              </div>
              <Link
                href="/profile"
                className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-emerald-600 hover:text-emerald-700"
              >
                Complete your profile
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}

          {/* Stat Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              title="Total Leads"
              value={earnings?.leadsReceived.toLocaleString('en-IN') ?? '0'}
              icon={Inbox}
              color="bg-blue-50 text-blue-600"
            />
            <MetricCard
              title="Leads Won"
              value={earnings?.leadsWon.toLocaleString('en-IN') ?? '0'}
              icon={CheckCircle}
              color="bg-green-50 text-green-600"
            />
            <MetricCard
              title="Completed Bookings"
              value={earnings?.completedBookings.toLocaleString('en-IN') ?? '0'}
              icon={TrendingUp}
              color="bg-amber-50 text-amber-600"
            />
            <MetricCard
              title="Total Earnings"
              value={formatPaise(earnings?.totalEarningsPaise ?? 0)}
              icon={IndianRupee}
              color="bg-emerald-50 text-emerald-600"
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Recent Leads */}
            <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <h2 className="text-base font-semibold text-slate-900">Recent Lead Assignments</h2>
                <Link
                  href="/inbox"
                  className="flex items-center gap-1 text-sm font-medium text-emerald-600 hover:text-emerald-700"
                >
                  View all
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              {recentLeads.length === 0 ? (
                <div className="p-8 text-center">
                  <Inbox className="mx-auto h-8 w-8 text-slate-300" />
                  <p className="mt-2 text-sm text-slate-400">
                    No leads yet. They&apos;ll appear here when customers match your profile.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {recentLeads.map((item) => (
                    <div key={item.id} className="flex items-center justify-between px-5 py-3.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900">
                          {item.lead.customerName}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-400">
                          {item.lead.category?.name ?? 'General'}
                          {item.lead.city && ` · ${item.lead.city}`}
                          {item.lead.eventDate && ` · ${formatDate(item.lead.eventDate)}`}
                        </p>
                      </div>
                      <div className="ml-3 flex shrink-0 items-center gap-3">
                        <span className="text-xs text-slate-400">
                          {formatDateTime(item.assignedAt)}
                        </span>
                        <span
                          className={cn(
                            'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                            statusBadge[item.status] || 'bg-slate-100 text-slate-500'
                          )}
                        >
                          {item.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              {/* Quick Actions */}
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <h2 className="mb-4 text-base font-semibold text-slate-900">Quick Actions</h2>
                <div className="space-y-2">
                  <QuickAction href="/calendar" icon={CalendarDays} label="Update Availability" />
                  <QuickAction href="/profile" icon={UserCircle} label="Edit Profile" />
                  <QuickAction href="/reviews" icon={Star} label="View Reviews" />
                  <QuickAction href="/inbox" icon={Inbox} label="Check Inbox" />
                </div>
              </div>

              {/* Performance */}
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <h2 className="mb-4 text-base font-semibold text-slate-900">Performance</h2>
                <div className="space-y-3">
                  <StatRow label="Conversion Rate" value={`${conversionRate}%`} />
                  <StatRow
                    label="Avg Rating"
                    value={
                      profile?.vendorStats
                        ? `${profile.vendorStats.averageRating.toFixed(1)} / 5`
                        : 'No reviews'
                    }
                  />
                  <StatRow
                    label="Response Rate"
                    value={
                      profile?.vendorStats
                        ? `${(profile.vendorStats.responseRate * 100).toFixed(0)}%`
                        : 'N/A'
                    }
                  />
                </div>
              </div>

              {/* Upcoming Bookings */}
              {earnings?.recentBookings && earnings.recentBookings.length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-base font-semibold text-slate-900">Upcoming Bookings</h2>
                    <Link
                      href="/bookings"
                      className="text-xs font-medium text-emerald-600 hover:text-emerald-700"
                    >
                      View all
                    </Link>
                  </div>
                  <div className="space-y-2">
                    {earnings.recentBookings
                      .filter((b) => ['CONFIRMED', 'IN_PROGRESS'].includes(b.status))
                      .slice(0, 3)
                      .map((b) => (
                        <div key={b.id} className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50">
                            <Clock className="h-4 w-4 text-blue-600" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium text-slate-900">
                              {b.customer.name}
                            </p>
                            <p className="text-xs text-slate-400">
                              {b.eventDate ? formatDate(b.eventDate) : 'Date TBD'}
                            </p>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </VendorLayout>
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

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-50 pb-3 last:border-0 last:pb-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-semibold text-slate-900">{value}</span>
    </div>
  );
}

function QuickAction({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
    >
      <Icon className="h-4 w-4 shrink-0 text-slate-400" />
      {label}
      <ArrowRight className="ml-auto h-3.5 w-3.5 text-slate-300" />
    </Link>
  );
}
