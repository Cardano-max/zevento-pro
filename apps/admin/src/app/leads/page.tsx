'use client';

import { useState } from 'react';
import { Loader2, Search, ArrowRight } from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';

interface RoutingTrace {
  vendorId: string;
  vendorName: string;
  score: number;
  factors: Record<string, number>;
  selected: boolean;
  skipReason: string | null;
}

interface RoutingTraceResponse {
  leadId: string;
  status: string;
  assignedVendorId: string | null;
  traces: RoutingTrace[];
}

export default function LeadsPage() {
  const [leadId, setLeadId] = useState('');
  const [traceData, setTraceData] = useState<RoutingTraceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [overrideVendorId, setOverrideVendorId] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideLoading, setOverrideLoading] = useState(false);
  const [overrideMessage, setOverrideMessage] = useState('');

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!leadId.trim()) return;

    setLoading(true);
    setError('');
    setTraceData(null);
    setOverrideMessage('');

    try {
      const res = await api<RoutingTraceResponse>(`/admin/leads/${leadId.trim()}/routing-trace`);
      setTraceData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch routing trace');
    } finally {
      setLoading(false);
    }
  }

  async function handleOverride(e: React.FormEvent) {
    e.preventDefault();
    if (!leadId.trim() || !overrideVendorId.trim() || !overrideReason.trim()) return;

    setOverrideLoading(true);
    setOverrideMessage('');

    try {
      await api(`/admin/leads/${leadId.trim()}/routing-override`, {
        method: 'PATCH',
        body: JSON.stringify({
          vendorId: overrideVendorId.trim(),
          reason: overrideReason.trim(),
        }),
      });
      setOverrideMessage('Routing override applied successfully');
      // Refetch trace
      const res = await api<RoutingTraceResponse>(`/admin/leads/${leadId.trim()}/routing-trace`);
      setTraceData(res);
    } catch (err) {
      setOverrideMessage(err instanceof Error ? err.message : 'Override failed');
    } finally {
      setOverrideLoading(false);
    }
  }

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Lead Routing Audit</h1>
        <p className="text-sm text-slate-500">Inspect routing decisions and override assignments</p>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="mb-6">
        <div className="flex gap-3">
          <div className="relative flex-1 max-w-md">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
              type="text"
              value={leadId}
              onChange={(e) => setLeadId(e.target.value)}
              placeholder="Enter Lead ID"
              className="block w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !leadId.trim()}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Trace'}
          </button>
        </div>
      </form>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {traceData && (
        <div className="space-y-6">
          {/* Lead Info */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap gap-6">
              <div>
                <span className="text-xs font-medium uppercase text-slate-400">Lead ID</span>
                <p className="mt-0.5 font-mono text-sm text-slate-700">{traceData.leadId}</p>
              </div>
              <div>
                <span className="text-xs font-medium uppercase text-slate-400">Status</span>
                <p className="mt-0.5 text-sm text-slate-700">{traceData.status}</p>
              </div>
              <div>
                <span className="text-xs font-medium uppercase text-slate-400">Assigned Vendor</span>
                <p className="mt-0.5 font-mono text-sm text-slate-700">
                  {traceData.assignedVendorId || 'None'}
                </p>
              </div>
            </div>
          </div>

          {/* Routing Traces Table */}
          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">Routing Traces</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="px-6 py-3 text-left font-medium text-slate-500">Vendor</th>
                    <th className="px-6 py-3 text-right font-medium text-slate-500">Score</th>
                    <th className="px-6 py-3 text-left font-medium text-slate-500">Factors</th>
                    <th className="px-6 py-3 text-center font-medium text-slate-500">Selected</th>
                    <th className="px-6 py-3 text-left font-medium text-slate-500">Skip Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {traceData.traces.map((trace, i) => (
                    <tr
                      key={`${trace.vendorId}-${i}`}
                      className={cn(
                        'border-b border-slate-50',
                        trace.selected && 'bg-green-50/50'
                      )}
                    >
                      <td className="px-6 py-3">
                        <div className="font-medium text-slate-900">{trace.vendorName}</div>
                        <div className="font-mono text-xs text-slate-400">{trace.vendorId}</div>
                      </td>
                      <td className="px-6 py-3 text-right font-mono font-medium text-slate-900">
                        {trace.score.toFixed(2)}
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(trace.factors).map(([key, val]) => (
                            <span
                              key={key}
                              className="inline-flex rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600"
                            >
                              {key}: {typeof val === 'number' ? val.toFixed(1) : val}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-3 text-center">
                        {trace.selected ? (
                          <span className="inline-flex rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                            Yes
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
                            No
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-sm text-slate-500">
                        {trace.skipReason || '-'}
                      </td>
                    </tr>
                  ))}
                  {traceData.traces.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                        No routing traces found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Override Form */}
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Override Routing</h2>
            <form onSubmit={handleOverride} className="flex flex-wrap items-end gap-4">
              <div className="min-w-[200px] flex-1">
                <label className="mb-1 block text-xs font-medium text-slate-500">
                  Vendor ID
                </label>
                <input
                  type="text"
                  value={overrideVendorId}
                  onChange={(e) => setOverrideVendorId(e.target.value)}
                  required
                  placeholder="Target vendor ID"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
              <div className="min-w-[200px] flex-1">
                <label className="mb-1 block text-xs font-medium text-slate-500">
                  Reason
                </label>
                <input
                  type="text"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  required
                  placeholder="Reason for override"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
              <button
                type="submit"
                disabled={overrideLoading}
                className="flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {overrideLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
                Apply Override
              </button>
            </form>
            {overrideMessage && (
              <p className="mt-3 text-sm text-slate-600">{overrideMessage}</p>
            )}
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
