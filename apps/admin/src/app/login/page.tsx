'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Phone, KeyRound, ArrowRight, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';

export default function LoginPage() {
  const router = useRouter();
  const setToken = useAuthStore((s) => s.setToken);

  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const fullPhone = phone.startsWith('+91') ? phone : `+91${phone}`;
      await api('/auth/otp/send', {
        method: 'POST',
        body: JSON.stringify({ phone: fullPhone }),
      });
      setStep('otp');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const fullPhone = phone.startsWith('+91') ? phone : `+91${phone}`;
      const res = await api<{ accessToken: string }>('/auth/otp/verify', {
        method: 'POST',
        body: JSON.stringify({ phone: fullPhone, otp, role: 'ADMIN' }),
      });
      setToken(res.accessToken);
      router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600">
            <span className="text-2xl font-bold text-white">Z</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Zevento Pro Admin</h1>
          <p className="mt-1 text-sm text-slate-500">Sign in to your admin account</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          {step === 'phone' ? (
            <form onSubmit={handleSendOtp} className="space-y-5">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Phone Number
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Phone className="h-4 w-4 text-slate-400" />
                  </div>
                  <div className="absolute inset-y-0 left-9 flex items-center text-sm text-slate-500">
                    +91
                  </div>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                    placeholder="9876543210"
                    maxLength={10}
                    required
                    className="block w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-[4.5rem] pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              {error && (
                <p className="text-sm text-red-600">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading || phone.length < 10}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Send OTP
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-5">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Enter OTP
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <KeyRound className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="Enter 6-digit OTP"
                    maxLength={6}
                    required
                    autoFocus
                    className="block w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  OTP sent to +91{phone}
                </p>
              </div>

              {error && (
                <p className="text-sm text-red-600">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading || otp.length < 4}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Verify & Sign In
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep('phone');
                  setOtp('');
                  setError('');
                }}
                className="w-full text-center text-sm text-slate-500 hover:text-slate-700"
              >
                Change phone number
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
