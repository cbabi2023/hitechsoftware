'use client';

import React, { useState } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';
import { JobCompletionPanel } from '@/components/subjects/job-completion-panel';
import { PhotoUploadGrid } from '@/components/subjects/photo-upload-grid';
import type {
  SubjectDetail,
  JobCompletionRequirements,
  PhotoType,
} from '@/modules/subjects/subject.types';

interface CompleteJobPanelProps {
  subject: SubjectDetail;
  requirements: JobCompletionRequirements | undefined;
  isLoadingRequirements: boolean;
  isConfirming: boolean;
  confirmError: Error | null | undefined;
  onUploadPhoto: (args: { file: File; photoType: PhotoType }) => Promise<unknown>;
  onRemovePhoto?: (args: { photoId: string; storagePath: string; photoType: PhotoType }) => Promise<unknown>;
  onConfirmComplete: (notes?: string) => void;
  onClose: () => void;
}

export function CompleteJobPanel({
  subject,
  requirements,
  isLoadingRequirements,
  isConfirming,
  confirmError,
  onUploadPhoto,
  onRemovePhoto,
  onConfirmComplete,
  onClose,
}: CompleteJobPanelProps) {
  const [notes, setNotes] = useState('');
  const [uploadAttempted, setUploadAttempted] = useState(false);

  const canComplete = requirements?.canComplete ?? false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Job Completion Checklist</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-6 p-6">
          {/* Requirements progress indicator */}
          <JobCompletionPanel
            requirements={requirements}
            isLoading={isLoadingRequirements}
            canComplete={canComplete}
          />

          {/* Upload card grid */}
          {requirements && requirements.required.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-700">Upload Required Proof</h3>
              <PhotoUploadGrid
                requiredTypes={requirements.required}
                uploadedTypes={requirements.uploaded}
                photos={subject.photos}
                canEdit={subject.status !== 'COMPLETED'}
                uploadAttempted={uploadAttempted}
                onUpload={onUploadPhoto}
                onRemove={onRemovePhoto}
              />
            </div>
          )}

          {/* Completion notes */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Completion Notes <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="e.g. Service completed successfully, unit tested and operating normally…"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {/* Error */}
          {confirmError && (
            <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{confirmError.message}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3">
            <button type="button" onClick={onClose} className="ht-btn ht-btn-secondary">
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (!canComplete) {
                  setUploadAttempted(true);
                  return;
                }
                onConfirmComplete(notes.trim() || undefined);
              }}
              disabled={isConfirming}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              <CheckCircle2 className="h-4 w-4" />
              {isConfirming ? 'Completing…' : 'Confirm Complete'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
