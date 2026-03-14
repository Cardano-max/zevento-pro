'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Sparkles, Phone, ArrowRight, LoaderCircle, CircleCheck, ChevronLeft } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';

type Step = 'phone' | 'otp' | 'success';

export default function LoginPage() {
  const router = useRouter();
  const { setToken } = useAuthStore();
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [devOtp, setDevOtp] = useState('');

  const formatPhone = (val: string) => val.replace(/\D/g, '').slice(0, 10);

  const handleSendOtp = async () => {
    if (phone.length !== 10) {
      setError('Please enter a valid 10-digit mobile number');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await api<{ message: string; otp?: string }>('/auth/otp/send', {
        method: 'POST',
        body: JSON.stringify({ phone: `+91${phone}` }),
      });
      if (res.otp) setDevOtp(res.otp);
      setStep('otp');
    } catch (e: any) {
      setError(e.message || 'Failed to send OTP. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) {
      setError('Please enter the 6-digit OTP');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await api<{ accessToken: string; access_token?: string; user: any }>('/auth/otp/verify', {
        method: 'POST',
        body: JSON.stringify({ phone: `+91${phone}`, otp, role: 'CUSTOMER' }),
      });
      setToken(res.accessToken ?? res.access_token ?? '', res.user);
      setStep('success');
      setTimeout(() => router.push('/dashboard'), 1200);
    } catch (e: any) {
      setError(e.message || 'Invalid OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen gradient-bg flex items-center justify-center px-4 py-24">
      {/* Decorative */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full bg-rose-500/10 blur-3xl" />
        <div className="absolute bottom-1/3 right-1/4 w-96 h-96 rounded-full bg-rose-700/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Back */}
        <Link href="/" className="inline-flex items-center gap-1 text-white/60 hover:text-white text-sm mb-8 transition-colors">
          <ChevronLeft className="w-4 h-4" />
          Back to Home
        </Link>

        <div className="glass rounded-3xl p-8 sm:p-10">
          {/* Logo */}
          <div className="flex items-center gap-2 mb-8">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-600 to-rose-400 flex items-center justify-center shadow-lg">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white">Zevento</span>
          </div>

          {step === 'phone' && (
            <div className="animate-fade-up">
              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Welcome back 👋</h1>
              <p className="text-white/60 text-sm mb-8">Enter your mobile number to continue planning your dream wedding.</p>

              <div className="mb-6">
                <label className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-2 block">
                  Mobile Number
                </label>
                <div className="flex items-center gap-3 bg-white/10 rounded-2xl px-4 py-4 border border-white/10 focus-within:border-rose-400 transition-colors">
                  <span className="text-white/70 font-medium text-sm shrink-0">🇮🇳 +91</span>
                  <div className="w-px h-5 bg-white/20" />
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={phone}
                    onChange={(e) => {
                      setPhone(formatPhone(e.target.value));
                      setError('');
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendOtp()}
                    placeholder="98765 43210"
                    className="flex-1 bg-transparent text-white placeholder-white/30 outline-none text-base font-medium tracking-wider"
                  />
                </div>
              </div>

              {error && (
                <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                  {error}
                </div>
              )}

              <button
                onClick={handleSendOtp}
                disabled={loading || phone.length < 10}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-gradient-to-r from-rose-600 to-rose-500 text-white font-bold text-base hover:from-rose-700 hover:to-rose-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
              >
                {loading ? (
                  <LoaderCircle className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    Send OTP
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <p className="text-center text-xs text-white/40 mt-6">
                By continuing, you agree to our{' '}
                <a href="#" className="text-rose-400 hover:underline">Terms</a> and{' '}
                <a href="#" className="text-rose-400 hover:underline">Privacy Policy</a>
              </p>
            </div>
          )}

          {step === 'otp' && (
            <div className="animate-fade-up">
              <button
                onClick={() => { setStep('phone'); setError(''); setOtp(''); }}
                className="flex items-center gap-1 text-white/50 hover:text-white text-sm mb-6 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Change number
              </button>

              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Enter OTP 🔐</h1>
              <p className="text-white/60 text-sm mb-2">
                We sent a 6-digit code to{' '}
                <span className="text-white font-medium">+91 {phone}</span>
              </p>
              {devOtp && (
                <p className="text-amber-400 text-xs mb-6">
                  Dev mode OTP: <strong>{devOtp}</strong>
                </p>
              )}
              {!devOtp && <div className="mb-6" />}

              <div className="mb-6">
                <label className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-2 block">
                  6-Digit OTP
                </label>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => {
                    setOtp(e.target.value.replace(/\D/g, '').slice(0, 6));
                    setError('');
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleVerifyOtp()}
                  placeholder="• • • • • •"
                  className="w-full bg-white/10 border border-white/10 focus:border-rose-400 rounded-2xl px-4 py-4 text-white text-2xl text-center font-bold tracking-[0.5em] placeholder-white/20 outline-none transition-colors"
                />
              </div>

              {error && (
                <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                  {error}
                </div>
              )}

              <button
                onClick={handleVerifyOtp}
                disabled={loading || otp.length < 6}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-gradient-to-r from-rose-600 to-rose-500 text-white font-bold text-base hover:from-rose-700 hover:to-rose-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
              >
                {loading ? (
                  <LoaderCircle className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    Verify & Continue
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <button
                onClick={handleSendOtp}
                disabled={loading}
                className="w-full text-center text-sm text-white/50 hover:text-white/80 mt-4 transition-colors disabled:cursor-not-allowed"
              >
                Didn't receive? Resend OTP
              </button>
            </div>
          )}

          {step === 'success' && (
            <div className="animate-scale-in text-center py-4">
              <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-6">
                <CircleCheck className="w-10 h-10 text-emerald-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">You're In! 🎉</h2>
              <p className="text-white/60 text-sm">Redirecting to your dashboard...</p>
            </div>
          )}
        </div>

        <p className="text-center text-white/40 text-xs mt-6">
          Are you a vendor?{' '}
          <a href="#" className="text-rose-400 hover:text-rose-300">Sign in as Vendor →</a>
        </p>
      </div>
    </div>
  );
}
