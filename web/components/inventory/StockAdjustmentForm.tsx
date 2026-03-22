'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { stockAdjustmentSchema } from '@/modules/inventory/inventory.validation';
import type { StockAdjustmentFormValues } from '@/modules/inventory/inventory.validation';

interface StockAdjustmentFormProps {
  inventoryId: string;
  currentOnHand: number;
  onSubmit: (inventoryId: string, values: StockAdjustmentFormValues) => void | Promise<void>;
  isSubmitting: boolean;
  onCancel: () => void;
}

export function StockAdjustmentForm({
  inventoryId,
  currentOnHand,
  onSubmit,
  isSubmitting,
  onCancel,
}: StockAdjustmentFormProps) {
  'use no memo';

  const [mode, setMode] = useState<'add' | 'remove'>('add');

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<StockAdjustmentFormValues>({
    resolver: zodResolver(stockAdjustmentSchema),
    defaultValues: { adjustment: 1, warehouse_location: '' },
  });

  const rawAdjustment = watch('adjustment') ?? 0;
  const effectiveAdjustment = mode === 'remove' ? -Math.abs(rawAdjustment) : Math.abs(rawAdjustment);
  const resultingOnHand = currentOnHand + effectiveAdjustment;

  return (
    <form
      className="space-y-4"
      onSubmit={handleSubmit(async (values) => {
        await onSubmit(inventoryId, {
          ...values,
          adjustment: effectiveAdjustment,
        });
      })}
    >
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode('add')}
          className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition ${
            mode === 'add'
              ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          + Add stock
        </button>
        <button
          type="button"
          onClick={() => setMode('remove')}
          className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition ${
            mode === 'remove'
              ? 'border-rose-300 bg-rose-50 text-rose-700'
              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          − Remove stock
        </button>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">
          Quantity <span className="text-rose-500">*</span>
        </label>
        <input
          {...register('adjustment', { valueAsNumber: true })}
          type="number"
          min={1}
          step={1}
          className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm shadow-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
        />
        {errors.adjustment ? (
          <p className="mt-1 text-xs text-rose-600">{errors.adjustment.message}</p>
        ) : null}
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">
          Warehouse / location
        </label>
        <input
          {...register('warehouse_location')}
          className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm shadow-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
          placeholder="e.g. Shelf A3"
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
        <div className="flex justify-between">
          <span>Current on-hand</span>
          <span className="font-medium">{currentOnHand}</span>
        </div>
        <div className="flex justify-between">
          <span>Adjustment</span>
          <span className={`font-medium ${effectiveAdjustment >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
            {effectiveAdjustment >= 0 ? '+' : ''}{effectiveAdjustment}
          </span>
        </div>
        <div className="mt-1 flex justify-between border-t border-slate-200 pt-1 font-semibold">
          <span>Resulting on-hand</span>
          <span className={resultingOnHand < 0 ? 'text-rose-600' : 'text-slate-900'}>
            {resultingOnHand}
          </span>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isSubmitting || resultingOnHand < 0}
          className="ht-btn ht-btn-primary flex-1"
        >
          {isSubmitting ? 'Saving…' : 'Confirm adjustment'}
        </button>
        <button type="button" onClick={onCancel} className="ht-btn ht-btn-secondary">
          Cancel
        </button>
      </div>
    </form>
  );
}
