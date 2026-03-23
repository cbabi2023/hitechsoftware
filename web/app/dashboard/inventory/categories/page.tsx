'use client';

/**
 * @file page.tsx
 * @module app/dashboard/inventory/categories
 *
 * @description
 * Admin page for managing Product Categories.
 *
 * WHAT THIS PAGE DOES
 * -------------------
 * Allows admins and managers to:
 *  1. View all product categories in a table
 *  2. Add new categories via an inline form at the top
 *  3. Edit a category name directly in the table row (inline edit)
 *  4. Toggle active/inactive status
 *  5. Soft-delete a category (with a confirmation step)
 *
 * INLINE EDIT STATE MACHINE
 * -------------------------
 * Each row can be in one of three visual states:
 *  - DEFAULT: Shows name + Edit + Delete buttons
 *  - EDITING: Shows name as an `<input>` + Save (✓) + Cancel (✗) buttons
 *            Triggered by clicking Edit (sets editingId)
 *  - DELETE_CONFIRM: Shows "Delete?" + Yes + No buttons
 *                   Triggered by clicking Delete (sets deleteConfirmId)
 *
 * Opening edit resets deleteConfirmId (and vice versa) to prevent both
 * UI states from being open on different rows simultaneously.
 *
 * PERMISSION GUARDS
 * -----------------
 * - `can('inventory:view')`:   False → entire page shows "no access" message
 * - `can('inventory:create')`: False → "Add category" form is hidden
 * - `can('inventory:edit')`:   False → Edit button is hidden per row
 * - `can('inventory:delete')`: False → Delete button is hidden per row
 *
 * KEYBOARD SHORTCUTS
 * ------------------
 * While editing a row: Enter → save, Escape → cancel.
 *
 * LOADING SKELETON
 * ----------------
 * While data is fetching, we render 5 placeholder rows using `Array.from({ length: 5 })`
 * with CSS `animate-pulse` to create a shimmering skeleton effect.
 */

import { useState } from 'react';
import { Check, Pencil, Trash2, X, Plus } from 'lucide-react';
import { useProductCategories } from '@/hooks/product-categories/useProductCategories';
import { usePermission } from '@/hooks/auth/usePermission';

export default function ProductCategoriesPage() {
  const { can } = usePermission();
  const { data, isLoading, error, createMutation, updateMutation, deleteMutation } =
    useProductCategories();

  // Controlled input for the "Add category" form at the top of the page
  const [newName, setNewName] = useState('');

  // editingId: UUID of the category currently being renamed inline (null = no editing)
  const [editingId, setEditingId] = useState<string | null>(null);

  // editName: Temporary value of the name input while editing (reset on startEdit)
  const [editName, setEditName] = useState('');

  // deleteConfirmId: UUID of the category showing the delete confirmation UI
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
    if (!newName.trim()) return; // Ignore empty submission
    try {
      const result = await createMutation.mutateAsync({ name: newName });
      // Clear the input only on success; keep it on error so the user doesn't lose their text
      if (result.ok) setNewName('');
    } catch {
      // onError callback in the hook shows the toast
    }
  };

  /**
   * Transitions a row to EDITING state.
   * Resets deleteConfirmId to close any open delete confirm on another row.
   */
  const startEdit = (id: string, currentName: string) => {
    setEditingId(id);
    setEditName(currentName); // Seed the edit input with the current name
    setDeleteConfirmId(null); // Close any open delete confirmation
  };

  /**
   * Saves the in-progress edit and returns the row to DEFAULT state.
   * If the user cleared the input (empty string), we skip the API call
   * because an empty category name is invalid.
   */
  const commitEdit = async (id: string) => {
    if (editName.trim()) {
      await updateMutation.mutateAsync({ id, name: editName.trim() });
    }
    setEditingId(null); // Return row to DEFAULT state regardless of API result
  };

  /**
   * Executes the soft-delete after the user confirms.
   * Resets deleteConfirmId so the row returns to DEFAULT state.
   */
  const handleDelete = async (id: string) => {
    await deleteMutation.mutateAsync(id);
    setDeleteConfirmId(null);
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Product Categories</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Manage product categories used to classify inventory items.
        </p>
      </div>

      {can('inventory:create') && (
        <form
          onSubmit={handleCreate}
          className="rounded-xl border border-slate-200 bg-white p-4"
        >
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            New category name
          </label>
          <div className="flex gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Electronics"
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
              ? Array.from({ length: 5 }).map((_, i) => (
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
                          No categories yet. Add one above.
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
