'use client';

import { useEffect, useState, useCallback } from 'react';
import { Loader2, Plus, Trash2, Package, Edit2 } from 'lucide-react';
import { VendorLayout } from '@/components/layout';
import { api, apiUpload } from '@/lib/api';
import { formatPaise } from '@/lib/format';
import { cn } from '@/lib/cn';

interface Product {
  id: string;
  name: string;
  description: string | null;
  pricePaise: number;
  moq: number;
  stock: number;
  isActive: boolean;
  images: Array<{ id: string; url: string }>;
  category: { name: string } | null;
}

interface ProductsResponse {
  items: Product[];
  total: number;
  page: number;
  limit: number;
}

export default function ProductsPage() {
  const [data, setData] = useState<ProductsResponse | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [pricePaise, setPricePaise] = useState('');
  const [moq, setMoq] = useState('1');
  const [stock, setStock] = useState('0');
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchProducts = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res = await api<ProductsResponse>(`/products/mine?page=${p}&limit=20`);
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts(page);
  }, [page, fetchProducts]);

  function resetForm() {
    setName('');
    setDescription('');
    setPricePaise('');
    setMoq('1');
    setStock('0');
    setEditingId(null);
    setShowForm(false);
  }

  function startEdit(p: Product) {
    setName(p.name);
    setDescription(p.description || '');
    setPricePaise(String(p.pricePaise / 100));
    setMoq(String(p.moq));
    setStock(String(p.stock));
    setEditingId(p.id);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const body = {
        name,
        description: description || undefined,
        pricePaise: Math.round(parseFloat(pricePaise) * 100),
        moq: parseInt(moq, 10),
        stock: parseInt(stock, 10),
      };

      if (editingId) {
        await api(`/products/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
      } else {
        await api('/products', {
          method: 'POST',
          body: JSON.stringify(body),
        });
      }
      resetForm();
      fetchProducts(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save product');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(productId: string) {
    try {
      await api(`/products/${productId}`, { method: 'DELETE' });
      fetchProducts(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  }

  async function handleImageUpload(productId: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const formData = new FormData();
      formData.append('image', file);
      await apiUpload(`/products/${productId}/images`, formData);
      fetchProducts(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    }
  }

  const totalPages = data ? Math.ceil(data.total / data.limit) : 0;

  return (
    <VendorLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Products</h1>
          <p className="text-sm text-slate-500">
            Manage your product catalog{data ? ` (${data.total} products)` : ''}
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700"
        >
          <Plus className="h-4 w-4" />
          Add Product
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
          <button onClick={() => setError('')} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      {/* Add/Edit Form */}
      {showForm && (
        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">
            {editingId ? 'Edit Product' : 'New Product'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Price (INR)</label>
                <input
                  type="number"
                  step="0.01"
                  value={pricePaise}
                  onChange={(e) => setPricePaise(e.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">MOQ</label>
                <input
                  type="number"
                  value={moq}
                  onChange={(e) => setMoq(e.target.value)}
                  min="1"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Stock</label>
                <input
                  type="number"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  min="0"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {saving ? <Loader2 className="inline h-4 w-4 animate-spin" /> : editingId ? 'Update' : 'Create'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {loading && (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        </div>
      )}

      {!loading && data && (
        <div className="space-y-4">
          {data.items.length === 0 && !showForm && (
            <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-400">
              <Package className="mx-auto mb-3 h-10 w-10 text-slate-300" />
              No products yet. Add your first product to start selling.
            </div>
          )}

          {data.items.map((product) => (
            <div key={product.id} className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex gap-4">
                  {product.images.length > 0 ? (
                    <img
                      src={product.images[0].url}
                      alt={product.name}
                      className="h-16 w-16 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-slate-100">
                      <Package className="h-6 w-6 text-slate-300" />
                    </div>
                  )}
                  <div>
                    <h3 className="font-semibold text-slate-900">{product.name}</h3>
                    <p className="mt-0.5 text-sm text-slate-500">
                      {formatPaise(product.pricePaise)} / unit
                      {product.category && ` | ${product.category.name}`}
                    </p>
                    <div className="mt-1 flex gap-3 text-xs text-slate-400">
                      <span>MOQ: {product.moq}</span>
                      <span className={product.stock <= 5 ? 'text-red-500 font-medium' : ''}>
                        Stock: {product.stock}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <label className="cursor-pointer rounded-lg border border-slate-200 p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-600">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => handleImageUpload(product.id, e)}
                      className="hidden"
                    />
                    <Plus className="h-4 w-4" />
                  </label>
                  <button
                    onClick={() => startEdit(product)}
                    className="rounded-lg border border-slate-200 p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-600"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(product.id)}
                    className="rounded-lg border border-red-200 p-2 text-red-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
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
              <span className="text-sm text-slate-500">Page {page} of {totalPages}</span>
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
