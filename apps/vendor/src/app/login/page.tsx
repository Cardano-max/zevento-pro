'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';

export default function LoginPage() {
  const router = useRouter();
  const setToken = useAuthStore((s) => s.setToken);

  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [role, setRole] = useState<'PLANNER' | 'SUPPLIER'>('PLANNER');
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
        body: JSON.stringify({ phone: fullPhone, otp, role }),
      });
      setToken(res.accessToken, role);
      router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '20px',
            backgroundColor: '#059669', display: 'flex', alignItems: 'center',
            justifyContent: 'center', margin: '0 auto 16px',
            boxShadow: '0 8px 24px rgba(5, 150, 105, 0.3)'
          }}>
            <span style={{ fontSize: '28px', fontWeight: '800', color: 'white' }}>Z</span>
          </div>
          <h1 style={{ fontSize: '26px', fontWeight: '700', color: '#0f172a', margin: '0 0 6px' }}>
            Zevento Vendor
          </h1>
          <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
            Sign in to manage your business
          </p>
        </div>

        {/* Card */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '20px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
          padding: '32px',
        }}>

          {step === 'phone' ? (
            <form onSubmit={handleSendOtp}>
              {/* Role Toggle */}
              <div style={{ marginBottom: '24px' }}>
                <p style={{ fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  I am a...
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {(['PLANNER', 'SUPPLIER'] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      style={{
                        padding: '12px',
                        borderRadius: '12px',
                        border: role === r ? '2px solid #059669' : '2px solid #e2e8f0',
                        backgroundColor: role === r ? '#f0fdf4' : 'white',
                        color: role === r ? '#059669' : '#64748b',
                        fontWeight: '600',
                        fontSize: '14px',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                    >
                      {r === 'PLANNER' ? '🎪 Event Planner' : '📦 Supplier'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Phone Input */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                  Phone Number
                </label>
                <div style={{ display: 'flex', border: '1.5px solid #d1d5db', borderRadius: '12px', overflow: 'hidden', backgroundColor: 'white', transition: 'border-color 0.15s' }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = '#059669')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = '#d1d5db')}
                >
                  <div style={{
                    padding: '12px 14px',
                    backgroundColor: '#f8fafc',
                    borderRight: '1.5px solid #e2e8f0',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#374151',
                    whiteSpace: 'nowrap',
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
                      flex: 1,
                      padding: '12px 14px',
                      border: 'none',
                      outline: 'none',
                      fontSize: '15px',
                      color: '#0f172a',
                      backgroundColor: 'transparent',
                      letterSpacing: '0.05em',
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
                  backgroundColor: phone.length >= 10 && !loading ? '#059669' : '#94a3b8',
                  color: 'white', border: 'none', borderRadius: '12px',
                  fontSize: '15px', fontWeight: '700', cursor: phone.length >= 10 ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  transition: 'background-color 0.15s',
                  boxShadow: phone.length >= 10 && !loading ? '0 4px 12px rgba(5, 150, 105, 0.3)' : 'none',
                }}
              >
                {loading ? (
                  <Loader2 style={{ width: '18px', height: '18px', animation: 'spin 1s linear infinite' }} />
                ) : (
                  <>Send OTP <ArrowRight style={{ width: '16px', height: '16px' }} /></>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp}>
              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <div style={{ fontSize: '40px', marginBottom: '8px' }}>📱</div>
                <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', margin: '0 0 4px' }}>
                  Enter OTP
                </h2>
                <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
                  Sent to +91 {phone.slice(0,5)} {phone.slice(5)}
                </p>
              </div>

              {/* OTP Input */}
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
                    width: '100%',
                    padding: '16px',
                    border: '1.5px solid #d1d5db',
                    borderRadius: '12px',
                    fontSize: '24px',
                    fontWeight: '700',
                    letterSpacing: '0.4em',
                    textAlign: 'center',
                    color: '#0f172a',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = '#059669')}
                  onBlur={(e) => (e.target.style.borderColor = '#d1d5db')}
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
                  backgroundColor: otp.length >= 4 && !loading ? '#059669' : '#94a3b8',
                  color: 'white', border: 'none', borderRadius: '12px',
                  fontSize: '15px', fontWeight: '700', cursor: otp.length >= 4 ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  marginBottom: '16px',
                  boxShadow: otp.length >= 4 && !loading ? '0 4px 12px rgba(5, 150, 105, 0.3)' : 'none',
                }}
              >
                {loading ? (
                  <Loader2 style={{ width: '18px', height: '18px', animation: 'spin 1s linear infinite' }} />
                ) : (
                  <>Verify & Sign In <ArrowRight style={{ width: '16px', height: '16px' }} /></>
                )}
              </button>

              <button
                type="button"
                onClick={() => { setStep('phone'); setOtp(''); setError(''); }}
                style={{ width: '100%', padding: '10px', backgroundColor: 'transparent', border: 'none', fontSize: '14px', color: '#64748b', cursor: 'pointer' }}
              >
                ← Change phone number
              </button>
            </form>
          )}
        </div>

        <p style={{ textAlign: 'center', marginTop: '24px', fontSize: '12px', color: '#94a3b8' }}>
          By signing in, you agree to Zevento's Terms of Service
        </p>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
