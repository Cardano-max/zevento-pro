'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Star, MapPin, Phone, Camera, ChevronLeft, ChevronRight, LoaderCircle,
  TriangleAlert, Users, Award, Calendar, Heart, Send,
  CircleCheck, ArrowRight, Sparkles, Clock, Briefcase,
  MessageSquare, ChevronDown, Package
} from 'lucide-react';
import { api } from '@/lib/api';
import { Vendor } from '@/lib/types';
import { formatPaise, formatRating, formatDate } from '@/lib/format';
import { useAuthStore } from '@/lib/auth-store';

interface ApiService {
  id: string;
  title: string;
  description: string | null;
  pricePaise: number;
  priceType?: 'FIXED' | 'STARTING_FROM' | 'CUSTOM_QUOTE';
  isActive?: boolean;
  category: { id: string; name: string } | null;
  images: string[] | null;
  packages?: Array<{
    id: string;
    name: string;
    description?: string;
    priceInPaise: number;
    features?: string[];
    isPopular: boolean;
  }>;
}

interface VendorDetail extends Omit<Vendor, 'services' | 'blockedDates'> {
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
  services?: ApiService[];
  blockedDates?: Array<{ date: string; reason?: string }>;
}

// ── Availability Calendar ─────────────────────────────────────────────────────
function AvailabilityCalendar({ blockedDates }: { blockedDates: Array<{ date: string }> }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const blockedSet = new Set(blockedDates.map((d) => d.date.substring(0, 10)));

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date().toISOString().substring(0, 10);

  const days: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setCurrentMonth(new Date(year, month - 1))}
          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          aria-label="Previous month"
        >
          <ChevronLeft className="w-4 h-4 text-gray-600" />
        </button>
        <span className="text-sm font-semibold text-gray-900">
          {currentMonth.toLocaleString('en-IN', { month: 'long', year: 'numeric' })}
        </span>
        <button
          onClick={() => setCurrentMonth(new Date(year, month + 1))}
          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          aria-label="Next month"
        >
          <ChevronRight className="w-4 h-4 text-gray-600" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center mb-2">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
          <span key={d} className="text-xs font-medium text-gray-400">{d}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day, i) => {
          if (!day) return <div key={i} />;
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const isBlocked = blockedSet.has(dateStr);
          const isPast = dateStr < today;
          return (
            <div
              key={i}
              className={`text-xs rounded-lg py-1.5 text-center font-medium
                ${isPast
                  ? 'text-gray-300'
                  : isBlocked
                  ? 'bg-red-100 text-red-600'
                  : 'bg-emerald-50 text-emerald-700'
                }`}
              title={isBlocked ? 'Unavailable' : isPast ? '' : 'Available'}
            >
              {day}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-emerald-100 inline-block" />
          Available
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-red-100 inline-block" />
          Unavailable
        </span>
      </div>
    </div>
  );
}

