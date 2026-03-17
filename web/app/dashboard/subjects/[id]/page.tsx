'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { usePermission } from '@/hooks/usePermission';
import { useSubjectDetail } from '@/hooks/useSubjects';
import { ROUTES } from '@/lib/constants/routes';

function formatDate(value: string) {
  return new Date(value).toLocaleString('en-GB');
}

function formatStatus(value: string) {
  return value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDateOnly(value: string | null) {
  if (!value) {
    return '-';
  }

  return new Date(value).toLocaleDateString('en-GB');
}

export default function SubjectDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { can } = usePermission();

  const query = useSubjectDetail(id);

  if (query.isLoading) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">Loading subject...</div>
      </div>
    );
  }

  if (!query.data?.ok) {
    const message = query.data && !query.data.ok ? query.data.error.message : 'Failed to load subject';

    return (
      <div className="p-6">
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">{message}</div>
      </div>
    );
  }

  const subject = query.data.data;

  const coverageMeta = subject.is_amc_service
    ? { label: 'Free Service - Under AMC', className: 'bg-emerald-100 text-emerald-700' }
    : subject.is_warranty_service
      ? { label: 'Under Warranty', className: 'bg-blue-100 text-blue-700' }
      : { label: 'Out of Warranty', className: 'bg-slate-100 text-slate-700' };

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Subject {subject.subject_number}</h1>
          <p className="mt-1 text-sm text-slate-600">Easy service summary with billing and warranty clarity.</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${coverageMeta.className}`}>
              {coverageMeta.label}
            </span>
            <span className="inline-flex items-center rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-700">
              {formatStatus(subject.status)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {can('subject:edit') && !subject.assigned_technician_id ? (
            <Link
              href={ROUTES.DASHBOARD_SUBJECTS_EDIT(subject.id)}
              className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              Quick Assign
            </Link>
          ) : null}
          {can('subject:edit') ? (
            <Link href={ROUTES.DASHBOARD_SUBJECTS_EDIT(subject.id)} className="ht-btn ht-btn-primary">
              Edit subject
            </Link>
          ) : null}
          <Link href={ROUTES.DASHBOARD_SUBJECTS} className="ht-btn ht-btn-secondary">
            Back to list
          </Link>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Charge To</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{subject.service_charge_type === 'brand_dealer' ? 'Brand / Dealer' : 'Customer'}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Billing Status</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{formatStatus(subject.billing_status)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Assigned Technician</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">
            {subject.assigned_technician_name ? `${subject.assigned_technician_name} (${subject.assigned_technician_code})` : 'Unassigned'}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Allocated Date</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{formatDateOnly(subject.allocated_date)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <section className="rounded-xl border border-slate-200 bg-white p-5 xl:col-span-2">
          <h2 className="mb-4 text-base font-semibold text-slate-900">Service Information</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <p className="text-sm text-slate-700"><span className="font-medium text-slate-900">Source:</span> {subject.source_name}</p>
            <p className="text-sm text-slate-700"><span className="font-medium text-slate-900">Source Type:</span> {subject.source_type}</p>
            <p className="text-sm text-slate-700"><span className="font-medium text-slate-900">Category:</span> {subject.category_name ?? '-'}</p>
            <p className="text-sm text-slate-700"><span className="font-medium text-slate-900">Type:</span> {subject.type_of_service}</p>
            <p className="text-sm text-slate-700"><span className="font-medium text-slate-900">Priority:</span> {subject.priority}</p>
            <p className="text-sm text-slate-700"><span className="font-medium text-slate-900">Phone:</span> {subject.customer_phone ?? '-'}</p>
            <p className="text-sm text-slate-700 md:col-span-2"><span className="font-medium text-slate-900">Customer Name:</span> {subject.customer_name ?? '-'}</p>
            <p className="text-sm text-slate-700 md:col-span-2"><span className="font-medium text-slate-900">Customer Address:</span> {subject.customer_address ?? '-'}</p>
            <p className="text-sm text-slate-700 md:col-span-2"><span className="font-medium text-slate-900">Priority Reason:</span> {subject.priority_reason}</p>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 text-base font-semibold text-slate-900">Coverage Dates</h2>
          <div className="space-y-2">
            <p className="text-sm text-slate-700"><span className="font-medium text-slate-900">Purchase Date:</span> {formatDateOnly(subject.purchase_date)}</p>
            <p className="text-sm text-slate-700"><span className="font-medium text-slate-900">Warranty End Date:</span> {formatDateOnly(subject.warranty_end_date)}</p>
            <p className="text-sm text-slate-700"><span className="font-medium text-slate-900">AMC End Date:</span> {formatDateOnly(subject.amc_end_date)}</p>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 xl:col-span-2">
          <h2 className="mb-4 text-base font-semibold text-slate-900">Product Information</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <p className="text-sm text-slate-700"><span className="font-medium text-slate-900">Product Name:</span> {subject.product_name ?? '-'}</p>
            <p className="text-sm text-slate-700"><span className="font-medium text-slate-900">Serial Number:</span> {subject.serial_number ?? '-'}</p>
            <p className="text-sm text-slate-700 md:col-span-2"><span className="font-medium text-slate-900">Product Description:</span> {subject.product_description ?? '-'}</p>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 text-base font-semibold text-slate-900">Timeline</h2>
          {subject.timeline.length === 0 ? (
            <p className="text-sm text-slate-500">No status history available.</p>
          ) : (
            <div className="space-y-3">
              {subject.timeline.map((item) => (
                <div key={item.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <p className="text-sm font-medium text-slate-900">{formatStatus(item.status)}</p>
                  <p className="text-xs text-slate-500">{formatDate(item.changed_at)}</p>
                  {item.note ? <p className="mt-1 text-xs text-slate-600">{item.note}</p> : null}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
