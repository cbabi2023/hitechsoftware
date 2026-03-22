'use client';

import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Package } from 'lucide-react';
import { INVENTORY_CATEGORIES } from '@/modules/inventory/inventory.constants';
import { createInventorySchema } from '@/modules/inventory/inventory.validation';
import type { CreateInventoryInput, InventoryItem } from '@/modules/inventory/inventory.types';

interface InventoryFormProps {
  initialValues?: Partial<InventoryItem>;
  submitLabel: string;
  isSubmitting?: boolean;
  onSubmit: (values: CreateInventoryInput) => void | Promise<void>;
  onCancel?: () => void;
}

const defaultValues: CreateInventoryInput = {
  item_code: '',
  item_name: '',
  item_category: '',
  description: '',
  unit_cost: 0,
  mrp_price: 0,
  reorder_level: 10,
  is_active: true,
};

export function InventoryForm({
  initialValues,
  submitLabel,
  isSubmitting = false,
  onSubmit,
  onCancel,
}: InventoryFormProps) {
  'use no memo';

  const resolvedDefaults = useMemo<CreateInventoryInput>(() => {
    if (!initialValues) return defaultValues;
    return {
      item_code: initialValues.item_code ?? '',
      item_name: initialValues.item_name ?? '',
      item_category: initialValues.item_category ?? '',
      description: initialValues.description ?? '',
      unit_cost: initialValues.unit_cost ?? 0,
      mrp_price: initialValues.mrp_price ?? 0,
      reorder_level: initialValues.reorder_level ?? 10,
      is_active: initialValues.is_active ?? true,
    };
  }, [initialValues]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitted },
  } = useForm<CreateInventoryInput>({
    resolver: zodResolver(createInventorySchema),
    defaultValues: resolvedDefaults,
  });

  useEffect(() => {
    reset(resolvedDefaults);
  }, [reset, resolvedDefaults]);

  const showErrorSummary = isSubmitted && Object.keys(errors).length > 0;

  return (
    <form
      className="space-y-6"
      onSubmit={handleSubmit(async (values) => {
        await onSubmit(values);
      })}
    >
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-white via-slate-50 to-indigo-50 p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-indigo-50 p-2 text-indigo-700">
            <Package size={18} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-700">
              Inventory item
            </p>
            <h2 className="mt-1 text-xl font-semibold text-slate-900">Part / Product details</h2>
            <p className="mt-1 text-sm text-slate-600">
              Each item represents a distinct part or product that can be stocked and issued to
              technicians.
            </p>
          </div>
        </div>
      </div>

      {showErrorSummary ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          Please review the highlighted fields before saving.
        </div>
      ) : null}

      <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Identification
        </h3>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Item code <span className="text-rose-500">*</span>
            </label>
            <input
              {...register('item_code')}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm uppercase shadow-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
              placeholder="e.g. COMP-INV-001"
            />
            <p className="mt-1 text-xs text-slate-500">
              Unique SKU. Letters, digits, hyphens, and underscores only.
            </p>
            {errors.item_code ? (
              <p className="mt-1 text-xs text-rose-600">{errors.item_code.message}</p>
            ) : null}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Item name <span className="text-rose-500">*</span>
            </label>
            <input
              {...register('item_name')}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm shadow-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
              placeholder="e.g. 1.5 Ton Compressor"
            />
            {errors.item_name ? (
              <p className="mt-1 text-xs text-rose-600">{errors.item_name.message}</p>
            ) : null}
          </div>

          <div className="md:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Category <span className="text-rose-500">*</span>
            </label>
            <select
              {...register('item_category')}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm shadow-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
            >
              <option value="">Select a category</option>
              {INVENTORY_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            {errors.item_category ? (
              <p className="mt-1 text-xs text-rose-600">{errors.item_category.message}</p>
            ) : null}
          </div>

          <div className="md:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Description</label>
            <textarea
              {...register('description')}
              rows={3}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm shadow-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
              placeholder="Optional — model numbers, specs, compatible units, etc."
            />
            {errors.description ? (
              <p className="mt-1 text-xs text-rose-600">{errors.description.message}</p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Pricing & stock threshold
        </h3>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Unit cost (₹) <span className="text-rose-500">*</span>
            </label>
            <input
              {...register('unit_cost', { valueAsNumber: true })}
              type="number"
              min={0}
              step="0.01"
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm shadow-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
              placeholder="0.00"
            />
            <p className="mt-1 text-xs text-slate-500">Purchase / procurement cost.</p>
            {errors.unit_cost ? (
              <p className="mt-1 text-xs text-rose-600">{errors.unit_cost.message}</p>
            ) : null}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              MRP (₹) <span className="text-rose-500">*</span>
            </label>
            <input
              {...register('mrp_price', { valueAsNumber: true })}
              type="number"
              min={0}
              step="0.01"
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm shadow-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
              placeholder="0.00"
            />
            <p className="mt-1 text-xs text-slate-500">
              Must be ≥ unit cost. OOW jobs: technician may exceed MRP.
            </p>
            {errors.mrp_price ? (
              <p className="mt-1 text-xs text-rose-600">{errors.mrp_price.message}</p>
            ) : null}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Reorder level
            </label>
            <input
              {...register('reorder_level', { valueAsNumber: true })}
              type="number"
              min={0}
              step={1}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm shadow-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
              placeholder="10"
            />
            <p className="mt-1 text-xs text-slate-500">
              Alert when available stock drops to or below this.
            </p>
            {errors.reorder_level ? (
              <p className="mt-1 text-xs text-rose-600">{errors.reorder_level.message}</p>
            ) : null}
          </div>
        </div>

        <label className="inline-flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
          <input
            type="checkbox"
            {...register('is_active')}
            className="h-4 w-4 rounded border-slate-300 text-indigo-600"
          />
          <span>
            <span className="block font-medium text-slate-900">Active item</span>
            <span className="block text-xs text-slate-500">
              Inactive items are hidden from issuance workflows.
            </span>
          </span>
        </label>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="ht-btn ht-btn-primary"
        >
          {isSubmitting ? 'Saving…' : submitLabel}
        </button>

        {onCancel ? (
          <button type="button" onClick={onCancel} className="ht-btn ht-btn-secondary">
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}
