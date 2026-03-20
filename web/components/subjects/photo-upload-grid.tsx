'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Camera, CheckCircle2, Loader2, RefreshCw, Video, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { PhotoType, SubjectPhoto } from '@/modules/subjects/subject.types';

const PHOTO_LABELS: Record<PhotoType, string> = {
  serial_number: 'Serial Number',
  machine: 'Machine',
  bill: 'Invoice',
  job_sheet: 'Job Sheet',
  defective_part: 'Defective Part',
  site_photo_1: 'Site Photo 1',
  site_photo_2: 'Site Photo 2',
  site_photo_3: 'Site Photo 3',
  service_video: 'Service Video',
};

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const VIDEO_TYPES = ['video/mp4', 'video/quicktime'];
const IMAGE_MAX_BYTES = 2 * 1024 * 1024;
const VIDEO_MAX_BYTES = 50 * 1024 * 1024;

interface CardRuntimeState {
  localPreviewUrl?: string;
  uploading?: boolean;
  error?: string;
  retryFile?: File;
}

interface Props {
  requiredTypes: PhotoType[];
  uploadedTypes: PhotoType[];
  photos: SubjectPhoto[];
  canEdit: boolean;
  uploadAttempted?: boolean;
  onUpload: (args: { file: File; photoType: PhotoType }) => Promise<unknown>;
  onRemove?: (args: { photoId: string; storagePath: string; photoType: PhotoType }) => Promise<unknown>;
}

function progressColorClass(done: number, total: number) {
  if (total === 0) return 'bg-slate-400';
  const ratio = done / total;
  if (ratio < 0.4) return 'bg-rose-500';
  if (ratio < 1) return 'bg-amber-500';
  return 'bg-emerald-500';
}

