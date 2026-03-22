'use client';

import { useMemo, useState } from 'react';
import type { SubjectBill } from '@/modules/subjects/subject.types';

const RENDER_REFERENCE_TS = Date.now();

interface Props {
  bill: SubjectBill;
  canUpdatePayment: boolean;
  onUpdatePaymentStatus: (status: 'paid' | 'due' | 'waived', paymentMode?: 'cash' | 'upi' | 'card' | 'cheque') => void;
  isUpdatingPayment: boolean;
  onDownload: () => void;
  highlightCustomerPayment?: boolean;
  canEditBill?: boolean;
  onEditBill?: () => void;
}

const PAYMENT_MODE_OPTIONS: Array<{ value: 'cash' | 'upi' | 'card' | 'cheque'; label: string }> = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
  { value: 'cheque', label: 'Cheque' },
];

function formatMoney(value: number) {
  return value.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatPaymentStatus(status: string) {
  return status.replaceAll('_', ' ').replace(/\b\w/g, (ch) => ch.toUpperCase());
}

export function BillCard({
  bill,
  canUpdatePayment,
  onUpdatePaymentStatus,
  isUpdatingPayment,
  onDownload,
  highlightCustomerPayment = false,
  canEditBill = false,
  onEditBill,
}: Props) {
  const showCustomerPaymentActions = canUpdatePayment && bill.bill_type === 'customer_receipt';
  const [selectedPaymentMode, setSelectedPaymentMode] = useState<'cash' | 'upi' | 'card' | 'cheque'>(bill.payment_mode ?? 'cash');

  const paymentClass = bill.payment_status === 'paid'
    ? 'bg-emerald-100 text-emerald-700'
    : bill.payment_status === 'waived'
      ? 'bg-slate-200 text-slate-700'
      : 'bg-amber-100 text-amber-700';

  const dueDays = useMemo(() => {
    if (bill.payment_status !== 'due') {
      return null;
    }

    const generatedAt = new Date(bill.generated_at).getTime();
    const now = RENDER_REFERENCE_TS;

    if (Number.isNaN(generatedAt) || now < generatedAt) {
      return 0;
    }

    return Math.floor((now - generatedAt) / (1000 * 60 * 60 * 24));
  }, [bill.generated_at, bill.payment_status]);

  return (
    <div className={`rounded-xl border p-4 ${highlightCustomerPayment ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white'}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{bill.bill_number}</p>
          <p className="text-xs text-slate-500">{new Date(bill.generated_at).toLocaleString('en-GB')}</p>
        </div>
        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${paymentClass}`}>
          {formatPaymentStatus(bill.payment_status)}
        </span>
      </div>

      {showCustomerPaymentActions && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-100 px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">Record Payment From Customer</p>
          <p className="mt-0.5 text-xs text-amber-800">This is a customer-chargeable bill. Update payment status after collecting amount from customer.</p>
          {bill.payment_status === 'due' && dueDays !== null ? (
            <p className="mt-1 text-xs font-semibold text-amber-900">
              Due pending for {dueDays} day{dueDays === 1 ? '' : 's'} since bill generation.
            </p>
          ) : null}
        </div>
      )}

      {bill.payment_collected_at ? (
        <p className="mt-3 text-xs text-slate-600">
          Collected At: {new Date(bill.payment_collected_at).toLocaleString('en-GB')}
          {bill.payment_mode ? ` (${bill.payment_mode.toUpperCase()})` : ''}
        </p>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Visit Charge</p>
          <p className="font-semibold text-slate-900">INR {formatMoney(bill.visit_charge)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Service Charge</p>
          <p className="font-semibold text-slate-900">INR {formatMoney(bill.service_charge)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Accessories</p>
          <p className="font-semibold text-slate-900">INR {formatMoney(bill.accessories_total)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Grand Total</p>
          <p className="font-semibold text-slate-900">INR {formatMoney(bill.grand_total)}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onDownload}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
        >
          Download PDF
        </button>

        {canEditBill && onEditBill && (
          <button
            type="button"
            onClick={onEditBill}
            className="rounded-lg border border-violet-300 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-100"
          >
            Edit Bill
          </button>
        )}

        {showCustomerPaymentActions && (
          <>
            <select
              value={selectedPaymentMode}
              disabled={isUpdatingPayment}
              onChange={(event) => setSelectedPaymentMode(event.target.value as 'cash' | 'upi' | 'card' | 'cheque')}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 focus:border-blue-500 focus:outline-none"
            >
              {PAYMENT_MODE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={isUpdatingPayment}
              onClick={() => onUpdatePaymentStatus('paid', selectedPaymentMode)}
              className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
            >
              Collect and Mark Paid
            </button>
            <button
              type="button"
              disabled={isUpdatingPayment}
              onClick={() => onUpdatePaymentStatus('due')}
              className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-60"
            >
              Mark Due
            </button>
            <button
              type="button"
              disabled={isUpdatingPayment}
              onClick={() => onUpdatePaymentStatus('waived')}
              className="rounded-lg border border-slate-300 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-60"
            >
              Mark Waived
            </button>
          </>
        )}
      </div>
    </div>
  );
}
