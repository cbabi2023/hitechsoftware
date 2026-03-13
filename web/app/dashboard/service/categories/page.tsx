'use client';

import { useState } from 'react';
import { useServiceCategories } from '@/hooks/useServiceCategories';
import { usePermission } from '@/hooks/usePermission';

export default function ServiceCategoriesPage() {
  const { can } = usePermission();
  const { data, isLoading, error, createMutation, updateMutation, deleteMutation } = useServiceCategories();
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
      await updateMutation.mutateAsync({ id, name: editName.trim() });
    }
    setEditingId(null);
  };

  return (
    <div className="space-y-5 p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Service Categories</h1>
        <p className="mt-0.5 text-sm text-slate-500">Manage master categories for service subjects.</p>
      </div>

      <form onSubmit={onCreate} className="rounded-xl border border-slate-200 bg-white p-4">
        <label className="mb-1.5 block text-sm font-medium text-slate-700">New category name</label>
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Air Conditioner"
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
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr><td colSpan={3} className="px-4 py-8 text-center text-sm text-slate-500">Loading...</td></tr>
            ) : error ? (
              <tr><td colSpan={3} className="px-4 py-8 text-center text-sm text-rose-600">{error}</td></tr>
            ) : data.length === 0 ? (
              <tr><td colSpan={3} className="px-4 py-8 text-center text-sm text-slate-400">No categories yet. Add one above.</td></tr>
            ) : data.map((item) => (
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
                  ) : item.name}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${item.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                    {item.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {editingId === item.id ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => commitRename(item.id)}
                        disabled={updateMutation.isPending}
                        className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(item.id, item.name)}
                        className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                      >
                        Rename
                      </button>
                      <button
                        type="button"
                        onClick={() => updateMutation.mutate({ id: item.id, is_active: !item.is_active })}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                      >
                        {item.is_active ? 'Disable' : 'Enable'}
                      </button>
                      {can('service-settings:edit') && (
                        <button
                          type="button"
                          onClick={() => deleteMutation.mutate(item.id)}
                          className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
