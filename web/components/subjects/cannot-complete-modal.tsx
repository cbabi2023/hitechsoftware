'use client';

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { INCOMPLETE_REASONS } from '@/modules/subjects/subject.constants';
import type { IncompleteReason, IncompleteJobInput } from '@/modules/subjects/subject.types';

interface CannotCompleteModalProps {
  isOpen: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (data: IncompleteJobInput) => void;
}

export function CannotCompleteModal({ isOpen, isSubmitting, onClose, onSubmit }: CannotCompleteModalProps) {
  const [reason, setReason] = useState<IncompleteReason | ''>('');
  const [note, setNote] = useState('');
  const [spareParts, setSpareParts] = useState<Array<{ name: string; quantity: number; price: number }>>([
    { name: '', quantity: 1, price: 0 },
  ]);
  const [rescheduleDate, setRescheduleDate] = useState('');

  if (!isOpen) return null;

  const isSparePartsReason = reason === 'spare_parts_not_available';
  const isOtherReason = reason === 'other';
  const noteValid = !isOtherReason || note.trim().length >= 10;
  const sparePartsValid = !isSparePartsReason || spareParts.every((part) => part.name.trim().length > 0 && part.quantity > 0 && part.price > 0);
  const canSubmit = reason !== '' && noteValid && sparePartsValid && !isSubmitting;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason) return;
    onSubmit({
      reason,
      note: note || '',
      sparePartsRequested: isSparePartsReason ? spareParts.map((part) => part.name.trim()).join(', ') : undefined,
      sparePartsQuantity: isSparePartsReason ? spareParts.reduce((sum, part) => sum + (part.quantity || 0), 0) : undefined,
      sparePartsItems: isSparePartsReason
        ? spareParts.map((part) => ({
            name: part.name.trim(),
            quantity: part.quantity,
            price: part.price,
          }))
        : undefined,
      rescheduledDate: rescheduleDate || undefined,
    });
  };

  const handleClose = () => {
    setReason('');
    setNote('');
    setSpareParts([{ name: '', quantity: 1, price: 0 }]);
    setRescheduleDate('');
    onClose();
  };

  const updatePart = (index: number, field: 'name' | 'quantity' | 'price', value: string | number) => {
    setSpareParts((prev) => prev.map((part, i) => (i === index ? { ...part, [field]: value } : part)));
  };

  const addPartRow = () => {
    setSpareParts((prev) => [...prev, { name: '', quantity: 1, price: 0 }]);
  };

  const removePartRow = (index: number) => {
    setSpareParts((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900">Cannot Complete Job</h3>
          <button type="button" onClick={handleClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X size={18} />
          </button>
        </div>

        <p className="mb-4 text-sm text-slate-600">
          Describe why you cannot complete this job. This helps the office schedule a follow-up.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Reason *</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as IncompleteReason)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
            >
              <option value="">Select reason…</option>
              {INCOMPLETE_REASONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          {isSparePartsReason && (
            <>
              <div className="space-y-2 rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-slate-700">Spare Parts (name, qty, price) *</label>
                  <button
                    type="button"
                    onClick={addPartRow}
                    className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Add Part
                  </button>
                </div>

                {spareParts.map((part, index) => (
                  <div key={`spare-part-${index}`} className="grid grid-cols-12 gap-2">
                    <input
                      value={part.name}
                      onChange={(e) => updatePart(index, 'name', e.target.value)}
                      placeholder="Part name"
                      className="col-span-6 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                    <input
                      type="number"
                      min="1"
                      value={part.quantity}
                      onChange={(e) => updatePart(index, 'quantity', parseInt(e.target.value) || 1)}
                      className="col-span-2 rounded-lg border border-slate-300 px-2 py-2 text-sm"
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={part.price}
                      onChange={(e) => updatePart(index, 'price', parseFloat(e.target.value) || 0)}
                      className="col-span-3 rounded-lg border border-slate-300 px-2 py-2 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => removePartRow(index)}
                      className="col-span-1 rounded-md border border-slate-300 px-2 text-xs text-slate-600 hover:bg-slate-50"
                      aria-label="Remove part row"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              {isOtherReason ? 'Details * (minimum 10 characters)' : 'Additional Notes (optional)'}
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Describe what happened…"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
            />
            {isOtherReason && (
              <p className={`mt-1 text-xs ${note.trim().length >= 10 ? 'text-emerald-600' : 'text-slate-400'}`}>
                {note.trim().length} / 10 characters minimum
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Reschedule Date (optional)</label>
            <input
              type="date"
              value={rescheduleDate}
              onChange={(e) => setRescheduleDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={handleClose} className="ht-btn ht-btn-secondary">
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
            >
              {isSubmitting ? 'Submitting…' : 'Mark Incomplete'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
