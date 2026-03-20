'use client';

import type { SubjectBill } from '@/modules/subjects/subject.types';

interface Props {
  bill: SubjectBill;
  canUpdatePayment: boolean;
  onUpdatePaymentStatus: (status: 'paid' | 'due' | 'waived') => void;
  isUpdatingPayment: boolean;
  onDownload: () => void;
  highlightCustomerPayment?: boolean;
}

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
}: Props) {
  const showCustomerPaymentActions = canUpdatePayment && bill.bill_type === 'customer_receipt';

  const paymentClass = bill.payment_status === 'paid'
    ? 'bg-emerald-100 text-emerald-700'
    : bill.payment_status === 'waived'
      ? 'bg-slate-200 text-slate-700'
      : 'bg-amber-100 text-amber-700';

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
        </div>
      )}

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

        {showCustomerPaymentActions && (
          <>
            <button
              type="button"
              disabled={isUpdatingPayment}
              onClick={() => onUpdatePaymentStatus('paid')}
              className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
            >
              Mark Paid
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
