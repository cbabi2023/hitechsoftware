'use client';

import Link from 'next/link';
import { Package } from 'lucide-react';
import { useInventory } from '@/hooks/inventory/useInventory';
import { usePermission } from '@/hooks/auth/usePermission';
import { InventoryStatusBadge } from '@/components/inventory/InventoryStatusBadge';
import { StockBadge } from '@/components/inventory/StockBadge';
import { INVENTORY_CATEGORIES } from '@/modules/inventory/inventory.constants';

export default function InventoryListPage() {
  const { can } = usePermission();
  const {
    items,
    pagination,
    filters,
    searchInput,
    isLoading,
    error,
    setSearch,
    setCategory,
    setStatus,
    setPage,
  } = useInventory();

  if (!can('inventory:view')) {
    return (
      <div className="p-6 text-sm text-rose-600">
        You do not have access to the inventory module.
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Inventory</h1>
          <p className="mt-1 text-sm text-slate-600">
            Manage parts catalogue, pricing, and stock levels.
          </p>
        </div>

        {can('inventory:create') ? (
          <Link href="/dashboard/inventory/new" className="ht-btn ht-btn-primary">
            Add item
          </Link>
        ) : null}
      </div>

      {/* Filters */}
      <div className="mb-4 grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-4">
        <div className="md:col-span-2">
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
            Search
          </label>
          <input
            value={searchInput}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or item code"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
            Category
          </label>
          <select
            value={filters.category ?? ''}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">All categories</option>
            {INVENTORY_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
            Status
          </label>
          <select
            value={filters.status}
            onChange={(e) => setStatus(e.target.value as 'all' | 'active' | 'inactive')}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Item name</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Unit cost</th>
              <th className="px-4 py-3">MRP</th>
              <th className="px-4 py-3">Stock</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td className="px-4 py-6 text-slate-500" colSpan={8}>
                  Loading inventory…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center" colSpan={8}>
                  <div className="flex flex-col items-center gap-2 text-slate-500">
                    <Package size={32} className="text-slate-300" />
                    <p className="text-sm">No inventory items found.</p>
                    {can('inventory:create') ? (
                      <Link
                        href="/dashboard/inventory/new"
                        className="mt-1 text-xs font-medium text-indigo-600 hover:underline"
                      >
                        Add your first item
                      </Link>
                    ) : null}
                  </div>
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-mono text-xs font-medium text-slate-700">
                    {item.item_code}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">{item.item_name}</td>
                  <td className="px-4 py-3 text-slate-600">{item.item_category}</td>
                  <td className="px-4 py-3 text-slate-700">
                    ₹{Number(item.unit_cost).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    ₹{Number(item.mrp_price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3">
                    <StockBadge stock={item.stock} reorderLevel={item.reorder_level} />
                  </td>
                  <td className="px-4 py-3">
                    <InventoryStatusBadge isActive={item.is_active} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/dashboard/inventory/${item.id}`}
                      className="ht-btn ht-btn-secondary ht-btn-sm"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}

      <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
        <p>
          Page {pagination.page} of {pagination.totalPages} ({pagination.total} total items)
        </p>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage(pagination.page - 1)}
            disabled={pagination.page <= 1}
            className="ht-btn ht-btn-secondary ht-btn-sm disabled:opacity-40"
          >
            Previous
          </button>
          <button
            onClick={() => setPage(pagination.page + 1)}
            disabled={pagination.page >= pagination.totalPages}
            className="ht-btn ht-btn-secondary ht-btn-sm disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

