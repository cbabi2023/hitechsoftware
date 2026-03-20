'use client';

import { useState } from 'react';
import type { SubjectDetail } from '@/modules/subjects/subject.types';
import { useAddAccessory, useRemoveAccessory, useSubjectAccessories } from '@/hooks/subjects/useBilling';

interface Props {
  subject: SubjectDetail;
  userRole: string | null;
  userId: string | null;
}

function formatMoney(value: number) {
  return value.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function AccessoriesSection({ subject, userRole, userId }: Props) {
  const query = useSubjectAccessories(subject.id);
  const addMutation = useAddAccessory(subject.id);
  const removeMutation = useRemoveAccessory(subject.id);

  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState(0);

  const canEdit = userRole === 'technician'
    && userId === subject.assigned_technician_id
    && subject.status === 'IN_PROGRESS'
    && !subject.bill_generated;

  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Accessories</h3>
          <p className="mt-1 text-xs text-slate-500">Add billed spare items before final bill generation.</p>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
          Total: INR {formatMoney(total)}
        </span>
      </div>

      {canEdit && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            addMutation.mutate({
              item_name: itemName.trim(),
              quantity,
              unit_price: unitPrice,
            });
            setItemName('');
            setQuantity(1);
            setUnitPrice(0);
          }}
          className="mb-4 grid grid-cols-1 gap-2 md:grid-cols-5"
        >
          <input
            value={itemName}
            onChange={(event) => setItemName(event.target.value)}
            placeholder="Item name"
            className="md:col-span-2 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            required
          />
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(event) => setQuantity(Math.max(1, Number(event.target.value || 1)))}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            required
          />
          <input
            type="number"
            min={0}
            step="0.01"
            value={unitPrice}
            onChange={(event) => setUnitPrice(Math.max(0, Number(event.target.value || 0)))}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            required
          />
          <button
            type="submit"
            disabled={addMutation.isPending}
            className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            Add Item
          </button>
        </form>
      )}

      {query.isLoading ? <p className="text-sm text-slate-500">Loading accessories...</p> : null}

      {!query.isLoading && items.length === 0 ? (
        <p className="text-sm text-slate-500">No accessories added.</p>
      ) : null}

      {items.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Item</th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Qty</th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Unit</th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Total</th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="px-3 py-2 font-medium text-slate-900">{item.item_name}</td>
                  <td className="px-3 py-2 text-right text-slate-700">{item.quantity}</td>
                  <td className="px-3 py-2 text-right text-slate-700">INR {formatMoney(item.unit_price)}</td>
                  <td className="px-3 py-2 text-right font-semibold text-slate-900">INR {formatMoney(item.total_price)}</td>
                  <td className="px-3 py-2 text-right">
                    {canEdit ? (
                      <button
                        type="button"
                        disabled={removeMutation.isPending}
                        onClick={() => removeMutation.mutate(item.id)}
                        className="rounded-md border border-rose-300 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                      >
                        Remove
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">Locked</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
