'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, LoaderCircle, ShieldCheck } from 'lucide-react';
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
  const [testOtp, setTestOtp] = useState('');

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const fullPhone = phone.startsWith('+91') ? phone : `+91${phone}`;
      const res = await api<{ message: string; phone: string; otp?: string }>('/auth/otp/send', {
        method: 'POST',
        body: JSON.stringify({ phone: fullPhone }),
      });
      if (res.otp) setTestOtp(res.otp);
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
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '72px', height: '72px', borderRadius: '24px',
            background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: '0 12px 32px rgba(99, 102, 241, 0.5)',
          }}>
            <span style={{ fontSize: '32px', fontWeight: '800', color: 'white' }}>Z</span>
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: '800', color: 'white', margin: '0 0 6px' }}>
            Zevento Admin
          </h1>
          <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.6)', margin: 0 }}>
            Secure admin access only
          </p>
        </div>

        {/* Card */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '24px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.3)',
          padding: '36px',
        }}>

          {/* Shield badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#eef2ff', borderRadius: '12px', padding: '10px 14px', marginBottom: '28px' }}>
            <ShieldCheck style={{ width: '18px', height: '18px', color: '#4f46e5' }} />
            <span style={{ fontSize: '13px', fontWeight: '600', color: '#4338ca' }}>Admin Portal — Restricted Access</span>
          </div>

          {step === 'phone' ? (
            <form onSubmit={handleSendOtp}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                  Phone Number
                </label>
                <div style={{ display: 'flex', border: '1.5px solid #d1d5db', borderRadius: '12px', overflow: 'hidden', backgroundColor: 'white' }}>
                  <div style={{
                    padding: '13px 14px',
                    backgroundColor: '#f8fafc',
                    borderRight: '1.5px solid #e2e8f0',
                    fontSize: '14px', fontWeight: '600', color: '#374151', whiteSpace: 'nowrap',
                  }}>
                    🇮🇳 +91
                  </div>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                    placeholder="98765 43210"
                    maxLength={10}
                    required
                    style={{
                      flex: 1, padding: '13px 14px', border: 'none', outline: 'none',
                      fontSize: '15px', color: '#0f172a', backgroundColor: 'transparent', letterSpacing: '0.05em',
                    }}
                  />
                </div>
              </div>

              {error && (
                <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '12px', marginBottom: '16px', fontSize: '14px', color: '#dc2626' }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || phone.length < 10}
                style={{
                  width: '100%', padding: '14px',
                  background: phone.length >= 10 && !loading ? 'linear-gradient(135deg, #6366f1, #4f46e5)' : '#94a3b8',
                  color: 'white', border: 'none', borderRadius: '12px',
                  fontSize: '15px', fontWeight: '700', cursor: phone.length >= 10 ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  boxShadow: phone.length >= 10 && !loading ? '0 4px 16px rgba(99, 102, 241, 0.4)' : 'none',
                }}
              >
                {loading ? <LoaderCircle style={{ width: '18px', height: '18px', animation: 'spin 1s linear infinite' }} /> : <>Send OTP <ArrowRight style={{ width: '16px', height: '16px' }} /></>}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp}>
              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <div style={{ fontSize: '40px', marginBottom: '8px' }}>🔐</div>
                <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', margin: '0 0 4px' }}>Enter OTP</h2>
                <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>Sent to +91 {phone.slice(0,5)} {phone.slice(5)}</p>
              </div>

              {/* Test mode OTP banner */}
              {testOtp && (
                <div style={{ backgroundColor: '#fefce8', border: '1.5px solid #fbbf24', borderRadius: '12px', padding: '12px 16px', marginBottom: '20px', textAlign: 'center' }}>
                  <p style={{ fontSize: '12px', fontWeight: '600', color: '#92400e', margin: '0 0 4px' }}>⚠️ TEST MODE — Your OTP</p>
                  <p style={{ fontSize: '28px', fontWeight: '800', color: '#b45309', margin: 0, letterSpacing: '0.3em' }}>{testOtp}</p>
                </div>
              )}

              <div style={{ marginBottom: '20px' }}>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="• • • • • •"
                  maxLength={6}
                  required
                  autoFocus
                  style={{
                    width: '100%', padding: '16px', border: '1.5px solid #d1d5db', borderRadius: '12px',
                    fontSize: '24px', fontWeight: '700', letterSpacing: '0.4em', textAlign: 'center',
                    color: '#0f172a', outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>

              {error && (
                <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '12px', marginBottom: '16px', fontSize: '14px', color: '#dc2626' }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || otp.length < 4}
                style={{
                  width: '100%', padding: '14px',
                  background: otp.length >= 4 && !loading ? 'linear-gradient(135deg, #6366f1, #4f46e5)' : '#94a3b8',
                  color: 'white', border: 'none', borderRadius: '12px',
                  fontSize: '15px', fontWeight: '700', cursor: otp.length >= 4 ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  marginBottom: '16px',
                  boxShadow: otp.length >= 4 && !loading ? '0 4px 16px rgba(99, 102, 241, 0.4)' : 'none',
                }}
              >
                {loading ? <LoaderCircle style={{ width: '18px', height: '18px', animation: 'spin 1s linear infinite' }} /> : <>Verify & Sign In <ArrowRight style={{ width: '16px', height: '16px' }} /></>}
              </button>

              <button
                type="button"
                onClick={() => { setStep('phone'); setOtp(''); setError(''); setTestOtp(''); }}
                style={{ width: '100%', padding: '10px', backgroundColor: 'transparent', border: 'none', fontSize: '14px', color: '#64748b', cursor: 'pointer' }}
              >
                ← Change phone number
              </button>
            </form>
          )}
        </div>

        <p style={{ textAlign: 'center', marginTop: '24px', fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>
          Zevento Pro · Admin Access Only
        </p>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