export function PhotoUploadGrid({
  requiredTypes,
  uploadedTypes,
  photos,
  canEdit,
  uploadAttempted,
  onUpload,
  onRemove,
}: Props) {
  const [runtimeState, setRuntimeState] = useState<Record<PhotoType, CardRuntimeState>>({} as Record<PhotoType, CardRuntimeState>);
  const [selectedPhoto, setSelectedPhoto] = useState<SubjectPhoto | null>(null);
  const [longPressCard, setLongPressCard] = useState<PhotoType | null>(null);
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const objectUrlSetRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const objectUrls = objectUrlSetRef.current;
    return () => {
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
      objectUrls.clear();
    };
  }, []);

  const photoByType = useMemo(() => {
    const map = new Map<PhotoType, SubjectPhoto>();
    for (const item of photos) {
      map.set(item.photo_type, item);
    }
    return map;
  }, [photos]);

  const doneCount = uploadedTypes.length;
  const totalCount = requiredTypes.length;
  const progressWidth = totalCount > 0 ? (doneCount / totalCount) * 100 : 0;

  const setCardState = (type: PhotoType, updater: (prev: CardRuntimeState) => CardRuntimeState) => {
    setRuntimeState((prev) => ({
      ...prev,
      [type]: updater(prev[type] ?? {}),
    }));
  };

  const validateFile = (photoType: PhotoType, file: File): string | null => {
    const isVideo = photoType === 'service_video';
    const allowed = isVideo ? VIDEO_TYPES : IMAGE_TYPES;
    const maxBytes = isVideo ? VIDEO_MAX_BYTES : IMAGE_MAX_BYTES;

    if (!allowed.includes(file.type)) {
      return isVideo ? 'Only MP4 or MOV allowed.' : 'Only JPEG, PNG, or WebP allowed.';
    }

    if (file.size > maxBytes) {
      return isVideo ? 'File too large. Max 50MB.' : 'File too large. Max 2MB.';
    }

    return null;
  };

  const uploadFile = async (photoType: PhotoType, file: File) => {
    const validationError = validateFile(photoType, file);
    if (validationError) {
      setCardState(photoType, (prev) => ({
        ...prev,
        error: validationError,
        retryFile: undefined,
      }));
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    objectUrlSetRef.current.add(previewUrl);

    setCardState(photoType, (prev) => {
      if (prev.localPreviewUrl) {
        URL.revokeObjectURL(prev.localPreviewUrl);
        objectUrlSetRef.current.delete(prev.localPreviewUrl);
      }

      return {
        ...prev,
        localPreviewUrl: previewUrl,
        uploading: true,
        error: undefined,
        retryFile: file,
      };
    });

    try {
      await onUpload({ file, photoType });
      setCardState(photoType, (prev) => ({
        ...prev,
        uploading: false,
        error: undefined,
      }));
    } catch (err) {
      setCardState(photoType, (prev) => ({
        ...prev,
        uploading: false,
        error: err instanceof Error ? err.message : 'Upload failed',
        retryFile: file,
      }));
    }
  };

  const handlePick = (photoType: PhotoType, file: File | null) => {
    if (!file || !canEdit) return;
    void uploadFile(photoType, file);
  };

  const handleRemove = async (photoType: PhotoType) => {
    if (!canEdit || !onRemove) return;

    const existing = photoByType.get(photoType);
    if (!existing) return;

    setCardState(photoType, (prev) => ({ ...prev, uploading: true, error: undefined }));

    try {
      await onRemove({
        photoId: existing.id,
        storagePath: existing.storage_path,
        photoType,
      });

      setCardState(photoType, (prev) => {
        if (prev.localPreviewUrl) {
          URL.revokeObjectURL(prev.localPreviewUrl);
          objectUrlSetRef.current.delete(prev.localPreviewUrl);
        }
        return {
          localPreviewUrl: undefined,
          uploading: false,
          error: undefined,
          retryFile: undefined,
        };
      });
      setLongPressCard(null);
    } catch (err) {
      setCardState(photoType, (prev) => ({
        ...prev,
        uploading: false,
        error: err instanceof Error ? err.message : 'Remove failed',
      }));
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm font-medium text-slate-700">
          <span>{doneCount} of {totalCount} uploaded</span>
          <span>{doneCount === totalCount ? 'Ready' : 'Pending uploads'}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-200">
          <div
            className={`h-full transition-all ${progressColorClass(doneCount, totalCount)}`}
            style={{ width: `${progressWidth}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {requiredTypes.map((photoType) => {
          const state = runtimeState[photoType] ?? {};
          const uploaded = uploadedTypes.includes(photoType);
          const existing = photoByType.get(photoType);
          const preview = state.localPreviewUrl ?? existing?.public_url;
          const isVideo = photoType === 'service_video';
          const showPulse = Boolean(uploadAttempted && !uploaded);
          const showRemove = canEdit && uploaded && (longPressCard === photoType);

          return (
            <div key={photoType} className="space-y-1">
              <label
                className={`group relative flex aspect-square cursor-pointer flex-col overflow-hidden rounded-xl border bg-white p-2 transition-all ${
                  showPulse ? 'border-rose-400 animate-pulse' : 'border-slate-200 hover:border-blue-400'
                } ${state.uploading ? 'opacity-80' : ''}`}
                onTouchStart={() => {
                  if (longPressRef.current) clearTimeout(longPressRef.current);
                  longPressRef.current = setTimeout(() => setLongPressCard(photoType), 500);
                }}
                onTouchEnd={() => {
                  if (longPressRef.current) clearTimeout(longPressRef.current);
                }}
                onMouseEnter={() => {
                  if (uploaded && canEdit) setLongPressCard(photoType);
                }}
                onMouseLeave={() => {
                  if (longPressCard === photoType) setLongPressCard(null);
                }}
                onClick={(e) => {
                  if (uploaded && existing) {
                    e.preventDefault();
                    setSelectedPhoto(existing);
                  }
                }}
              >
                <input
                  type="file"
                  className="hidden"
                  disabled={!canEdit || state.uploading}
                  accept={isVideo ? VIDEO_TYPES.join(',') : IMAGE_TYPES.join(',')}
                  onChange={(e) => {
                    const file = e.currentTarget.files?.[0] ?? null;
                    handlePick(photoType, file);
                    e.currentTarget.value = '';
                  }}
                />

                {preview ? (
                  isVideo ? (
                    <div className="relative h-full w-full rounded-lg bg-slate-100">
                      <video src={preview} className="h-full w-full rounded-lg object-cover" />
                    </div>
                  ) : (
                    <img src={preview} alt={PHOTO_LABELS[photoType]} className="h-full w-full rounded-lg object-cover" />
                  )
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center rounded-lg bg-slate-50 text-slate-500">
                    {isVideo ? <Video className="h-8 w-8" /> : <Camera className="h-8 w-8" />}
                    <span className="mt-2 text-[11px] font-medium text-center">Tap to upload</span>
                  </div>
                )}

                <div className="pointer-events-none absolute left-2 bottom-2 rounded-md bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
                  {PHOTO_LABELS[photoType]}
                </div>

                <div className="absolute right-2 top-2 rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">
                  Required
                </div>

                {uploaded && (
                  <div className="absolute bottom-2 right-2 rounded-full bg-emerald-600 p-1 text-white shadow">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                )}

                {state.uploading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/35">
                    <Loader2 className="h-6 w-6 animate-spin text-white" />
                  </div>
                )}

                {state.error && !state.uploading && (
                  <div className="absolute bottom-2 right-2 rounded-full bg-rose-600 p-1 text-white shadow">
                    <X className="h-4 w-4" />
                  </div>
                )}

                {showRemove && onRemove && (
                  <button
                    type="button"
                    className="absolute right-2 top-2 z-10 rounded-full bg-rose-600 p-1 text-white shadow hover:bg-rose-700"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      void handleRemove(photoType);
                    }}
                    aria-label={`Remove ${PHOTO_LABELS[photoType]}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </label>

              {state.error && (
                <div className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-700">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" />{state.error}</span>
                    {state.retryFile && canEdit && (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded bg-white px-1.5 py-0.5 text-[11px] font-semibold text-rose-700 border border-rose-200"
                        onClick={() => void uploadFile(photoType, state.retryFile!)}
                      >
                        <RefreshCw className="h-3 w-3" />Retry
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Dialog open={!!selectedPhoto} onOpenChange={(open: boolean) => !open && setSelectedPhoto(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedPhoto ? PHOTO_LABELS[selectedPhoto.photo_type] : ''}</DialogTitle>
            <DialogDescription>Uploaded preview</DialogDescription>
          </DialogHeader>
          {selectedPhoto && (
            <div className="rounded-lg bg-slate-100 overflow-hidden max-h-[70vh]">
              {selectedPhoto.mime_type?.startsWith('video/') ? (
                <video src={selectedPhoto.public_url} controls className="w-full h-auto max-h-[70vh]" />
              ) : (
                <img src={selectedPhoto.public_url} alt={PHOTO_LABELS[selectedPhoto.photo_type]} className="w-full h-auto max-h-[70vh] object-contain" />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
