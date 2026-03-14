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

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<ReviewsResponse | null>(null);
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [avgRating, setAvgRating] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [responseText, setResponseText] = useState('');
  const [respondLoading, setRespondLoading] = useState(false);
  const [page, setPage] = useState(1);

  const fetchData = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const profile = await api<ProfileData>('/vendor/profile/me');
      setVendorId(profile.id);
      setAvgRating(profile.vendorStats?.averageRating ?? 0);
      const res = await api<ReviewsResponse>(
        `/vendor/${profile.id}/reviews?page=${p}&limit=10`
      );
      setReviews(res);
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

  const totalPages = reviews ? Math.ceil(reviews.total / reviews.limit) : 0;

  return (
    <VendorLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reviews</h1>
          <p className="text-sm text-slate-500">
            Customer feedback{reviews ? ` (${reviews.total} reviews)` : ''}
          </p>
        </div>
        {avgRating > 0 && (
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5">
            <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
            <span className="text-lg font-bold text-slate-900">{avgRating.toFixed(1)}</span>
            <span className="text-sm text-slate-400">/ 5</span>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
          <button onClick={() => setError('')} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      {loading && (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        </div>
      )}

      {!loading && reviews && (
        <div className="space-y-4">
          {reviews.items.length === 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-400">
              No reviews yet. Complete bookings to receive customer reviews.
            </div>
          )}

          {reviews.items.map((review) => (
            <div key={review.id} className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-900">{review.customer.name}</span>
                    <span className="text-xs text-slate-400">{formatDate(review.createdAt)}</span>
                  </div>
                  <div className="mt-1 flex gap-0.5">
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
              </div>

              {review.comment && (
                <p className="mt-3 text-sm text-slate-600">{review.comment}</p>
              )}

              {review.vendorResponse && (
                <div className="mt-3 rounded-lg bg-slate-50 p-3">
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
                  Respond
                </button>
              )}

              {respondingTo === review.id && (
                <div className="mt-3 flex items-center gap-3">
                  <input
                    type="text"
                    value={responseText}
                    onChange={(e) => setResponseText(e.target.value)}
                    placeholder="Write your response..."
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    autoFocus
                  />
                  <button
                    onClick={() => handleRespond(review.id)}
                    disabled={!responseText.trim() || respondLoading}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {respondLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send'}
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
              )}
            </div>
          ))}

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
