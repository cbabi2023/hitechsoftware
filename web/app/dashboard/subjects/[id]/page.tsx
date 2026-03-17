'use client';
import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { DeleteConfirmModal } from '@/components/customers/DeleteConfirmModal';
import { ProtectedComponent } from '@/components/ui/ProtectedComponent';
import { AssignTechnicianForm } from '@/components/assignment/AssignTechnicianForm';
import { WarrantyAndContractsSection } from '@/components/warranty/WarrantyAndContractsSection';
import { SubjectInfoCard } from '@/components/subjects/SubjectInfoCard';
import { ProductInfoCard } from '@/components/subjects/ProductInfoCard';
import { ActivityTimeline } from '@/components/subjects/ActivityTimeline';
import { AttendanceGuard } from '@/components/attendance/AttendanceGuard';
import { useContractsBySubject } from '@/hooks/contracts/useContracts';
import { useSubjectDetail } from '@/hooks/subjects/useSubjects';
import { useAuth } from '@/hooks/auth/useAuth';
import { ROUTES } from '@/lib/constants/routes';
import { SUBJECT_QUERY_KEYS } from '@/modules/subjects/subject.constants';
import { removeSubject } from '@/modules/subjects/subject.service';

async function respondToSubjectApi(subjectId: string, action: 'accept' | 'reject', rejectionReason?: string) {
  const response = await fetch(`/api/subjects/${subjectId}/respond`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, rejection_reason: rejectionReason }),
  });
  return response.json() as Promise<{ ok: boolean; error?: { message: string } }>;
}

