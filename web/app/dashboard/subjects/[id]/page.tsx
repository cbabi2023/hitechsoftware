'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Activity, Calendar, Flag, Plus, UserCheck, UserMinus, UserPlus } from 'lucide-react';
import { DeleteConfirmModal } from '@/components/customers/DeleteConfirmModal';
import { ProtectedComponent } from '@/components/ui/ProtectedComponent';
import { useContractsBySubject, useCreateContract, useDeleteContract } from '@/hooks/useContracts';
import { useAssignableTechnicians, useAssignTechnician, useSaveSubjectWarranty, useSubjectDetail } from '@/hooks/useSubjects';
import { useAuth } from '@/hooks/useAuth';
import { ROUTES } from '@/lib/constants/routes';
import { SUBJECT_QUERY_KEYS, WARRANTY_PERIODS } from '@/modules/subjects/subject.constants';
import { removeSubject } from '@/modules/subjects/subject.service';
import type { SubjectContract, SubjectTimelineItem, WarrantyPeriod } from '@/modules/subjects/subject.types';

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

function toIsoDate(value: string) {
  return new Date(value).toISOString().split('T')[0];
}

function addMonths(dateText: string, months: number) {
  const date = new Date(dateText);
  date.setMonth(date.getMonth() + months);
  return toIsoDate(date.toISOString());
}

function getWarrantyPeriodFromMonths(months: number | null): WarrantyPeriod {
  const match = WARRANTY_PERIODS.find((item) => item.months === months);
  return (match?.value as WarrantyPeriod | undefined) ?? 'custom';
}

function getContractVisualStatus(contract: SubjectContract): 'active' | 'upcoming' | 'expired' {
  const today = new Date().toISOString().split('T')[0];

  if (contract.start_date > today) {
    return 'upcoming';
  }

  if (contract.end_date < today) {
    return 'expired';
  }

  return 'active';
}

const EVENT_META: Record<string, { label: string; icon: React.ReactNode; iconBg: string; iconColor: string; borderColor: string }> = {
  status_change: {
    label: 'Status Change',
    icon: <Activity className="h-3.5 w-3.5" />,
    iconBg: 'bg-violet-100',
    iconColor: 'text-violet-600',
    borderColor: 'border-violet-100',
  },
  assignment: {
    label: 'Technician Assigned',
    icon: <UserPlus className="h-3.5 w-3.5" />,
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
    borderColor: 'border-emerald-100',
  },
  reassignment: {
    label: 'Technician Reassigned',
    icon: <UserCheck className="h-3.5 w-3.5" />,
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    borderColor: 'border-amber-100',
  },
  unassignment: {
    label: 'Technician Removed',
    icon: <UserMinus className="h-3.5 w-3.5" />,
    iconBg: 'bg-rose-100',
    iconColor: 'text-rose-600',
    borderColor: 'border-rose-100',
  },
  reschedule: {
    label: 'Rescheduled',
    icon: <Calendar className="h-3.5 w-3.5" />,
    iconBg: 'bg-sky-100',
    iconColor: 'text-sky-600',
    borderColor: 'border-sky-100',
  },
  priority_change: {
    label: 'Priority Changed',
    icon: <Flag className="h-3.5 w-3.5" />,
    iconBg: 'bg-orange-100',
    iconColor: 'text-orange-600',
    borderColor: 'border-orange-100',
  },
};

