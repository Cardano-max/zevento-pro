'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Sparkles, ArrowRight, LoaderCircle, CircleCheck,
  Camera, Music, Palette, Mic, Users, Flower,
  Heart, Star, MapPin, ChevronRight, Gift, Gem
} from 'lucide-react';
import { formatPaise } from '@/lib/format';
import { WeddingPlanItem } from '@/lib/types';

const WEDDING_SERVICES: WeddingPlanItem[] = [
  { service: 'Photography & Videography', emoji: '📸', percent: 15, budgetPaise: 0, description: 'Capture every precious moment with professional photographers and cinematographers' },
  { service: 'Decoration & Florals', emoji: '🌸', percent: 18, budgetPaise: 0, description: 'Transform your venue with stunning floral arrangements and thematic decorations' },
  { service: 'Catering & Food', emoji: '🍽️', percent: 30, budgetPaise: 0, description: 'Delight your guests with authentic cuisine and live food stations' },
  { service: 'Venue & Hall', emoji: '🏰', percent: 20, budgetPaise: 0, description: 'Book the perfect venue that matches your wedding vision and guest count' },
  { service: 'DJ & Entertainment', emoji: '🎵', percent: 5, budgetPaise: 0, description: 'Keep the energy alive with professional DJs, live bands, and performers' },
  { service: 'Lighting & AV', emoji: '💡', percent: 5, budgetPaise: 0, description: 'Professional lighting design and audio-visual setup for your celebration' },
  { service: 'Bridal & Groom Wear', emoji: '👗', percent: 8, budgetPaise: 0, description: 'Find your dream bridal lehenga, sherwani, and accessories' },
  { service: 'Mehndi & Beauty', emoji: '💅', percent: 3, budgetPaise: 0, description: 'Professional mehndi artists and bridal makeup specialists' },
  { service: 'Anchor & MC', emoji: '🎤', percent: 2, budgetPaise: 0, description: 'Charismatic hosts to guide your celebration and keep guests entertained' },
  { service: 'Wedding Cards', emoji: '💌', percent: 1, budgetPaise: 0, description: 'Beautiful invitations that set the tone for your big day' },
  { service: 'Transportation', emoji: '🚗', percent: 2, budgetPaise: 0, description: 'Elegant bridal entry and guest transportation arrangements' },
  { service: 'Gifts & Favors', emoji: '🎁', percent: 1, budgetPaise: 0, description: 'Thoughtful gifts and return favors for your cherished guests' },
];

type Step = 'input' | 'result';

