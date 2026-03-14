'use client';

import { useEffect, useState } from 'react';
import { Loader2, Crown, CheckCircle } from 'lucide-react';
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
  plan: { name: string; amountPaise: number };
}

export default function SubscriptionPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);

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
      // Redirect to Razorpay checkout
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cancellation failed');
    } finally {
      setCancelLoading(false);
    }
  }

  return (
    <VendorLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Subscription</h1>
        <p className="text-sm text-slate-500">Manage your subscription plan</p>
      </div>

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

      {!loading && (
        <div className="space-y-6">
          {/* Current Subscription */}
          {subscription && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Crown className="h-5 w-5 text-emerald-600" />
                    <h2 className="text-lg font-semibold text-slate-900">
                      {subscription.plan.name}
                    </h2>
                    <span
                      className={cn(
                        'rounded-full px-2.5 py-0.5 text-xs font-medium',
                        subscription.status === 'ACTIVE'
                          ? 'bg-green-100 text-green-700'
                          : subscription.status === 'AUTHENTICATED'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-slate-100 text-slate-500'
                      )}
                    >
                      {subscription.status}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    {formatPaise(subscription.plan.amountPaise)} / month
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Current period ends: {formatDate(subscription.currentPeriodEnd)}
                  </p>
                </div>
                {subscription.status === 'ACTIVE' && (
                  <button
                    onClick={handleCancel}
                    disabled={cancelLoading}
                    className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    {cancelLoading ? <Loader2 className="inline h-4 w-4 animate-spin" /> : 'Cancel'}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Available Plans */}
          <div>
            <h2 className="mb-4 text-lg font-semibold text-slate-900">
              {subscription ? 'Available Plans' : 'Choose a Plan'}
            </h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {plans.map((plan) => {
                const isCurrent = subscription?.plan.name === plan.name;
                return (
                  <div
                    key={plan.id}
                    className={cn(
                      'rounded-xl border bg-white p-6',
                      isCurrent ? 'border-emerald-300 ring-1 ring-emerald-300' : 'border-slate-200'
                    )}
                  >
                    <h3 className="text-lg font-semibold text-slate-900">{plan.name}</h3>
                    <p className="mt-1 text-2xl font-bold text-slate-900">
                      {formatPaise(plan.amountPaise)}
                      <span className="text-sm font-normal text-slate-500">
                        /{plan.periodMonths === 1 ? 'mo' : `${plan.periodMonths} mo`}
                      </span>
                    </p>

                    {plan.features && plan.features.length > 0 && (
                      <ul className="mt-4 space-y-2">
                        {plan.features.map((f, i) => (
                          <li key={i} className="flex items-center gap-2 text-sm text-slate-600">
                            <CheckCircle className="h-4 w-4 shrink-0 text-emerald-500" />
                            {f}
                          </li>
                        ))}
                      </ul>
                    )}

                    <button
                      onClick={() => handleCheckout(plan.id)}
                      disabled={isCurrent || checkoutLoading === plan.id}
                      className={cn(
                        'mt-5 w-full rounded-lg px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50',
                        isCurrent
                          ? 'border border-emerald-300 bg-emerald-50 text-emerald-700 cursor-default'
                          : 'bg-emerald-600 text-white hover:bg-emerald-700'
                      )}
                    >
                      {checkoutLoading === plan.id ? (
                        <Loader2 className="inline h-4 w-4 animate-spin" />
                      ) : isCurrent ? (
                        'Current Plan'
                      ) : (
                        'Subscribe'
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </VendorLayout>
  );
}