function formatDate(value: string) {
  return value;
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
  const router = useRouter();
  const queryClient = useQueryClient();
  const { userRole } = useAuth();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const query = useSubjectDetail(id);
  const contractsQuery = useContractsBySubject(id);

  const deleteSubjectMutation = useMutation({
    mutationFn: (subjectId: string) => removeSubject(subjectId),
    onSuccess: (result) => {
      if (result.ok) {
        toast.success('Subject deleted successfully');
        queryClient.invalidateQueries({ queryKey: SUBJECT_QUERY_KEYS.all });
        router.push(ROUTES.DASHBOARD_SUBJECTS);
      } else {
        toast.error(result.error.message);
      }
    },
    onError: () => {
      toast.error('Failed to delete subject');
    },
  });

  const respondMutation = useMutation({
    mutationFn: ({ action, reason }: { action: 'accept' | 'reject'; reason?: string }) =>
      respondToSubjectApi(id, action, reason),
    onSuccess: (result, variables) => {
      if (result.ok) {
        toast.success(variables.action === 'accept' ? 'Service accepted successfully' : 'Service rejected');
        queryClient.invalidateQueries({ queryKey: SUBJECT_QUERY_KEYS.all });
        queryClient.invalidateQueries({ queryKey: SUBJECT_QUERY_KEYS.detail(id) });
        setShowRejectModal(false);
        setRejectionReason('');
      } else {
        toast.error(result.error?.message ?? 'Failed to respond');
      }
    },
    onError: () => {
      toast.error('Failed to respond to service');
    },
  });

  const subject = query.data?.ok ? query.data.data : null;
  const contracts = contractsQuery.data?.ok ? contractsQuery.data.data : [];

  const today = new Date().toISOString().split('T')[0];
  const isWarrantyActive = Boolean(subject?.warranty_end_date && subject.warranty_end_date >= today);
  const hasActiveContract = useMemo(
    () => contracts.some((c) => c.start_date <= today && c.end_date >= today),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [contracts],
  );

  const billingTypeMeta = isWarrantyActive
    ? { label: 'Under Warranty', className: 'bg-emerald-100 text-emerald-700', chargeTarget: 'Brand / Dealer' }
    : hasActiveContract
      ? { label: 'Active AMC Contract', className: 'bg-blue-100 text-blue-700', chargeTarget: 'Brand / Dealer' }
      : { label: 'Chargeable', className: 'bg-slate-100 text-slate-700', chargeTarget: 'Customer' };

  if (query.isLoading) {
    return <div className="space-y-4 p-6"><div className="animate-pulse rounded-xl border border-slate-200 bg-white p-5"><div className="h-7 w-56 rounded bg-slate-200" /><div className="mt-2 h-4 w-80 rounded bg-slate-100" /></div></div>;
  }

  if (!query.data?.ok || !subject) {
    const message = query.data && !query.data.ok ? query.data.error.message : 'Failed to load subject';
    return <div className="p-6"><div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">{message}</div></div>;
  }

  if (userRole === 'technician') {
    const todayDate = new Date().toISOString().split('T')[0];
    const effectiveServiceDate = subject.technician_allocated_date ?? subject.allocated_date;

    if (effectiveServiceDate !== todayDate) {
      return (
        <div className="p-6">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
            Only current day allocated service details are visible to technicians.
          </div>
        </div>
      );
    }
  }

  return (
    <AttendanceGuard>
      <div className="p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Subject {subject.subject_number}</h1>
          <p className="mt-1 text-sm text-slate-600">Easy service summary with billing and warranty clarity.</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${billingTypeMeta.className}`}>{billingTypeMeta.label}</span>
            <span className="inline-flex items-center rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-700">{formatStatus(subject.status)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ProtectedComponent permission="subject:update">
            <Link href={ROUTES.DASHBOARD_SUBJECTS_EDIT(subject.id)} className="ht-btn ht-btn-primary">Edit</Link>
          </ProtectedComponent>
          <ProtectedComponent permission="subject:delete">
            <button type="button" onClick={() => setShowDeleteModal(true)} className="ht-btn ht-btn-danger">Delete</button>
          </ProtectedComponent>
          <Link href={ROUTES.DASHBOARD_SUBJECTS} className="ht-btn ht-btn-secondary">Back to list</Link>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Charge To</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{billingTypeMeta.chargeTarget}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Billing Status</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{formatStatus(subject.billing_status)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Source Date</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{formatDateOnly(subject.allocated_date)}</p>
          <p className="mt-0.5 text-xs text-slate-400">Brand / Dealer allocated date</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Tech Visit Date</p>
          {subject.technician_allocated_date ? (
            <p className="mt-1 text-sm font-semibold text-blue-700">{formatDateOnly(subject.technician_allocated_date)}</p>
          ) : (
            <p className="mt-1 text-sm text-slate-400 italic">Not scheduled</p>
          )}
        </div>
      </div>

      <AssignTechnicianForm subject={subject} userRole={userRole} />

      {/* Urgent reschedule warning — visible to admin/staff when technician has rejected */}
      {userRole !== 'technician' && subject.is_rejected_pending_reschedule && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-rose-300 bg-rose-50 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
          <div>
            <p className="text-sm font-semibold text-rose-800">Reschedule Urgently — Technician Rejected</p>
            {subject.rejected_by_technician_name && (
              <p className="mt-1 text-sm text-rose-700">
                Rejected by: <span className="font-semibold">{subject.rejected_by_technician_name}</span>
              </p>
            )}
            {subject.technician_rejection_reason && (
              <p className="mt-1 text-sm text-rose-700">
                Reason: <span className="italic">{subject.technician_rejection_reason}</span>
              </p>
            )}
            <p className="mt-1 text-xs text-rose-500">Please reassign or reschedule this service as soon as possible.</p>
          </div>
        </div>
      )}

      {/* Technician accept / reject panel */}
      {userRole === 'technician' && subject.status === 'ALLOCATED' && subject.technician_acceptance_status === 'pending' && (
        <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-5">
          <p className="text-sm font-semibold text-blue-900">This service is allocated to you. Do you accept?</p>
          <p className="mt-1 text-xs text-blue-600">Once you accept, the status will change to Accepted and your work can begin. If you cannot attend, reject with a reason so the admin can reschedule.</p>
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              disabled={respondMutation.isPending}
              onClick={() => respondMutation.mutate({ action: 'accept' })}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              <CheckCircle2 className="h-4 w-4" />
              {respondMutation.isPending && respondMutation.variables?.action === 'accept' ? 'Accepting...' : 'Accept Service'}
            </button>
            <button
              type="button"
              disabled={respondMutation.isPending}
              onClick={() => setShowRejectModal(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
            >
              <XCircle className="h-4 w-4" />
              Reject Service
            </button>
          </div>
        </div>
      )}

      {/* Technician: show accepted badge */}
      {userRole === 'technician' && subject.technician_acceptance_status === 'accepted' && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          <p className="text-sm font-semibold text-emerald-800">You have accepted this service.</p>
        </div>
      )}

      {/* Technician: show rejected badge */}
      {userRole === 'technician' && subject.technician_acceptance_status === 'rejected' && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4">
          <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
          <div>
            <p className="text-sm font-semibold text-rose-800">You rejected this service.</p>
            {subject.technician_rejection_reason && (
              <p className="mt-0.5 text-sm text-rose-700">Reason: <span className="italic">{subject.technician_rejection_reason}</span></p>
            )}
          </div>
        </div>
      )}

      <WarrantyAndContractsSection subject={subject} userRole={userRole} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <SubjectInfoCard subject={subject} />
        <ProductInfoCard subject={subject} />
        <ActivityTimeline timeline={subject.timeline} />
      </div>

      <DeleteConfirmModal
        isOpen={showDeleteModal}
        title="Delete subject"
        description={`Delete ${subject.subject_number}? This action permanently removes the subject.`}
        confirmLabel="Delete permanently"
        isSubmitting={deleteSubjectMutation.isPending}
        onCancel={() => setShowDeleteModal(false)}
        onConfirm={() => {
          setShowDeleteModal(false);
          deleteSubjectMutation.mutate(subject.id);
        }}
      />

      {/* Reject reason modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">Reject Service</h3>
            <p className="mt-1 text-sm text-slate-600">Please provide a reason so the admin can reschedule appropriately.</p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={4}
              placeholder="e.g. Customer not reachable, address not found, personal emergency…"
              className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
            />
            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => { setShowRejectModal(false); setRejectionReason(''); }}
                className="ht-btn ht-btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={rejectionReason.trim().length === 0 || respondMutation.isPending}
                onClick={() => respondMutation.mutate({ action: 'reject', reason: rejectionReason })}
                className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
              >
                {respondMutation.isPending ? 'Submitting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </AttendanceGuard>
  );
}