export default function PlanPage() {
  const [step, setStep] = useState<Step>('input');
  const [budget, setBudget] = useState('');
  const [guestCount, setGuestCount] = useState('');
  const [city, setCity] = useState('');
  const [weddingDate, setWeddingDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<WeddingPlanItem[]>([]);
  const [totalBudget, setTotalBudget] = useState(0);

  const generatePlan = () => {
    const budgetRupees = Number(budget);
    if (!budgetRupees || budgetRupees < 10000) {
      alert('Please enter a valid budget (min ₹10,000)');
      return;
    }
    setLoading(true);

    // Simulate AI processing
    setTimeout(() => {
      const budgetPaise = budgetRupees * 100;
      const generatedPlan = WEDDING_SERVICES.map((service) => ({
        ...service,
        budgetPaise: Math.round(budgetPaise * (service.percent / 100)),
      }));
      setPlan(generatedPlan);
      setTotalBudget(budgetPaise);
      setLoading(false);
      setStep('result');
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-[#faf8f5] pt-16">
      {/* Header */}
      <div className="gradient-bg pt-16 pb-16 px-4 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full bg-rose-500/10 blur-3xl" />
          <div className="absolute bottom-0 right-1/3 w-72 h-72 rounded-full bg-amber-400/10 blur-3xl" />
        </div>
        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-amber-400/10 text-amber-400 text-xs font-bold tracking-widest uppercase px-4 py-2 rounded-full mb-6">
            <Sparkles className="w-3.5 h-3.5" />
            AI-Powered Planning
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
            Your Dream Wedding,{' '}
            <span className="text-amber-400">Planned in 60 Seconds</span>
          </h1>
          <p className="text-white/70 text-lg max-w-2xl mx-auto">
            Tell us your budget and preferences. Our AI will generate a complete wedding plan with vendor recommendations, budget breakdown, and booking checklist.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 -mt-8 pb-16">
        {step === 'input' && (
          <div className="bg-white rounded-3xl shadow-xl border border-rose-50 p-6 sm:p-10 animate-fade-up">
            <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-rose-600" />
              Tell Us About Your Wedding
            </h2>

            <div className="grid sm:grid-cols-2 gap-5 mb-6">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">
                  Total Budget (₹) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">₹</span>
                  <input
                    type="number"
                    placeholder="e.g. 1000000"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    className="w-full pl-8 pr-4 py-3.5 border border-gray-200 rounded-2xl text-gray-800 outline-none focus:border-rose-400 transition-colors text-sm"
                  />
                </div>
                {budget && Number(budget) >= 10000 && (
                  <p className="text-xs text-rose-600 mt-1 font-medium">
                    = {formatPaise(Number(budget) * 100)}
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">
                  Number of Guests
                </label>
                <input
                  type="number"
                  placeholder="e.g. 500"
                  value={guestCount}
                  onChange={(e) => setGuestCount(e.target.value)}
                  className="w-full px-4 py-3.5 border border-gray-200 rounded-2xl text-gray-800 outline-none focus:border-rose-400 transition-colors text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">
                  Wedding City
                </label>
                <input
                  type="text"
                  placeholder="e.g. Mumbai"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-4 py-3.5 border border-gray-200 rounded-2xl text-gray-800 outline-none focus:border-rose-400 transition-colors text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">
                  Wedding Date
                </label>
                <input
                  type="date"
                  value={weddingDate}
                  onChange={(e) => setWeddingDate(e.target.value)}
                  className="w-full px-4 py-3.5 border border-gray-200 rounded-2xl text-gray-800 outline-none focus:border-rose-400 transition-colors text-sm"
                />
              </div>
            </div>

            {/* Budget Presets */}
            <div className="mb-8">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Quick Select Budget</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: '₹5L', value: '500000' },
                  { label: '₹10L', value: '1000000' },
                  { label: '₹20L', value: '2000000' },
                  { label: '₹50L', value: '5000000' },
                  { label: '₹1 Cr', value: '10000000' },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => setBudget(preset.value)}
                    className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                      budget === preset.value
                        ? 'bg-rose-700 text-white shadow-md'
                        : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={generatePlan}
              disabled={loading || !budget}
              className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-gradient-to-r from-rose-700 to-rose-500 text-white font-bold text-lg hover:from-rose-800 hover:to-rose-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xl hover:shadow-rose-300"
            >
              {loading ? (
                <>
                  <LoaderCircle className="w-5 h-5 animate-spin" />
                  AI is planning your wedding...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Generate My Wedding Plan
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>

            <p className="text-center text-xs text-gray-400 mt-4">
              Free to use · No credit card required · Instant results
            </p>
          </div>
        )}

        {step === 'result' && (
          <div className="animate-fade-up">
            {/* Success Banner */}
            <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-3xl p-5 mb-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                <CircleCheck className="w-7 h-7 text-white" />
              </div>
              <div>
                <p className="text-white font-bold text-lg">Your Wedding Plan is Ready! 🎊</p>
                <p className="text-white/80 text-sm">
                  Total Budget: <strong>{formatPaise(totalBudget)}</strong>
                  {city && ` · ${city}`}
                  {guestCount && ` · ${guestCount} guests`}
                </p>
              </div>
            </div>

            {/* Plan Grid */}
            <div className="bg-white rounded-3xl shadow-xl border border-rose-50 overflow-hidden mb-6">
              <div className="p-6 border-b border-gray-50 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Complete Wedding Breakdown</h2>
                <button
                  onClick={() => setStep('input')}
                  className="text-sm text-rose-700 font-semibold hover:text-rose-800 flex items-center gap-1"
                >
                  Edit Plan
                </button>
              </div>

              <div className="divide-y divide-gray-50">
                {plan.map((item, i) => (
                  <div key={item.service} className="flex items-center gap-4 p-4 hover:bg-rose-50/30 transition-colors group">
                    <span className="text-2xl w-10 text-center shrink-0">{item.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900 text-sm">{item.service}</h3>
                        <span className="font-bold text-rose-700 text-sm shrink-0">
                          {formatPaise(item.budgetPaise)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 line-clamp-1 mb-2">{item.description}</p>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-rose-500 to-rose-400 rounded-full transition-all"
                            style={{ width: `${item.percent}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-400 shrink-0">{item.percent}%</span>
                      </div>
                    </div>
                    <Link
                      href={`/vendors?search=${encodeURIComponent(item.service.split('&')[0].trim())}${city ? `&city=${encodeURIComponent(city)}` : ''}`}
                      className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <div className="flex items-center gap-1 text-xs font-semibold text-rose-700 bg-rose-50 px-3 py-1.5 rounded-full hover:bg-rose-100">
                        Find Vendors
                        <ChevronRight className="w-3 h-3" />
                      </div>
                    </Link>
                  </div>
                ))}
              </div>

              <div className="p-5 bg-rose-50/50 flex items-center justify-between">
                <span className="font-bold text-gray-900">Total Budget</span>
                <span className="text-xl font-black text-rose-700">{formatPaise(totalBudget)}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="grid sm:grid-cols-2 gap-4">
              <Link
                href={`/vendors${city ? `?city=${encodeURIComponent(city)}` : ''}`}
                className="flex items-center justify-center gap-2 py-4 rounded-2xl bg-gradient-to-r from-rose-700 to-rose-500 text-white font-bold hover:from-rose-800 hover:to-rose-600 transition-all shadow-lg"
              >
                <Users className="w-5 h-5" />
                Browse All Vendors
              </Link>
              <button
                onClick={() => setStep('input')}
                className="flex items-center justify-center gap-2 py-4 rounded-2xl border-2 border-rose-200 text-rose-700 font-bold hover:bg-rose-50 transition-all"
              >
                <Sparkles className="w-5 h-5" />
                Adjust Budget
              </button>
            </div>

            {/* Tips */}
            <div className="mt-6 grid sm:grid-cols-3 gap-4">
              {[
                { icon: '💡', title: 'Book Early', desc: 'Top vendors book 6-12 months in advance. Start early!' },
                { icon: '📊', title: 'Buffer 10%', desc: 'Keep 10% of your budget as a contingency reserve.' },
                { icon: '🤝', title: 'Negotiate', desc: 'Most vendors offer discounts for off-season or weekday weddings.' },
              ].map((tip) => (
                <div key={tip.title} className="bg-white rounded-2xl p-4 border border-rose-50 shadow-sm">
                  <span className="text-2xl">{tip.icon}</span>
                  <h4 className="font-bold text-gray-900 text-sm mt-2 mb-1">{tip.title}</h4>
                  <p className="text-xs text-gray-500 leading-relaxed">{tip.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
