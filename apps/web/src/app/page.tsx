'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight, Sparkles, Star, MapPin, Camera, Music,
  Palette, Mic, Users, Flower, Gift, Gem,
  ChevronRight, Zap, Heart, Award, TrendingUp, Search, MessageCircle, Calendar
} from 'lucide-react';
import { api } from '@/lib/api';
import { Vendor, Category, FeedPost } from '@/lib/types';
import { formatPaise, formatRating, formatDate } from '@/lib/format';

const weddingCategories = [
  { icon: '📸', label: 'Photography', slug: 'photography' },
  { icon: '🎨', label: 'Decoration', slug: 'decoration' },
  { icon: '🎵', label: 'DJ & Music', slug: 'dj-music' },
  { icon: '🎤', label: 'Anchor / Host', slug: 'anchor' },
  { icon: '💡', label: 'Lighting', slug: 'lighting' },
  { icon: '🌸', label: 'Mehndi', slug: 'mehndi' },
  { icon: '🍽️', label: 'Catering', slug: 'catering' },
  { icon: '💍', label: 'Jewellery', slug: 'jewellery' },
  { icon: '🚗', label: 'Bridal Entry', slug: 'bridal-entry' },
  { icon: '🎂', label: 'Wedding Cake', slug: 'cake' },
  { icon: '👗', label: 'Bridal Wear', slug: 'bridal-wear' },
  { icon: '🎁', label: 'Gifts', slug: 'gifts' },
];

const stats = [
  { value: '10,000+', label: 'Verified Vendors', icon: Users },
  { value: '50,000+', label: 'Happy Couples', icon: Heart },
  { value: '200+', label: 'Cities Covered', icon: MapPin },
  { value: '4.9★', label: 'Average Rating', icon: Star },
];

const testimonials = [
  {
    name: 'Priya & Rahul Sharma',
    city: 'Mumbai',
    text: 'Zevento made our dream wedding a reality! Found all our vendors in one place — photographer, decorator, mehndi artist. The AI planner saved us weeks of planning.',
    rating: 5,
    emoji: '👰',
  },
  {
    name: 'Ananya & Karan Mehta',
    city: 'Delhi',
    text: 'Incredible platform! Our wedding had 500 guests and Zevento helped coordinate everything perfectly. The vendor quality is exceptional.',
    rating: 5,
    emoji: '💑',
  },
  {
    name: 'Sneha & Vikram Patel',
    city: 'Bengaluru',
    text: 'Used the AI planner with ₹20L budget and got a complete breakdown in seconds. Booked 8 vendors through Zevento — seamless experience!',
    rating: 5,
    emoji: '🎊',
  },
];

