'use client';

import React from 'react';
import { CheckCircle2, Circle, AlertCircle } from 'lucide-react';
import { Progress, Alert, AlertDescription } from '@/components/ui/form';
import type { JobCompletionRequirements, PhotoType } from '@/modules/subjects/subject.types';

interface JobCompletionPanelProps {
  requirements?: JobCompletionRequirements;
  isLoading?: boolean;
  canComplete?: boolean;
}

const PHOTO_LABELS: Record<PhotoType, string> = {
  serial_number: 'Serial Number Label',
  machine: 'Machine/Equipment',
  bill: 'Invoice/Bill',
  job_sheet: 'Job Sheet',
  defective_part: 'Defective Part',
  site_photo_1: 'Site Photo 1',
  site_photo_2: 'Site Photo 2',
  site_photo_3: 'Site Photo 3',
  service_video: 'Service Video',
};

export function JobCompletionPanel({
  requirements,
  isLoading,
  canComplete,
}: JobCompletionPanelProps) {
  if (isLoading) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-gray-500">Loading requirements...</p>
      </div>
    );
  }

  if (!requirements) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-gray-500">Unable to load completion requirements</p>
      </div>
    );
  }

  const progressPercentage =
    requirements.required.length > 0
      ? Math.round((requirements.uploaded.length / requirements.required.length) * 100)
      : 0;

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-gray-900">Photo Requirements</h3>
          <span className="text-sm font-medium text-gray-600">
            {requirements.uploaded.length} of {requirements.required.length}
          </span>
        </div>
        <Progress value={progressPercentage} className="h-2" />
      </div>

      {canComplete ? (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            All required photos uploaded. You can now complete this job.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert className="border-amber-200 bg-amber-50">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            Please upload all required photos before completing the job.
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <h4 className="text-sm font-medium text-gray-700">Required Photos:</h4>
        <div className="space-y-1">
          {requirements.required.map((photoType) => {
            const isUploaded = requirements.uploaded.includes(photoType);
            return (
              <div key={photoType} className="flex items-center gap-2 p-2 rounded bg-gray-50">
                {isUploaded ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                ) : (
                  <Circle className="h-4 w-4 text-gray-400 flex-shrink-0" />
                )}
                <span className={`text-sm ${isUploaded ? 'text-green-700 font-medium' : 'text-gray-600'}`}>
                  {PHOTO_LABELS[photoType as PhotoType] || photoType}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {requirements.missing.length > 0 && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm font-medium text-red-900 mb-2">Missing:</p>
          <ul className="text-sm text-red-800 space-y-1">
            {requirements.missing.map((photoType) => (
              <li key={photoType} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 bg-red-500 rounded-full"></span>
                {PHOTO_LABELS[photoType as PhotoType] || photoType}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
