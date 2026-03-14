'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Users, MessageCircle, MapPin, Calendar, ArrowRight,
  Send, Heart, LoaderCircle, ChevronDown, ChevronUp,
  Sparkles, Filter, Plus, X
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { FeedPost, FeedComment } from '@/lib/types';
import { formatPaise, formatDate } from '@/lib/format';

type TabFilter = 'ALL' | 'REQUIREMENT' | 'OFFER' | 'SHOWCASE' | 'GENERAL';

const TAB_LABELS: { key: TabFilter; label: string }[] = [
  { key: 'ALL', label: 'All Posts' },
  { key: 'REQUIREMENT', label: 'Requirements' },
  { key: 'OFFER', label: 'Vendor Offers' },
  { key: 'SHOWCASE', label: 'Showcase' },
  { key: 'GENERAL', label: 'General' },
];

const CATEGORY_COLORS: Record<string, string> = {
  REQUIREMENT: 'bg-blue-50 text-blue-700',
  OFFER: 'bg-rose-50 text-rose-700',
  SHOWCASE: 'bg-purple-50 text-purple-700',
  GENERAL: 'bg-gray-50 text-gray-600',
};

const ROLE_COLORS: Record<string, string> = {
  CUSTOMER: 'bg-blue-100 text-blue-800',
  VENDOR: 'bg-rose-100 text-rose-800',
};

function authorLabel(author: FeedPost['author']): string {
  if (author.name) return author.name;
  if (author.phone) return `***${author.phone.slice(-4)}`;
  return 'Anonymous';
}

function authorInitial(author: FeedPost['author']): string {
  const name = author.name || author.phone || 'A';
  return name[0].toUpperCase();
}

const AVATAR_COLORS = [
  'from-rose-500 to-rose-700',
  'from-blue-500 to-blue-700',
  'from-purple-500 to-purple-700',
  'from-emerald-500 to-emerald-700',
  'from-amber-500 to-amber-600',
];

