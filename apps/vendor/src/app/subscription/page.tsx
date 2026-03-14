'use client';

import { useEffect, useState } from 'react';
import { Loader2, Crown, CheckCircle, CreditCard, Calendar, Zap, Shield, TrendingUp } from 'lucide-react';
import { VendorLayout } from '@/components/layout';
import { api } from '@/lib/api';
import { formatPaise, formatDate } from '@/lib/format';
import { cn } from '@/lib/cn';

interface Plan {
  id: string;
  name: string;
  amountPaise: number;
  periodMonths: number;
  features: string[];
}

interface Subscription {
  id: string;
  status: string;
  currentPeriodEnd: string;
  currentPeriodStart?: string;
  plan: { name: string; amountPaise: number };
}

// Hardcoded feature lists per plan tier
const PLAN_FEATURES: Record<string, string[]> = {
  BASIC: [
    'Up to 10 leads per month',
    'Basic profile listing',
    'Customer messaging',
    'Quote submission',
    'Email support',
  ],
  PRO: [
    'Up to 50 leads per month',
    'Priority profile listing',
    'Customer messaging & calls',
    'Quote submission with custom terms',
    'Calendar availability management',
    'Review response feature',
    'Priority support',
  ],
  PREMIUM: [
    'Unlimited leads per month',
    'Top-ranked profile listing',
    'Customer messaging, calls & video',
    'Advanced quote builder',
    'Calendar & booking management',
    'Portfolio showcase (up to 50 photos)',
    'Review response & analytics',
    'Dedicated account manager',
    'Early access to new features',
  ],
};

function getPlanFeatures(planName: string, apiFeatures: string[]): string[] {
  if (apiFeatures && apiFeatures.length > 0) return apiFeatures;
  const upper = planName.toUpperCase();
  return PLAN_FEATURES[upper] || PLAN_FEATURES['BASIC'];
}

const statusColors: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  AUTHENTICATED: 'bg-blue-100 text-blue-700',
  CREATED: 'bg-amber-100 text-amber-700',
  CANCELLED: 'bg-red-100 text-red-700',
  EXPIRED: 'bg-slate-100 text-slate-500',
};

