'use client';

import { useState } from 'react';
import { ProtectedComponent } from '@/components/ui/ProtectedComponent';
import { useAssignTechnician, useAssignableTechnicians } from '@/hooks/subjects/useSubjects';
import { useAuth } from '@/hooks/auth/useAuth';
import type { SubjectDetail } from '@/modules/subjects/subject.types';

interface AssignTechnicianFormProps {
  subject: SubjectDetail;
  userRole: string | null;
}

export function AssignTechnicianForm({ subject }: AssignTechnicianFormProps) {
  const { user } = useAuth();
  const isCompleted = subject.status === 'COMPLETED';
  const [selectedTechnicianId, setSelectedTechnicianId] = useState(subject.assigned_technician_id ?? '');
  const [techAllocatedDate, setTechAllocatedDate] = useState(subject.technician_allocated_date ?? '');
  const [techAllocatedNotes, setTechAllocatedNotes] = useState(subject.technician_allocated_notes ?? '');

  const techniciansQuery = useAssignableTechnicians();
  const assignMutation = useAssignTechnician(subject.id);

  return (
    <section key={`${subject.id}-${subject.assigned_technician_id ?? ''}-${subject.technician_allocated_date ?? ''}-${subject.technician_allocated_notes ?? ''}`} className="mb-4 rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="mb-1 text-base font-semibold text-slate-900">
        {isCompleted ? 'Assignment Locked' : (subject.assigned_technician_id ? 'Reassign Technician' : 'Assign Technician')}
      </h2>
      {isCompleted ? (
        <p className="mb-3 text-sm text-slate-500">
          This subject is completed. Reassignment is disabled.
        </p>
      ) : null}
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
              disabled={isCompleted || assignMutation.isPending || techniciansQuery.isLoading}
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
              onChange={(e) => setTechAllocatedDate(e.target.value)}
              disabled={isCompleted || assignMutation.isPending}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            />
            <p className="mt-1 text-[11px] text-slate-500">Past dates are allowed for backdated assignment updates.</p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">
              Allocation Notes <span className="text-slate-400">(optional)</span>
            </label>
            <input
              type="text"
              value={techAllocatedNotes}
              onChange={(e) => setTechAllocatedNotes(e.target.value)}
              placeholder="Notes for the technician"
              disabled={isCompleted || assignMutation.isPending}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-300 focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            disabled={isCompleted || assignMutation.isPending || (!!selectedTechnicianId && !techAllocatedDate)}
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
  );
}
