'use client';

import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { ContractCard } from '@/components/contracts/ContractCard';
import { useContractsBySubject, useCreateContract, useDeleteContract } from '@/hooks/contracts/useContracts';
import { useSaveSubjectWarranty } from '@/hooks/subjects/useSubjects';
import { useAuth } from '@/hooks/auth/useAuth';
import { WARRANTY_PERIODS } from '@/modules/subjects/subject.constants';
import type { SubjectDetail } from '@/modules/subjects/subject.types';
import type { SubjectContract } from '@/modules/contracts/contract.types';
import type { WarrantyPeriod } from '@/modules/subjects/subject.types';

// ── helpers ────────────────────────────────────────────────────────────────────

function toIsoDate(value: string) {
  return new Date(value).toISOString().split('T')[0];
}

function addMonths(dateText: string, months: number) {
  const date = new Date(dateText);
  date.setMonth(date.getMonth() + months);
  return toIsoDate(date.toISOString());
}

function diffInWholeDays(fromDate: string, toDate: string) {
  const from = new Date(fromDate);
  const to = new Date(toDate);
  const ms = to.getTime() - from.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function getRemainingDaysText(endDate: string | null) {
  if (!endDate) return 'Not set';
  const today = new Date().toISOString().split('T')[0];
  const days = diffInWholeDays(today, endDate);
  if (days > 0) return `${days} day(s) remaining`;
  if (days === 0) return 'Ends today';
  return `${Math.abs(days)} day(s) overdue`;
}

function getWarrantyPeriodFromMonths(months: number | null): WarrantyPeriod {
  const match = WARRANTY_PERIODS.find((item) => item.months === months);
  return (match?.value as WarrantyPeriod | undefined) ?? 'custom';
}

function getContractVisualStatus(contract: SubjectContract): 'active' | 'upcoming' | 'expired' {
  const today = new Date().toISOString().split('T')[0];
  if (contract.start_date > today) return 'upcoming';
  if (contract.end_date < today) return 'expired';
  return 'active';
}

function formatDateOnly(value: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-GB');
}

// ── component ─────────────────────────────────────────────────────────────────

interface WarrantyAndContractsSectionProps {
  subject: SubjectDetail;
  userRole: string | null;
}

export function WarrantyAndContractsSection({ subject, userRole }: WarrantyAndContractsSectionProps) {
  const { user } = useAuth();
  const canManage = userRole === 'super_admin' || userRole === 'office_staff';
  const canDeleteContract = userRole === 'super_admin';

  // ── warranty state ──────────────────────────────────────────────────────────
  const [isEditingWarranty, setIsEditingWarranty] = useState(false);
  const [purchaseDate, setPurchaseDate] = useState(subject.purchase_date ?? '');
  const [warrantyPeriod, setWarrantyPeriod] = useState<WarrantyPeriod>(
    getWarrantyPeriodFromMonths(subject.warranty_period_months),
  );
  const [warrantyEndDate, setWarrantyEndDate] = useState(subject.warranty_end_date ?? '');

  // ── contract state ──────────────────────────────────────────────────────────
  const [showContractForm, setShowContractForm] = useState(false);
  const [contractName, setContractName] = useState('');
  const [contractStartDate, setContractStartDate] = useState('');
  const [contractPeriod, setContractPeriod] = useState<WarrantyPeriod>('1_year');
  const [contractEndDate, setContractEndDate] = useState('');

  // ── hooks ───────────────────────────────────────────────────────────────────
  const contractsQuery = useContractsBySubject(subject.id);
  const saveWarrantyMutation = useSaveSubjectWarranty(subject.id);
  const createContractMutation = useCreateContract(subject.id);
  const deleteContractMutation = useDeleteContract(subject.id);

  // ── derived ─────────────────────────────────────────────────────────────────
  const sortedContracts = useMemo(
    () => [...(contractsQuery.data?.ok ? contractsQuery.data.data : [])].sort(
      (a, b) => a.start_date.localeCompare(b.start_date),
    ),
    [contractsQuery.data],
  );

  const selectedWarrantyMonths = WARRANTY_PERIODS.find((item) => item.value === warrantyPeriod)?.months ?? null;
  const selectedContractMonths = WARRANTY_PERIODS.find((item) => item.value === contractPeriod)?.months ?? null;

  const effectiveWarrantyEndDate =
    warrantyEndDate || (purchaseDate && selectedWarrantyMonths ? addMonths(purchaseDate, selectedWarrantyMonths) : '');

  const today = new Date().toISOString().split('T')[0];
  const isWarrantyActive = Boolean(effectiveWarrantyEndDate && effectiveWarrantyEndDate >= today);
  const hasActiveContract = sortedContracts.some((c) => getContractVisualStatus(c) === 'active');

  const billingTypeMeta = isWarrantyActive
    ? { label: 'Under Warranty', className: 'bg-emerald-100 text-emerald-700' }
    : hasActiveContract
      ? { label: 'Active AMC Contract', className: 'bg-blue-100 text-blue-700' }
      : { label: 'Chargeable', className: 'bg-slate-100 text-slate-700' };

  const warrantyStatusMeta = !effectiveWarrantyEndDate
    ? { label: 'No Warranty', className: 'bg-slate-100 text-slate-600' }
    : isWarrantyActive
      ? { label: 'Under Warranty', className: 'bg-emerald-100 text-emerald-700' }
      : { label: 'Expired', className: 'bg-rose-100 text-rose-700' };

  const recommendedContractStartDate = useMemo(() => {
    if (sortedContracts.length > 0) return sortedContracts[sortedContracts.length - 1].end_date;
    if (effectiveWarrantyEndDate) return effectiveWarrantyEndDate;
    return today;
  }, [effectiveWarrantyEndDate, sortedContracts, today]);

  const handlePurchaseDateChange = (nextDate: string) => {
    setPurchaseDate(nextDate);

    if (warrantyPeriod !== 'custom' && selectedWarrantyMonths && nextDate) {
      setWarrantyEndDate(addMonths(nextDate, selectedWarrantyMonths));
    }

    if (contractPeriod !== 'custom' && selectedContractMonths && nextDate && !contractStartDate) {
      setContractStartDate(nextDate);
      setContractEndDate(addMonths(nextDate, selectedContractMonths));
    }
  };

  const handleWarrantyPeriodChange = (nextPeriod: WarrantyPeriod) => {
    setWarrantyPeriod(nextPeriod);
    const nextMonths = WARRANTY_PERIODS.find((item) => item.value === nextPeriod)?.months ?? null;
    if (nextPeriod !== 'custom' && purchaseDate && nextMonths) {
      setWarrantyEndDate(addMonths(purchaseDate, nextMonths));
    }
  };

  const handleWarrantyEndDateChange = (nextEndDate: string) => {
    setWarrantyEndDate(nextEndDate);
    if (!purchaseDate || !nextEndDate) {
      setWarrantyPeriod('custom');
      return;
    }
    const months = Math.round(diffInWholeDays(purchaseDate, nextEndDate) / 30);
    setWarrantyPeriod(getWarrantyPeriodFromMonths(months));
  };

  const handleContractStartDateChange = (nextStartDate: string) => {
    setContractStartDate(nextStartDate);
    if (contractPeriod !== 'custom' && selectedContractMonths && nextStartDate) {
      setContractEndDate(addMonths(nextStartDate, selectedContractMonths));
    }
  };

  const handleContractPeriodChange = (nextPeriod: WarrantyPeriod) => {
    setContractPeriod(nextPeriod);
    const nextMonths = WARRANTY_PERIODS.find((item) => item.value === nextPeriod)?.months ?? null;
    if (nextPeriod !== 'custom' && contractStartDate && nextMonths) {
      setContractEndDate(addMonths(contractStartDate, nextMonths));
    }
  };

  const handleContractEndDateChange = (nextEndDate: string) => {
    setContractEndDate(nextEndDate);
    if (!contractStartDate || !nextEndDate) {
      setContractPeriod('custom');
      return;
    }
    const months = Math.round(diffInWholeDays(contractStartDate, nextEndDate) / 30);
    setContractPeriod(getWarrantyPeriodFromMonths(months));
  };

  // ── render ───────────────────────────────────────────────────────────────────
  return (
    <section className="mb-4 rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-900">Warranty and AMC Contracts</h2>
        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${billingTypeMeta.className}`}>
          {billingTypeMeta.label}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* ── Warranty card ── */}
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
                onChange={(e) => handlePurchaseDateChange(e.target.value)}
                disabled={!isEditingWarranty || !canManage || saveWarrantyMutation.isPending}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Warranty Period</label>
              <select
                value={warrantyPeriod}
                onChange={(e) => handleWarrantyPeriodChange(e.target.value as WarrantyPeriod)}
                disabled={!isEditingWarranty || !canManage || saveWarrantyMutation.isPending}
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
                onChange={(e) => handleWarrantyEndDateChange(e.target.value)}
                disabled={!isEditingWarranty || !canManage || saveWarrantyMutation.isPending}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100"
              />
              <p className="mt-1 text-[11px] text-slate-500">{getRemainingDaysText(warrantyEndDate || null)}</p>
            </div>
          </div>

          {canManage && (
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
                          if (result.ok) setIsEditingWarranty(false);
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

        {/* ── Contracts panel ── */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Contracts Timeline</h3>
            {canManage && (
              <button
                type="button"
                onClick={() => {
                  if (showContractForm) {
                    setShowContractForm(false);
                    return;
                  }
                  setShowContractForm(true);
                  setContractStartDate(recommendedContractStartDate);
                  if (contractPeriod !== 'custom' && selectedContractMonths) {
                    setContractEndDate(addMonths(recommendedContractStartDate, selectedContractMonths));
                  }
                }}
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

          {showContractForm && canManage && (
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-slate-700">Contract Name</label>
                  <input
                    type="text"
                    value={contractName}
                    onChange={(e) => setContractName(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">AMC Purchase / Start Date</label>
                  <input
                    type="date"
                    value={contractStartDate}
                    onChange={(e) => handleContractStartDateChange(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                  <p className="mt-1 text-[11px] text-slate-500">
                    Recommended: {formatDateOnly(recommendedContractStartDate)}
                  </p>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">Duration</label>
                  <select
                    value={contractPeriod}
                    onChange={(e) => handleContractPeriodChange(e.target.value as WarrantyPeriod)}
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
                    onChange={(e) => handleContractEndDateChange(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                  <p className="mt-1 text-[11px] text-slate-500">{getRemainingDaysText(contractEndDate || null)}</p>
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
            {sortedContracts.map((contract) => (
              <ContractCard
                key={contract.id}
                contract={contract}
                visualStatus={getContractVisualStatus(contract)}
                canDelete={canDeleteContract}
                isDeleting={deleteContractMutation.isPending}
                onDelete={(id) => deleteContractMutation.mutate(id)}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