function avatarColor(id: string): string {
  let hash = 0;
  for (const c of id) hash = (hash + c.charCodeAt(0)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[hash];
}

function PostCard({ post, onCommentAdded }: { post: FeedPost; onCommentAdded?: () => void }) {
  const { isLoggedIn } = useAuthStore();
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [comments, setComments] = useState<FeedComment[]>(post.comments ?? []);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [commentCount, setCommentCount] = useState(post._count?.comments ?? post.comments?.length ?? 0);

  const loadComments = async () => {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (comments.length > 0) return;
    setCommentsLoading(true);
    try {
      const res = await api<{ data: FeedComment[] } | FeedComment[]>(`/feed/${post.id}/comments`);
      const list = Array.isArray(res) ? res : (res as any).data ?? [];
      setComments(list);
    } catch {
      // silently fail
    } finally {
      setCommentsLoading(false);
    }
  };

  const submitComment = async () => {
    if (!commentText.trim()) return;
    if (!isLoggedIn) {
      router.push('/login');
      return;
    }
    setSubmitting(true);
    try {
      const newComment = await api<FeedComment>(`/feed/${post.id}/comments`, {
        method: 'POST',
        body: JSON.stringify({ body: commentText }),
      });
      setComments((prev) => [...prev, newComment]);
      setCommentText('');
      setCommentCount((c) => c + 1);
      onCommentAdded?.();
    } catch (e: any) {
      alert(e.message || 'Failed to post comment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-rose-50 shadow-sm hover:shadow-md transition-all p-5">
      {/* Author row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${avatarColor(post.authorId)} flex items-center justify-center text-white font-bold text-sm shrink-0`}>
            {authorInitial(post.author)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900 text-sm">{authorLabel(post.author)}</span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ROLE_COLORS[post.authorRole] ?? 'bg-gray-100 text-gray-600'}`}>
                {post.authorRole === 'VENDOR' ? 'Vendor' : 'Customer'}
              </span>
            </div>
            <p className="text-xs text-gray-400">{formatDate(post.createdAt)}</p>
          </div>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${CATEGORY_COLORS[post.category] ?? 'bg-gray-50 text-gray-600'}`}>
          {post.category}
        </span>
      </div>

      {/* Title if present */}
      {post.title && (
        <h3 className="font-semibold text-gray-900 mb-2">{post.title}</h3>
      )}

      {/* Body */}
      <p className="text-gray-700 text-sm leading-relaxed line-clamp-3 mb-3">{post.body}</p>

      {/* Meta badges */}
      <div className="flex flex-wrap gap-2 mb-3">
        {post.city && (
          <span className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-50 px-2.5 py-1 rounded-full">
            <MapPin className="w-3 h-3" /> {post.city}
          </span>
        )}
        {post.eventDate && (
          <span className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-50 px-2.5 py-1 rounded-full">
            <Calendar className="w-3 h-3" /> {formatDate(post.eventDate)}
          </span>
        )}
        {post.budgetPaise && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
            Budget: {formatPaise(post.budgetPaise)}
          </span>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-50">
        <button
          onClick={loadComments}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-rose-600 transition-colors font-medium"
        >
          <MessageCircle className="w-4 h-4" />
          {commentCount} {commentCount === 1 ? 'comment' : 'comments'}
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
        <span className="flex items-center gap-1 text-xs text-gray-400">
          <Heart className="w-3.5 h-3.5" />
          {post.likesCount}
        </span>
      </div>

      {/* Comments section */}
      {expanded && (
        <div className="mt-4 space-y-3">
          {commentsLoading ? (
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
              Loading comments...
            </div>
          ) : comments.length === 0 ? (
            <p className="text-xs text-gray-400 py-2">No comments yet. Be the first!</p>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="flex gap-2.5">
                <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${avatarColor(comment.authorId)} flex items-center justify-center text-white font-bold text-xs shrink-0`}>
                  {authorInitial(comment.author)}
                </div>
                <div className="flex-1 bg-gray-50 rounded-xl px-3 py-2">
                  <p className="text-xs font-semibold text-gray-700 mb-0.5">{authorLabel(comment.author)}</p>
                  <p className="text-xs text-gray-600">{comment.body}</p>
                </div>
              </div>
            ))
          )}

          {/* Comment input */}
          <div className="flex gap-2 mt-2">
            <input
              type="text"
              placeholder={isLoggedIn ? 'Write a comment...' : 'Login to comment'}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && submitComment()}
              disabled={!isLoggedIn}
              className="flex-1 text-xs border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-rose-400 transition-colors disabled:bg-gray-50 disabled:cursor-not-allowed"
            />
            <button
              onClick={submitComment}
              disabled={submitting || !commentText.trim() || !isLoggedIn}
              className="p-2 rounded-xl bg-rose-600 text-white disabled:opacity-40 hover:bg-rose-700 transition-colors"
            >
              {submitting ? <LoaderCircle className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PostSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-rose-50 shadow-sm p-5 space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full shimmer" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3.5 shimmer rounded w-1/3" />
          <div className="h-3 shimmer rounded w-1/4" />
        </div>
      </div>
      <div className="h-4 shimmer rounded w-full" />
      <div className="h-4 shimmer rounded w-5/6" />
      <div className="h-4 shimmer rounded w-3/4" />
    </div>
  );
}

interface CreatePostFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

function CreatePostForm({ onClose, onSuccess }: CreatePostFormProps) {
  const [form, setForm] = useState({
    body: '',
    category: 'GENERAL' as FeedPost['category'],
    city: '',
    eventDate: '',
    budgetPaise: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!form.body.trim()) {
      setError('Please write something');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await api('/feed', {
        method: 'POST',
        body: JSON.stringify({
          body: form.body,
          category: form.category,
          city: form.city || undefined,
          eventDate: form.eventDate || undefined,
          budgetPaise: form.budgetPaise ? Number(form.budgetPaise) * 100 : undefined,
        }),
      });
      onSuccess();
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to post');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-rose-100 shadow-lg p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-900 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-rose-600" />
          Share with the Community
        </h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-3">
        <textarea
          placeholder="Share your wedding requirement, offer, or story..."
          rows={4}
          value={form.body}
          onChange={(e) => setForm({ ...form, body: e.target.value })}
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 outline-none focus:border-rose-400 transition-colors resize-none"
        />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Category</label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value as FeedPost['category'] })}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 outline-none focus:border-rose-400 transition-colors"
            >
              <option value="GENERAL">General</option>
              <option value="REQUIREMENT">Requirement</option>
              <option value="OFFER">Vendor Offer</option>
              <option value="SHOWCASE">Showcase</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">City</label>
            <input
              type="text"
              placeholder="e.g. Mumbai"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 outline-none focus:border-rose-400 transition-colors"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Event Date (optional)</label>
            <input
              type="date"
              value={form.eventDate}
              onChange={(e) => setForm({ ...form, eventDate: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 outline-none focus:border-rose-400 transition-colors"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Budget ₹ (optional)</label>
            <input
              type="number"
              placeholder="e.g. 50000"
              value={form.budgetPaise}
              onChange={(e) => setForm({ ...form, budgetPaise: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 outline-none focus:border-rose-400 transition-colors"
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={submitting}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-rose-700 to-rose-500 text-white font-semibold text-sm hover:from-rose-800 hover:to-rose-600 disabled:opacity-60 transition-all"
          >
            {submitting ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Post
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FeedPage() {
  const { isLoggedIn, initialize } = useAuthStore();
  const router = useRouter();

  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [activeTab, setActiveTab] = useState<TabFilter>('ALL');
  const [cityFilter, setCityFilter] = useState('');
  const [cityInput, setCityInput] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    initialize();
  }, [initialize]);

  const loadPosts = useCallback(async (tab: TabFilter, city: string, pg: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(pg));
      params.set('limit', '10');
      if (tab !== 'ALL') params.set('category', tab);
      if (city) params.set('city', city);

      const res = await api<{ data: FeedPost[]; total?: number; page?: number; limit?: number } | FeedPost[]>(`/feed?${params}`);
      const list = Array.isArray(res) ? res : (res as any).data ?? [];
      const total = Array.isArray(res) ? list.length : (res as any).total ?? list.length;

      if (pg === 1) {
        setPosts(list);
      } else {
        setPosts((prev) => [...prev, ...list]);
      }
      setHasMore(list.length === 10 && (pg * 10) < total);
    } catch {
      // silently fail on public endpoint
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setPage(1);
    loadPosts(activeTab, cityFilter, 1);
  }, [activeTab, cityFilter, loadPosts]);

  const handleTabChange = (tab: TabFilter) => {
    setActiveTab(tab);
  };

  const handleCityFilter = () => {
    setCityFilter(cityInput.trim());
  };

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    loadPosts(activeTab, cityFilter, nextPage);
  };

  const handleShareClick = () => {
    if (!isLoggedIn) {
      router.push('/login?redirect=/feed');
      return;
    }
    setShowCreate(true);
  };

  const handlePostSuccess = () => {
    setPage(1);
    loadPosts(activeTab, cityFilter, 1);
  };

  return (
    <div className="min-h-screen bg-[#faf8f5] pt-16">
      {/* Header */}
      <div className="gradient-bg pt-10 pb-12 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-1/4 w-64 h-64 rounded-full bg-rose-500/10 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 w-48 h-48 rounded-full bg-amber-400/5 blur-2xl" />
        </div>
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 bg-white/10 text-white/80 text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
                <Users className="w-3.5 h-3.5" />
                Wedding Community
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">Community Feed</h1>
              <p className="text-white/70 text-sm sm:text-base">
                Share requirements, discover vendors, connect with the wedding community
              </p>
            </div>
            <button
              onClick={handleShareClick}
              className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-rose-700 font-semibold text-sm hover:bg-rose-50 transition-colors shadow-md"
            >
              <Plus className="w-4 h-4" />
              Share
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 -mt-5 pb-16">
        {/* Tabs */}
        <div className="bg-white rounded-2xl shadow-sm border border-rose-50 p-1.5 mb-4 flex gap-1 overflow-x-auto">
          {TAB_LABELS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={`shrink-0 px-3.5 py-2 rounded-xl text-sm font-medium transition-all ${
                activeTab === tab.key
                  ? 'bg-rose-700 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-rose-50 hover:text-rose-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* City filter */}
        <div className="bg-white rounded-2xl shadow-sm border border-rose-50 p-3 mb-5 flex gap-2">
          <div className="flex-1 flex items-center gap-2 px-2">
            <Filter className="w-4 h-4 text-gray-400 shrink-0" />
            <input
              type="text"
              placeholder="Filter by city..."
              value={cityInput}
              onChange={(e) => setCityInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCityFilter()}
              className="w-full text-sm text-gray-700 outline-none placeholder-gray-400"
            />
            {cityFilter && (
              <button
                onClick={() => { setCityInput(''); setCityFilter(''); }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            onClick={handleCityFilter}
            className="px-4 py-2 rounded-xl bg-rose-700 text-white text-sm font-semibold hover:bg-rose-800 transition-colors"
          >
            Search
          </button>
        </div>

        {/* Create post form */}
        {showCreate && (
          <CreatePostForm
            onClose={() => setShowCreate(false)}
            onSuccess={handlePostSuccess}
          />
        )}

        {/* Feed */}
        {loading && page === 1 ? (
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => <PostSkeleton key={i} />)}
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">💬</div>
            <h3 className="text-lg font-bold text-gray-800 mb-2">No posts yet</h3>
            <p className="text-gray-500 mb-6 text-sm">
              Be the first to share something with the community!
            </p>
            <button
              onClick={handleShareClick}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-rose-700 to-rose-500 text-white font-semibold hover:from-rose-800 hover:to-rose-600 transition-all"
            >
              <Plus className="w-4 h-4" />
              Share to Community
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} onCommentAdded={handlePostSuccess} />
              ))}
            </div>

            {/* Load more */}
            {loading && page > 1 && (
              <div className="flex justify-center py-6">
                <LoaderCircle className="w-6 h-6 animate-spin text-rose-600" />
              </div>
            )}

            {hasMore && !loading && (
              <div className="flex justify-center mt-6">
                <button
                  onClick={handleLoadMore}
                  className="flex items-center gap-2 px-6 py-3 rounded-2xl border-2 border-rose-200 text-rose-700 font-semibold hover:bg-rose-50 transition-all text-sm"
                >
                  <ChevronDown className="w-4 h-4" />
                  Load More Posts
                </button>
              </div>
            )}

            {!hasMore && posts.length > 0 && (
              <p className="text-center text-xs text-gray-400 py-6">
                You've seen all posts
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
