'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Star, MapPin, Phone, Camera, ChevronLeft, LoaderCircle,
  TriangleAlert, Users, Award, Calendar, Heart, Send,
  CircleCheck, ArrowRight, Sparkles, Clock, Briefcase
} from 'lucide-react';
import { api } from '@/lib/api';
import { Vendor } from '@/lib/types';
import { formatPaise, formatRating, formatDate } from '@/lib/format';
import { useAuthStore } from '@/lib/auth-store';

interface VendorDetail extends Vendor {
  reviews?: {
    id: string;
    rating: number;
    comment?: string;
    createdAt: string;
    customer?: { name?: string };
  }[];
  portfolio?: { id: string; url: string; caption?: string }[];
  experience?: number;
  teamSize?: number;
  availableDates?: string[];
}

export default function VendorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { isLoggedIn } = useAuthStore();

  const [vendor, setVendor] = useState<VendorDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activePhoto, setActivePhoto] = useState(0);
  const [inquiring, setInquiring] = useState(false);
  const [inquiryDone, setInquiryDone] = useState(false);
  const [inquiryForm, setInquiryForm] = useState({
    eventDate: '',
    city: '',
    description: '',
    budgetPaise: '',
  });
  const [favorited, setFavorited] = useState(false);
  const [favLoading, setFavLoading] = useState(false);

  useEffect(() => {
    api<VendorDetail>(`/customer/vendors/${id}`)
      .then((res) => {
        setVendor(res);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message || 'Vendor not found');
        setLoading(false);
      });
  }, [id]);

  // Check if already favorited once auth is known
  useEffect(() => {
    if (!isLoggedIn) return;
    api<{ favorited: boolean }>(`/customer/favorites/${id}/check`)
      .then((res) => setFavorited(res?.favorited ?? false))
      .catch(() => {/* ignore */});
  }, [id, isLoggedIn]);

  const handleInquiry = async () => {
    if (!isLoggedIn) {
      router.push('/login');
      return;
    }
    if (!inquiryForm.city) {
      alert('Please enter your city');
      return;
    }
    setInquiring(true);
    try {
      await api('/leads/inquiries', {
        method: 'POST',
        body: JSON.stringify({
          vendorId: id,
          eventDate: inquiryForm.eventDate || undefined,
          city: inquiryForm.city,
          description: inquiryForm.description || undefined,
          budgetPaise: inquiryForm.budgetPaise ? Number(inquiryForm.budgetPaise) * 100 : undefined,
          categoryId: vendor?.categories?.[0]?.category?.id,
        }),
      });
      setInquiryDone(true);
    } catch (e: any) {
      alert(e.message || 'Failed to send inquiry');
    } finally {
      setInquiring(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-16">
        <div className="flex flex-col items-center gap-3">
          <LoaderCircle className="w-8 h-8 animate-spin text-rose-600" />
          <p className="text-gray-500 text-sm">Loading vendor profile...</p>
        </div>
      </div>
    );
  }

  if (error || !vendor) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-16 px-4">
        <div className="text-center">
          <TriangleAlert className="w-12 h-12 text-rose-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">Vendor Not Found</h2>
          <p className="text-gray-500 mb-6">{error}</p>
          <Link href="/vendors" className="px-6 py-3 rounded-xl bg-rose-700 text-white font-semibold">
            Browse Vendors
          </Link>
        </div>
      </div>
    );
  }

  const photos = vendor.photos ?? [];
  const rating = vendor.stats?.avgRating;
  const reviews = vendor.stats?.reviewCount ?? 0;
  const bookings = vendor.stats?.totalBookings ?? 0;

  return (
    <div className="min-h-screen bg-[#faf8f5] pt-16">
      {/* Back */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-3">
        <Link href="/vendors" className="inline-flex items-center gap-1 text-gray-500 hover:text-rose-700 text-sm font-medium transition-colors">
          <ChevronLeft className="w-4 h-4" />
          Back to Vendors
        </Link>
      </div>

      {/* Hero Photos */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8">
        {photos.length > 0 ? (
          <div className="grid grid-cols-4 gap-2 h-72 sm:h-96 rounded-3xl overflow-hidden">
            <div className="col-span-4 sm:col-span-2 relative group cursor-pointer" onClick={() => setActivePhoto(0)}>
              <img
                src={photos[0]?.url}
                alt={vendor.businessName}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
            </div>
            {photos.slice(1, 3).map((p, i) => (
              <div key={p.id} className="hidden sm:block relative cursor-pointer group" onClick={() => setActivePhoto(i + 1)}>
                <img src={p.url} alt="" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                {i === 1 && photos.length > 3 && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <span className="text-white font-bold text-xl">+{photos.length - 3}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="h-64 rounded-3xl bg-gradient-to-br from-rose-100 to-pink-50 flex items-center justify-center">
            <Camera className="w-16 h-16 text-rose-200" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Header */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-rose-50">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex flex-wrap gap-2 mb-3">
                    {vendor.categories?.map((c) => (
                      <span key={c.category.id} className="text-xs font-semibold bg-rose-50 text-rose-700 px-2.5 py-1 rounded-full">
                        {c.category.name}
                      </span>
                    ))}
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
                    {vendor.businessName}
                  </h1>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                    {vendor.city && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-4 h-4 text-rose-500" />
                        {vendor.city}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                      <strong className="text-gray-800">{formatRating(rating)}</strong>
                      {reviews > 0 && <span>({reviews} reviews)</span>}
                    </span>
                    {bookings > 0 && (
                      <span className="flex items-center gap-1">
                        <Briefcase className="w-4 h-4" />
                        {bookings} bookings
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={async () => {
                    if (!isLoggedIn) {
                      router.push(`/login?redirect=/vendors/${id}`);
                      return;
                    }
                    setFavLoading(true);
                    try {
                      if (favorited) {
                        await api(`/customer/favorites/${id}`, { method: 'DELETE' });
                        setFavorited(false);
                      } else {
                        await api(`/customer/favorites/${id}`, { method: 'POST' });
                        setFavorited(true);
                      }
                    } catch (e: any) {
                      alert(e.message || 'Failed to update favorites');
                    } finally {
                      setFavLoading(false);
                    }
                  }}
                  disabled={favLoading}
                  title={favorited ? 'Remove from favorites' : 'Save to favorites'}
                  className={`p-3 rounded-2xl border-2 transition-all disabled:opacity-60 ${
                    favorited
                      ? 'border-rose-500 bg-rose-50 text-rose-500'
                      : 'border-gray-200 text-gray-400 hover:border-rose-300 hover:text-rose-400'
                  }`}
                >
                  {favLoading ? (
                    <LoaderCircle className="w-5 h-5 animate-spin" />
                  ) : (
                    <Heart className={`w-5 h-5 ${favorited ? 'fill-rose-500' : ''}`} />
                  )}
                </button>
              </div>
            </div>

            {/* About */}
            {vendor.description && (
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-rose-50">
                <h2 className="text-lg font-bold text-gray-900 mb-3">About</h2>
                <p className="text-gray-600 leading-relaxed">{vendor.description}</p>
              </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { icon: Star, label: 'Rating', value: formatRating(rating), color: 'text-amber-500' },
                { icon: Users, label: 'Reviews', value: `${reviews}+`, color: 'text-rose-600' },
                { icon: Briefcase, label: 'Bookings', value: `${bookings}+`, color: 'text-emerald-600' },
                { icon: Award, label: 'Experience', value: vendor.experience ? `${vendor.experience}y` : '5y+', color: 'text-blue-600' },
              ].map((stat) => (
                <div key={stat.label} className="bg-white rounded-2xl p-4 shadow-sm border border-rose-50 text-center">
                  <stat.icon className={`w-5 h-5 ${stat.color} mx-auto mb-2`} />
                  <p className="text-lg font-bold text-gray-900">{stat.value}</p>
                  <p className="text-xs text-gray-500">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Reviews */}
            {vendor.reviews && vendor.reviews.length > 0 && (
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-rose-50">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Customer Reviews</h2>
                <div className="space-y-4">
                  {vendor.reviews.slice(0, 5).map((review) => (
                    <div key={review.id} className="pb-4 border-b border-gray-50 last:border-0 last:pb-0">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-rose-50 flex items-center justify-center text-sm">
                            👤
                          </div>
                          <span className="font-medium text-gray-800 text-sm">
                            {review.customer?.name || 'Happy Customer'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          {[...Array(5)].map((_, i) => (
                            <Star key={i} className={`w-3 h-3 ${i < review.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`} />
                          ))}
                        </div>
                      </div>
                      {review.comment && (
                        <p className="text-gray-600 text-sm leading-relaxed">{review.comment}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">{formatDate(review.createdAt)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Pricing */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-rose-50 sticky top-24">
              {vendor.pricingMin && (
                <div className="mb-4">
                  <p className="text-xs text-gray-500 mb-1">Starting Price</p>
                  <p className="text-2xl font-bold text-rose-700">
                    {formatPaise(vendor.pricingMin)}
                    {vendor.pricingMax && vendor.pricingMax !== vendor.pricingMin && (
                      <span className="text-base text-gray-400 font-normal"> – {formatPaise(vendor.pricingMax)}</span>
                    )}
                  </p>
                </div>
              )}

              {/* Inquiry Form */}
              {inquiryDone ? (
                <div className="text-center py-6">
                  <CircleCheck className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                  <h3 className="font-bold text-gray-900 mb-1">Inquiry Sent! 🎉</h3>
                  <p className="text-sm text-gray-500">
                    {vendor.businessName} will contact you shortly. Check your dashboard for updates.
                  </p>
                  <Link
                    href="/dashboard"
                    className="inline-flex items-center gap-1 mt-4 text-sm font-semibold text-rose-700 hover:text-rose-800"
                  >
                    View Dashboard <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  <h3 className="font-bold text-gray-900 flex items-center gap-2">
                    <Send className="w-4 h-4 text-rose-600" />
                    Send Inquiry
                  </h3>

                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Your City *</label>
                    <input
                      type="text"
                      placeholder="e.g. Mumbai"
                      value={inquiryForm.city}
                      onChange={(e) => setInquiryForm({ ...inquiryForm, city: e.target.value })}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 outline-none focus:border-rose-400 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Event Date</label>
                    <input
                      type="date"
                      value={inquiryForm.eventDate}
                      onChange={(e) => setInquiryForm({ ...inquiryForm, eventDate: e.target.value })}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 outline-none focus:border-rose-400 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Your Budget (₹)</label>
                    <input
                      type="number"
                      placeholder="e.g. 50000"
                      value={inquiryForm.budgetPaise}
                      onChange={(e) => setInquiryForm({ ...inquiryForm, budgetPaise: e.target.value })}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 outline-none focus:border-rose-400 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Message</label>
                    <textarea
                      placeholder="Tell us about your event..."
                      rows={3}
                      value={inquiryForm.description}
                      onChange={(e) => setInquiryForm({ ...inquiryForm, description: e.target.value })}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 outline-none focus:border-rose-400 transition-colors resize-none"
                    />
                  </div>

                  <button
                    onClick={handleInquiry}
                    disabled={inquiring}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-gradient-to-r from-rose-700 to-rose-500 text-white font-bold hover:from-rose-800 hover:to-rose-600 disabled:opacity-60 transition-all shadow-md"
                  >
                    {inquiring ? (
                      <LoaderCircle className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        {isLoggedIn ? 'Send Inquiry' : 'Login to Inquire'}
                      </>
                    )}
                  </button>

                  {!isLoggedIn && (
                    <p className="text-center text-xs text-gray-400">
                      <Link href="/login" className="text-rose-600 font-medium">Sign in</Link> to send your inquiry
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Contact Info */}
            {vendor.user?.phone && (
              <div className="bg-rose-50 rounded-2xl p-4">
                <h3 className="font-semibold text-rose-900 text-sm mb-2 flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  Contact
                </h3>
                <p className="text-rose-800 font-medium">{vendor.user.phone}</p>
              </div>
            )}

            {/* AI Planner promo */}
            <div className="gradient-bg rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span className="text-white font-semibold text-sm">AI Wedding Planner</span>
              </div>
              <p className="text-white/70 text-xs mb-3">
                Let AI plan your entire wedding budget and find all vendors at once.
              </p>
              <Link
                href="/plan"
                className="block text-center py-2 rounded-xl bg-amber-400 text-amber-950 text-sm font-bold hover:bg-amber-300 transition-colors"
              >
                Plan My Wedding →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
