'use client';

import { useEffect, useState } from 'react';
import { Loader2, Upload, Trash2, CheckCircle, AlertCircle, Instagram, Globe, Facebook, ImagePlus } from 'lucide-react';
import { VendorLayout } from '@/components/layout';
import { api, apiUpload } from '@/lib/api';
import { cn } from '@/lib/cn';

interface VendorProfile {
  id: string;
  businessName: string;
  description: string | null;
  contactEmail: string | null;
  websiteUrl: string | null;
  instagramUrl?: string | null;
  facebookUrl?: string | null;
  yearsExperience?: number | null;
  onboardingStep: number;
  kycStatus: string;
  categories: Array<{ id: string; name: string }>;
  serviceAreas: Array<{ id: string; city: string; radiusKm: number }>;
  photos: Array<{ id: string; url: string; caption: string | null }>;
}

interface Toast {
  type: 'success' | 'error';
  message: string;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<VendorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Form fields
  const [businessName, setBusinessName] = useState('');
  const [description, setDescription] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [instagramUrl, setInstagramUrl] = useState('');
  const [facebookUrl, setFacebookUrl] = useState('');
  const [yearsExperience, setYearsExperience] = useState('');

  function showToast(type: 'success' | 'error', message: string) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }

  useEffect(() => {
    api<VendorProfile>('/vendor/profile/me')
      .then((p) => {
        setProfile(p);
        setBusinessName(p.businessName || '');
        setDescription(p.description || '');
        setContactEmail(p.contactEmail || '');
        setWebsiteUrl(p.websiteUrl || '');
        setInstagramUrl(p.instagramUrl || '');
        setFacebookUrl(p.facebookUrl || '');
        setYearsExperience(p.yearsExperience ? String(p.yearsExperience) : '');
      })
      .catch((err) => showToast('error', err.message))
      .finally(() => setLoading(false));
  }, []);

  const inputCls = 'w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20';

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api('/vendor/profile/business', {
        method: 'PATCH',
        body: JSON.stringify({
          businessName,
          description,
          contactEmail,
          websiteUrl,
          instagramUrl: instagramUrl || undefined,
          facebookUrl: facebookUrl || undefined,
          yearsExperience: yearsExperience ? parseInt(yearsExperience, 10) : undefined,
        }),
      });
      showToast('success', 'Profile updated successfully');
      const p = await api<VendorProfile>('/vendor/profile/me');
      setProfile(p);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append('photo', file);
      await apiUpload('/vendor/profile/photos', formData);
      const p = await api<VendorProfile>('/vendor/profile/me');
      setProfile(p);
      showToast('success', 'Photo uploaded successfully');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploadingPhoto(false);
      // Reset file input
      e.target.value = '';
    }
  }

  async function handleDeletePhoto(photoId: string) {
    try {
      await api(`/vendor/profile/photos/${photoId}`, { method: 'DELETE' });
      const p = await api<VendorProfile>('/vendor/profile/me');
      setProfile(p);
      showToast('success', 'Photo removed');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Delete failed');
    }
  }

  async function handleSubmitKyc() {
    setSaving(true);
    try {
      await api('/vendor/profile/kyc/submit', { method: 'POST' });
      showToast('success', 'KYC submitted for review. We will notify you within 1-2 business days.');
      const p = await api<VendorProfile>('/vendor/profile/me');
      setProfile(p);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'KYC submission failed');
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
      showToast('success', 'KYC document uploaded. Now submit for review.');
      const p = await api<VendorProfile>('/vendor/profile/me');
      setProfile(p);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setSaving(false);
      e.target.value = '';
    }
  }

  return (
    <VendorLayout>
      {/* Toast Notification */}
      {toast && (
        <div
          className={cn(
            'fixed right-5 top-5 z-50 flex items-center gap-3 rounded-xl px-4 py-3 shadow-lg text-sm font-medium transition-all',
            toast.type === 'success'
              ? 'border border-green-200 bg-green-50 text-green-800'
              : 'border border-red-200 bg-red-50 text-red-800'
          )}
        >
          {toast.type === 'success' ? (
            <CheckCircle className="h-4 w-4 shrink-0 text-green-600" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
          )}
          {toast.message}
          <button
            onClick={() => setToast(null)}
            className="ml-2 text-current opacity-50 hover:opacity-100"
          >
            ×
          </button>
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Profile</h1>
        <p className="text-sm text-slate-500">Manage your business profile and documents</p>
      </div>

      {loading && (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        </div>
      )}

      {!loading && profile && (
        <div className="space-y-6">
          {/* Business Details */}
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="mb-5 text-lg font-semibold text-slate-900">Business Details</h2>
            <form onSubmit={handleSaveProfile} className="space-y-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField label="Business Name" required>
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    required
                    className={inputCls}
                  />
                </FormField>
                <FormField label="Contact Email">
                  <input
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    className={inputCls}
                  />
                </FormField>
              </div>

              <FormField label="Description" hint="Tell customers what makes your business special">
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  placeholder="We specialize in creating unforgettable experiences..."
                  className={cn(inputCls, 'resize-none')}
                />
              </FormField>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField label="Years of Experience">
                  <input
                    type="number"
                    value={yearsExperience}
                    onChange={(e) => setYearsExperience(e.target.value)}
                    min="0"
                    max="50"
                    placeholder="e.g. 5"
                    className={inputCls}
                  />
                </FormField>
                <FormField label="Website URL">
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="url"
                      value={websiteUrl}
                      onChange={(e) => setWebsiteUrl(e.target.value)}
                      placeholder="https://yourwebsite.com"
                      className={cn(inputCls, 'pl-9')}
                    />
                  </div>
                </FormField>
              </div>

              {/* Social Links */}
              <div>
                <h3 className="mb-3 text-sm font-semibold text-slate-700">Social Media Links</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField label="Instagram">
                    <div className="relative">
                      <Instagram className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-pink-400" />
                      <input
                        type="url"
                        value={instagramUrl}
                        onChange={(e) => setInstagramUrl(e.target.value)}
                        placeholder="https://instagram.com/yourbusiness"
                        className={cn(inputCls, 'pl-9')}
                      />
                    </div>
                  </FormField>
                  <FormField label="Facebook">
                    <div className="relative">
                      <Facebook className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-500" />
                      <input
                        type="url"
                        value={facebookUrl}
                        onChange={(e) => setFacebookUrl(e.target.value)}
                        placeholder="https://facebook.com/yourbusiness"
                        className={cn(inputCls, 'pl-9')}
                      />
                    </div>
                  </FormField>
                </div>
              </div>

              {/* Categories (read-only display) */}
              {profile.categories.length > 0 && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Service Categories</label>
                  <div className="flex flex-wrap gap-2">
                    {profile.categories.map((cat) => (
                      <span
                        key={cat.id}
                        className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-700"
                      >
                        {cat.name}
                      </span>
                    ))}
                  </div>
                  <p className="mt-1.5 text-xs text-slate-400">
                    Contact support to update your service categories.
                  </p>
                </div>
              )}

              {/* Service Areas (read-only display) */}
              {profile.serviceAreas.length > 0 && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Service Areas</label>
                  <div className="flex flex-wrap gap-2">
                    {profile.serviceAreas.map((area) => (
                      <span
                        key={area.id}
                        className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700"
                      >
                        {area.city} ({area.radiusKm}km)
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                  Save Changes
                </button>
                <p className="text-xs text-slate-400">All changes are saved immediately</p>
              </div>
            </form>
          </div>

          {/* Portfolio Photos */}
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Portfolio Photos</h2>
                <p className="text-sm text-slate-400">
                  {profile.photos.length} photo{profile.photos.length !== 1 ? 's' : ''} uploaded
                </p>
              </div>
              <label className={cn(
                'flex cursor-pointer items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                uploadingPhoto
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700'
              )}>
                {uploadingPhoto ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {uploadingPhoto ? 'Uploading...' : 'Upload Photo'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handlePhotoUpload}
                  disabled={uploadingPhoto}
                  className="hidden"
                />
              </label>
            </div>

            {profile.photos.length === 0 ? (
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-12 text-center hover:border-emerald-300 hover:bg-emerald-50/30 transition-colors">
                <ImagePlus className="mx-auto h-10 w-10 text-slate-300" />
                <p className="mt-2 text-sm font-medium text-slate-500">Click to upload your first photo</p>
                <p className="mt-1 text-xs text-slate-400">JPEG, PNG, WebP — Max 10MB</p>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </label>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {profile.photos.map((photo) => (
                    <div
                      key={photo.id}
                      className="group relative aspect-square overflow-hidden rounded-xl bg-slate-100"
                    >
                      <img
                        src={photo.url}
                        alt={photo.caption || 'Portfolio photo'}
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      />
                      {/* Dark overlay on hover */}
                      <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/20" />
                      {/* Delete button */}
                      <button
                        onClick={() => handleDeletePhoto(photo.id)}
                        className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-red-600 text-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100 hover:bg-red-700"
                        title="Remove photo"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                      {photo.caption && (
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 p-2 opacity-0 transition-opacity group-hover:opacity-100">
                          <p className="truncate text-xs text-white">{photo.caption}</p>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Upload tile */}
                  <label className="flex cursor-pointer aspect-square flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 hover:border-emerald-300 hover:bg-emerald-50/30 transition-colors">
                    <ImagePlus className="h-6 w-6 text-slate-300" />
                    <span className="mt-1 text-xs text-slate-400">Add more</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </>
            )}
          </div>

          {/* KYC Section */}
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">KYC Verification</h2>

            <div className="mb-5 flex items-center gap-3">
              <div
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-full',
                  profile.kycStatus === 'VERIFIED'
                    ? 'bg-green-100'
                    : profile.kycStatus === 'PENDING'
                      ? 'bg-amber-100'
                      : profile.kycStatus === 'REJECTED'
                        ? 'bg-red-100'
                        : 'bg-slate-100'
                )}
              >
                {profile.kycStatus === 'VERIFIED' ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : profile.kycStatus === 'REJECTED' ? (
                  <AlertCircle className="h-5 w-5 text-red-600" />
                ) : (
                  <span className="text-sm font-bold text-slate-500">
                    {profile.kycStatus === 'PENDING' ? '⏳' : '?'}
                  </span>
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {profile.kycStatus === 'VERIFIED'
                    ? 'KYC Verified'
                    : profile.kycStatus === 'PENDING'
                      ? 'KYC Under Review'
                      : profile.kycStatus === 'REJECTED'
                        ? 'KYC Rejected — Re-upload Required'
                        : 'KYC Not Submitted'}
                </p>
                <p className="text-xs text-slate-400">
                  {profile.kycStatus === 'VERIFIED'
                    ? 'Your business is verified and active on the platform.'
                    : profile.kycStatus === 'PENDING'
                      ? 'We are reviewing your documents. This usually takes 1-2 business days.'
                      : profile.kycStatus === 'REJECTED'
                        ? 'Please re-upload valid business documents and resubmit.'
                        : 'Upload and submit your business registration document to get verified.'}
                </p>
              </div>
            </div>

            {profile.kycStatus !== 'VERIFIED' && (
              <div className="space-y-3">
                <label
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-xl border border-dashed p-4 text-sm transition-colors',
                    'border-slate-300 bg-slate-50 text-slate-600 hover:border-emerald-400 hover:bg-emerald-50'
                  )}
                >
                  <Upload className="h-5 w-5 shrink-0 text-slate-400" />
                  <div>
                    <p className="font-medium">Upload KYC Document</p>
                    <p className="text-xs text-slate-400">Business Registration, GST certificate, or PAN card</p>
                  </div>
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
                    className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Submit for KYC Review
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

function FormField({
  label,
  children,
  hint,
  required,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}
