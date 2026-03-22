'use client';

/**
 * @file page.tsx
 * @module app/dashboard/inventory/stock
 *
 * @description
 * List page for all stock entries (goods receipts) against invoices.
 *
 * WHAT THIS PAGE SHOWS
 * --------------------
 * - A searchable, paginated list of stock entry headers (invoice + date + item count).
 * - Each entry is expandable (accordion) to see the line items inside it.
 * - Each expanded item shows: product name, material code, HSN/SAC, quantity.
 *
 * ACCORDION PATTERN
 * -----------------
 * `expandedId` tracks which entry is currently expanded (null = all collapsed).
 * Clicking the chevron icon toggles that entry:
 *  - if already expanded (expandedId === entry.id) → collapse (set to null)
 *  - otherwise → expand (set to entry.id)
 * Only ONE entry can be expanded at a time; opening a new one closes the previous.
 *
 * SUMMARY ROW METADATA
 * --------------------
 * The collapsed row shows:
 *  - Invoice number (monospaced font)
 *  - Entry date (formatted as "22 Mar 2026" via `toLocaleDateString`)
 *  - Item count + total quantity (computed from `entry.items` array in-client)
 *
 * SEARCH
 * ------
 * Local state `searchValue` keeps the input controlled.
 * On every change, `setSearch(value)` is called — this updates the hook's
 * filter state and triggers a React Query re-fetch filtering by invoice number.
 *
 * NO EDIT BUTTON
 * --------------
 * Stock entries are intentionally immutable after creation. If an error was made,
 * the entry must be deleted and re-created. This preserves accounting integrity.
 *
 * PERMISSION GUARDS
 * -----------------
 * - `can('stock:view')`:   False → access denied message
 * - `can('stock:create')`: False → "Add Stock Entry" button hidden
 * - `can('stock:delete')`: False → Delete button hidden per row
 *
 * RELATED FILES
 * -------------
 * - Hook: `hooks/stock-entries/useStockEntries.ts`
 * - New entry page: `app/dashboard/inventory/stock/new/page.tsx`
 */

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Search, Trash2, ChevronDown, ChevronRight, ClipboardList } from 'lucide-react';
import { useStockEntries } from '@/hooks/stock-entries/useStockEntries';
import { usePermission } from '@/hooks/auth/usePermission';
import { ROUTES } from '@/lib/constants/routes';

export default function StockEntriesPage() {
  const { can } = usePermission();
  const {
    entries,
    pagination,
    isLoading,
    error,
    setSearch,
    setPage,
    deleteMutation,
  } = useStockEntries();

  const [searchValue, setSearchValue] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  if (!can('stock:view')) {
    return (
      <div className="p-6 text-sm text-rose-600">
        You do not have access to stock entries.
      </div>
    );
  }

  const handleSearch = (value: string) => {
    setSearchValue(value);
    setSearch(value);
  };

  const handleDelete = async (id: string) => {
    await deleteMutation.mutateAsync(id);
    setDeleteConfirmId(null);
  };

  return (
    <div className="space-y-5 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Stock Entries</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Record stock received against invoices.
          </p>
        </div>
        {can('stock:create') && (
          <Link
            href={ROUTES.DASHBOARD_INVENTORY_STOCK_NEW}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <Plus size={16} />
            Add Stock Entry
          </Link>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={searchValue}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search by invoice number…"
          className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
      </div>

      {/* Entries list */}
      <div className="space-y-3">
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 rounded-xl border border-slate-200 bg-white animate-pulse" />
            ))
          : error
            ? <p className="text-sm text-rose-600">{error}</p>
            : entries.length === 0
              ? (
                  <div className="flex flex-col items-center gap-3 rounded-xl border border-slate-200 bg-white py-14 text-slate-400">
                    <ClipboardList size={36} className="opacity-40" />
                    <p className="text-sm">No stock entries yet.</p>
                  </div>
                )
              : entries.map((entry) => {
                  const isExpanded = expandedId === entry.id;
                  const totalQty = entry.items.reduce((sum, it) => sum + it.quantity, 0);
                  return (
                    <div key={entry.id} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                      {/* Row header */}
                      <div className="flex items-center gap-3 px-4 py-3">
                        <button
                          type="button"
                          onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                          className="text-slate-500 hover:text-slate-700"
                          aria-label={isExpanded ? 'Collapse' : 'Expand'}
                        >
                          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </button>

                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800">
                            Invoice: <span className="font-mono">{entry.invoice_number}</span>
                          </p>
                          <p className="text-xs text-slate-400">
                            {new Date(entry.entry_date).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                            {' · '}
                            {entry.items.length} item{entry.items.length !== 1 ? 's' : ''}
                            {' · '}
                            {totalQty} unit{totalQty !== 1 ? 's' : ''}
                          </p>
                        </div>

                        {deleteConfirmId === entry.id ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-rose-600">Delete?</span>
                            <button
                              type="button"
                              onClick={() => handleDelete(entry.id)}
                              disabled={deleteMutation.isPending}
                              className="inline-flex h-7 items-center rounded-md bg-rose-600 px-2.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                            >
                              Yes
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmId(null)}
                              className="inline-flex h-7 items-center rounded-md border border-slate-200 px-2.5 text-xs text-slate-600 hover:bg-slate-50"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          can('stock:delete') && (
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmId(entry.id)}
                              title="Delete entry"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-rose-200 text-rose-600 hover:bg-rose-50"
                            >
                              <Trash2 size={14} />
                            </button>
                          )
                        )}
                      </div>

                      {/* Expanded items */}
                      {isExpanded && (
                        <div className="border-t border-slate-100 bg-slate-50 px-4 py-3">
                          {entry.notes && (
                            <p className="mb-3 text-xs text-slate-500 italic">{entry.notes}</p>
                          )}
                          <table className="min-w-full text-sm">
                            <thead>
                              <tr className="text-left text-xs text-slate-400">
                                <th className="pb-2 font-medium">Product</th>
                                <th className="pb-2 font-medium">Material Code</th>
                                <th className="pb-2 font-medium">HSN/SAC</th>
                                <th className="pb-2 text-right font-medium">Qty</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {entry.items.map((item) => (
                                <tr key={item.id}>
                                  <td className="py-1.5 text-slate-700">
                                    {item.product?.product_name ?? <span className="text-slate-400">—</span>}
                                  </td>
                                  <td className="py-1.5">
                                    <code className="rounded bg-white px-1.5 py-0.5 text-xs font-mono text-slate-600 border border-slate-200">
                                      {item.material_code}
                                    </code>
                                  </td>
                                  <td className="py-1.5 text-slate-500 text-xs">
                                    {item.hsn_sac_code ?? '—'}
                                  </td>
                                  <td className="py-1.5 text-right font-semibold text-slate-800">
                                    {item.quantity}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>
            Showing {(pagination.page - 1) * pagination.pageSize + 1}–
            {Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-40"
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() => setPage(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
