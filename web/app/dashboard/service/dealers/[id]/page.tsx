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

type DealerFinancialSummary = {
  dealer_id: string;
  dealer_name: string;
  total_services: number;
  total_invoiced: number;
  total_due: number;
  total_paid: number;
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

export default function DealerBillingDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const supabase = createClient();

  const dealerQuery = useQuery({
    queryKey: ['dealer-detail', id],
    queryFn: async () => {
      const result = await supabase.from('dealers').select('id,name,is_active').eq('id', id).maybeSingle();
      if (result.error || !result.data) throw new Error(result.error?.message ?? 'Dealer not found');
      return result.data as { id: string; name: string; is_active: boolean };
    },
  });

  const billsQuery = useQuery({
    queryKey: ['dealer-bills', id],
    queryFn: async () => {
      const result = await supabase
        .from('subject_bills')
        .select('id,subject_id,bill_number,grand_total,payment_status,payment_collected_at,generated_at,subjects(subject_number)')
        .eq('dealer_id', id)
        .order('generated_at', { ascending: false });

      if (result.error) throw new Error(result.error.message);
      return (result.data ?? []) as BillRow[];
    },
  });

  const financialSummaryQuery = useQuery({
    queryKey: ['dealer-financial-summary', id],
    queryFn: async () => {
      const result = await supabase
        .from('dealer_financial_summary')
        .select('dealer_id,dealer_name,total_services,total_invoiced,total_due,total_paid')
        .eq('dealer_id', id)
        .maybeSingle();
      if (result.error) throw new Error(result.error.message);
      return result.data as DealerFinancialSummary | null;
    },
  });

  const dueCount = useMemo(() => {
    return (billsQuery.data ?? []).filter((row) => row.payment_status === 'due').length;
  }, [billsQuery.data]);

  const summary = {
    totalBills: Number(financialSummaryQuery.data?.total_services ?? 0),
    total: Number(financialSummaryQuery.data?.total_invoiced ?? 0),
    dueTotal: Number(financialSummaryQuery.data?.total_due ?? 0),
    dueCount,
  };

  if (dealerQuery.isLoading) {
    return (
      <div className="space-y-5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 animate-pulse">
          <div>
            <div className="h-7 w-48 rounded bg-slate-200" />
            <div className="mt-2 h-4 w-32 rounded bg-slate-100" />
          </div>
          <div className="h-10 w-32 rounded-lg bg-slate-200" />
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={`dealer-stat-skeleton-${index}`} className="animate-pulse rounded-xl border border-slate-200 bg-white p-4">
              <div className="h-3 w-20 rounded bg-slate-100" />
              <div className="mt-2 h-5 w-28 rounded bg-slate-200" />
            </div>
          ))}
        </div>

        <div className="animate-pulse rounded-xl border border-slate-200 bg-white">
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
              {Array.from({ length: 5 }).map((_, index) => (
                <tr key={`dealer-bill-skeleton-${index}`} className="animate-pulse">
                  <td className="px-4 py-3">
                    <div className="h-4 w-20 rounded bg-slate-200" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-4 w-24 rounded bg-slate-200" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-4 w-20 rounded bg-slate-200" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-6 w-16 rounded-full bg-slate-200" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-4 w-20 rounded bg-slate-200" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (dealerQuery.error || !dealerQuery.data) {
    return <div className="p-6 text-sm text-rose-700">{dealerQuery.error instanceof Error ? dealerQuery.error.message : 'Unable to load dealer'}</div>;
  }

  return (
    <div className="space-y-5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Dealer Billing Profile</h1>
          <p className="mt-1 text-sm text-slate-600">{dealerQuery.data.name}</p>
        </div>
        <Link href={ROUTES.DASHBOARD_SERVICE_DEALERS} className="ht-btn ht-btn-secondary">Back to Dealers</Link>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Status</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{dealerQuery.data.is_active ? 'Active' : 'Inactive'}</p>
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
            {billsQuery.isLoading
              ? Array.from({ length: 5 }).map((_, index) => (
                  <tr key={`dealer-bill-skeleton-${index}`} className="animate-pulse">
                    <td className="px-4 py-3">
                      <div className="h-4 w-20 rounded bg-slate-200" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-4 w-24 rounded bg-slate-200" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-4 w-20 rounded bg-slate-200" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-6 w-16 rounded-full bg-slate-200" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-4 w-20 rounded bg-slate-200" />
                    </td>
                  </tr>
                ))
              : null}
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
