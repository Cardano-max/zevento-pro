'use client';

import { useEffect, useState } from 'react';
import { LoaderCircle, Plus, Trash2 } from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import { api } from '@/lib/api';
import { formatBps } from '@/lib/format';

interface CommissionRate {
  id: string;
  vendorRole: string;
  categoryId: string | null;
  categoryName: string | null;
  rateBps: number;
  createdAt: string;
}

export default function CommissionRatesPage() {
  const [rates, setRates] = useState<CommissionRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [formVendorRole, setFormVendorRole] = useState('');
  const [formRateBps, setFormRateBps] = useState('');
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [formMessage, setFormMessage] = useState('');

  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetchRates();
  }, []);

  async function fetchRates() {
    setLoading(true);
    try {
      const res = await api<CommissionRate[]>('/admin/commission-rates');
      setRates(Array.isArray(res) ? res : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load commission rates');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormLoading(true);
    setFormMessage('');

    try {
      await api('/admin/commission-rates', {
        method: 'POST',
        body: JSON.stringify({
          vendorRole: formVendorRole,
          rateBps: parseInt(formRateBps, 10),
          ...(formCategoryId ? { categoryId: formCategoryId } : {}),
        }),
      });
      setFormMessage('Commission rate created');
      setFormVendorRole('');
      setFormRateBps('');
      setFormCategoryId('');
      setShowForm(false);
      fetchRates();
    } catch (err) {
      setFormMessage(err instanceof Error ? err.message : 'Failed to create rate');
    } finally {
      setFormLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this commission rate?')) return;
    setDeleting(id);
    try {
      await api(`/admin/commission-rates/${id}`, { method: 'DELETE' });
      setRates((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeleting(null);
    }
  }

  return (
    <AdminLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Commission Rates</h1>
          <p className="text-sm text-slate-500">Manage platform commission rates by vendor role</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" />
          Add Rate
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Create Commission Rate</h2>
          <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-4">
            <div className="min-w-[180px]">
              <label className="mb-1 block text-xs font-medium text-slate-500">Vendor Role</label>
              <select
                value={formVendorRole}
                onChange={(e) => setFormVendorRole(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="">Select role</option>
                <option value="VENUE">Venue</option>
                <option value="PHOTOGRAPHER">Photographer</option>
                <option value="CATERER">Caterer</option>
                <option value="DECORATOR">Decorator</option>
                <option value="DJ">DJ</option>
                <option value="MAKEUP_ARTIST">Makeup Artist</option>
                <option value="PLANNER">Planner</option>
              </select>
            </div>
            <div className="min-w-[140px]">
              <label className="mb-1 block text-xs font-medium text-slate-500">
                Rate (basis points)
              </label>
              <input
                type="number"
                value={formRateBps}
                onChange={(e) => setFormRateBps(e.target.value)}
                required
                min="0"
                max="10000"
                placeholder="e.g., 1500 = 15%"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
            <div className="min-w-[180px]">
              <label className="mb-1 block text-xs font-medium text-slate-500">
                Category ID (optional)
              </label>
              <input
                type="text"
                value={formCategoryId}
                onChange={(e) => setFormCategoryId(e.target.value)}
                placeholder="Leave blank for default"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
            <button
              type="submit"
              disabled={formLoading}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {formLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : 'Create'}
            </button>
          </form>
          {formMessage && (
            <p className="mt-3 text-sm text-slate-600">{formMessage}</p>
          )}
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Rates Table */}
      <div className="rounded-xl border border-slate-200 bg-white">
        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <LoaderCircle className="h-6 w-6 animate-spin text-indigo-600" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="px-6 py-3 text-left font-medium text-slate-500">Vendor Role</th>
                  <th className="px-6 py-3 text-left font-medium text-slate-500">Category</th>
                  <th className="px-6 py-3 text-right font-medium text-slate-500">Rate (BPS)</th>
                  <th className="px-6 py-3 text-right font-medium text-slate-500">Percentage</th>
                  <th className="px-6 py-3 text-center font-medium text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rates.map((rate) => (
                  <tr key={rate.id} className="border-b border-slate-50">
                    <td className="px-6 py-3 font-medium text-slate-900">
                      {rate.vendorRole.replace(/_/g, ' ')}
                    </td>
                    <td className="px-6 py-3 text-slate-600">
                      {rate.categoryName || 'Default'}
                    </td>
                    <td className="px-6 py-3 text-right font-mono text-slate-700">
                      {rate.rateBps}
                    </td>
                    <td className="px-6 py-3 text-right text-slate-700">
                      {formatBps(rate.rateBps)}
                    </td>
                    <td className="px-6 py-3 text-center">
                      <button
                        onClick={() => handleDelete(rate.id)}
                        disabled={deleting === rate.id}
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        {deleting === rate.id ? (
                          <LoaderCircle className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {rates.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                      No commission rates configured
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
