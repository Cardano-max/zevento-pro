'use client';

import { useEffect, useState } from 'react';
import { Inbox, IndianRupee, TrendingUp, CheckCircle, Loader2 } from 'lucide-react';
import { VendorLayout } from '@/components/layout';
import { api } from '@/lib/api';
import { formatPaise } from '@/lib/format';
import { cn } from '@/lib/cn';

interface EarningsData {
  leadsReceived: number;
  leadsWon: number;
  completedBookings: number;
  totalEarningsPaise: number;
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

export default function DashboardPage() {
  const [earnings, setEarnings] = useState<EarningsData | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api<EarningsData>('/vendor/earnings').catch(() => null),
      api<ProfileData>('/vendor/profile/me').catch(() => null),
    ])
      .then(([e, p]) => {
        if (e) setEarnings(e);
        if (p) setProfile(p);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const conversionRate =
    earnings && earnings.leadsReceived > 0
      ? ((earnings.leadsWon / earnings.leadsReceived) * 100).toFixed(1)
      : '0.0';

  return (
    <VendorLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">
          {profile?.businessName ? `Welcome, ${profile.businessName}` : 'Dashboard'}
        </h1>
        <p className="text-sm text-slate-500">Your business performance at a glance</p>
      </div>

      {loading && (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && (
        <div className="space-y-6">
          {/* KYC / Onboarding Alert */}
          {profile && profile.kycStatus !== 'VERIFIED' && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-medium text-amber-800">
                {profile.kycStatus === 'PENDING'
                  ? 'Your KYC is pending review. You will start receiving leads once verified.'
                  : profile.kycStatus === 'REJECTED'
                    ? 'Your KYC was rejected. Please re-upload your documents.'
                    : 'Complete your profile and submit KYC to start receiving leads.'}
              </p>
            </div>
          )}

          {/* Metric Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              title="Leads Received"
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
              title="Total Earnings"
              value={formatPaise(earnings?.totalEarningsPaise ?? 0)}
              icon={IndianRupee}
              color="bg-emerald-50 text-emerald-600"
            />
            <MetricCard
              title="Conversion Rate"
              value={`${conversionRate}%`}
              icon={TrendingUp}
              color="bg-amber-50 text-amber-600"
            />
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Quick Stats */}
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">Performance</h2>
              <div className="space-y-4">
                <StatRow label="Completed Bookings" value={String(earnings?.completedBookings ?? 0)} />
                <StatRow
                  label="Average Rating"
                  value={
                    profile?.vendorStats
                      ? `${profile.vendorStats.averageRating.toFixed(1)} / 5`
                      : 'No reviews yet'
                  }
                />
                <StatRow
                  label="Total Reviews"
                  value={String(profile?.vendorStats?.totalReviews ?? 0)}
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

            {/* Profile Completion */}
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">Profile Status</h2>
              <div className="space-y-3">
                <StepItem step={1} current={profile?.onboardingStep ?? 0} label="Business Details" />
                <StepItem step={2} current={profile?.onboardingStep ?? 0} label="Portfolio Photos" />
                <StepItem step={3} current={profile?.onboardingStep ?? 0} label="Service Areas" />
                <StepItem step={4} current={profile?.onboardingStep ?? 0} label="KYC Documents" />
                <StepItem step={5} current={profile?.onboardingStep ?? 0} label="KYC Submitted" />
              </div>
              {profile && profile.onboardingStep < 5 && (
                <a
                  href="/profile"
                  className="mt-4 inline-flex items-center text-sm font-medium text-emerald-600 hover:text-emerald-700"
                >
                  Complete your profile →
                </a>
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
      <span className="text-sm text-slate-600">{label}</span>
      <span className="text-sm font-semibold text-slate-900">{value}</span>
    </div>
  );
}

function StepItem({ step, current, label }: { step: number; current: number; label: string }) {
  const done = current >= step;
  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold',
          done ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'
        )}
      >
        {done ? '✓' : step}
      </div>
      <span className={cn('text-sm', done ? 'text-slate-700' : 'text-slate-400')}>{label}</span>
    </div>
  );
}
