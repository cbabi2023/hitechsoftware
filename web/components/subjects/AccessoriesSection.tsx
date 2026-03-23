// ─────────────────────────────────────────────────────────────────────────────
// AccessoriesSection.tsx
//
// Spare-parts / accessories table on the Subject Detail page.
// canEdit guard  — technician + assigned + IN_PROGRESS + bill not yet generated.
// After the bill is generated the table becomes read-only for everyone.
// form submit resets to blank row after mutate so the technician can add more.
//
// MRP is always GST-inclusive (18%). The form shows live GST split.
// Discounts can be percentage or flat, applied before GST split.
// ─────────────────────────────────────────────────────────────────────────────
'use client';

import { useMemo, useState } from 'react';
import type { SubjectDetail } from '@/modules/subjects/subject.types';
import { useAddAccessory, useRemoveAccessory, useSubjectAccessories } from '@/hooks/subjects/useBilling';

const GST_RATE = 1.18;

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
  const [mrp, setMrp] = useState(0);
  const [discountType, setDiscountType] = useState<'percentage' | 'flat'>('percentage');
  const [discountValue, setDiscountValue] = useState(0);

  const canEdit = userRole === 'technician'
    && userId === subject.assigned_technician_id
    && subject.status === 'IN_PROGRESS'
    && !subject.bill_generated;

  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;

  // Live GST split preview for the form input
  const liveCalc = useMemo(() => {
    const discountAmt = discountType === 'percentage'
      ? Math.round(mrp * discountValue / 100 * 100) / 100
      : Math.min(discountValue, mrp);
    const discountedMrp = Math.max(mrp - discountAmt, 0);
    const basePrice = Math.round(discountedMrp / GST_RATE * 100) / 100;
    const gstAmount = Math.round((discountedMrp - basePrice) * 100) / 100;
    const lineTotal = quantity * discountedMrp;
    return { discountAmt, discountedMrp, basePrice, gstAmount, lineTotal };
  }, [mrp, discountType, discountValue, quantity]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Accessories</h3>
          <p className="mt-1 text-xs text-slate-500">Add billed spare items before final bill generation. MRP is GST-inclusive (18%).</p>
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
              mrp,
              discount_type: discountType,
              discount_value: discountValue,
            });
            setItemName('');
            setQuantity(1);
            setMrp(0);
            setDiscountType('percentage');
            setDiscountValue(0);
          }}
          className="mb-4 space-y-3"
        >
          <div className="grid grid-cols-1 gap-2 md:grid-cols-6">
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
              placeholder="Qty"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              required
            />
            <div>
              <input
                type="number"
                min={0}
                step="0.01"
                value={mrp}
                onChange={(event) => setMrp(Math.max(0, Number(event.target.value || 0)))}
                placeholder="MRP (incl. GST)"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                required
              />
            </div>
            <div className="flex gap-1">
              <select
                value={discountType}
                onChange={(event) => setDiscountType(event.target.value as 'percentage' | 'flat')}
                className="w-16 rounded-lg border border-slate-300 px-1 py-2 text-sm"
              >
                <option value="percentage">%</option>
                <option value="flat">₹</option>
              </select>
              <input
                type="number"
                min={0}
                step="0.01"
                max={discountType === 'percentage' ? 100 : mrp}
                value={discountValue}
                onChange={(event) => setDiscountValue(Math.max(0, Number(event.target.value || 0)))}
                placeholder="Disc."
                className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={addMutation.isPending}
              className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              Add Item
            </button>
          </div>

          {/* Live GST split preview */}
          {mrp > 0 && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
              {liveCalc.discountAmt > 0 && (
                <span>Discount: <strong className="text-slate-800">−₹{formatMoney(liveCalc.discountAmt)}</strong></span>
              )}
              <span>Base Price: <strong className="text-slate-800">₹{formatMoney(liveCalc.basePrice)}</strong></span>
              <span>GST 18%: <strong className="text-slate-800">₹{formatMoney(liveCalc.gstAmount)}</strong></span>
              <span>Line Total: <strong className="text-emerald-700">₹{formatMoney(liveCalc.lineTotal)}</strong></span>
            </div>
          )}
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
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">MRP</th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Disc.</th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Qty</th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Base</th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">GST 18%</th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Total</th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="px-3 py-2 font-medium text-slate-900">{item.item_name}</td>
                  <td className="px-3 py-2 text-right text-slate-700">₹{formatMoney(item.mrp)}</td>
                  <td className="px-3 py-2 text-right text-slate-700">
                    {item.discount_value > 0
                      ? item.discount_type === 'percentage'
                        ? `${item.discount_value}%`
                        : `₹${formatMoney(item.discount_value)}`
                      : '—'}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-700">{item.quantity}</td>
                  <td className="px-3 py-2 text-right text-slate-700">₹{formatMoney(item.line_base_total)}</td>
                  <td className="px-3 py-2 text-right text-slate-700">₹{formatMoney(item.line_gst_total)}</td>
                  <td className="px-3 py-2 text-right font-semibold text-slate-900">₹{formatMoney(item.line_total)}</td>
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
