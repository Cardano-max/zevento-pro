'use client';

import { useEffect, useState } from 'react';
import { LoaderCircle, ChevronLeft, ChevronRight, Search, Users } from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/cn';

interface UserRole {
  id: string;
  role: string;
  contextId?: string;
}

interface User {
  id: string;
  name?: string;
  phone: string;
  email?: string;
  isActive?: boolean;
  createdAt?: string;
  roles?: UserRole[];
}

interface UserListResponse {
  data: User[];
  total: number;
  page: number;
  totalPages: number;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [filtered, setFiltered] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const limit = 20;

  function fetchUsers() {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (roleFilter) params.set('role', roleFilter);

    api<UserListResponse>(`/admin/users?${params}`)
      .then((res) => {
        const usersData = Array.isArray(res) ? (res as unknown as User[]) : (res.data ?? []);
        const totalCount = Array.isArray(res) ? (res as unknown as User[]).length : (res.total ?? 0);
        setUsers(usersData);
        setTotal(totalCount);
        setFiltered(usersData);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, roleFilter]);

  // Client-side search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFiltered(users);
      return;
    }
    const q = searchQuery.toLowerCase();
    setFiltered(
      users.filter(
        (u) =>
          (u.phone ?? '').includes(q) ||
          (u.name ?? '').toLowerCase().includes(q) ||
          (u.email ?? '').toLowerCase().includes(q)
      )
    );
  }, [searchQuery, users]);

  async function toggleActive(userId: string) {
    setTogglingId(userId);
    try {
      await api(`/admin/users/${userId}/toggle-active`, { method: 'PATCH' });
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, isActive: !u.isActive } : u))
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to toggle user status');
    } finally {
      setTogglingId(null);
    }
  }

  const totalPages = Math.ceil(total / limit);

  function getRolesBadges(user: User) {
    const roles = user.roles ?? [];
    if (roles.length === 0) return <span className="text-slate-400 text-xs">—</span>;
    return roles.map((r) => (
      <span
        key={r.id}
        className="inline-flex rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700 mr-1"
      >
        {r.role}
      </span>
    ));
  }

  return (
    <AdminLayout>
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900">Users</h1>
          <p className="text-sm text-slate-500">{total} user{total !== 1 ? 's' : ''} registered</p>
        </div>

        {/* Search */}
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Search className="h-4 w-4 text-slate-400" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, phone..."
            className="w-56 rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>

        {/* Role filter */}
        <select
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        >
          <option value="">All Roles</option>
          <option value="CUSTOMER">Customer</option>
          <option value="VENDOR">Vendor</option>
          <option value="ADMIN">Admin</option>
        </select>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
          {error.includes('404') || error.includes('not found') ? (
            <p className="mt-1 text-slate-500">The user management endpoint may not be available yet.</p>
          ) : null}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white">
        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <LoaderCircle className="h-6 w-6 animate-spin text-indigo-600" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="px-6 py-3 text-left font-medium text-slate-500">Name / Phone</th>
                    <th className="px-6 py-3 text-left font-medium text-slate-500">Email</th>
                    <th className="px-6 py-3 text-left font-medium text-slate-500">Roles</th>
                    <th className="px-6 py-3 text-left font-medium text-slate-500">Status</th>
                    <th className="px-6 py-3 text-left font-medium text-slate-500">Joined</th>
                    <th className="px-6 py-3 text-left font-medium text-slate-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((user) => (
                    <tr key={user.id} className="border-b border-slate-50 hover:bg-slate-50/30">
                      <td className="px-6 py-3">
                        <div className="font-medium text-slate-900">{user.name ?? 'Unknown'}</div>
                        <div className="text-xs text-slate-500">{user.phone}</div>
                      </td>
                      <td className="px-6 py-3 text-slate-600">{user.email ?? '—'}</td>
                      <td className="px-6 py-3">{getRolesBadges(user)}</td>
                      <td className="px-6 py-3">
                        <span
                          className={cn(
                            'inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium',
                            user.isActive !== false
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          )}
                        >
                          {user.isActive !== false ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-slate-600">
                        {user.createdAt ? formatDate(user.createdAt) : '—'}
                      </td>
                      <td className="px-6 py-3">
                        <button
                          onClick={() => toggleActive(user.id)}
                          disabled={togglingId === user.id}
                          className={cn(
                            'flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium disabled:opacity-50',
                            user.isActive !== false
                              ? 'bg-red-100 text-red-700 hover:bg-red-200'
                              : 'bg-green-100 text-green-700 hover:bg-green-200'
                          )}
                        >
                          {togglingId === user.id && (
                            <LoaderCircle className="h-3 w-3 animate-spin" />
                          )}
                          {user.isActive !== false ? 'Deactivate' : 'Reactivate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-16 text-center">
                        <Users className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                        <p className="text-slate-400">No users found</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-100 px-6 py-3">
                <span className="text-sm text-slate-500">
                  Page {page} of {totalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Prev
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
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
