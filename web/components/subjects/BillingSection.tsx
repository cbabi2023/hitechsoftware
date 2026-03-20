'use client';

import { useMemo, useState } from 'react';
import type { PaymentMode, SubjectDetail } from '@/modules/subjects/subject.types';
import { PAYMENT_MODES } from '@/modules/subjects/subject.constants';
import {
  useDownloadBill,
  useGenerateBill,
  useSubjectAccessories,
  useSubjectBill,
  useUpdateBillPaymentStatus,
} from '@/hooks/subjects/useBilling';
import { BillCard } from '@/components/subjects/BillCard';

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

export function BillingSection({ subject, userRole, userId }: Props) {
  const accessoriesQuery = useSubjectAccessories(subject.id);
  const billQuery = useSubjectBill(subject.id);
  const generateMutation = useGenerateBill(subject.id);
  const updatePaymentMutation = useUpdateBillPaymentStatus(subject.id);
  const downloadBill = useDownloadBill();

  const [visitCharge, setVisitCharge] = useState(subject.visit_charge ?? 0);
  const [serviceCharge, setServiceCharge] = useState(subject.service_charge ?? 0);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('cash');

  const isOutOfWarranty = !subject.is_warranty_service && !subject.is_amc_service;
  const isAssignedTechnician = userRole === 'technician' && userId === subject.assigned_technician_id;
  const canGenerate = isAssignedTechnician && subject.status === 'IN_PROGRESS' && !subject.bill_generated;
  const canUpdatePayment = userRole === 'office_staff' || userRole === 'super_admin';

  const accessories = accessoriesQuery.data?.items ?? [];
  const accessoriesTotal = accessoriesQuery.data?.total ?? 0;

  const grandTotal = useMemo(() => {
    return Number(visitCharge || 0) + Number(serviceCharge || 0) + Number(accessoriesTotal || 0);
  }, [visitCharge, serviceCharge, accessoriesTotal]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Billing</h3>
        <p className="mt-1 text-xs text-slate-500">Generate exactly one bill after job completion evidence is ready.</p>
      </div>

      {billQuery.data ? (
        <BillCard
          bill={billQuery.data}
          canUpdatePayment={canUpdatePayment}
          onUpdatePaymentStatus={(status) => {
            const billId = billQuery.data?.id;
            if (!billId) return;
            updatePaymentMutation.mutate({ billId, paymentStatus: status });
          }}
          isUpdatingPayment={updatePaymentMutation.isPending}
          onDownload={() => {
            const billId = billQuery.data?.id;
            if (!billId) return;
            downloadBill(billId);
          }}
        />
      ) : null}

      {!billQuery.isLoading && !billQuery.data && canGenerate && (
        <div className="space-y-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm font-semibold text-blue-900">Generate Final Bill</p>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="text-sm text-slate-700">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Visit Charge</span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={visitCharge}
                onChange={(event) => setVisitCharge(Math.max(0, Number(event.target.value || 0)))}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
              />
            </label>

            <label className="text-sm text-slate-700">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Service Charge</span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={serviceCharge}
                onChange={(event) => setServiceCharge(Math.max(0, Number(event.target.value || 0)))}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
              />
            </label>

            {isOutOfWarranty ? (
              <label className="text-sm text-slate-700">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Payment Mode</span>
                <select
                  value={paymentMode}
                  onChange={(event) => setPaymentMode(event.target.value as PaymentMode)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                >
                  {PAYMENT_MODES.map((mode) => (
                    <option key={mode.value} value={mode.value}>{mode.label}</option>
                  ))}
                </select>
              </label>
            ) : (
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                Payment will be marked as Due for Brand / Dealer billing.
              </div>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
            <div className="flex items-center justify-between text-slate-700">
              <span>Accessories Total</span>
              <span>INR {formatMoney(accessoriesTotal)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between font-semibold text-slate-900">
              <span>Grand Total</span>
              <span>INR {formatMoney(grandTotal)}</span>
            </div>
          </div>

          <button
            type="button"
            disabled={generateMutation.isPending}
            onClick={() => generateMutation.mutate({
              visit_charge: visitCharge,
              service_charge: serviceCharge,
              payment_mode: isOutOfWarranty ? paymentMode : undefined,
              accessories: accessories.map((item) => ({
                item_name: item.item_name,
                quantity: item.quantity,
                unit_price: item.unit_price,
              })),
            })}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {generateMutation.isPending ? 'Generating Bill & Completing Job...' : 'Generate Bill & Complete Job'}
          </button>
        </div>
      )}

      {!billQuery.isLoading && !billQuery.data && !canGenerate && (
        <p className="text-sm text-slate-500">
          {subject.bill_generated
            ? 'Bill has been generated for this subject.'
            : 'Billing becomes available when assigned technician reaches In Progress status.'}
        </p>
      )}
    </div>
  );
}