function TimelineEventDetail({ item }: { item: SubjectTimelineItem }) {
  const meta = EVENT_META[item.event_type] ?? EVENT_META.status_change;

  const renderContent = () => {
    switch (item.event_type) {
      case 'status_change':
        return (
          <p className="mt-0.5 text-[13px] text-slate-700">
            {item.old_value ? (
              <><span className="rounded bg-slate-200 px-1.5 py-0.5 font-medium text-slate-600">{formatStatus(item.old_value)}</span>
              <span className="mx-1.5 text-slate-400">&rarr;</span></>
            ) : null}
            <span className="rounded bg-violet-100 px-1.5 py-0.5 font-medium text-violet-700">{formatStatus(item.new_value ?? item.status)}</span>
          </p>
        );
      case 'assignment':
        return (
          <p className="mt-0.5 text-[13px] text-slate-700">
            Assigned to <span className="font-medium text-slate-900">{item.new_value ?? '-'}</span>
          </p>
        );
      case 'reassignment':
        return (
          <p className="mt-0.5 text-[13px] text-slate-700">
            <span className="font-medium text-slate-500">{item.old_value ?? '-'}</span>
            <span className="mx-1.5 text-slate-400">&rarr;</span>
            <span className="font-medium text-slate-900">{item.new_value ?? '-'}</span>
          </p>
        );
      case 'unassignment':
        return (
          <p className="mt-0.5 text-[13px] text-rose-700">
            Removed <span className="font-medium">{item.old_value ?? '-'}</span>
          </p>
        );
      case 'reschedule':
        return (
          <p className="mt-0.5 text-[13px] text-slate-700">
            {item.old_value ? (
              <><span className="rounded bg-slate-200 px-1.5 py-0.5 font-medium text-slate-600">{formatDateOnly(item.old_value)}</span>
              <span className="mx-1.5 text-slate-400">&rarr;</span></>
            ) : null}
            <span className="rounded bg-sky-100 px-1.5 py-0.5 font-medium text-sky-700">{formatDateOnly(item.new_value)}</span>
          </p>
        );
      case 'priority_change':
        return (
          <p className="mt-0.5 text-[13px] text-slate-700">
            {item.old_value ? (
              <><span className="rounded bg-slate-200 px-1.5 py-0.5 font-medium capitalize text-slate-600">{item.old_value}</span>
              <span className="mx-1.5 text-slate-400">&rarr;</span></>
            ) : null}
            <span className="rounded bg-orange-100 px-1.5 py-0.5 font-medium capitalize text-orange-700">{item.new_value ?? item.status}</span>
          </p>
        );
      default:
        return null;
    }
  };

  return (
    <div className={`flex gap-3 rounded-lg border ${meta.borderColor} bg-white p-3`}>
      <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${meta.iconBg} ${meta.iconColor}`}>
        {meta.icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-1">
          <span className="text-[13px] font-semibold text-slate-800">{meta.label}</span>
          <span className="text-[11px] text-slate-400">{formatDate(item.changed_at)}</span>
        </div>
        {renderContent()}
        {item.note ? <p className="mt-1 text-[12px] italic text-slate-500">{item.note}</p> : null}
      </div>
    </div>
  );
}

export default function SubjectDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, userRole } = useAuth();
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const [selectedTechnicianId, setSelectedTechnicianId] = useState('');
  const [techAllocatedDate, setTechAllocatedDate] = useState('');
  const [techAllocatedNotes, setTechAllocatedNotes] = useState('');

  const [isEditingWarranty, setIsEditingWarranty] = useState(false);
  const [purchaseDate, setPurchaseDate] = useState('');
  const [warrantyPeriod, setWarrantyPeriod] = useState<WarrantyPeriod>('custom');
  const [warrantyEndDate, setWarrantyEndDate] = useState('');

  const [showContractForm, setShowContractForm] = useState(false);
  const [contractName, setContractName] = useState('');
  const [contractStartDate, setContractStartDate] = useState('');
  const [contractPeriod, setContractPeriod] = useState<WarrantyPeriod>('1_year');
  const [contractEndDate, setContractEndDate] = useState('');

  const query = useSubjectDetail(id);
  const contractsQuery = useContractsBySubject(id);
  const techniciansQuery = useAssignableTechnicians();
  const assignMutation = useAssignTechnician(id);
  const saveWarrantyMutation = useSaveSubjectWarranty(id);
  const createContractMutation = useCreateContract(id);
  const deleteContractMutation = useDeleteContract(id);

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

  const subject = query.data?.ok ? query.data.data : null;
  const contractRows = contractsQuery.data?.ok ? contractsQuery.data.data : [];

  const sortedContracts = useMemo(() => {
    return [...contractRows].sort((a, b) => a.start_date.localeCompare(b.start_date));
  }, [contractRows]);

  const selectedWarrantyMonths = WARRANTY_PERIODS.find((item) => item.value === warrantyPeriod)?.months ?? null;
  const selectedContractMonths = WARRANTY_PERIODS.find((item) => item.value === contractPeriod)?.months ?? null;

  const effectiveWarrantyEndDate = warrantyEndDate || (purchaseDate && selectedWarrantyMonths ? addMonths(purchaseDate, selectedWarrantyMonths) : '');

  const recommendedContractStartDate = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    if (sortedContracts.length > 0) {
      return sortedContracts[sortedContracts.length - 1].end_date;
    }

    if (effectiveWarrantyEndDate) {
      return effectiveWarrantyEndDate;
    }

    return today;
  }, [effectiveWarrantyEndDate, sortedContracts]);

  const hasActiveContract = sortedContracts.some((contract) => getContractVisualStatus(contract) === 'active');
  const isWarrantyActive = Boolean(effectiveWarrantyEndDate && effectiveWarrantyEndDate >= new Date().toISOString().split('T')[0]);

  const billingTypeMeta = isWarrantyActive
    ? { label: 'Under Warranty', className: 'bg-emerald-100 text-emerald-700', serviceChargeType: 'brand_dealer' as const }
    : hasActiveContract
      ? { label: 'Active AMC Contract', className: 'bg-blue-100 text-blue-700', serviceChargeType: 'brand_dealer' as const }
      : { label: 'Chargeable', className: 'bg-slate-100 text-slate-700', serviceChargeType: 'customer' as const };

  const warrantyStatusMeta = !effectiveWarrantyEndDate
    ? { label: 'No Warranty', className: 'bg-slate-100 text-slate-600' }
    : isWarrantyActive
      ? { label: 'Under Warranty', className: 'bg-emerald-100 text-emerald-700' }
      : { label: 'Expired', className: 'bg-rose-100 text-rose-700' };

  const canManageWarrantyAndContracts = userRole === 'super_admin' || userRole === 'office_staff';
  const canDeleteContract = userRole === 'super_admin';

  useEffect(() => {
    if (!subject) {
      return;
    }

    setSelectedTechnicianId(subject.assigned_technician_id ?? '');
    setTechAllocatedDate(subject.technician_allocated_date ?? '');
    setTechAllocatedNotes(subject.technician_allocated_notes ?? '');

    setPurchaseDate(subject.purchase_date ?? '');
    setWarrantyEndDate(subject.warranty_end_date ?? '');
    setWarrantyPeriod(getWarrantyPeriodFromMonths(subject.warranty_period_months));
  }, [subject]);

  useEffect(() => {
    if (!showContractForm) {
      return;
    }

    setContractStartDate(recommendedContractStartDate);
  }, [recommendedContractStartDate, showContractForm]);

  useEffect(() => {
    if (warrantyPeriod === 'custom') {
      return;
    }

    if (purchaseDate && selectedWarrantyMonths) {
      setWarrantyEndDate(addMonths(purchaseDate, selectedWarrantyMonths));
    }
  }, [purchaseDate, selectedWarrantyMonths, warrantyPeriod]);

  useEffect(() => {
    if (contractPeriod === 'custom') {
      return;
    }

    if (contractStartDate && selectedContractMonths) {
      setContractEndDate(addMonths(contractStartDate, selectedContractMonths));
    }
  }, [contractStartDate, selectedContractMonths, contractPeriod]);

  if (query.isLoading) {
    return (
      <div className="space-y-4 p-6">
        <div className="animate-pulse rounded-xl border border-slate-200 bg-white p-5">
          <div className="h-7 w-56 rounded bg-slate-200" />
          <div className="mt-2 h-4 w-80 rounded bg-slate-100" />
        </div>
      </div>
    );
  }

  if (!query.data?.ok || !subject) {
    const message = query.data && !query.data.ok ? query.data.error.message : 'Failed to load subject';

    return (
      <div className="p-6">
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">{message}</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Subject {subject.subject_number}</h1>
          <p className="mt-1 text-sm text-slate-600">Easy service summary with billing and warranty clarity.</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${billingTypeMeta.className}`}>
              {billingTypeMeta.label}
            </span>
            <span className="inline-flex items-center rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-700">
              {formatStatus(subject.status)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ProtectedComponent permission="subject:update">
            <Link href={ROUTES.DASHBOARD_SUBJECTS_EDIT(subject.id)} className="ht-btn ht-btn-primary">
              Edit
            </Link>
          </ProtectedComponent>
          <ProtectedComponent permission="subject:delete">
            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              className="ht-btn ht-btn-danger"
            >
              Delete
            </button>
          </ProtectedComponent>
          <Link href={ROUTES.DASHBOARD_SUBJECTS} className="ht-btn ht-btn-secondary">
            Back to list
          </Link>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Charge To</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{billingTypeMeta.serviceChargeType === 'brand_dealer' ? 'Brand / Dealer' : 'Customer'}</p>
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

      <section className="mb-4 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-1 text-base font-semibold text-slate-900">
          {subject.assigned_technician_id ? 'Reassign Technician' : 'Assign Technician'}
        </h2>
        <ProtectedComponent
          permission="subject:update"
          fallback={
            <p className="text-sm text-slate-500">
              {subject.assigned_technician_name
                ? `Assigned: ${subject.assigned_technician_name}`
                : 'No technician assigned.'}
            </p>
          }
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Technician <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedTechnicianId}
                onChange={(e) => setSelectedTechnicianId(e.target.value)}
                disabled={assignMutation.isPending || techniciansQuery.isLoading}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="">- Unassign -</option>
                {techniciansQuery.data?.ok ? techniciansQuery.data.data.map((tech) => (
                  <option key={tech.id} value={tech.id}>
                    {tech.display_name} ({tech.technician_code})
                  </option>
                )) : null}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Technician Visit Date{selectedTechnicianId ? <span className="text-rose-500"> *</span> : null}
              </label>
              <input
                type="date"
                value={techAllocatedDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setTechAllocatedDate(e.target.value)}
                disabled={assignMutation.isPending}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Allocation Notes <span className="text-slate-400">(optional)</span></label>
              <input
                type="text"
                value={techAllocatedNotes}
                onChange={(e) => setTechAllocatedNotes(e.target.value)}
                placeholder="Notes for the technician"
                disabled={assignMutation.isPending}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-300 focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              disabled={
                assignMutation.isPending ||
                (!!selectedTechnicianId && !techAllocatedDate)
              }
              onClick={() => {
                assignMutation.mutate({
                  subject_id: subject.id,
                  technician_id: selectedTechnicianId || null,
                  technician_allocated_date: techAllocatedDate || null,
                  technician_allocated_notes: techAllocatedNotes.trim() || null,
                  assigned_by: user?.id ?? '',
                });
              }}
              className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {assignMutation.isPending ? 'Saving...' : 'Save Assignment'}
            </button>
          </div>
        </ProtectedComponent>
      </section>

      <section className="mb-4 rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-900">Warranty and AMC Contracts</h2>
          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${billingTypeMeta.className}`}>
            {billingTypeMeta.label}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Warranty Card</h3>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${warrantyStatusMeta.className}`}>
                {warrantyStatusMeta.label}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Purchase Date</label>
                <input
                  type="date"
                  value={purchaseDate}
                  onChange={(event) => setPurchaseDate(event.target.value)}
                  disabled={!isEditingWarranty || !canManageWarrantyAndContracts || saveWarrantyMutation.isPending}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Warranty Period</label>
                <select
                  value={warrantyPeriod}
                  onChange={(event) => setWarrantyPeriod(event.target.value as WarrantyPeriod)}
                  disabled={!isEditingWarranty || !canManageWarrantyAndContracts || saveWarrantyMutation.isPending}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100"
                >
                  {WARRANTY_PERIODS.map((period) => (
                    <option key={period.value} value={period.value}>{period.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Warranty End Date</label>
                <input
                  type="date"
                  value={warrantyEndDate}
                  onChange={(event) => setWarrantyEndDate(event.target.value)}
                  disabled={!isEditingWarranty || !canManageWarrantyAndContracts || saveWarrantyMutation.isPending}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100"
                />
              </div>
            </div>

            {canManageWarrantyAndContracts && (
              <div className="mt-4 flex gap-2">
                {!isEditingWarranty ? (
                  <button
                    type="button"
                    onClick={() => setIsEditingWarranty(true)}
                    className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Edit
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={saveWarrantyMutation.isPending}
                      onClick={() => {
                        saveWarrantyMutation.mutate({
                          subject_id: subject.id,
                          purchase_date: purchaseDate || null,
                          warranty_period: warrantyPeriod,
                          warranty_end_date_manual: warrantyEndDate || null,
                        }, {
                          onSuccess: (result) => {
                            if (result.ok) {
                              setIsEditingWarranty(false);
                            }
                          },
                        });
                      }}
                      className="inline-flex items-center rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {saveWarrantyMutation.isPending ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPurchaseDate(subject.purchase_date ?? '');
                        setWarrantyEndDate(subject.warranty_end_date ?? '');
                        setWarrantyPeriod(getWarrantyPeriodFromMonths(subject.warranty_period_months));
                        setIsEditingWarranty(false);
                      }}
                      className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Contracts Timeline</h3>
              {canManageWarrantyAndContracts && (
                <button
                  type="button"
                  onClick={() => setShowContractForm((prev) => !prev)}
                  className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Contract
                </button>
              )}
            </div>

            {contractsQuery.isLoading ? (
              <p className="text-xs text-slate-500">Loading contracts...</p>
            ) : sortedContracts.length === 0 ? (
              <p className="text-xs text-slate-500">No contracts added yet.</p>
            ) : (
              <div className="mb-4 overflow-x-auto pb-2">
                <div className="flex min-w-max items-stretch gap-2">
                  {sortedContracts.map((contract) => {
                    const status = getContractVisualStatus(contract);
                    const statusClass = status === 'active'
                      ? 'bg-blue-100 text-blue-700 border-blue-200'
                      : status === 'upcoming'
                        ? 'bg-amber-100 text-amber-700 border-amber-200'
                        : 'bg-slate-100 text-slate-600 border-slate-200';

                    return (
                      <div key={contract.id} className={`min-w-[220px] rounded-lg border px-3 py-2 ${statusClass}`}>
                        <p className="truncate text-xs font-semibold">{contract.contract_name}</p>
                        <p className="mt-1 text-[11px]">{formatDateOnly(contract.start_date)} to {formatDateOnly(contract.end_date)}</p>
                        <span className="mt-1 inline-flex rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-semibold uppercase">{status}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {showContractForm && canManageWarrantyAndContracts && (
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-xs font-medium text-slate-700">Contract Name</label>
                    <input
                      type="text"
                      value={contractName}
                      onChange={(event) => setContractName(event.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">Start Date</label>
                    <input
                      type="date"
                      value={contractStartDate}
                      onChange={(event) => setContractStartDate(event.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                    <p className="mt-1 text-[11px] text-slate-500">Recommended start date: {formatDateOnly(recommendedContractStartDate)}</p>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">Duration</label>
                    <select
                      value={contractPeriod}
                      onChange={(event) => setContractPeriod(event.target.value as WarrantyPeriod)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    >
                      {WARRANTY_PERIODS.map((period) => (
                        <option key={period.value} value={period.value}>{period.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="mb-1 block text-xs font-medium text-slate-700">End Date</label>
                    <input
                      type="date"
                      value={contractEndDate}
                      onChange={(event) => setContractEndDate(event.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    disabled={createContractMutation.isPending || !contractName.trim() || !contractStartDate || !contractEndDate}
                    onClick={() => {
                      createContractMutation.mutate({
                        subject_id: subject.id,
                        contract_name: contractName,
                        start_date: contractStartDate,
                        duration_period: contractPeriod,
                        end_date: contractEndDate,
                        created_by: user?.id ?? '',
                      }, {
                        onSuccess: (result) => {
                          if (result.ok) {
                            setContractName('');
                            setContractPeriod('1_year');
                            setContractEndDate('');
                            setContractStartDate(recommendedContractStartDate);
                            setShowContractForm(false);
                          }
                        },
                      });
                    }}
                    className="inline-flex items-center rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {createContractMutation.isPending ? 'Saving...' : 'Save Contract'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowContractForm(false)}
                    className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="mt-4 grid grid-cols-1 gap-2">
              {sortedContracts.map((contract) => {
                const status = getContractVisualStatus(contract);
                const statusClass = status === 'active'
                  ? 'bg-blue-100 text-blue-700'
                  : status === 'upcoming'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-slate-100 text-slate-700';

                return (
                  <div key={contract.id} className="rounded-lg border border-slate-200 bg-white p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">{contract.contract_name}</p>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ${statusClass}`}>{status}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">Start: {formatDateOnly(contract.start_date)}</p>
                    <p className="text-xs text-slate-600">End: {formatDateOnly(contract.end_date)}</p>
                    <p className="text-xs text-slate-600">Duration: {contract.duration_months ? `${contract.duration_months} months` : 'Custom'}</p>
                    {canDeleteContract && status !== 'active' && (
                      <button
                        type="button"
                        disabled={deleteContractMutation.isPending}
                        onClick={() => deleteContractMutation.mutate(contract.id)}
                        className="mt-2 inline-flex items-center rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <section className="rounded-xl border border-slate-200 bg-white p-5 xl:col-span-2">
          <h2 className="mb-4 text-base font-semibold text-slate-900">Service Information</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <p className="text-sm text-slate-700"><span className="font-medium text-slate-900">Source:</span> {subject.source_name}</p>
            <p className="text-sm text-slate-700"><span className="font-medium text-slate-900">Source Type:</span> {subject.source_type}</p>
            <p className="text-sm text-slate-700"><span className="font-medium text-slate-900">Category:</span> {subject.category_name ?? '-'}</p>
            <p className="text-sm text-slate-700"><span className="font-medium text-slate-900">Type:</span> {subject.type_of_service === 'installation' ? 'Installation' : 'Service'}</p>
            <p className="text-sm text-slate-700"><span className="font-medium text-slate-900">Priority:</span> {subject.priority}</p>
            <p className="text-sm text-slate-700"><span className="font-medium text-slate-900">Phone:</span> {subject.customer_phone ?? '-'}</p>
            <p className="text-sm text-slate-700 md:col-span-2"><span className="font-medium text-slate-900">Customer Name:</span> {subject.customer_name ?? '-'}</p>
            <p className="text-sm text-slate-700 md:col-span-2"><span className="font-medium text-slate-900">Customer Address:</span> {subject.customer_address ?? '-'}</p>
            <p className="text-sm text-slate-700 md:col-span-2"><span className="font-medium text-slate-900">Priority Reason:</span> {subject.priority_reason}</p>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 text-base font-semibold text-slate-900">Product Information</h2>
          <div className="space-y-2">
            <p className="text-sm text-slate-700"><span className="font-medium text-slate-900">Product Name:</span> {subject.product_name ?? '-'}</p>
            <p className="text-sm text-slate-700"><span className="font-medium text-slate-900">Serial Number:</span> {subject.serial_number ?? '-'}</p>
            <p className="text-sm text-slate-700"><span className="font-medium text-slate-900">Description:</span> {subject.product_description ?? '-'}</p>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 xl:col-span-3">
          <h2 className="mb-4 text-base font-semibold text-slate-900">Activity Timeline</h2>
          {subject.timeline.length === 0 ? (
            <p className="text-sm text-slate-500">No activity recorded yet.</p>
          ) : (
            <div className="space-y-2.5">
              {subject.timeline.map((item) => (
                <TimelineEventDetail key={item.id} item={item} />
              ))}
            </div>
          )}
        </section>
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
    </div>
  );
}
