'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Pencil, Trash2, X } from 'lucide-react';
import { ProtectedComponent } from '@/components/ui/ProtectedComponent';
import { useBrands } from '@/hooks/brands/useBrands';
import { usePermission } from '@/hooks/auth/usePermission';
import { createClient } from '@/lib/supabase/client';
import { ROUTES } from '@/lib/constants/routes';

export default function ServiceBrandsPage() {
  const { can } = usePermission();
  const { data, isLoading, error, createMutation, renameMutation, deleteMutation } = useBrands();
  const supabase = createClient();
  const dueSummaryQuery = useQuery({
    queryKey: ['brand-due-summary'],
    queryFn: async () => {
      const result = await supabase
        .from('subject_bills')
        .select('brand_id,grand_total')
        .eq('payment_status', 'due')
        .not('brand_id', 'is', null);

      if (result.error) {
        throw result.error;
      }

      const map = new Map<string, { dueCount: number; dueAmount: number }>();

      for (const row of result.data ?? []) {
        const typed = row as { brand_id: string; grand_total: number };
        const existing = map.get(typed.brand_id) ?? { dueCount: 0, dueAmount: 0 };
        existing.dueCount += 1;
        existing.dueAmount += Number(typed.grand_total || 0);
        map.set(typed.brand_id, existing);
      }

      return map;
    },
  });
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  if (!can('service-settings:view')) {
    return <div className="p-6 text-sm text-rose-700">You do not have access to Service Settings.</div>;
  }

  const onCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    const result = await createMutation.mutateAsync({ name });
    if (result.ok) {
      setName('');
    }
  };

  const startEdit = (id: string, currentName: string) => {
    setEditingId(id);
    setEditName(currentName);
  };

  const commitRename = async (id: string) => {
    if (editName.trim()) {
      await renameMutation.mutateAsync({ id, name: editName.trim() });
    }
    setEditingId(null);
  };

  return (
    <div className="space-y-5 p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Brands</h1>
        <p className="mt-0.5 text-sm text-slate-500">Manage active brand sources for subject creation.</p>
      </div>

      <form onSubmit={onCreate} className="rounded-xl border border-slate-200 bg-white p-4">
        <label className="mb-1.5 block text-sm font-medium text-slate-700">New brand name</label>
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Samsung"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
          <button
            type="submit"
            disabled={createMutation.isPending || !name.trim()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </form>

      <div className="rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Name</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Due</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-500">Loading...</td></tr> : null}
            {!isLoading && error ? <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-rose-600">{error}</td></tr> : null}
            {!isLoading && !error && data.length === 0 ? <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-400">No brands yet. Add one above.</td></tr> : null}
            {!isLoading && !error ? data.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50/50">
                <td className="px-4 py-3 text-sm font-medium text-slate-800">
                  {editingId === item.id ? (
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full rounded-lg border border-blue-400 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      autoFocus
                      onKeyDown={(e) => { if (e.key === 'Enter') commitRename(item.id); if (e.key === 'Escape') setEditingId(null); }}
                    />
                  ) : (
                    <Link href={ROUTES.DASHBOARD_SERVICE_BRAND_DETAIL(item.id)} className="text-blue-700 hover:text-blue-800 hover:underline">
                      {item.name}
                    </Link>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${item.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                    {item.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-slate-700">
                  {(() => {
                    const summary = dueSummaryQuery.data?.get(item.id);
                    if (!summary) return <span className="text-slate-400">No due</span>;
                    return (
                      <span className="font-semibold text-amber-700">
                        {summary.dueCount} / INR {summary.dueAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    );
                  })()}
                </td>
                <td className="px-4 py-3">
                  {editingId === item.id ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => commitRename(item.id)}
                        disabled={renameMutation.isPending}
                        title="Save"
                        aria-label="Save"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        <Check size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        title="Cancel"
                        aria-label="Cancel"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(item.id, item.name)}
                        title="Edit"
                        aria-label="Edit"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100"
                      >
                        <Pencil size={14} />
                      </button>
                      <ProtectedComponent permission="service-settings:edit">
                        <button
                          type="button"
                          onClick={() => deleteMutation.mutate(item.id)}
                          title="Delete"
                          aria-label="Delete"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-rose-200 text-rose-600 hover:bg-rose-50"
                        >
                          <Trash2 size={14} />
                        </button>
                      </ProtectedComponent>
                    </div>
                  )}
                </td>
              </tr>
            )) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