// ── Service Card ──────────────────────────────────────────────────────────────
function ServiceCard({ svc }: { svc: ApiService }) {
  const [showPackages, setShowPackages] = useState(false);

  const priceLabel =
    svc.priceType === 'CUSTOM_QUOTE'
      ? 'Custom Quote'
      : svc.priceType === 'STARTING_FROM'
      ? `Starting from ${formatPaise(svc.pricePaise)}`
      : formatPaise(svc.pricePaise);

  return (
    <div className="border border-gray-100 rounded-2xl p-4 hover:border-rose-200 transition-colors bg-white">
      {svc.images && svc.images.length > 0 && (
        <img
          src={svc.images[0]}
          alt={svc.title}
          className="w-full h-32 object-cover rounded-xl mb-3"
        />
      )}

      {svc.category && (
        <span className="inline-block text-xs font-semibold bg-rose-50 text-rose-600 px-2 py-0.5 rounded-full mb-2">
          {svc.category.name}
        </span>
      )}

      <h3 className="font-semibold text-gray-900 text-sm mb-1">{svc.title}</h3>

      {svc.description && (
        <p className="text-xs text-gray-500 line-clamp-2 mb-3">{svc.description}</p>
      )}

      <p className={`text-sm font-bold mb-3 ${svc.priceType === 'CUSTOM_QUOTE' ? 'text-amber-700' : 'text-rose-700'}`}>
        {priceLabel}
      </p>

      {svc.packages && svc.packages.length > 0 && (
        <>
          <button
            onClick={() => setShowPackages(!showPackages)}
            className="flex items-center gap-1.5 text-xs font-medium text-rose-700 hover:text-rose-800 transition-colors mb-2"
          >
            <Package className="w-3.5 h-3.5" />
            {svc.packages.length} package{svc.packages.length !== 1 ? 's' : ''}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showPackages ? 'rotate-180' : ''}`} />
          </button>

          {showPackages && (
            <div className="space-y-2 mt-2">
              {svc.packages.map((pkg) => (
                <div
                  key={pkg.id}
                  className={`rounded-xl p-3 border ${pkg.isPopular ? 'border-rose-200 bg-rose-50' : 'border-gray-100 bg-gray-50'}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-gray-900">{pkg.name}</span>
                    <div className="flex items-center gap-1.5">
                      {pkg.isPopular && (
                        <span className="text-xs font-bold text-rose-600 bg-rose-100 px-1.5 py-0.5 rounded-full">Popular</span>
                      )}
                      <span className="text-xs font-bold text-rose-700">{formatPaise(pkg.priceInPaise)}</span>
                    </div>
                  </div>
                  {pkg.description && (
                    <p className="text-xs text-gray-500 mb-1">{pkg.description}</p>
                  )}
                  {pkg.features && pkg.features.length > 0 && (
                    <ul className="space-y-0.5">
                      {pkg.features.map((f: string, fi: number) => (
                        <li key={fi} className="text-xs text-gray-600 flex items-start gap-1">
                          <CircleCheck className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
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

  // Message state
  const [messageText, setMessageText] = useState('');
  const [messageSent, setMessageSent] = useState(false);
  const [messageSending, setMessageSending] = useState(false);
  const [showMessageForm, setShowMessageForm] = useState(false);

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

  const handleSendMessage = async () => {
    if (!isLoggedIn) {
      router.push(`/login?redirect=/vendors/${id}`);
      return;
    }
    if (!messageText.trim()) return;
    setMessageSending(true);
    try {
      await api(`/customer/messages/${id}`, {
        method: 'POST',
        body: JSON.stringify({ body: messageText.trim() }),
      });
      setMessageSent(true);
      setMessageText('');
    } catch (e: any) {
      alert(e.message || 'Failed to send message');
    } finally {
      setMessageSending(false);
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
  const activeServices: ApiService[] = vendor.services?.filter((s) => s.isActive !== false) ?? [];

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

            {/* Services & Packages */}
            {activeServices.length > 0 && (
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-rose-50">
                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Package className="w-5 h-5 text-rose-500" />
                  Services &amp; Packages
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {activeServices.map((svc) => (
                    <ServiceCard key={svc.id} svc={svc} />
                  ))}
                </div>
              </div>
            )}

            {/* Availability Calendar */}
            {vendor.blockedDates && (
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-rose-50">
                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-rose-500" />
                  Availability
                </h2>
                <AvailabilityCalendar blockedDates={vendor.blockedDates} />
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
            {/* Pricing + Inquiry Form */}
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
                  <h3 className="font-bold text-gray-900 mb-1">Inquiry Sent!</h3>
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

            {/* Direct Message */}
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-rose-50">
              <h3 className="font-bold text-gray-900 text-sm mb-3 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-rose-600" />
                Direct Message
              </h3>

              {messageSent ? (
                <div className="text-center py-3">
                  <CircleCheck className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-gray-800">Message Sent!</p>
                  <p className="text-xs text-gray-400 mt-1">The vendor will reply to you soon.</p>
                  <button
                    onClick={() => { setMessageSent(false); setShowMessageForm(false); }}
                    className="mt-3 text-xs text-rose-600 font-medium hover:underline"
                  >
                    Send another
                  </button>
                </div>
              ) : showMessageForm ? (
                <div className="space-y-2">
                  <textarea
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder="Write your message..."
                    rows={3}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 outline-none focus:border-rose-400 resize-none"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleSendMessage}
                      disabled={messageSending || !messageText.trim()}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-rose-700 text-white text-sm font-semibold hover:bg-rose-800 disabled:opacity-60 transition-colors"
                    >
                      {messageSending ? (
                        <LoaderCircle className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                      Send
                    </button>
                    <button
                      onClick={() => setShowMessageForm(false)}
                      className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => {
                    if (!isLoggedIn) {
                      router.push(`/login?redirect=/vendors/${id}`);
                      return;
                    }
                    setShowMessageForm(true);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-rose-200 text-rose-700 text-sm font-semibold hover:bg-rose-50 transition-colors"
                >
                  <MessageSquare className="w-4 h-4" />
                  {isLoggedIn ? 'Send Message' : 'Login to Message'}
                </button>
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
