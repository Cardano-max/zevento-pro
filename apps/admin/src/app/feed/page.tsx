'use client';

import { useEffect, useState } from 'react';
import { LoaderCircle, ChevronLeft, ChevronRight, Eye, EyeOff, Trash2, MessageSquare } from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/cn';

interface FeedPost {
  id: string;
  body: string;
  category?: string;
  city?: string;
  status: string;
  createdAt: string;
  _count?: { comments: number };
  author?: { name?: string; phone?: string };
  user?: { name?: string; phone?: string };
}

interface FeedResponse {
  data: FeedPost[];
  total?: number;
  pagination?: { page: number; limit: number; total: number; totalPages: number };
}

const statusBadge: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  HIDDEN: 'bg-amber-100 text-amber-700',
  REPORTED: 'bg-red-100 text-red-700',
  DELETED: 'bg-slate-100 text-slate-500',
};

type TabFilter = 'ALL' | 'ACTIVE' | 'HIDDEN' | 'REPORTED';

export default function FeedPage() {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<TabFilter>('ALL');
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const limit = 20;

  function fetchPosts() {
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (tab !== 'ALL') params.set('status', tab);

    api<FeedResponse | FeedPost[]>(`/feed?${params}`)
      .then((res) => {
        if (Array.isArray(res)) {
          setPosts(res);
          setTotal(res.length);
          setTotalPages(1);
        } else {
          const postsData = (res as FeedResponse).data ?? [];
          const pagination = (res as FeedResponse).pagination;
          setPosts(postsData);
          setTotal(pagination?.total ?? (res as FeedResponse).total ?? postsData.length);
          setTotalPages(pagination?.totalPages ?? 1);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, tab]);

  async function toggleHide(post: FeedPost) {
    setActioningId(post.id);
    try {
      await api(`/admin/feed/${post.id}/hide`, { method: 'PATCH' });
      setPosts((prev) =>
        prev.map((p) =>
          p.id === post.id
            ? { ...p, status: p.status === 'HIDDEN' ? 'ACTIVE' : 'HIDDEN' }
            : p
        )
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActioningId(null);
    }
  }

  async function deletePost(id: string) {
    setActioningId(id);
    try {
      await api(`/admin/feed/${id}`, { method: 'DELETE' });
      setPosts((prev) => prev.filter((p) => p.id !== id));
      setDeleteConfirm(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setActioningId(null);
    }
  }

  function getAuthorName(post: FeedPost) {
    return post.author?.name ?? post.author?.phone ?? post.user?.name ?? post.user?.phone ?? 'Unknown';
  }

  const tabs: { key: TabFilter; label: string }[] = [
    { key: 'ALL', label: 'All Posts' },
    { key: 'ACTIVE', label: 'Active' },
    { key: 'HIDDEN', label: 'Hidden' },
    { key: 'REPORTED', label: 'Reported' },
  ];

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Feed Moderation</h1>
        <p className="text-sm text-slate-500">Review and moderate community feed posts</p>
      </div>

      {/* Delete confirm dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Delete Post</h3>
            <p className="text-sm text-slate-600 mb-4">
              This will permanently delete the post. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() => deletePost(deleteConfirm)}
                disabled={actioningId === deleteConfirm}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {actioningId === deleteConfirm && (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                )}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-4 flex gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1 w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setPage(1); }}
            className={cn(
              'rounded-lg px-4 py-1.5 text-sm font-medium transition-colors',
              tab === t.key
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white">
        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <LoaderCircle className="h-6 w-6 animate-spin text-indigo-600" />
          </div>
        ) : (
          <>
            <div className="divide-y divide-slate-100">
              {posts.length === 0 && (
                <div className="py-16 text-center">
                  <MessageSquare className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                  <p className="text-slate-400">No posts found</p>
                </div>
              )}
              {posts.map((post) => (
                <div key={post.id} className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Author + meta */}
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-slate-800">{getAuthorName(post)}</span>
                        {post.category && (
                          <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                            {post.category}
                          </span>
                        )}
                        <span
                          className={cn(
                            'rounded-full px-2.5 py-0.5 text-xs font-medium',
                            statusBadge[post.status] || 'bg-slate-100 text-slate-600'
                          )}
                        >
                          {post.status}
                        </span>
                        {post.city && (
                          <span className="text-xs text-slate-400">{post.city}</span>
                        )}
                        <span className="text-xs text-slate-400">{formatDate(post.createdAt)}</span>
                      </div>

                      {/* Body */}
                      <p className="text-sm text-slate-700 line-clamp-3">{post.body}</p>

                      {/* Comments count */}
                      {post._count && (
                        <div className="mt-2 flex items-center gap-1 text-xs text-slate-400">
                          <MessageSquare className="h-3.5 w-3.5" />
                          {post._count.comments} comment{post._count.comments !== 1 ? 's' : ''}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex shrink-0 gap-2">
                      <button
                        onClick={() => toggleHide(post)}
                        disabled={actioningId === post.id}
                        title={post.status === 'HIDDEN' ? 'Unhide post' : 'Hide post'}
                        className={cn(
                          'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50',
                          post.status === 'HIDDEN'
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                        )}
                      >
                        {actioningId === post.id ? (
                          <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                        ) : post.status === 'HIDDEN' ? (
                          <Eye className="h-3.5 w-3.5" />
                        ) : (
                          <EyeOff className="h-3.5 w-3.5" />
                        )}
                        {post.status === 'HIDDEN' ? 'Unhide' : 'Hide'}
                      </button>

                      <button
                        onClick={() => setDeleteConfirm(post.id)}
                        disabled={actioningId === post.id}
                        title="Delete post permanently"
                        className="flex items-center gap-1.5 rounded-lg bg-red-100 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-200 disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-100 px-6 py-3">
                <span className="text-sm text-slate-500">
                  Page {page} of {totalPages} &middot; {total} posts
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                  >
                    <ChevronLeft className="h-4 w-4" /> Prev
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Next <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
}
