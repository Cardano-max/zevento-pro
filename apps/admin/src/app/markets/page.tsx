'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';

interface Market {
  id: string;
  city: string;
  state: string;
  status: string;
}

const marketStatuses = ['ACTIVE', 'COMING_SOON', 'INACTIVE', 'SUSPENDED'];

const statusBadge: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  COMING_SOON: 'bg-blue-100 text-blue-700',
  INACTIVE: 'bg-slate-100 text-slate-600',
  SUSPENDED: 'bg-red-100 text-red-700',
};

export default function MarketsPage() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    fetchMarkets();
  }, []);

  async function fetchMarkets() {
    setLoading(true);
    try {
      const res = await api<Market[]>('/admin/markets');
      setMarkets(Array.isArray(res) ? res : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load markets');
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(marketId: string, newStatus: string) {
    setUpdating(marketId);
    try {
      await api(`/admin/markets/${marketId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      setMarkets((prev) =>
        prev.map((m) => (m.id === marketId ? { ...m, status: newStatus } : m))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setUpdating(null);
    }
  }

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Markets</h1>
        <p className="text-sm text-slate-500">Manage market availability by city</p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white">
        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="px-6 py-3 text-left font-medium text-slate-500">City</th>
                  <th className="px-6 py-3 text-left font-medium text-slate-500">State</th>
                  <th className="px-6 py-3 text-left font-medium text-slate-500">Status</th>
                  <th className="px-6 py-3 text-left font-medium text-slate-500">Change Status</th>
                </tr>
              </thead>
              <tbody>
                {markets.map((market) => (
                  <tr key={market.id} className="border-b border-slate-50">
                    <td className="px-6 py-3 font-medium text-slate-900">{market.city}</td>
                    <td className="px-6 py-3 text-slate-600">{market.state}</td>
                    <td className="px-6 py-3">
                      <span
                        className={cn(
                          'inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium',
                          statusBadge[market.status] || 'bg-slate-100 text-slate-600'
                        )}
                      >
                        {market.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <select
                        value={market.status}
                        onChange={(e) => handleStatusChange(market.id, e.target.value)}
                        disabled={updating === market.id}
                        className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50"
                      >
                        {marketStatuses.map((s) => (
                          <option key={s} value={s}>
                            {s.replace(/_/g, ' ')}
                          </option>
                        ))}
                      </select>
                      {updating === market.id && (
                        <Loader2 className="ml-2 inline h-4 w-4 animate-spin text-indigo-600" />
                      )}
                    </td>
                  </tr>
                ))}
                {markets.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                      No markets configured
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
