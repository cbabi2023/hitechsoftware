'use client';

import React, { useState, useCallback } from 'react';
import { Upload, AlertCircle } from 'lucide-react';
import type { PhotoType } from '@/modules/subjects/subject.types';

interface PhotoUploadProps {
  photoType: PhotoType;
  onUpload: (file: File, photoType: PhotoType) => void;
  isUploading: boolean;
  uploadProgress?: number;
  uploadError?: Error | null;
  isCompleted?: boolean;
  uploaded?: boolean;
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

const ALLOWED_TYPES: Record<PhotoType, string[]> = {
  serial_number: ['image/jpeg', 'image/png', 'image/webp'],
  machine: ['image/jpeg', 'image/png', 'image/webp'],
  bill: ['image/jpeg', 'image/png', 'image/webp'],
  job_sheet: ['image/jpeg', 'image/png', 'image/webp'],
  defective_part: ['image/jpeg', 'image/png', 'image/webp'],
  site_photo_1: ['image/jpeg', 'image/png', 'image/webp'],
  site_photo_2: ['image/jpeg', 'image/png', 'image/webp'],
  site_photo_3: ['image/jpeg', 'image/png', 'image/webp'],
  service_video: ['video/mp4', 'video/quicktime'],
};

const MAX_FILE_SIZE: Record<PhotoType, number> = {
  serial_number: 2 * 1024 * 1024,
  machine: 2 * 1024 * 1024,
  bill: 2 * 1024 * 1024,
  job_sheet: 2 * 1024 * 1024,
  defective_part: 2 * 1024 * 1024,
  site_photo_1: 2 * 1024 * 1024,
  site_photo_2: 2 * 1024 * 1024,
  site_photo_3: 2 * 1024 * 1024,
  service_video: 50 * 1024 * 1024,
};

export function PhotoUpload({
  photoType,
  onUpload,
  isUploading,
  uploadProgress,
  uploadError,
  isCompleted,
  uploaded,
}: PhotoUploadProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const maxSize = MAX_FILE_SIZE[photoType];
  const allowedTypes = ALLOWED_TYPES[photoType];
  const isVideo = photoType === 'service_video';

  const validateFile = (file: File): { valid: boolean; error?: string } => {
    if (!allowedTypes.includes(file.type)) {
      const ext = isVideo ? 'MP4, MOV' : 'JPEG, PNG, WebP';
      return { valid: false, error: `Invalid format. Allowed: ${ext}` };
    }

    if (file.size > maxSize) {
      const maxMB = maxSize / (1024 * 1024);
      return { valid: false, error: `File too large. Max ${maxMB}MB allowed.` };
    }

    return { valid: true };
  };

  const handleFileChange = useCallback(
    (file: File | null) => {
      if (!file) return;

      const validation = validateFile(file);
      if (!validation.valid) {
        alert(validation.error);
        return;
      }

      onUpload(file, photoType);
    },
    [photoType, onUpload],
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    handleFileChange(file || null);
  };

  const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    const file = e.dataTransfer.files?.[0];
    handleFileChange(file || null);
  };

  if (isCompleted && uploaded) {
    return (
      <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
        <svg className="h-5 w-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
        <span className="text-sm font-medium text-green-700">{PHOTO_LABELS[photoType]} uploaded</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        {PHOTO_LABELS[photoType]}
        {!uploaded && <span className="text-red-500 ml-1">*</span>}
      </label>

      {uploadError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex gap-2">
          <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-800">{uploadError.message}</p>
        </div>
      )}

      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-lg p-6 text-center transition-colors
          ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50'}
          ${isUploading ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:border-blue-400'}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          onChange={handleInputChange}
          disabled={isUploading}
          className="hidden"
          accept={allowedTypes.join(',')}
        />

        {isUploading ? (
          <div className="space-y-2">
            <div className="inline-block p-3 bg-blue-100 rounded-full">
              <Upload className="h-5 w-5 text-blue-600 animate-pulse" />
            </div>
            <p className="text-sm font-medium text-gray-700">Uploading...</p>
            {uploadProgress !== undefined && (
              <>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500">{uploadProgress}%</p>
              </>
            )}
          </div>
        ) : (
          <div
            onClick={() => inputRef.current?.click()}
            className="space-y-2"
          >
            <div className="inline-block p-3 bg-gray-200 rounded-full">
              <Upload className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">
                Drop {isVideo ? 'video' : 'image'} or click to select
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {isVideo
                  ? 'MP4, MOV up to 50MB'
                  : 'JPEG, PNG, WebP up to 2MB'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
