'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Heart, MapPin, Star, Camera, ArrowRight,
  LoaderCircle, Sparkles, Trash2
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { Vendor } from '@/lib/types';
import { formatPaise, formatRating } from '@/lib/format';

function FavoriteVendorCard({ vendor, onRemove }: { vendor: Vendor; onRemove: (id: string) => void }) {
  const [removing, setRemoving] = useState(false);
  const photo = vendor.photos?.[0]?.url;
  const rating = vendor.stats?.avgRating;
  const reviews = vendor.stats?.reviewCount ?? 0;
  const category = vendor.categories?.[0]?.category?.name;

  const handleRemove = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setRemoving(true);
    try {
      await api(`/customer/favorites/${vendor.id}`, { method: 'DELETE' });
      onRemove(vendor.id);
    } catch (err: any) {
      alert(err.message || 'Failed to remove from favorites');
      setRemoving(false);
    }
  };

  return (
    <div className="group bg-white rounded-2xl overflow-hidden shadow-sm border border-rose-50 hover:shadow-md transition-all relative">
      {/* Remove button */}
      <button
        onClick={handleRemove}
        disabled={removing}
        className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-white shadow-md border border-rose-100 text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition-all disabled:opacity-60"
        title="Remove from saved"
      >
        {removing ? (
          <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Heart className="w-3.5 h-3.5 fill-rose-500" />
        )}
      </button>

      <Link href={`/vendors/${vendor.id}`} className="block">
        <div className="relative h-48 bg-gradient-to-br from-rose-100 to-rose-50 overflow-hidden">
          {photo ? (
            <img
              src={photo}
              alt={vendor.businessName}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Camera className="w-12 h-12 text-rose-200" />
            </div>
          )}
          {category && (
            <span className="absolute top-3 left-3 text-xs font-semibold bg-white/90 backdrop-blur-sm text-rose-700 px-2.5 py-1 rounded-full">
              {category}
            </span>
          )}
        </div>

        <div className="p-4">
          <h3 className="font-semibold text-gray-900 group-hover:text-rose-700 transition-colors">
            {vendor.businessName}
          </h3>
          {vendor.city && (
            <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
              <MapPin className="w-3 h-3" />
              {vendor.city}
            </div>
          )}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
            <div className="flex items-center gap-1">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span className="text-sm font-medium text-gray-700">{formatRating(rating)}</span>
              {reviews > 0 && <span className="text-xs text-gray-400">({reviews})</span>}
            </div>
            {vendor.pricingMin && (
              <span className="text-sm font-semibold text-rose-700">
                from {formatPaise(vendor.pricingMin)}
              </span>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-rose-50">
      <div className="h-48 shimmer" />
      <div className="p-4 space-y-2">
        <div className="h-4 shimmer rounded w-3/4" />
        <div className="h-3 shimmer rounded w-1/2" />
        <div className="h-3 shimmer rounded w-1/3 mt-3" />
      </div>
    </div>
  );
}

export default function FavoritesPage() {
  const router = useRouter();
  const { isLoggedIn, initialize } = useAuthStore();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    initialize();
    setInitialized(true);
  }, [initialize]);

  useEffect(() => {
    if (!initialized) return;
    if (!isLoggedIn) {
      router.push('/login?redirect=/favorites');
      return;
    }

    api<{ data: Vendor[] } | Vendor[]>('/customer/favorites')
      .then((res) => {
        const list = Array.isArray(res) ? res : (res as any).data ?? [];
        setVendors(list);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [initialized, isLoggedIn, router]);

  const handleRemove = (id: string) => {
    setVendors((prev) => prev.filter((v) => v.id !== id));
  };

  if (!initialized || (!isLoggedIn && initialized)) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-16">
        <LoaderCircle className="w-6 h-6 animate-spin text-rose-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf8f5] pt-16">
      {/* Header */}
      <div className="gradient-bg pt-10 pb-12 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-1/3 w-64 h-64 rounded-full bg-rose-500/10 blur-3xl" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="inline-flex items-center gap-2 bg-white/10 text-white/80 text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
            <Heart className="w-3.5 h-3.5" />
            Saved Vendors
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">Saved Vendors</h1>
          <p className="text-white/70 text-sm">
            Your shortlisted vendors for the perfect wedding
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-5 pb-16">
        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {[...Array(8)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : vendors.length === 0 ? (
          <div className="text-center py-24">
            <div className="w-20 h-20 rounded-full bg-rose-50 flex items-center justify-center mx-auto mb-5">
              <Heart className="w-10 h-10 text-rose-300" />
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">No saved vendors yet</h3>
            <p className="text-gray-500 mb-8 text-sm max-w-sm mx-auto">
              Start browsing vendors and tap the heart icon to save your favorites for easy access later.
            </p>
            <Link
              href="/vendors"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-rose-700 to-rose-500 text-white font-semibold hover:from-rose-800 hover:to-rose-600 transition-all shadow-md"
            >
              <Sparkles className="w-4 h-4" />
              Browse Vendors
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between py-4 mb-2">
              <p className="text-sm text-gray-500">
                {vendors.length} vendor{vendors.length !== 1 ? 's' : ''} saved
              </p>
              <Link
                href="/vendors"
                className="text-sm font-semibold text-rose-700 hover:text-rose-800 flex items-center gap-1"
              >
                Browse More <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {vendors.map((vendor) => (
                <FavoriteVendorCard key={vendor.id} vendor={vendor} onRemove={handleRemove} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
