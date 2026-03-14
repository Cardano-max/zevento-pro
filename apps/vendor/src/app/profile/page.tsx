'use client';

import { useEffect, useState } from 'react';
import { Loader2, Upload, Trash2 } from 'lucide-react';
import { VendorLayout } from '@/components/layout';
import { api, apiUpload } from '@/lib/api';
import { cn } from '@/lib/cn';

interface VendorProfile {
  id: string;
  businessName: string;
  description: string | null;
  contactEmail: string | null;
  websiteUrl: string | null;
  onboardingStep: number;
  kycStatus: string;
  categories: Array<{ id: string; name: string }>;
  serviceAreas: Array<{ id: string; city: string; radiusKm: number }>;
  photos: Array<{ id: string; url: string; caption: string | null }>;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<VendorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Edit form state
  const [businessName, setBusinessName] = useState('');
  const [description, setDescription] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');

  useEffect(() => {
    api<VendorProfile>('/vendor/profile/me')
      .then((p) => {
        setProfile(p);
        setBusinessName(p.businessName || '');
        setDescription(p.description || '');
        setContactEmail(p.contactEmail || '');
        setWebsiteUrl(p.websiteUrl || '');
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccessMsg('');
    try {
      await api('/vendor/profile/business', {
        method: 'PATCH',
        body: JSON.stringify({ businessName, description, contactEmail, websiteUrl }),
      });
      setSuccessMsg('Profile updated successfully');
      const p = await api<VendorProfile>('/vendor/profile/me');
      setProfile(p);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('photo', file);
      await apiUpload('/vendor/profile/photos', formData);
      const p = await api<VendorProfile>('/vendor/profile/me');
      setProfile(p);
      setSuccessMsg('Photo uploaded');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeletePhoto(photoId: string) {
    try {
      await api(`/vendor/profile/photos/${photoId}`, { method: 'DELETE' });
      const p = await api<VendorProfile>('/vendor/profile/me');
      setProfile(p);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  async function handleSubmitKyc() {
    setSaving(true);
    try {
      await api('/vendor/profile/kyc/submit', { method: 'POST' });
      setSuccessMsg('KYC submitted for review');
      const p = await api<VendorProfile>('/vendor/profile/me');
      setProfile(p);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'KYC submission failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleKycUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('document', file);
      formData.append('type', 'BUSINESS_REGISTRATION');
      await apiUpload('/vendor/profile/kyc/documents', formData);
      setSuccessMsg('KYC document uploaded');
      const p = await api<VendorProfile>('/vendor/profile/me');
      setProfile(p);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <VendorLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Profile</h1>
        <p className="text-sm text-slate-500">Manage your business profile and documents</p>
      </div>

      {loading && (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
          <button onClick={() => setError('')} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      {successMsg && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">
          {successMsg}
          <button onClick={() => setSuccessMsg('')} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      {!loading && profile && (
        <div className="space-y-6">
          {/* Business Details */}
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Business Details</h2>
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Business Name
                  </label>
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Contact Email
                  </label>
                  <input
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Website URL
                </label>
                <input
                  type="url"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  placeholder="https://"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {saving ? <Loader2 className="inline h-4 w-4 animate-spin" /> : 'Save Changes'}
              </button>
            </form>
          </div>

          {/* Portfolio Photos */}
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Portfolio Photos</h2>
              <label className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700">
                <Upload className="h-4 w-4" />
                Upload
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </label>
            </div>
            {profile.photos.length === 0 ? (
              <p className="text-sm text-slate-400">No photos uploaded yet</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {profile.photos.map((photo) => (
                  <div key={photo.id} className="group relative aspect-square rounded-lg overflow-hidden bg-slate-100">
                    <img src={photo.url} alt={photo.caption || 'Portfolio'} className="h-full w-full object-cover" />
                    <button
                      onClick={() => handleDeletePhoto(photo.id)}
                      className="absolute right-2 top-2 rounded-full bg-red-600 p-1.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* KYC Section */}
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">KYC Verification</h2>
            <div className="mb-4 flex items-center gap-3">
              <span className="text-sm text-slate-600">Status:</span>
              <span
                className={cn(
                  'inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium',
                  profile.kycStatus === 'VERIFIED'
                    ? 'bg-green-100 text-green-700'
                    : profile.kycStatus === 'PENDING'
                      ? 'bg-amber-100 text-amber-700'
                      : profile.kycStatus === 'REJECTED'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-slate-100 text-slate-500'
                )}
              >
                {profile.kycStatus}
              </span>
            </div>

            {profile.kycStatus !== 'VERIFIED' && (
              <div className="space-y-3">
                <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 px-4 py-3 text-sm text-slate-600 hover:bg-slate-50">
                  <Upload className="h-4 w-4 text-slate-400" />
                  Upload KYC Document (Business Registration, GST, PAN)
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    onChange={handleKycUpload}
                    className="hidden"
                  />
                </label>

                {profile.kycStatus !== 'PENDING' && (
                  <button
                    onClick={handleSubmitKyc}
                    disabled={saving}
                    className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="inline h-4 w-4 animate-spin" /> : 'Submit for KYC Review'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </VendorLayout>
  );
}
