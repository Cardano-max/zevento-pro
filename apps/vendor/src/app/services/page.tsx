'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Briefcase,
  CheckCircle,
  AlertCircle,
  Loader2,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { VendorLayout } from '@/components/layout';
import { api } from '@/lib/api';
import { formatPaise } from '@/lib/format';
import { cn } from '@/lib/cn';

interface VendorService {
  id: string;
  title: string;
  description: string | null;
  pricePaise: number;
  isActive: boolean;
  images: string[] | null;
  category: { id: string; name: string } | null;
}

interface Category {
  id: string;
  name: string;
}

interface Toast {
  type: 'success' | 'error';
  message: string;
}

const PRICE_TYPES = [
  { value: 'FIXED', label: 'Fixed Price' },
  { value: 'STARTING_FROM', label: 'Starting From' },
  { value: 'CUSTOM_QUOTE', label: 'Custom Quote' },
];

const inputCls =
  'w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20';

export default function ServicesPage() {
  const [services, setServices] = useState<VendorService[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priceRupees, setPriceRupees] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [priceType, setPriceType] = useState('FIXED');

  function showToast(type: 'success' | 'error', message: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ type, message });
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }

  async function fetchServices() {
    try {
      const data = await api<VendorService[]>('/vendor/services');
      setServices(data);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to load services');
    }
  }

  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        const [svcData, catData] = await Promise.all([
          api<VendorService[]>('/vendor/services'),
          api<Category[]>('/customer/categories'),
        ]);
        setServices(svcData);
        setCategories(catData);
      } catch (err) {
        showToast('error', err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  function resetForm() {
    setTitle('');
    setDescription('');
    setPriceRupees('');
    setCategoryId('');
    setPriceType('FIXED');
    setShowForm(false);
  }

  async function handleCreateService(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const price = parseFloat(priceRupees);
    if (!priceRupees || isNaN(price) || price < 0) {
      showToast('error', 'Please enter a valid price (0 or more)');
      return;
    }
    setSaving(true);
    try {
      await api('/vendor/services', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          pricePaise: Math.round(price * 100),
          categoryId: categoryId || undefined,
        }),
      });
      showToast('success', 'Service created successfully');
      resetForm();
      await fetchServices();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to create service');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(serviceId: string, serviceTitle: string) {
    if (!window.confirm(`Delete "${serviceTitle}"? This cannot be undone.`)) return;
    try {
      await api(`/vendor/services/${serviceId}`, { method: 'DELETE' });
      showToast('success', 'Service deleted');
      await fetchServices();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to delete service');
    }
  }

  async function handleToggleActive(service: VendorService) {
    try {
      await api(`/vendor/services/${service.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !service.isActive }),
      });
      await fetchServices();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to update service');
    }
  }

  return (
    <VendorLayout>
      {/* Toast */}
      {toast && (
        <div
          className={cn(
            'fixed right-5 top-5 z-50 flex items-center gap-3 rounded-xl px-4 py-3 shadow-lg text-sm font-medium transition-all',
            toast.type === 'success'
              ? 'border border-green-200 bg-green-50 text-green-800'
              : 'border border-red-200 bg-red-50 text-red-800'
          )}
        >
          {toast.type === 'success' ? (
            <CheckCircle className="h-4 w-4 shrink-0 text-green-600" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
          )}
          {toast.message}
          <button onClick={() => setToast(null)} className="ml-2 text-current opacity-50 hover:opacity-100">
            ×
          </button>
        </div>
      )}

      {/* Page header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Services</h1>
          <p className="text-sm text-slate-500">
            Manage the services you offer to customers on the marketplace
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4" />
            Add Service
          </button>
        )}
      </div>

      {/* Add Service Form */}
      {showForm && (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">New Service</h2>
            <button
              onClick={resetForm}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <form onSubmit={handleCreateService} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Service Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={200}
                  placeholder="e.g. Wedding Photography Package"
                  required
                  className={inputCls}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Category</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className={inputCls}
                >
                  <option value="">Select a category (optional)</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Describe what's included in this service..."
                className={cn(inputCls, 'resize-none')}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Base Price (₹) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-400">
                    ₹
                  </span>
                  <input
                    type="number"
                    value={priceRupees}
                    onChange={(e) => setPriceRupees(e.target.value)}
                    min="0"
                    step="0.01"
                    placeholder="0"
                    required
                    className={cn(inputCls, 'pl-7')}
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Price Type
                </label>
                <select
                  value={priceType}
                  onChange={(e) => setPriceType(e.target.value)}
                  className={inputCls}
                >
                  {PRICE_TYPES.map((pt) => (
                    <option key={pt.value} value={pt.value}>
                      {pt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-3 border-t border-slate-100 pt-4">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                Save Service
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        </div>
      )}

      {/* Empty state */}
      {!loading && services.length === 0 && !showForm && (
        <div className="rounded-xl border-2 border-dashed border-slate-200 bg-white p-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
            <Briefcase className="h-7 w-7 text-slate-400" />
          </div>
          <h3 className="mb-1 text-base font-semibold text-slate-900">No services yet</h3>
          <p className="mb-5 text-sm text-slate-500">
            You haven&apos;t added any services yet. Services appear on your public marketplace profile.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4" />
            Add Your First Service
          </button>
        </div>
      )}

      {/* Service cards grid */}
      {!loading && services.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <div
              key={service.id}
              className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              {/* Card header */}
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-semibold text-slate-900">{service.title}</h3>
                  {service.category && (
                    <span className="mt-1 inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                      {service.category.name}
                    </span>
                  )}
                </div>
                <span
                  className={cn(
                    'shrink-0 inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium',
                    service.isActive
                      ? 'bg-green-100 text-green-700'
                      : 'bg-slate-100 text-slate-500'
                  )}
                >
                  {service.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>

              {/* Description */}
              {service.description && (
                <p className="mb-3 line-clamp-2 text-sm text-slate-500">{service.description}</p>
              )}

              {/* Price */}
              <div className="mb-4 mt-auto">
                <span className="text-lg font-bold text-slate-900">
                  {formatPaise(service.pricePaise)}
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 border-t border-slate-100 pt-3">
                <button
                  onClick={() => handleToggleActive(service)}
                  className={cn(
                    'flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors',
                    service.isActive
                      ? 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                      : 'border border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                  )}
                >
                  {service.isActive ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  onClick={() => handleDelete(service.id, service.title)}
                  className="flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </VendorLayout>
  );
}
