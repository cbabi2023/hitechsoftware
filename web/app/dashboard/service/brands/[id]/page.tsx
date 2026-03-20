'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { ROUTES } from '@/lib/constants/routes';

type BillRow = {
  id: string;
  subject_id: string;
  bill_number: string;
  grand_total: number;
  payment_status: 'paid' | 'due' | 'waived';
  payment_collected_at: string | null;
  generated_at: string;
  subjects: { subject_number: string } | { subject_number: string }[] | null;
};

function formatMoney(value: number) {
  return value.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function subjectNumberFromRelation(value: BillRow['subjects']) {
  if (!value) return '-';
  if (Array.isArray(value)) return value[0]?.subject_number ?? '-';
  return value.subject_number ?? '-';
}

export default function BrandBillingDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const supabase = createClient();

  const brandQuery = useQuery({
    queryKey: ['brand-detail', id],
    queryFn: async () => {
      const result = await supabase.from('brands').select('id,name,is_active').eq('id', id).maybeSingle();
      if (result.error || !result.data) throw new Error(result.error?.message ?? 'Brand not found');
      return result.data as { id: string; name: string; is_active: boolean };
    },
  });

  const billsQuery = useQuery({
    queryKey: ['brand-bills', id],
    queryFn: async () => {
      const result = await supabase
        .from('subject_bills')
        .select('id,subject_id,bill_number,grand_total,payment_status,payment_collected_at,generated_at,subjects(subject_number)')
        .eq('brand_id', id)
        .order('generated_at', { ascending: false });

      if (result.error) throw new Error(result.error.message);
      return (result.data ?? []) as BillRow[];
    },
  });

  const summary = useMemo(() => {
    const rows = billsQuery.data ?? [];
    const total = rows.reduce((sum, row) => sum + Number(row.grand_total || 0), 0);
    const dueRows = rows.filter((row) => row.payment_status === 'due');
    const dueTotal = dueRows.reduce((sum, row) => sum + Number(row.grand_total || 0), 0);
    return {
      totalBills: rows.length,
      dueCount: dueRows.length,
      total,
      dueTotal,
    };
  }, [billsQuery.data]);

  if (brandQuery.isLoading) {
    return <div className="p-6 text-sm text-slate-500">Loading brand billing profile...</div>;
  }

  if (brandQuery.error || !brandQuery.data) {
    return <div className="p-6 text-sm text-rose-700">{brandQuery.error instanceof Error ? brandQuery.error.message : 'Unable to load brand'}</div>;
  }

  return (
    <div className="space-y-5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Brand Billing Profile</h1>
          <p className="mt-1 text-sm text-slate-600">{brandQuery.data.name}</p>
        </div>
        <Link href={ROUTES.DASHBOARD_SERVICE_BRANDS} className="ht-btn ht-btn-secondary">Back to Brands</Link>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Status</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{brandQuery.data.is_active ? 'Active' : 'Inactive'}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Total Bills</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{summary.totalBills}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Total Billed</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">INR {formatMoney(summary.total)}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs uppercase tracking-wide text-amber-700">Due</p>
          <p className="mt-1 text-sm font-semibold text-amber-800">{summary.dueCount} / INR {formatMoney(summary.dueTotal)}</p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Bill</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Subject</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Amount</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {billsQuery.isLoading ? <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">Loading invoices...</td></tr> : null}
            {billsQuery.error ? <tr><td colSpan={5} className="px-4 py-6 text-center text-rose-600">{billsQuery.error instanceof Error ? billsQuery.error.message : 'Failed to load invoices'}</td></tr> : null}
            {!billsQuery.isLoading && !billsQuery.error && (billsQuery.data ?? []).length === 0 ? <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">No invoices found.</td></tr> : null}
            {(billsQuery.data ?? []).map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-3 font-medium text-slate-900">{row.bill_number}</td>
                <td className="px-4 py-3">
                  <Link href={ROUTES.DASHBOARD_SUBJECTS_DETAIL(row.subject_id)} className="text-blue-700 hover:text-blue-800 hover:underline">
                    {subjectNumberFromRelation(row.subjects)}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-700">INR {formatMoney(row.grand_total)}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${row.payment_status === 'paid' ? 'bg-emerald-100 text-emerald-700' : row.payment_status === 'waived' ? 'bg-slate-200 text-slate-700' : 'bg-amber-100 text-amber-700'}`}>
                    {row.payment_status.toUpperCase()}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">{new Date(row.generated_at).toLocaleDateString('en-GB')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