function VendorCard({ vendor }: { vendor: Vendor }) {
  const photo = vendor.photos?.[0]?.url;
  const rating = vendor.stats?.avgRating;
  const reviews = vendor.stats?.reviewCount ?? 0;
  const category = vendor.categories?.[0]?.category?.name;

  return (
    <Link
      href={`/vendors/${vendor.id}`}
      className="group bg-white rounded-2xl overflow-hidden shadow-sm border border-rose-50 card-hover block"
    >
      <div className="relative h-48 bg-gradient-to-br from-rose-100 to-rose-50 overflow-hidden">
        {photo ? (
          <img src={photo} alt={vendor.businessName} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
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
  );
}

const FEED_CATEGORY_COLORS: Record<string, string> = {
  REQUIREMENT: 'bg-blue-50 text-blue-700',
  OFFER: 'bg-rose-50 text-rose-700',
  SHOWCASE: 'bg-purple-50 text-purple-700',
  GENERAL: 'bg-gray-50 text-gray-600',
};

export default function HomePage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [feedPosts, setFeedPosts] = useState<FeedPost[]>([]);
  const [searchCity, setSearchCity] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api<{ data: Vendor[]; vendors?: Vendor[] }>('/customer/vendors?limit=6').catch(() => ({ data: [], vendors: [] as Vendor[] })),
      api<Category[]>('/customer/categories').catch(() => []),
      api<{ data: FeedPost[] } | FeedPost[]>('/feed?limit=3').catch(() => [] as FeedPost[]),
    ]).then(([vRes, cats, feedRes]) => {
      setVendors(vRes.data ?? vRes.vendors ?? []);
      setCategories(Array.isArray(cats) ? cats : []);
      const posts = Array.isArray(feedRes) ? feedRes : (feedRes as any).data ?? [];
      setFeedPosts(posts);
      setLoading(false);
    });
  }, []);

  return (
    <div className="overflow-hidden">
      {/* ═══════════════ HERO ═══════════════ */}
      <section className="relative min-h-screen gradient-bg flex items-center">
        {/* Decorative elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full bg-rose-500/10 blur-3xl animate-float" style={{ animationDelay: '0s' }} />
          <div className="absolute bottom-1/3 right-1/4 w-96 h-96 rounded-full bg-rose-700/10 blur-3xl animate-float" style={{ animationDelay: '1.5s' }} />
          <div className="absolute top-1/2 right-1/3 w-32 h-32 rounded-full bg-amber-400/10 blur-2xl animate-float" style={{ animationDelay: '3s' }} />
        </div>

        {/* Decorative emoji */}
        <div className="absolute top-24 left-8 text-4xl animate-float opacity-60 hidden lg:block" style={{ animationDelay: '0.5s' }}>💍</div>
        <div className="absolute top-32 right-12 text-3xl animate-float opacity-50 hidden lg:block" style={{ animationDelay: '2s' }}>🌸</div>
        <div className="absolute bottom-32 left-16 text-3xl animate-float opacity-50 hidden lg:block" style={{ animationDelay: '1s' }}>🎊</div>
        <div className="absolute bottom-40 right-8 text-4xl animate-float opacity-60 hidden lg:block" style={{ animationDelay: '3s' }}>✨</div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16">
          <div className="text-center max-w-4xl mx-auto">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 glass px-4 py-2 rounded-full mb-8 animate-fade-up">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span className="text-sm text-white/90 font-medium">AI-Powered Wedding Planning</span>
            </div>

            {/* Headline */}
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white leading-tight mb-6 animate-fade-up" style={{ animationDelay: '0.1s' }}>
              Your Dream Wedding,{' '}
              <span className="gradient-text">Planned Perfectly</span>
            </h1>

            <p className="text-lg sm:text-xl text-white/70 leading-relaxed mb-10 max-w-2xl mx-auto animate-fade-up" style={{ animationDelay: '0.2s' }}>
              Connect with 10,000+ verified wedding vendors across India. From photographers to decorators — find, compare, and book everything for your special day.
            </p>

            {/* Search Bar */}
            <div className="glass-light rounded-2xl p-2 max-w-xl mx-auto flex gap-2 mb-8 animate-fade-up" style={{ animationDelay: '0.3s' }}>
              <div className="flex-1 flex items-center gap-2 px-3">
                <MapPin className="w-4 h-4 text-rose-500 shrink-0" />
                <input
                  type="text"
                  placeholder="Your city (e.g. Mumbai)"
                  value={searchCity}
                  onChange={(e) => setSearchCity(e.target.value)}
                  className="w-full bg-transparent text-gray-800 placeholder-gray-400 text-sm outline-none"
                />
              </div>
              <Link
                href={searchCity ? `/vendors?city=${encodeURIComponent(searchCity)}` : '/vendors'}
                className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-rose-700 to-rose-500 text-white rounded-xl text-sm font-semibold hover:from-rose-800 hover:to-rose-600 transition-all shadow-md"
              >
                <Search className="w-4 h-4" />
                Search
              </Link>
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center animate-fade-up" style={{ animationDelay: '0.4s' }}>
              <Link
                href="/plan"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 text-amber-950 font-bold text-base hover:from-amber-300 hover:to-amber-400 transition-all shadow-xl hover:shadow-amber-400/30 hover:scale-105"
              >
                <Sparkles className="w-5 h-5" />
                Plan with AI
              </Link>
              <Link
                href="/vendors"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl glass text-white font-semibold text-base hover:bg-white/15 transition-all"
              >
                Browse Vendors
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>

        {/* Wave */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 80" className="w-full" preserveAspectRatio="none">
            <path d="M0,40 C360,80 1080,0 1440,40 L1440,80 L0,80 Z" fill="#faf8f5" />
          </svg>
        </div>
      </section>

      {/* ═══════════════ STATS ═══════════════ */}
      <section className="py-12 bg-[#faf8f5]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 mb-3">
                  <stat.icon className="w-6 h-6" />
                </div>
                <div className="text-2xl sm:text-3xl font-bold text-gray-900">{stat.value}</div>
                <div className="text-sm text-gray-500 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ CATEGORIES ═══════════════ */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="inline-block text-xs font-bold tracking-widest uppercase text-rose-600 bg-rose-50 px-3 py-1 rounded-full mb-4">
              Everything You Need
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
              Browse by <span className="gradient-text">Category</span>
            </h2>
            <p className="text-gray-500 mt-3 max-w-xl mx-auto">
              From intimate mehndis to grand baraat celebrations — find specialists for every part of your wedding.
            </p>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
            {weddingCategories.map((cat) => (
              <Link
                key={cat.slug}
                href={`/vendors?search=${encodeURIComponent(cat.label)}`}
                className="group flex flex-col items-center gap-2 p-4 rounded-2xl bg-rose-50/50 hover:bg-rose-50 hover:shadow-md transition-all cursor-pointer"
              >
                <span className="text-3xl group-hover:scale-110 transition-transform">{cat.icon}</span>
                <span className="text-xs font-medium text-gray-700 text-center leading-tight">
                  {cat.label}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ COMMUNITY FEED PREVIEW ═══════════════ */}
      {(feedPosts.length > 0 || loading) && (
        <section className="py-20 bg-[#faf8f5]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-end justify-between mb-10">
              <div>
                <span className="inline-block text-xs font-bold tracking-widest uppercase text-rose-600 bg-rose-50 px-3 py-1 rounded-full mb-4">
                  Community
                </span>
                <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
                  Wedding Community <span className="gradient-text">Feed</span>
                </h2>
                <p className="text-gray-500 mt-2 max-w-xl">
                  Requirements, vendor offers, and stories from real couples and professionals.
                </p>
              </div>
              <Link
                href="/feed"
                className="hidden sm:flex items-center gap-1 text-sm font-semibold text-rose-700 hover:text-rose-800 transition-colors"
              >
                See All Posts <ChevronRight className="w-4 h-4" />
              </Link>
            </div>

            {loading ? (
              <div className="grid sm:grid-cols-3 gap-5">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="bg-white rounded-2xl p-5 shadow-sm border border-rose-50 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full shimmer" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-3.5 shimmer rounded w-1/2" />
                        <div className="h-3 shimmer rounded w-1/3" />
                      </div>
                    </div>
                    <div className="h-4 shimmer rounded w-full" />
                    <div className="h-4 shimmer rounded w-5/6" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid sm:grid-cols-3 gap-5">
                {feedPosts.map((post) => {
                  const authorName = post.author?.name || (post.author?.phone ? `***${post.author.phone.slice(-4)}` : 'Member');
                  const initial = authorName[0].toUpperCase();
                  return (
                    <Link key={post.id} href="/feed" className="group bg-white rounded-2xl p-5 shadow-sm border border-rose-50 hover:shadow-md hover:border-rose-100 transition-all card-hover block">
                      {/* Author */}
                      <div className="flex items-center gap-2.5 mb-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-rose-500 to-rose-700 flex items-center justify-center text-white font-bold text-sm shrink-0">
                          {initial}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 text-sm truncate">{authorName}</p>
                          <p className="text-xs text-gray-400">{formatDate(post.createdAt)}</p>
                        </div>
                        <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${FEED_CATEGORY_COLORS[post.category] ?? 'bg-gray-50 text-gray-600'}`}>
                          {post.category}
                        </span>
                      </div>

                      {/* Body */}
                      <p className="text-gray-700 text-sm leading-relaxed line-clamp-3 mb-3 group-hover:text-gray-900 transition-colors">
                        {post.body}
                      </p>

                      {/* Meta */}
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        {post.city && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {post.city}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <MessageCircle className="w-3 h-3" />
                          {post._count?.comments ?? 0} comments
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}

            <div className="text-center mt-8">
              <Link
                href="/feed"
                className="inline-flex items-center gap-2 px-8 py-3 rounded-2xl border-2 border-rose-200 text-rose-700 font-semibold hover:bg-rose-50 transition-all"
              >
                See All Posts
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════ AI PLANNER PROMO ═══════════════ */}
      <section className="py-20 gradient-bg relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/3 w-72 h-72 rounded-full bg-rose-500/10 blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 rounded-full bg-amber-400/5 blur-3xl" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-amber-400/10 text-amber-400 text-xs font-bold tracking-widest uppercase px-3 py-1.5 rounded-full mb-6">
                <Zap className="w-3 h-3" />
                Powered by AI
              </div>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6">
                Plan Your Entire Wedding in{' '}
                <span className="text-amber-400">60 Seconds</span>
              </h2>
              <p className="text-white/70 text-lg mb-8 leading-relaxed">
                Tell our AI your budget and preferences. Get a complete wedding plan with vendor recommendations, budget breakdown, and a booking checklist — instantly.
              </p>
              <ul className="space-y-3 mb-8">
                {[
                  'Budget-aware vendor recommendations',
                  'Complete checklist with 200+ services',
                  'Instant lead delivery to vendors',
                  'Negotiate prices in-platform',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-white/80">
                    <div className="w-5 h-5 rounded-full bg-rose-500 flex items-center justify-center shrink-0">
                      <ArrowRight className="w-3 h-3 text-white" />
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/plan"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 text-amber-950 font-bold text-base hover:from-amber-300 hover:to-amber-400 transition-all shadow-xl"
              >
                <Sparkles className="w-5 h-5" />
                Start Planning Free
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {/* Mock AI Card */}
            <div className="glass rounded-3xl p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-rose-500 to-rose-700 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">Zevento AI Planner</p>
                  <p className="text-white/50 text-xs">Generating your wedding plan...</p>
                </div>
              </div>

              <div className="space-y-3">
                {[
                  { emoji: '📸', service: 'Photography', budget: '₹1.5L', vendors: 12 },
                  { emoji: '🎨', service: 'Decoration', budget: '₹2.0L', vendors: 8 },
                  { emoji: '🍽️', service: 'Catering', budget: '₹3.5L', vendors: 15 },
                  { emoji: '🎵', service: 'DJ & Music', budget: '₹0.8L', vendors: 6 },
                  { emoji: '💡', service: 'Lighting', budget: '₹1.2L', vendors: 9 },
                ].map((item, i) => (
                  <div
                    key={item.service}
                    className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
                    style={{ animationDelay: `${i * 0.1}s` }}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{item.emoji}</span>
                      <div>
                        <p className="text-white text-sm font-medium">{item.service}</p>
                        <p className="text-white/40 text-xs">{item.vendors} vendors available</p>
                      </div>
                    </div>
                    <span className="text-amber-400 font-bold text-sm">{item.budget}</span>
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-4 border-t border-white/10 flex justify-between items-center">
                <span className="text-white/60 text-sm">Total Budget</span>
                <span className="text-white font-bold text-lg">₹9.0L</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ FEATURED VENDORS ═══════════════ */}
      <section className="py-20 bg-[#faf8f5]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-12">
            <div>
              <span className="inline-block text-xs font-bold tracking-widest uppercase text-rose-600 bg-rose-50 px-3 py-1 rounded-full mb-4">
                Top Rated
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
                Featured <span className="gradient-text">Vendors</span>
              </h2>
            </div>
            <Link
              href="/vendors"
              className="hidden sm:flex items-center gap-1 text-sm font-semibold text-rose-700 hover:text-rose-800 transition-colors"
            >
              View All <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          {loading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-white rounded-2xl overflow-hidden shadow-sm">
                  <div className="h-48 shimmer" />
                  <div className="p-4 space-y-2">
                    <div className="h-4 shimmer rounded w-3/4" />
                    <div className="h-3 shimmer rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : vendors.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {vendors.map((vendor) => (
                <VendorCard key={vendor.id} vendor={vendor} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="text-4xl mb-4">💍</div>
              <p className="text-gray-500">Vendors are joining soon!</p>
            </div>
          )}

          <div className="text-center mt-10">
            <Link
              href="/vendors"
              className="inline-flex items-center gap-2 px-8 py-3 rounded-2xl border-2 border-rose-200 text-rose-700 font-semibold hover:bg-rose-50 transition-all"
            >
              Browse All Vendors
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════════════ HOW IT WORKS ═══════════════ */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <span className="inline-block text-xs font-bold tracking-widest uppercase text-rose-600 bg-rose-50 px-3 py-1 rounded-full mb-4">
              Simple Process
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
              Book a Vendor in <span className="gradient-text">3 Simple Steps</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                icon: Sparkles,
                title: 'Plan with AI',
                desc: 'Enter your budget and preferences. Our AI creates a complete wedding plan tailored to you.',
                color: 'from-rose-50 to-rose-100',
                iconColor: 'text-rose-600',
              },
              {
                step: '02',
                icon: Users,
                title: 'Browse & Compare',
                desc: 'Explore verified vendors, read real reviews, compare prices, and check availability.',
                color: 'from-amber-50 to-amber-100',
                iconColor: 'text-amber-600',
              },
              {
                step: '03',
                icon: Heart,
                title: 'Book & Celebrate',
                desc: 'Send inquiries, negotiate prices, and lock in your dream team for the big day!',
                color: 'from-emerald-50 to-emerald-100',
                iconColor: 'text-emerald-600',
              },
            ].map((step, i) => (
              <div key={step.step} className="relative text-center group">
                {i < 2 && (
                  <div className="hidden md:block absolute top-8 left-full w-full h-px bg-gradient-to-r from-rose-200 to-transparent z-10" style={{ width: 'calc(50% + 2rem)', left: '75%' }} />
                )}
                <div className={`inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-gradient-to-br ${step.color} mb-6 group-hover:scale-110 transition-transform`}>
                  <step.icon className={`w-7 h-7 ${step.iconColor}`} />
                </div>
                <div className="text-4xl font-black text-rose-100 absolute top-0 right-1/4 -translate-y-2">{step.step}</div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{step.title}</h3>
                <p className="text-gray-500 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ TESTIMONIALS ═══════════════ */}
      <section className="py-20 bg-[#faf8f5]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <span className="inline-block text-xs font-bold tracking-widest uppercase text-rose-600 bg-rose-50 px-3 py-1 rounded-full mb-4">
              Love Stories
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
              Couples Who <span className="gradient-text">Love Zevento</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <div key={t.name} className="bg-white rounded-2xl p-6 shadow-sm border border-rose-50 card-hover">
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(t.rating)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-gray-600 leading-relaxed mb-6 text-sm">"{t.text}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center text-xl">
                    {t.emoji}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{t.name}</p>
                    <p className="text-xs text-gray-400 flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {t.city}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ CTA BANNER ═══════════════ */}
      <section className="py-20 gradient-bg relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-rose-600/20 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full bg-amber-400/10 blur-3xl" />
        </div>
        <div className="relative max-w-3xl mx-auto px-4 text-center">
          <div className="text-4xl mb-6">💍</div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6">
            Ready to Plan Your Dream Wedding?
          </h2>
          <p className="text-white/70 text-lg mb-10">
            Join 50,000+ couples who planned their perfect celebration with Zevento.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/plan"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 text-amber-950 font-bold text-base hover:from-amber-300 hover:to-amber-400 transition-all shadow-xl hover:scale-105"
            >
              <Sparkles className="w-5 h-5" />
              Start Planning with AI
            </Link>
            <Link
              href="/vendors"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl glass text-white font-semibold text-base hover:bg-white/15 transition-all"
            >
              Browse Vendors
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
