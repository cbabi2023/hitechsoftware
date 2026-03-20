'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { DeleteConfirmModal } from '@/components/customers/DeleteConfirmModal';
import { ProtectedComponent } from '@/components/ui/ProtectedComponent';
import { useTeam } from '@/hooks/team/useTeam';
import { ROUTES } from '@/lib/constants/routes';
import type { UserRole } from '@/types/database.types';

const ROLE_OPTIONS: Array<{ value: UserRole; label: string }> = [
  { value: 'technician', label: 'Technician' },
  { value: 'office_staff', label: 'Office Staff' },
  { value: 'stock_manager', label: 'Stock Manager' },
];

export default function TeamMemberDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { members, isLoading, error, updateMutation, deleteMutation } = useTeam();

  const member = useMemo(() => members.find((item) => item.id === params.id), [members, params.id]);

  const [formState, setFormState] = useState<{
    displayName: string;
    phoneNumber: string;
    role: UserRole;
    technicianCode: string;
    isActive: boolean;
  } | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const performanceQuery = useQuery({
    queryKey: ['team-member-performance', params.id],
    enabled: !!member && member.role === 'technician',
    queryFn: async () => {
      const response = await fetch(`/api/team/members/${params.id}/performance`);
      const payload = (await response.json()) as {
        ok: boolean;
        data?: {
          monthly: Array<{ month: string; label: string; rejections: number; reschedules: number; completed: number }>;
          totals: { rejections: number; reschedules: number; completedLast6Months: number; completedAllTime: number };
        };
        error?: { message?: string };
      };

      if (!response.ok || !payload.ok || !payload.data) {
        throw new Error(payload.error?.message ?? 'Failed to load technician performance stats');
      }

      return payload.data;
    },
  });

  if (isLoading) {
    return <div className="p-6 text-sm text-slate-600">Loading team member...</div>;
  }

  if (!member) {
    return <div className="p-6 text-sm text-rose-600">{error ?? 'Team member not found.'}</div>;
  }

  const effectiveForm = formState ?? {
    displayName: member.display_name,
    phoneNumber: member.phone_number ?? '',
    role: member.role,
    technicianCode: member.technician?.technician_code ?? '',
    isActive: member.is_active,
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{member.display_name}</h1>
          <p className="mt-1 text-sm text-slate-600">Team member detail</p>
        </div>

        <div className="flex items-center gap-2">
          <Link href={ROUTES.DASHBOARD_TEAM} className="ht-btn ht-btn-secondary">
            Back
          </Link>
          <ProtectedComponent permission="technician:edit">
            <button
              type="button"
              onClick={() => {
                updateMutation.mutate({
                  id: member.id,
                  input: {
                    display_name: effectiveForm.displayName,
                    phone_number: effectiveForm.phoneNumber,
                    role: effectiveForm.role,
                    is_active: effectiveForm.isActive,
                    technician:
                      effectiveForm.role === 'technician'
                        ? {
                            technician_code: effectiveForm.technicianCode,
                            is_active: effectiveForm.isActive,
                            is_deleted: false,
                          }
                        : undefined,
                  },
                });
              }}
              disabled={updateMutation.isPending}
              className="ht-btn ht-btn-primary"
            >
              {updateMutation.isPending ? 'Saving...' : 'Edit'}
            </button>
          </ProtectedComponent>
          <ProtectedComponent permission="technician:delete">
            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              className="ht-btn ht-btn-danger"
            >
              Delete
            </button>
          </ProtectedComponent>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Profile</h2>
          <div className="space-y-3 text-sm">
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Display Name</span>
              <input
                value={effectiveForm.displayName}
                onChange={(event) => setFormState((prev) => ({
                  ...(prev ?? effectiveForm),
                  displayName: event.target.value,
                }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Phone Number</span>
              <input
                value={effectiveForm.phoneNumber}
                onChange={(event) => setFormState((prev) => ({
                  ...(prev ?? effectiveForm),
                  phoneNumber: event.target.value,
                }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Role</span>
              <select
                value={effectiveForm.role}
                onChange={(event) => {
                  const nextRole = event.target.value as UserRole;
                  setFormState((prev) => ({
                    ...(prev ?? effectiveForm),
                    role: nextRole,
                    technicianCode: nextRole === 'technician' ? (prev?.technicianCode ?? effectiveForm.technicianCode) : '',
                  }));
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              >
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="inline-flex items-center gap-2 pt-1 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={effectiveForm.isActive}
                onChange={(event) => setFormState((prev) => ({
                  ...(prev ?? effectiveForm),
                  isActive: event.target.checked,
                }))}
                className="h-4 w-4 rounded border-slate-300"
              />
              Active account
            </label>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Technician Info</h2>
          {effectiveForm.role === 'technician' ? (
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Technician Code</span>
              <input
                value={effectiveForm.technicianCode}
                onChange={(event) => setFormState((prev) => ({
                  ...(prev ?? effectiveForm),
                  technicianCode: event.target.value,
                }))}
                placeholder="TECH-001"
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>
          ) : (
            <p className="text-sm text-slate-600">Technician data is only required when role is Technician.</p>
          )}
        </div>
      </div>

      {member.role === 'technician' && member.technician && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Performance Stats</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Total Rejections</p>
              <p className={`mt-1 text-2xl font-bold ${member.technician.total_rejections > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                {member.technician.total_rejections}
              </p>
              <p className="mt-0.5 text-xs text-slate-400">All-time rejected services</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Rejections (Last 6 Months)</p>
              <p className={`mt-1 text-2xl font-bold ${(performanceQuery.data?.totals.rejections ?? 0) > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                {performanceQuery.data?.totals.rejections ?? 0}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Reschedules From Rejections (Last 6 Months)</p>
              <p className={`mt-1 text-2xl font-bold ${(performanceQuery.data?.totals.reschedules ?? 0) > 0 ? 'text-amber-700' : 'text-slate-900'}`}>
                {performanceQuery.data?.totals.reschedules ?? 0}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Completed Services (All Time)</p>
              <p className={`mt-1 text-2xl font-bold ${(performanceQuery.data?.totals.completedAllTime ?? 0) > 0 ? 'text-emerald-700' : 'text-slate-900'}`}>
                {performanceQuery.data?.totals.completedAllTime ?? 0}
              </p>
              <p className="mt-0.5 text-xs text-slate-400">Successfully completed by technician</p>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">Month</th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-600">Rejections</th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-600">Reschedules</th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-600">Completed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {(performanceQuery.data?.monthly ?? []).map((row) => (
                  <tr key={row.month}>
                    <td className="px-3 py-2 text-slate-700">{row.label}</td>
                    <td className="px-3 py-2 text-right font-medium text-rose-700">{row.rejections}</td>
                    <td className="px-3 py-2 text-right font-medium text-amber-700">{row.reschedules}</td>
                    <td className="px-3 py-2 text-right font-medium text-emerald-700">{row.completed}</td>
                  </tr>
                ))}
                {performanceQuery.isLoading && (
                  <tr>
                    <td className="px-3 py-3 text-slate-500" colSpan={4}>Loading monthly performance...</td>
                  </tr>
                )}
                {performanceQuery.error && (
                  <tr>
                    <td className="px-3 py-3 text-rose-600" colSpan={4}>Unable to load monthly stats.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <DeleteConfirmModal
        isOpen={showDeleteModal}
        title="Delete team member"
        description={`Delete ${member.display_name}? This permanently removes login access and linked team records.`}
        confirmLabel="Delete permanently"
        isSubmitting={deleteMutation.isPending}
        onCancel={() => setShowDeleteModal(false)}
        onConfirm={() => {
          setShowDeleteModal(false);
          deleteMutation.mutate(member.id, {
            onSuccess: (result) => {
              if (result.ok) {
                router.push(ROUTES.DASHBOARD_TEAM);
              }
            },
          });
        }}
      />
    </div>
  );
}
