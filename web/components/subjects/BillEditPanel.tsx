// ─────────────────────────────────────────────────────────────────────────────
// BillEditPanel.tsx
//
// Super-admin-only inline panel for editing an already-generated bill.
// State model:
//   toRemove   — Set of existing accessory IDs marked for deletion on save
//   toAdd      — pending new accessories (sent on save, not immediately)
//   newItem    — input row for the next accessory to add
//
// Totals are derived live in JS rather than re-fetching from the DB so the
// panel shows an instant preview while the admin edits charges.
//
// GST 18% is always applied. MRP values are GST-inclusive.
// ─────────────────────────────────────────────────────────────────────────────
'use client';

import { useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import type { AddAccessoryInput, EditBillInput, PaymentMode, SubjectAccessory, SubjectBill } from '@/modules/subjects/subject.types';
import { formatMoney } from '@/lib/utils/format';

interface Props {
  bill: SubjectBill;
  accessories: SubjectAccessory[];
  isSaving: boolean;
  onSave: (payload: EditBillInput) => void;
  onCancel: () => void;
}

const PAYMENT_MODE_OPTIONS = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
  { value: 'cheque', label: 'Cheque' },
];

function toPositiveNumber(value: string): number {
  const n = parseFloat(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function BillEditPanel({ bill, accessories, isSaving, onSave, onCancel }: Props) {
  const [visitCharge, setVisitCharge] = useState(String(bill.visit_charge));
  const [serviceCharge, setServiceCharge] = useState(String(bill.service_charge));
  const [paymentMode, setPaymentMode] = useState<string>(bill.payment_mode ?? '');

  // Accessories that will be removed on save (marked locally, not sent yet)
  const [toRemove, setToRemove] = useState<Set<string>>(new Set());
  // New accessories to add on save
  const [toAdd, setToAdd] = useState<AddAccessoryInput[]>([]);
  // New-accessory input row
  const [newItem, setNewItem] = useState({ item_name: '', quantity: '1', mrp: '0', discount_type: 'percentage' as 'percentage' | 'flat', discount_value: '0' });
  const [newItemError, setNewItemError] = useState<string | null>(null);

  const isCustomer = bill.bill_type === 'customer_receipt';

  // Derive live totals for preview
  const existingAccessoriesTotal = accessories
    .filter((a) => !toRemove.has(a.id))
    .reduce((s, a) => s + a.line_total, 0);
  const pendingAccessoriesTotal = toAdd.reduce((s, a) => {
    const mrpVal = a.mrp;
    const discVal = a.discount_value ?? 0;
    const discountedMrp = a.discount_type === 'percentage'
      ? mrpVal - (mrpVal * discVal / 100)
      : Math.max(mrpVal - discVal, 0);
    return s + discountedMrp * a.quantity;
  }, 0);
  const accessoriesTotal = existingAccessoriesTotal + pendingAccessoriesTotal;
  const subtotal = toPositiveNumber(visitCharge) + toPositiveNumber(serviceCharge) + accessoriesTotal;
  const grandTotal = subtotal;

  function handleAddPendingItem() {
    if (!newItem.item_name.trim()) {
      setNewItemError('Item name is required');
      return;
    }
    setToAdd((prev) => [
      ...prev,
      {
        item_name: newItem.item_name.trim(),
        quantity: Math.max(1, Math.floor(toPositiveNumber(newItem.quantity))),
        mrp: toPositiveNumber(newItem.mrp),
        discount_type: newItem.discount_type,
        discount_value: toPositiveNumber(newItem.discount_value),
      },
    ]);
    setNewItem({ item_name: '', quantity: '1', mrp: '0', discount_type: 'percentage', discount_value: '0' });
    setNewItemError(null);
  }

  function handleRemovePending(index: number) {
    setToAdd((prev) => prev.filter((_, i) => i !== index));
  }

  function handleToggleRemoveExisting(id: string) {
    setToRemove((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function handleSave() {
    onSave({
      visit_charge: toPositiveNumber(visitCharge),
      service_charge: toPositiveNumber(serviceCharge),
      apply_gst: true,
      payment_mode: isCustomer && paymentMode ? paymentMode as PaymentMode : null,
      accessories_to_add: toAdd,
      accessories_to_remove: [...toRemove],
    });
  }

  return (
    <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50 p-4">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-semibold text-violet-900">Edit Bill — Super Admin</p>
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          className="rounded-lg p-1 text-slate-500 hover:bg-violet-100 hover:text-slate-700"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Charges */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="text-sm text-slate-700">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Visit Charge</span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={visitCharge}
            onChange={(e) => setVisitCharge(e.target.value)}
            disabled={isSaving}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-violet-400 focus:outline-none"
          />
        </label>
        <label className="text-sm text-slate-700">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Service Charge</span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={serviceCharge}
            onChange={(e) => setServiceCharge(e.target.value)}
            disabled={isSaving}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-violet-400 focus:outline-none"
          />
        </label>
      </div>

      {/* Payment mode — only for customer receipts */}
      {isCustomer && (
        <label className="mt-3 block text-sm text-slate-700">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Payment Mode</span>
          <select
            value={paymentMode}
            onChange={(e) => setPaymentMode(e.target.value)}
            disabled={isSaving}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-violet-400 focus:outline-none"
          >
            <option value="">Keep current / not set</option>
            {PAYMENT_MODE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
      )}

      {/* GST info */}
      <div className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
        GST 18% is always applied. MRP is GST-inclusive.
      </div>

      {/* Accessories */}
      <div className="mt-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Accessories / Parts</p>

        {accessories.length === 0 && toAdd.length === 0 && (
          <p className="rounded-lg border border-dashed border-slate-300 bg-white p-3 text-xs text-slate-500">
            No accessories on this bill yet.
          </p>
        )}

        {/* Existing accessories */}
        {accessories.map((acc) => {
          const markedForRemoval = toRemove.has(acc.id);
          return (
            <div
              key={acc.id}
              className={`mb-2 flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${
                markedForRemoval
                  ? 'border-rose-200 bg-rose-50 line-through opacity-60'
                  : 'border-slate-200 bg-white'
              }`}
            >
              <div>
                <span className="font-medium text-slate-800">{acc.item_name}</span>
                <span className="ml-2 text-xs text-slate-500">
                  {acc.quantity} × ₹{formatMoney(acc.mrp)}
                  {acc.discount_value > 0 && (
                    <> (Disc: {acc.discount_type === 'percentage' ? `${acc.discount_value}%` : `₹${formatMoney(acc.discount_value)}`})</>
                  )}
                  {' '}= ₹{formatMoney(acc.line_total)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleToggleRemoveExisting(acc.id)}
                disabled={isSaving}
                className={`rounded p-1 text-xs ${
                  markedForRemoval
                    ? 'font-semibold text-emerald-700 hover:bg-emerald-100'
                    : 'text-rose-600 hover:bg-rose-100'
                }`}
                title={markedForRemoval ? 'Undo remove' : 'Remove this accessory'}
              >
                {markedForRemoval ? 'Undo' : <Trash2 className="h-3.5 w-3.5" />}
              </button>
            </div>
          );
        })}

        {/* Pending new accessories */}
        {toAdd.map((acc, idx) => (
          <div
            key={idx}
            className="mb-2 flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm"
          >
            <div>
              <span className="font-medium text-slate-800">{acc.item_name}</span>
              <span className="ml-2 text-xs text-slate-500">
                {acc.quantity} × ₹{formatMoney(acc.mrp)}
                {(acc.discount_value ?? 0) > 0 && (
                  <> (Disc: {acc.discount_type === 'percentage' ? `${acc.discount_value}%` : `₹${formatMoney(acc.discount_value ?? 0)}`})</>
                )}
              </span>
              <span className="ml-2 rounded-full bg-emerald-200 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">New</span>
            </div>
            <button
              type="button"
              onClick={() => handleRemovePending(idx)}
              disabled={isSaving}
              className="rounded p-1 text-rose-600 hover:bg-rose-100"
              title="Remove pending accessory"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}

        {/* Add new accessory row */}
        <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
          <p className="mb-2 text-xs font-semibold text-slate-600">Add New Item</p>
          <div className="grid grid-cols-3 gap-2 md:grid-cols-5">
            <input
              type="text"
              placeholder="Item name"
              value={newItem.item_name}
              onChange={(e) => setNewItem((p) => ({ ...p, item_name: e.target.value }))}
              disabled={isSaving}
              className="col-span-3 rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-violet-400 focus:outline-none md:col-span-1"
            />
            <input
              type="number"
              placeholder="Qty"
              min={1}
              step={1}
              value={newItem.quantity}
              onChange={(e) => setNewItem((p) => ({ ...p, quantity: e.target.value }))}
              disabled={isSaving}
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-violet-400 focus:outline-none"
            />
            <input
              type="number"
              placeholder="MRP (incl. GST)"
              min={0}
              step="0.01"
              value={newItem.mrp}
              onChange={(e) => setNewItem((p) => ({ ...p, mrp: e.target.value }))}
              disabled={isSaving}
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-violet-400 focus:outline-none"
            />
            <select
              value={newItem.discount_type}
              onChange={(e) => setNewItem((p) => ({ ...p, discount_type: e.target.value as 'percentage' | 'flat' }))}
              disabled={isSaving}
              className="rounded-lg border border-slate-300 px-1 py-1.5 text-sm focus:border-violet-400 focus:outline-none"
            >
              <option value="percentage">%</option>
              <option value="flat">₹</option>
            </select>
            <input
              type="number"
              placeholder="Disc."
              min={0}
              step="0.01"
              value={newItem.discount_value}
              onChange={(e) => setNewItem((p) => ({ ...p, discount_value: e.target.value }))}
              disabled={isSaving}
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-violet-400 focus:outline-none"
            />
          </div>
          {newItemError && <p className="mt-1 text-xs text-rose-600">{newItemError}</p>}
          <button
            type="button"
            onClick={handleAddPendingItem}
            disabled={isSaving}
            className="mt-2 inline-flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Item
          </button>
        </div>
      </div>

      {/* Live total preview */}
      <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3 text-sm">
        <div className="flex items-center justify-between text-slate-700">
          <span>Accessories Total</span>
          <span>INR {formatMoney(accessoriesTotal)}</span>
        </div>
        <div className="mt-1 flex items-center justify-between text-slate-700">
          <span>Base Amount (excl. GST)</span>
          <span>INR {formatMoney(subtotal / 1.18)}</span>
        </div>
        <div className="mt-1 flex items-center justify-between text-slate-700">
          <span>GST 18%</span>
          <span>INR {formatMoney(subtotal - subtotal / 1.18)}</span>
        </div>
        <div className="mt-1 flex items-center justify-between font-semibold text-slate-900">
          <span>New Grand Total</span>
          <span>INR {formatMoney(grandTotal)}</span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
        >
          {isSaving ? 'Saving…' : 'Save Changes'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
