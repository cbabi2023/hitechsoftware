'use client';

/**
 * @file page.tsx
 * @module app/dashboard/inventory/product-types
 *
 * @description
 * Admin page for managing Product Types.
 *
 * Structurally identical to the Categories page. Uses the same:
 *  - Inline edit state machine (editingId → name input in row → commitEdit)
 *  - Delete confirmation UI (deleteConfirmId → confirm/cancel buttons)
 *  - Permission guards (can('inventory:view/create/edit/delete'))
 *  - Loading skeleton (Array.from({ length: N }) with animate-pulse)
 *
 * See `app/dashboard/inventory/categories/page.tsx` for a detailed
 * explanation of these patterns.
 *
 * DIFFERENCE FROM CATEGORIES
 * --------------------------
 * Product Types use `useProductTypes` instead of `useProductCategories`.
 * The permission scope is the same (`inventory:*`) since both are admin
 * classification data that gate the same inventory workflows.
 */

import { useState } from 'react';
import { Check, Pencil, Trash2, X, Plus } from 'lucide-react';
import { useProductTypes } from '@/hooks/product-types/useProductTypes';
import { usePermission } from '@/hooks/auth/usePermission';

export default function ProductTypesPage() {
  const { can } = usePermission();
  const { data, isLoading, error, createMutation, updateMutation, deleteMutation } =
    useProductTypes();

  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  if (!can('inventory:view')) {
    return (
      <div className="p-6 text-sm text-rose-600">
        You do not have access to this section.
      </div>
    );
  }

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newName.trim()) return;
    const result = await createMutation.mutateAsync({ name: newName });
    if (result.ok) setNewName('');
  };

  const startEdit = (id: string, currentName: string) => {
    setEditingId(id);
    setEditName(currentName);
    setDeleteConfirmId(null);
  };

  const commitEdit = async (id: string) => {
    if (editName.trim()) {
      await updateMutation.mutateAsync({ id, name: editName.trim() });
    }
    setEditingId(null);
  };

  const handleDelete = async (id: string) => {
    await deleteMutation.mutateAsync(id);
    setDeleteConfirmId(null);
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Product Types</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Manage product types used to classify items in the inventory.
        </p>
      </div>

      {can('inventory:create') && (
        <form
          onSubmit={handleCreate}
          className="rounded-xl border border-slate-200 bg-white p-4"
        >
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            New product type name
          </label>
          <div className="flex gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Spare Part"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <button
              type="submit"
              disabled={createMutation.isPending || !newName.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <Plus size={14} />
              Add
            </button>
          </div>
        </form>
      )}

      <div className="rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Status
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <tr key={`skel-${i}`} className="animate-pulse">
                    <td className="px-4 py-3">
                      <div className="h-4 w-36 rounded bg-slate-200" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-5 w-16 rounded-full bg-slate-200" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="ml-auto h-8 w-20 rounded-md bg-slate-200" />
                    </td>
                  </tr>
                ))
              : error
                ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-sm text-rose-600">
                        {error}
                      </td>
                    </tr>
                  )
                : data.length === 0
                  ? (
                      <tr>
                        <td colSpan={3} className="px-4 py-8 text-center text-sm text-slate-400">
                          No product types yet. Add one above.
                        </td>
                      </tr>
                    )
                  : data.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 text-sm font-medium text-slate-800">
                          {editingId === item.id ? (
                            <input
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              autoFocus
                              className="w-full max-w-xs rounded-lg border border-blue-400 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') commitEdit(item.id);
                                if (e.key === 'Escape') setEditingId(null);
                              }}
                            />
                          ) : (
                            item.name
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                              item.is_active
                                ? 'bg-green-100 text-green-700'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {item.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            {editingId === item.id ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => commitEdit(item.id)}
                                  disabled={updateMutation.isPending}
                                  title="Save"
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                                >
                                  <Check size={14} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingId(null)}
                                  title="Cancel"
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
                                >
                                  <X size={14} />
                                </button>
                              </>
                            ) : deleteConfirmId === item.id ? (
                              <>
                                <span className="text-xs text-rose-600">Delete?</span>
                                <button
                                  type="button"
                                  onClick={() => handleDelete(item.id)}
                                  disabled={deleteMutation.isPending}
                                  className="inline-flex h-8 items-center gap-1 rounded-md bg-rose-600 px-3 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                                >
                                  Yes
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeleteConfirmId(null)}
                                  className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 px-3 text-xs text-slate-600 hover:bg-slate-50"
                                >
                                  No
                                </button>
                              </>
                            ) : (
                              <>
                                {can('inventory:edit') && (
                                  <button
                                    type="button"
                                    onClick={() => startEdit(item.id, item.name)}
                                    title="Edit"
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100"
                                  >
                                    <Pencil size={14} />
                                  </button>
                                )}
                                {can('inventory:delete') && (
                                  <button
                                    type="button"
                                    onClick={() => setDeleteConfirmId(item.id)}
                                    title="Delete"
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-rose-200 text-rose-600 hover:bg-rose-50"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
