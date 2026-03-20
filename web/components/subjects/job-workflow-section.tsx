'use client';

import { useState } from 'react';
import { MapPin, Wrench, CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react';
import { useJobWorkflow } from '@/hooks/subjects/use-job-workflow';
import { CannotCompleteModal } from '@/components/subjects/cannot-complete-modal';
import { CompleteJobPanel } from '@/components/subjects/complete-job-panel';
import { PhotoGallery } from '@/components/subjects/photo-gallery';
import { PhotoUploadGrid } from '@/components/subjects/photo-upload-grid';
import { INCOMPLETE_REASONS } from '@/modules/subjects/subject.constants';
import type { SubjectDetail } from '@/modules/subjects/subject.types';

interface Props {
  subject: SubjectDetail;
  userRole: string;
  userId: string;
}

// Ordered workflow steps for the status timeline
const TIMELINE_STEPS = [
  { status: 'PENDING', label: 'Pending' },
  { status: 'ALLOCATED', label: 'Allocated' },
  { status: 'ACCEPTED', label: 'Accepted' },
  { status: 'ARRIVED', label: 'Arrived' },
  { status: 'IN_PROGRESS', label: 'In Progress' },
] as const;

const STATUS_ORDER = ['PENDING', 'ALLOCATED', 'ACCEPTED', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'INCOMPLETE', 'AWAITING_PARTS', 'RESCHEDULED', 'CANCELLED'];

function getStepState(stepStatus: string, currentStatus: string): 'done' | 'active' | 'future' {
  const stepIdx = STATUS_ORDER.indexOf(stepStatus);
  const currIdx = STATUS_ORDER.indexOf(currentStatus);
  if (stepIdx < currIdx) return 'done';
  if (stepIdx === currIdx) return 'active';
  return 'future';
}

function formatTimestamp(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const TIMESTAMP_MAP: Partial<Record<string, keyof SubjectDetail>> = {
  ARRIVED: 'arrived_at',
  IN_PROGRESS: 'work_started_at',
  COMPLETED: 'completed_at',
  INCOMPLETE: 'incomplete_at',
};

const WORKFLOW_STATUSES = new Set(['ACCEPTED', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'INCOMPLETE', 'AWAITING_PARTS']);

export function JobWorkflowSection({ subject, userRole, userId }: Props) {
  const [showCompletePanel, setShowCompletePanel] = useState(false);
  const [showIncompleteModal, setShowIncompleteModal] = useState(false);

  const isAssignedTechnician = userRole === 'technician' && userId === subject.assigned_technician_id;

  const {
    completionRequirements,
    isLoadingRequirements,
    updateStatus,
    isUpdatingStatus,
    uploadPhotoAsync,
    removePhotoAsync,
    markIncomplete,
    isMarkingIncomplete,
    markComplete,
    isMarkingComplete,
    markCompleteError,
  } = useJobWorkflow(subject.id);

  // Only render for workflow-relevant statuses
  if (!WORKFLOW_STATUSES.has(subject.status)) return null;

  const incompleteReasonLabel = subject.incomplete_reason
    ? (INCOMPLETE_REASONS.find((r) => r.value === subject.incomplete_reason)?.label ?? subject.incomplete_reason)
    : null;

  const parsedSpareParts = (() => {
    if (!subject.spare_parts_requested) return null;
    try {
      const parsed = JSON.parse(subject.spare_parts_requested) as Array<{ name: string; quantity: number; price: number }>;
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  })();

  const uploadAvailabilityMessage = (() => {
    if (userRole !== 'technician') {
      return 'Photo uploads are available only for the assigned technician.';
    }

    if (!subject.assigned_technician_id) {
      return 'Photo uploads will be available after a technician is assigned.';
    }

    if (!isAssignedTechnician) {
      return 'Photo uploads are available only to the technician assigned to this subject.';
    }

    if (subject.status === 'ACCEPTED' || subject.status === 'ARRIVED') {
      return 'Photo uploads unlock after the technician clicks Start Work and the subject moves to In Progress.';
    }

    if (subject.status === 'PENDING' || subject.status === 'ALLOCATED') {
      return 'Photo uploads become available after the technician accepts the service and starts work.';
    }

    return null;
  })();

  return (
    <div className="mb-4 space-y-4">
      {/* ── PART A: Status Action Bar ───────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Job Workflow</h2>

        {/* Current status badge */}
        <div className="mb-4">
          <StatusBadge status={subject.status} />
        </div>

        {/* Action buttons — only for the assigned technician */}
        {isAssignedTechnician && (
          <div className="flex flex-wrap gap-3">
            {subject.status === 'ACCEPTED' && (
              <button
                type="button"
                disabled={isUpdatingStatus}
                onClick={() => updateStatus('ARRIVED')}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                <MapPin className="h-4 w-4" />
                {isUpdatingStatus ? 'Updating…' : 'Mark as Arrived'}
              </button>
            )}

            {subject.status === 'ARRIVED' && (
              <button
                type="button"
                disabled={isUpdatingStatus}
                onClick={() => updateStatus('IN_PROGRESS')}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                <Wrench className="h-4 w-4" />
                {isUpdatingStatus ? 'Updating…' : 'Start Work'}
              </button>
            )}

            {subject.status === 'IN_PROGRESS' && (
              <>
                <button
                  type="button"
                  onClick={() => setShowCompletePanel(true)}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Complete Job
                </button>
                <button
                  type="button"
                  onClick={() => setShowIncompleteModal(true)}
                  className="inline-flex items-center gap-2 rounded-lg border border-rose-300 bg-white px-5 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-50"
                >
                  <XCircle className="h-4 w-4" />
                  Cannot Complete
                </button>
              </>
            )}

            {(subject.status === 'COMPLETED' || subject.status === 'INCOMPLETE' || subject.status === 'AWAITING_PARTS') && (
              <p className="text-sm text-slate-500 italic">No further actions available for this status.</p>
            )}
          </div>
        )}

        {!isAssignedTechnician && (
          <p className="text-sm text-slate-500">
            {userRole === 'technician' ? 'You are not assigned to this job.' : 'Read-only view — workflow actions are for the assigned technician.'}
          </p>
        )}
      </div>

      {/* ── PART B: Photo Upload Section (during IN_PROGRESS) ──────────────── */}
      {isAssignedTechnician && subject.status === 'IN_PROGRESS' && completionRequirements && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <div className="mb-4 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-600" />
            <h3 className="text-sm font-semibold uppercase tracking-wide text-amber-800">Upload Required Photos</h3>
          </div>
          
          {/* Progress indicator */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-amber-700">
                {completionRequirements.uploaded.length} of {completionRequirements.required.length} uploaded
              </span>
            </div>
            <div className="h-2 bg-amber-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all"
                style={{
                  width: `${
                    completionRequirements.required.length > 0
                      ? (completionRequirements.uploaded.length / completionRequirements.required.length) * 100
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>

          <PhotoUploadGrid
            requiredTypes={completionRequirements.required}
            uploadedTypes={completionRequirements.uploaded}
            photos={subject.photos}
            canEdit
            onUpload={uploadPhotoAsync}
            onRemove={removePhotoAsync}
          />
        </div>
      )}

      {uploadAvailabilityMessage && subject.status !== 'COMPLETED' && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
            <div>
              <p className="text-sm font-semibold text-slate-700">Photo Upload Availability</p>
              <p className="mt-1 text-sm text-slate-600">{uploadAvailabilityMessage}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── PART C: Status Timeline ─────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Progress Timeline</h3>
        <ol className="relative border-l border-slate-200 pl-6 space-y-5">
          {TIMELINE_STEPS.map(({ status, label }) => {
            const state = getStepState(status, subject.status);
            const tsKey = TIMESTAMP_MAP[status];
            const ts = tsKey ? formatTimestamp(subject[tsKey] as string | null) : null;

            return (
              <li key={status} className="relative">
                <span
                  className={`absolute -left-[1.5625rem] flex h-5 w-5 items-center justify-center rounded-full ring-4 ring-white
                    ${state === 'done' ? 'bg-emerald-500' : state === 'active' ? 'animate-pulse bg-blue-500' : 'bg-slate-200'}`}
                >
                  {state === 'done' && <CheckCircle2 className="h-3 w-3 text-white" />}
                </span>
                <p className={`text-sm font-medium ${state === 'done' ? 'text-emerald-700' : state === 'active' ? 'text-blue-700' : 'text-slate-400'}`}>
                  {label}
                </p>
                {ts && <p className="mt-0.5 text-xs text-slate-400">{ts}</p>}
              </li>
            );
          })}

          {/* Terminal step: Completed or Incomplete */}
          {subject.status === 'COMPLETED' && (
            <li className="relative">
              <span className="absolute -left-[1.5625rem] flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 ring-4 ring-white">
                <CheckCircle2 className="h-3 w-3 text-white" />
              </span>
              <p className="text-sm font-medium text-emerald-700">Completed</p>
              {formatTimestamp(subject.completed_at) && (
                <p className="mt-0.5 text-xs text-slate-400">{formatTimestamp(subject.completed_at)}</p>
              )}
            </li>
          )}

          {subject.status === 'INCOMPLETE' && (
            <li className="relative">
              <span className="absolute -left-[1.5625rem] flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 ring-4 ring-white">
                <XCircle className="h-3 w-3 text-white" />
              </span>
              <p className="text-sm font-medium text-rose-700">Incomplete</p>
              {formatTimestamp(subject.incomplete_at) && (
                <p className="mt-0.5 text-xs text-slate-400">{formatTimestamp(subject.incomplete_at)}</p>
              )}
            </li>
          )}

          {subject.status === 'AWAITING_PARTS' && (
            <li className="relative">
              <span className="absolute -left-[1.5625rem] flex h-5 w-5 items-center justify-center rounded-full animate-pulse bg-amber-500 ring-4 ring-white">
                <Clock className="h-3 w-3 text-white" />
              </span>
              <p className="text-sm font-medium text-amber-700">Awaiting Parts</p>
            </li>
          )}
        </ol>
      </div>

      {/* ── PART D: Incomplete Details Panel ────────────────────────────────── */}
      {subject.status === 'INCOMPLETE' && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-5">
          <div className="mb-3 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-rose-600" />
            <h3 className="text-sm font-semibold text-rose-800">Incomplete Job Details</h3>
          </div>
          <dl className="space-y-2 text-sm">
            {incompleteReasonLabel && (
              <div className="flex gap-2">
                <dt className="w-32 flex-shrink-0 font-medium text-rose-700">Reason:</dt>
                <dd className="text-rose-900">{incompleteReasonLabel}</dd>
              </div>
            )}
            {subject.incomplete_note && (
              <div className="flex gap-2">
                <dt className="w-32 flex-shrink-0 font-medium text-rose-700">Note:</dt>
                <dd className="text-rose-900">{subject.incomplete_note}</dd>
              </div>
            )}
            {subject.spare_parts_requested && (
              <div className="flex gap-2">
                <dt className="w-32 flex-shrink-0 font-medium text-rose-700">Part Required:</dt>
                <dd className="text-rose-900">
                  {parsedSpareParts ? (
                    <ul className="space-y-1">
                      {parsedSpareParts.map((part, index) => (
                        <li key={`part-${index}`}>
                          {part.name} — Qty: {part.quantity}, Price: {part.price}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <>
                      {subject.spare_parts_requested}
                      {subject.spare_parts_quantity ? ` × ${subject.spare_parts_quantity}` : ''}
                    </>
                  )}
                </dd>
              </div>
            )}
            {subject.rescheduled_date && (
              <div className="flex gap-2">
                <dt className="w-32 flex-shrink-0 font-medium text-rose-700">Reschedule:</dt>
                <dd className="text-rose-900">{new Date(subject.rescheduled_date).toLocaleDateString('en-GB')}</dd>
              </div>
            )}
          </dl>
        </div>
      )}

      {/* ── Photo Gallery (completed jobs) ───────────────────────────────────── */}
      {subject.status === 'COMPLETED' && subject.photos.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Job Photos</h3>
          <PhotoGallery photos={subject.photos} />
        </div>
      )}

      {/* ── Modals ───────────────────────────────────────────────────────────── */}
      <CannotCompleteModal
        isOpen={showIncompleteModal}
        isSubmitting={isMarkingIncomplete}
        onClose={() => setShowIncompleteModal(false)}
        onSubmit={(data) => {
          markIncomplete(data, {
            onSuccess: () => setShowIncompleteModal(false),
          });
        }}
      />

      {showCompletePanel && (
        <CompleteJobPanel
          subject={subject}
          requirements={completionRequirements}
          isLoadingRequirements={isLoadingRequirements}
          isConfirming={isMarkingComplete}
          confirmError={markCompleteError}
          onUploadPhoto={uploadPhotoAsync}
          onRemovePhoto={removePhotoAsync}
          onConfirmComplete={(notes) => {
            markComplete(notes, {
              onSuccess: () => setShowCompletePanel(false),
            });
          }}
          onClose={() => setShowCompletePanel(false)}
        />
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    ACCEPTED: { label: 'Accepted', className: 'bg-blue-100 text-blue-700' },
    ARRIVED: { label: 'Arrived on Site', className: 'bg-cyan-100 text-cyan-700' },
    IN_PROGRESS: { label: 'Work in Progress', className: 'bg-amber-100 text-amber-700' },
    COMPLETED: { label: 'Completed', className: 'bg-emerald-100 text-emerald-700' },
    INCOMPLETE: { label: 'Incomplete', className: 'bg-rose-100 text-rose-700' },
    AWAITING_PARTS: { label: 'Awaiting Parts', className: 'bg-orange-100 text-orange-700' },
  };

  const { label, className } = config[status] ?? { label: status, className: 'bg-slate-100 text-slate-700' };

  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${className}`}>
      {label}
    </span>
  );
}
