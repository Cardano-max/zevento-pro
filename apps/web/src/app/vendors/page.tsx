'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Search, MapPin, Star, Camera, Filter, SlidersHorizontal,
  X, LoaderCircle, ChevronLeft, ChevronRight, Users
} from 'lucide-react';
import { api } from '@/lib/api';
import { Vendor, Category } from '@/lib/types';
import { formatPaise, formatRating } from '@/lib/format';

const CITIES = ['Mumbai', 'Delhi', 'Bengaluru', 'Hyderabad', 'Chennai', 'Kolkata', 'Pune', 'Ahmedabad', 'Jaipur', 'Surat'];

function VendorCard({ vendor }: { vendor: Vendor }) {
  const photo = vendor.photos?.[0]?.url;
  const rating = vendor.stats?.avgRating;
  const reviews = vendor.stats?.reviewCount ?? 0;
  const bookings = vendor.stats?.totalBookings ?? 0;
  const category = vendor.categories?.[0]?.category?.name;

  return (
    <Link
      href={`/vendors/${vendor.id}`}
      className="group bg-white rounded-2xl overflow-hidden shadow-sm border border-rose-50/80 hover:shadow-lg hover:border-rose-100 transition-all hover:-translate-y-1"
    >
      <div className="relative h-52 bg-gradient-to-br from-rose-100 to-pink-50 overflow-hidden">
        {photo ? (
          <img src={photo} alt={vendor.businessName} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2">
            <Camera className="w-10 h-10 text-rose-200" />
            <span className="text-xs text-rose-300">{vendor.role}</span>
          </div>
        )}
        {category && (
          <span className="absolute top-3 left-3 text-xs font-semibold bg-white/95 backdrop-blur-sm text-rose-700 px-2.5 py-1 rounded-full shadow-sm">
            {category}
          </span>
        )}
        {rating && rating >= 4.5 && (
          <span className="absolute top-3 right-3 text-xs font-bold bg-amber-400 text-amber-950 px-2 py-1 rounded-full">
            ⭐ Top Rated
          </span>
        )}
      </div>

      <div className="p-4">
        <h3 className="font-semibold text-gray-900 group-hover:text-rose-700 transition-colors mb-1">
          {vendor.businessName}
        </h3>
        {vendor.city && (
          <p className="flex items-center gap-1 text-xs text-gray-500">
            <MapPin className="w-3 h-3" />
            {vendor.city}
          </p>
        )}
        {vendor.description && (
          <p className="text-xs text-gray-400 mt-2 line-clamp-2 leading-relaxed">
            {vendor.description}
          </p>
        )}

        <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-50">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span className="text-sm font-semibold text-gray-700">{formatRating(rating)}</span>
              {reviews > 0 && <span className="text-xs text-gray-400">({reviews})</span>}
            </div>
            {bookings > 0 && (
              <span className="text-xs text-gray-400">{bookings} bookings</span>
            )}
          </div>
          {vendor.pricingMin && (
            <div className="text-right">
              <p className="text-[10px] text-gray-400">Starting</p>
              <p className="text-sm font-bold text-rose-700">{formatPaise(vendor.pricingMin)}</p>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

function VendorsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [city, setCity] = useState(searchParams.get('city') || '');
  const [categoryId, setCategoryId] = useState(searchParams.get('categoryId') || '');
  const [budgetMin, setBudgetMin] = useState(searchParams.get('budgetMin') || '');
  const [budgetMax, setBudgetMax] = useState(searchParams.get('budgetMax') || '');
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1);

  useEffect(() => {
    api<Category[]>('/customer/categories').then(setCategories).catch(() => {});
  }, []);

  const fetchVendors = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (city) params.set('city', city);
    if (categoryId) params.set('categoryId', categoryId);
    if (budgetMin) params.set('budgetMin', String(Number(budgetMin) * 100));
    if (budgetMax) params.set('budgetMax', String(Number(budgetMax) * 100));
    params.set('page', String(page));
    params.set('limit', '12');

    api<{ data: Vendor[]; vendors?: Vendor[]; pagination?: { totalPages: number } }>(`/customer/vendors?${params}`)
      .then((res) => {
        let filtered = res.data ?? res.vendors ?? [];
        if (search) {
          const q = search.toLowerCase();
          filtered = filtered.filter(
            (v) =>
              v.businessName.toLowerCase().includes(q) ||
              v.description?.toLowerCase().includes(q) ||
              v.categories?.some((c) => c.category.name.toLowerCase().includes(q))
          );
        }
        setVendors(filtered);
        setTotalPages(res.pagination?.totalPages ?? 1);
        setLoading(false);
      })
      .catch(() => {
        setVendors([]);
        setLoading(false);
      });
  }, [city, categoryId, budgetMin, budgetMax, page, search]);

  useEffect(() => {
    fetchVendors();
  }, [fetchVendors]);

  const clearFilters = () => {
    setSearch('');
    setCity('');
    setCategoryId('');
    setBudgetMin('');
    setBudgetMax('');
    setPage(1);
  };

  const hasFilters = search || city || categoryId || budgetMin || budgetMax;

  return (
    <div className="min-h-screen bg-[#faf8f5] pt-16">
      {/* Header */}
      <div className="gradient-bg pt-16 pb-12 px-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">Find Your Perfect Vendors</h1>
          <p className="text-white/70 mb-8">Browse 10,000+ verified wedding professionals across India</p>

          {/* Search */}
          <div className="flex flex-col sm:flex-row gap-3 max-w-2xl">
            <div className="flex-1 flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl px-4 py-3">
              <Search className="w-4 h-4 text-white/50 shrink-0" />
              <input
                type="text"
                placeholder="Search vendors, services..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="flex-1 bg-transparent text-white placeholder-white/40 outline-none text-sm"
              />
            </div>
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl px-4 py-3 min-w-44">
              <MapPin className="w-4 h-4 text-white/50 shrink-0" />
              <select
                value={city}
                onChange={(e) => { setCity(e.target.value); setPage(1); }}
                className="flex-1 bg-transparent text-white outline-none text-sm appearance-none cursor-pointer"
              >
                <option value="" className="text-gray-900">All Cities</option>
                {CITIES.map((c) => (
                  <option key={c} value={c} className="text-gray-900">{c}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filter Bar */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              showFilters ? 'bg-rose-700 text-white' : 'bg-white text-gray-700 border border-gray-200 hover:border-rose-300'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filters
          </button>

          {/* Category chips */}
          <div className="flex flex-wrap gap-2">
            {categories.slice(0, 6).map((cat) => (
              <button
                key={cat.id}
                onClick={() => { setCategoryId(categoryId === cat.id ? '' : cat.id); setPage(1); }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  categoryId === cat.id
                    ? 'bg-rose-700 text-white shadow-md'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-rose-300 hover:text-rose-700'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
            >
              <X className="w-3 h-3" />
              Clear Filters
            </button>
          )}

          <span className="ml-auto text-sm text-gray-500">
            {loading ? '...' : `${vendors.length} vendors found`}
          </span>
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-6 shadow-sm animate-fade-in">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Category</label>
                <select
                  value={categoryId}
                  onChange={(e) => { setCategoryId(e.target.value); setPage(1); }}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 outline-none focus:border-rose-400"
                >
                  <option value="">All Categories</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">City</label>
                <select
                  value={city}
                  onChange={(e) => { setCity(e.target.value); setPage(1); }}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 outline-none focus:border-rose-400"
                >
                  <option value="">All Cities</option>
                  {CITIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Budget Min (₹)</label>
                <input
                  type="number"
                  placeholder="e.g. 10000"
                  value={budgetMin}
                  onChange={(e) => { setBudgetMin(e.target.value); setPage(1); }}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 outline-none focus:border-rose-400"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Budget Max (₹)</label>
                <input
                  type="number"
                  placeholder="e.g. 100000"
                  value={budgetMax}
                  onChange={(e) => { setBudgetMax(e.target.value); setPage(1); }}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 outline-none focus:border-rose-400"
                />
              </div>
            </div>
          </div>
        )}

        {/* Vendors Grid */}
        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl overflow-hidden shadow-sm">
                <div className="h-52 shimmer" />
                <div className="p-4 space-y-2">
                  <div className="h-4 shimmer rounded w-3/4" />
                  <div className="h-3 shimmer rounded w-1/2" />
                  <div className="h-3 shimmer rounded w-full mt-4" />
                </div>
              </div>
            ))}
          </div>
        ) : vendors.length === 0 ? (
          <div className="text-center py-24">
            <div className="text-5xl mb-4">🔍</div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">No vendors found</h3>
            <p className="text-gray-500 mb-6">Try adjusting your search or filters</p>
            <button
              onClick={clearFilters}
              className="px-6 py-3 rounded-xl bg-rose-700 text-white font-semibold hover:bg-rose-800 transition-colors"
            >
              Clear All Filters
            </button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {vendors.map((vendor) => (
              <VendorCard key={vendor.id} vendor={vendor} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-10">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="p-2 rounded-xl border border-gray-200 text-gray-600 hover:border-rose-300 hover:text-rose-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            {[...Array(Math.min(totalPages, 7))].map((_, i) => {
              const p = i + 1;
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-10 h-10 rounded-xl text-sm font-medium transition-all ${
                    p === page
                      ? 'bg-rose-700 text-white shadow-md'
                      : 'border border-gray-200 text-gray-600 hover:border-rose-300 hover:text-rose-700'
                  }`}
                >
                  {p}
                </button>
              );
            })}
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="p-2 rounded-xl border border-gray-200 text-gray-600 hover:border-rose-300 hover:text-rose-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function VendorsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center pt-16">
        <LoaderCircle className="w-8 h-8 animate-spin text-rose-600" />
      </div>
    }>
      <VendorsContent />
    </Suspense>
  );
}