export default function SubscriptionPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  useEffect(() => {
    Promise.all([
      api<Plan[]>('/subscriptions/plans'),
      api<Subscription>('/subscriptions/me').catch(() => null),
    ])
      .then(([p, s]) => {
        setPlans(p);
        if (s) setSubscription(s);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleCheckout(planId: string) {
    setCheckoutLoading(planId);
    try {
      const res = await api<{ subscriptionId: string; shortUrl: string }>('/subscriptions/checkout', {
        method: 'POST',
        body: JSON.stringify({ planId }),
      });
      if (res.shortUrl) {
        window.location.href = res.shortUrl;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout failed');
    } finally {
      setCheckoutLoading(null);
    }
  }

  async function handleCancel() {
    setCancelLoading(true);
    try {
      await api('/subscriptions/cancel', { method: 'POST' });
      const s = await api<Subscription>('/subscriptions/me').catch(() => null);
      if (s) setSubscription(s);
      setShowCancelConfirm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cancellation failed');
    } finally {
      setCancelLoading(false);
    }
  }

  const planFeatureIcons = [Zap, Shield, TrendingUp, CreditCard, Calendar, CheckCircle, Crown];

  return (
    <VendorLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Subscription</h1>
        <p className="text-sm text-slate-500">Manage your plan and billing</p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
          <button onClick={() => setError('')} className="ml-2 underline">
            Dismiss
          </button>
        </div>
      )}

      {loading && (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        </div>
      )}

      {!loading && (
        <div className="space-y-6">
          {/* Current Subscription Card */}
          {subscription ? (
            <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-600">
                    <Crown className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-bold text-slate-900">
                        {subscription.plan.name}
                      </h2>
                      <span
                        className={cn(
                          'rounded-full px-2.5 py-0.5 text-xs font-medium',
                          statusColors[subscription.status] || 'bg-slate-100 text-slate-500'
                        )}
                      >
                        {subscription.status}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      {formatPaise(subscription.plan.amountPaise)} / month
                    </p>
                    <div className="mt-3 flex flex-wrap gap-4">
                      {subscription.currentPeriodStart && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <Calendar className="h-3.5 w-3.5" />
                          Started: {formatDate(subscription.currentPeriodStart)}
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Calendar className="h-3.5 w-3.5" />
                        Renews: {formatDate(subscription.currentPeriodEnd)}
                      </div>
                    </div>
                  </div>
                </div>

                {subscription.status === 'ACTIVE' && (
                  <div>
                    {showCancelConfirm ? (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-600">Are you sure?</span>
                        <button
                          onClick={handleCancel}
                          disabled={cancelLoading}
                          className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          {cancelLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Yes, Cancel'}
                        </button>
                        <button
                          onClick={() => setShowCancelConfirm(false)}
                          className="text-xs text-slate-500 hover:text-slate-700"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowCancelConfirm(true)}
                        className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                      >
                        Cancel Plan
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Plan features for current plan */}
              <div className="mt-5 border-t border-emerald-100 pt-5">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  What&apos;s included
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {getPlanFeatures(subscription.plan.name, []).map((feature, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-slate-700">
                      <CheckCircle className="h-4 w-4 shrink-0 text-emerald-500" />
                      {feature}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
              <div className="flex items-start gap-3">
                <Crown className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">No Active Subscription</p>
                  <p className="mt-0.5 text-sm text-amber-700">
                    Subscribe to a plan to start receiving leads and bookings.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Available Plans */}
          <div>
            <h2 className="mb-4 text-lg font-semibold text-slate-900">
              {subscription ? 'Available Plans' : 'Choose a Plan'}
            </h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {plans.map((plan, planIdx) => {
                const isCurrent = subscription?.plan.name === plan.name;
                const features = getPlanFeatures(plan.name, plan.features);
                const isPopular = plan.name.toUpperCase() === 'PRO';

                return (
                  <div
                    key={plan.id}
                    className={cn(
                      'relative rounded-xl border bg-white p-6 transition-shadow hover:shadow-sm',
                      isCurrent
                        ? 'border-emerald-300 ring-2 ring-emerald-200'
                        : isPopular
                          ? 'border-indigo-200 ring-1 ring-indigo-100'
                          : 'border-slate-200'
                    )}
                  >
                    {isPopular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="rounded-full bg-indigo-600 px-3 py-0.5 text-xs font-semibold text-white">
                          Most Popular
                        </span>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-slate-900">{plan.name}</h3>
                      {isCurrent && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          Current
                        </span>
                      )}
                    </div>

                    <p className="mt-2 text-3xl font-bold text-slate-900">
                      {formatPaise(plan.amountPaise)}
                      <span className="text-base font-normal text-slate-500">
                        /{plan.periodMonths === 1 ? 'mo' : `${plan.periodMonths} mo`}
                      </span>
                    </p>

                    <ul className="mt-4 space-y-2">
                      {features.map((f, i) => {
                        const FeatureIcon = planFeatureIcons[i % planFeatureIcons.length];
                        return (
                          <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                            <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                            {f}
                          </li>
                        );
                      })}
                    </ul>

                    <button
                      onClick={() => handleCheckout(plan.id)}
                      disabled={isCurrent || checkoutLoading === plan.id}
                      className={cn(
                        'mt-6 w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50',
                        isCurrent
                          ? 'cursor-default border border-emerald-300 bg-emerald-50 text-emerald-700'
                          : isPopular
                            ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                            : 'bg-emerald-600 text-white hover:bg-emerald-700'
                      )}
                    >
                      {checkoutLoading === plan.id ? (
                        <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                      ) : isCurrent ? (
                        'Current Plan'
                      ) : subscription ? (
                        'Switch Plan'
                      ) : (
                        'Get Started'
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Support note */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500 text-center">
            Need a custom plan for your business? Contact{' '}
            <a href="mailto:support@zevento.in" className="font-medium text-emerald-600 hover:underline">
              support@zevento.in
            </a>
          </div>
        </div>
      )}
    </VendorLayout>
  );
}
