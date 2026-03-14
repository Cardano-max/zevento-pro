'use client';

import { useEffect, useState, useCallback } from 'react';
import { Loader2, Star, MessageSquare } from 'lucide-react';
import { VendorLayout } from '@/components/layout';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/cn';

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  vendorResponse: string | null;
  createdAt: string;
  customer: { name: string };
}

interface ReviewsResponse {
  items: Review[];
  total: number;
  page: number;
  limit: number;
}

interface ProfileData {
  id: string;
  vendorStats: { averageRating: number; totalReviews: number } | null;
}

const STAR_FILTERS = [0, 5, 4, 3, 2, 1] as const;
const FILTER_LABELS: Record<number, string> = {
  0: 'All',
  5: '5 star',
  4: '4 star',
  3: '3 star',
  2: '2 star',
  1: '1 star',
};

export default function ReviewsPage() {
  const [allReviews, setAllReviews] = useState<Review[]>([]);
  const [avgRating, setAvgRating] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [responseText, setResponseText] = useState('');
  const [respondLoading, setRespondLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [starFilter, setStarFilter] = useState<number>(0);
  const [total, setTotal] = useState(0);
  const limit = 10;

  const fetchData = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const profile = await api<ProfileData>('/vendor/profile/me');
      setAvgRating(profile.vendorStats?.averageRating ?? 0);
      setTotalReviews(profile.vendorStats?.totalReviews ?? 0);
      const res = await api<ReviewsResponse>(
        `/vendor/${profile.id}/reviews?page=${p}&limit=${limit}`
      );
      setAllReviews(res.items);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reviews');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(page);
  }, [page, fetchData]);

  async function handleRespond(reviewId: string) {
    if (!responseText.trim()) return;
    setRespondLoading(true);
    try {
      await api(`/reviews/${reviewId}/respond`, {
        method: 'PATCH',
        body: JSON.stringify({ response: responseText }),
      });
      setRespondingTo(null);
      setResponseText('');
      fetchData(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to respond');
    } finally {
      setRespondLoading(false);
    }
  }

  // Client-side star filter
  const filteredReviews =
    starFilter === 0 ? allReviews : allReviews.filter((r) => r.rating === starFilter);

  const totalPages = Math.ceil(total / limit);

  // Rating distribution
  const ratingCounts = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: allReviews.filter((r) => r.rating === star).length,
  }));

  return (
    <VendorLayout>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reviews</h1>
          <p className="text-sm text-slate-500">
            Customer feedback{totalReviews > 0 ? ` (${totalReviews} reviews)` : ''}
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
          <button onClick={() => setError('')} className="ml-2 underline">
            Dismiss
          </button>
        </div>
      )}

      {loading && (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        </div>
      )}

      {!loading && (
        <div className="space-y-6">
          {/* Rating Summary */}
          {avgRating > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
                {/* Big Rating Number */}
                <div className="flex flex-col items-center gap-1 sm:border-r sm:border-slate-100 sm:pr-6">
                  <span className="text-5xl font-bold text-slate-900">{avgRating.toFixed(1)}</span>
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={cn(
                          'h-5 w-5',
                          s <= Math.round(avgRating)
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-slate-200'
                        )}
                      />
                    ))}
                  </div>
                  <span className="text-sm text-slate-400">{totalReviews} reviews</span>
                </div>

                {/* Rating Bars */}
                <div className="flex-1 space-y-2">
                  {ratingCounts.map(({ star, count }) => {
                    const pct = totalReviews > 0 ? (count / totalReviews) * 100 : 0;
                    return (
                      <div key={star} className="flex items-center gap-3">
                        <div className="flex w-12 shrink-0 items-center justify-end gap-1 text-xs text-slate-500">
                          {star}
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                        </div>
                        <div className="flex-1 overflow-hidden rounded-full bg-slate-100 h-2">
                          <div
                            className="h-full rounded-full bg-amber-400 transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="w-6 text-right text-xs text-slate-400">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Filter Tabs */}
          <div className="flex flex-wrap gap-2">
            {STAR_FILTERS.map((star) => (
              <button
                key={star}
                onClick={() => setStarFilter(star)}
                className={cn(
                  'flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
                  starFilter === star
                    ? 'bg-emerald-600 text-white'
                    : 'border border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:text-emerald-700'
                )}
              >
                {star > 0 && <Star className="h-3.5 w-3.5 fill-current" />}
                {FILTER_LABELS[star]}
              </button>
            ))}
          </div>

          {/* Reviews List */}
          {filteredReviews.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
              <Star className="mx-auto h-10 w-10 text-slate-200" />
              <p className="mt-3 text-sm font-medium text-slate-500">
                {totalReviews === 0
                  ? 'No reviews yet. Complete bookings to receive reviews from customers.'
                  : `No ${starFilter}-star reviews.`}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredReviews.map((review) => (
                <div key={review.id} className="rounded-xl border border-slate-200 bg-white p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600">
                          {review.customer.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <span className="text-sm font-medium text-slate-900">
                            {review.customer.name}
                          </span>
                          <p className="text-xs text-slate-400">{formatDate(review.createdAt)}</p>
                        </div>
                      </div>
                      <div className="mt-2 flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={cn(
                              'h-4 w-4',
                              s <= review.rating
                                ? 'fill-amber-400 text-amber-400'
                                : 'text-slate-200'
                            )}
                          />
                        ))}
                      </div>
                    </div>
                    <span className="text-xs text-slate-400">
                      {review.rating}/5
                    </span>
                  </div>

                  {review.comment && (
                    <p className="mt-3 text-sm text-slate-600 leading-relaxed">{review.comment}</p>
                  )}

                  {!review.comment && (
                    <p className="mt-3 text-sm italic text-slate-400">No written review</p>
                  )}

                  {review.vendorResponse && (
                    <div className="mt-3 rounded-lg bg-slate-50 p-3 border-l-4 border-emerald-400">
                      <p className="text-xs font-medium text-slate-500 mb-1">Your response</p>
                      <p className="text-sm text-slate-700">{review.vendorResponse}</p>
                    </div>
                  )}

                  {!review.vendorResponse && respondingTo !== review.id && (
                    <button
                      onClick={() => setRespondingTo(review.id)}
                      className="mt-3 flex items-center gap-1.5 text-sm font-medium text-emerald-600 hover:text-emerald-700"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      Respond to review
                    </button>
                  )}

                  {respondingTo === review.id && (
                    <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                      <textarea
                        value={responseText}
                        onChange={(e) => setResponseText(e.target.value)}
                        placeholder="Write a professional response to this review..."
                        rows={3}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 resize-none"
                        autoFocus
                      />
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleRespond(review.id)}
                          disabled={!responseText.trim() || respondLoading}
                          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {respondLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Post Response'}
                        </button>
                        <button
                          onClick={() => {
                            setRespondingTo(null);
                            setResponseText('');
                          }}
                          className="text-sm text-slate-500 hover:text-slate-700"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-5 py-3">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="text-sm font-medium text-slate-600 hover:text-slate-900 disabled:text-slate-300"
              >
                Previous
              </button>
              <span className="text-sm text-slate-500">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="text-sm font-medium text-slate-600 hover:text-slate-900 disabled:text-slate-300"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </VendorLayout>
  );
}
