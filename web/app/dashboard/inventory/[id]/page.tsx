'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Pencil, Trash2, TrendingUp } from 'lucide-react';
import { useInventoryItem } from '@/hooks/inventory/useInventoryItem';
import { useInventory } from '@/hooks/inventory/useInventory';
import { usePermission } from '@/hooks/auth/usePermission';
import { InventoryStatusBadge } from '@/components/inventory/InventoryStatusBadge';
import { StockBadge } from '@/components/inventory/StockBadge';
import { StockAdjustmentForm } from '@/components/inventory/StockAdjustmentForm';
import type { StockAdjustmentFormValues } from '@/modules/inventory/inventory.validation';

export default function InventoryItemDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { can } = usePermission();
  const { item, isLoading, error } = useInventoryItem(id);
  const { deleteMutation, adjustStockMutation } = useInventory();

  const [showStockForm, setShowStockForm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (!can('inventory:view')) {
    return (
      <div className="p-6 text-sm text-rose-600">
        You do not have access to inventory details.
      </div>
    );
  }

  if (isLoading) {
    return <div className="p-6 text-sm text-slate-500">Loading item…</div>;
  }

  if (error || !item) {
    return (
      <div className="p-6">
        <p className="text-sm text-rose-600">{error ?? 'Item not found.'}</p>
        <Link href="/dashboard/inventory" className="mt-2 inline-block text-xs text-slate-500 hover:underline">
          ← Back to inventory
        </Link>
      </div>
    );
  }

  async function handleDelete() {
    deleteMutation.mutate(id, {
      onSuccess: (result) => {
        if (result.ok) router.push('/dashboard/inventory');
      },
    });
  }

  async function handleStockAdjust(inventoryId: string, values: StockAdjustmentFormValues) {
    adjustStockMutation.mutate(
      { id: inventoryId, input: values },
      {
        onSuccess: (result) => {
          if (result.ok) setShowStockForm(false);
        },
      },
    );
  }

  const onHand = item.stock?.quantity_on_hand ?? 0;
  const reserved = item.stock?.quantity_reserved ?? 0;
  const available = item.stock?.quantity_available ?? 0;

  return (
    <div className="p-6">
      {/* Breadcrumb */}
      <div className="mb-6 flex items-center gap-3">
        <Link href="/dashboard/inventory" className="text-sm text-slate-500 hover:text-slate-700">
          ← Inventory
        </Link>
        <span className="text-slate-300">/</span>
        <span className="font-mono text-sm font-medium text-slate-700">{item.item_code}</span>
      </div>

      {/* Header card */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-semibold text-slate-400">{item.item_code}</span>
            <InventoryStatusBadge isActive={item.is_active} />
          </div>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">{item.item_name}</h1>
          <p className="mt-0.5 text-sm text-slate-600">{item.item_category}</p>
          {item.description ? (
            <p className="mt-2 max-w-prose text-sm text-slate-500">{item.description}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {can('inventory:edit') ? (
            <Link
              href={`/dashboard/inventory/${id}/edit`}
              className="ht-btn ht-btn-secondary inline-flex items-center gap-1.5"
            >
              <Pencil size={14} />
              Edit
            </Link>
          ) : null}

          {can('inventory:delete') ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="ht-btn ht-btn-secondary inline-flex items-center gap-1.5 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
            >
              <Trash2 size={14} />
              Remove
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Pricing */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Pricing
          </h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-600">Unit cost</dt>
              <dd className="font-medium text-slate-900">
                ₹{Number(item.unit_cost).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-600">MRP</dt>
              <dd className="font-medium text-slate-900">
                ₹{Number(item.mrp_price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-600">Reorder level</dt>
              <dd className="font-medium text-slate-900">{item.reorder_level} units</dd>
            </div>
          </dl>
        </div>

        {/* Stock */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Stock level
            </h2>
            {can('inventory:edit') ? (
              <button
                onClick={() => setShowStockForm((prev) => !prev)}
                className="ht-btn ht-btn-secondary ht-btn-sm inline-flex items-center gap-1"
              >
                <TrendingUp size={13} />
                Adjust
              </button>
            ) : null}
          </div>

          {showStockForm ? (
            <StockAdjustmentForm
              inventoryId={id}
              currentOnHand={onHand}
              onSubmit={handleStockAdjust}
              isSubmitting={adjustStockMutation.isPending}
              onCancel={() => setShowStockForm(false)}
            />
          ) : (
            <>
              <div className="mb-3">
                <StockBadge stock={item.stock} reorderLevel={item.reorder_level} />
              </div>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-600">On hand</dt>
                  <dd className="font-medium text-slate-900">{onHand}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-600">Reserved</dt>
                  <dd className="font-medium text-slate-900">{reserved}</dd>
                </div>
                <div className="flex justify-between border-t border-slate-100 pt-2">
                  <dt className="font-medium text-slate-800">Available</dt>
                  <dd className="font-semibold text-slate-900">{available}</dd>
                </div>
                {item.stock?.warehouse_location ? (
                  <div className="flex justify-between">
                    <dt className="text-slate-600">Location</dt>
                    <dd className="text-slate-900">{item.stock.warehouse_location}</dd>
                  </div>
                ) : null}
                {item.stock?.last_stock_date ? (
                  <div className="flex justify-between">
                    <dt className="text-slate-600">Last stocked</dt>
                    <dd className="text-slate-900">
                      {new Date(item.stock.last_stock_date).toLocaleDateString('en-IN')}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </>
          )}
        </div>
      </div>

      {/* Delete confirm */}
      {showDeleteConfirm ? (
        <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-5">
          <p className="text-sm font-medium text-rose-800">
            Remove <strong>{item.item_name}</strong> from inventory?
          </p>
          <p className="mt-1 text-xs text-rose-600">
            This will soft-delete the item. Stock records are retained for audit purposes.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="ht-btn ht-btn-sm rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
            >
              {deleteMutation.isPending ? 'Removing…' : 'Yes, remove'}
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="ht-btn ht-btn-secondary ht-btn-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {/* Meta */}
      <div className="mt-6 text-xs text-slate-400">
        Created {new Date(item.created_at).toLocaleString('en-IN')} · Last updated{' '}
        {new Date(item.updated_at).toLocaleString('en-IN')}
      </div>
    </div>
  );
}
