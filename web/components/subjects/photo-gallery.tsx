import React, { useState } from 'react';
import { Trash2, Calendar, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/dialog';
import type { SubjectPhoto } from '@/modules/subjects/subject.types';

function formatDistanceToNow(date: Date, options?: { addSuffix?: boolean }): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  let result = '';
  if (diffMins < 1) result = 'just now';
  else if (diffMins < 60) result = `${diffMins}m ago`;
  else if (diffHours < 24) result = `${diffHours}h ago`;
  else if (diffDays < 7) result = `${diffDays}d ago`;
  else result = date.toLocaleDateString();
  
  return result;
}

interface PhotoGalleryProps {
  photos: SubjectPhoto[];
  onDeletePhoto?: (photoId: string, storagePath: string) => void;
  isDeleting?: boolean;
  isAssignedTechnician?: boolean;
}

const PHOTO_LABELS: Record<string, string> = {
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

export function PhotoGallery({
  photos,
  onDeletePhoto,
  isDeleting,
  isAssignedTechnician,
}: PhotoGalleryProps) {
  const [selectedPhoto, setSelectedPhoto] = useState<SubjectPhoto | null>(null);
  const [photoToDelete, setPhotoToDelete] = useState<SubjectPhoto | null>(null);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);

  if (!photos || photos.length === 0) {
    return (
      <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-gray-500">No photos uploaded yet</p>
      </div>
    );
  }

  const isVideo = (photo: SubjectPhoto) => photo.mime_type?.startsWith('video/');
  const sanitizeFileName = (value: string) => {
    return value.replace(/[^a-zA-Z0-9._-]/g, '_');
  };

  const guessExtension = (photo: SubjectPhoto) => {
    if (photo.mime_type?.startsWith('video/')) {
      return 'mp4';
    }
    if (photo.mime_type?.includes('png')) {
      return 'png';
    }
    if (photo.mime_type?.includes('webp')) {
      return 'webp';
    }
    return 'jpg';
  };

  const makeDownloadName = (photo: SubjectPhoto) => {
    const label = PHOTO_LABELS[photo.photo_type] || photo.photo_type;
    const safeLabel = sanitizeFileName(label.toLowerCase().replaceAll(' ', '-'));
    return `${safeLabel}-${photo.id}.${guessExtension(photo)}`;
  };

  const triggerDownload = async (photo: SubjectPhoto) => {
    try {
      const response = await fetch(photo.public_url);
      if (!response.ok) {
        throw new Error(`Failed to fetch file (${response.status})`);
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = makeDownloadName(photo);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      // Fallback keeps access to full-resolution public file if blob download fails.
      window.open(photo.public_url, '_blank', 'noopener,noreferrer');
    }
  };

  const downloadAll = async () => {
    setIsDownloadingAll(true);
    try {
      for (const photo of photos) {
        // Small delay to avoid browser popup/download throttling when opening multiple files.
        // eslint-disable-next-line no-await-in-loop
        await triggerDownload(photo);
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => setTimeout(resolve, 180));
      }
    } finally {
      setIsDownloadingAll(false);
    }
  };

  return (
    <>
      <div className="mb-3 flex items-center justify-end">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => void downloadAll()}
          disabled={isDownloadingAll || photos.length === 0}
          className="inline-flex items-center gap-1"
        >
          <Download className="h-4 w-4" />
          {isDownloadingAll ? 'Downloading...' : 'Download All'}
        </Button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {photos.map((photo) => (
          <div key={photo.id} className="relative group">
            <div
              onClick={() => setSelectedPhoto(photo)}
              className="
                aspect-square bg-gray-100 rounded-lg overflow-hidden cursor-pointer
                border border-gray-200 hover:border-blue-400 transition-colors
              "
            >
              {isVideo(photo) ? (
                <div className="w-full h-full flex items-center justify-center bg-gray-200">
                  <video
                    src={photo.public_url}
                    className="max-w-full max-h-full"
                  />
                </div>
              ) : (
                <img
                  src={photo.public_url}
                  alt={PHOTO_LABELS[photo.photo_type] || photo.photo_type}
                  className="w-full h-full object-cover"
                />
              )}
            </div>

            <div className="absolute inset-0 rounded-lg bg-black/0 transition-colors group-hover:bg-black/20 flex items-center justify-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setSelectedPhoto(photo)}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              >
                View
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => void triggerDownload(photo)}
                className="inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Download className="h-3.5 w-3.5" />
                Download
              </Button>
            </div>

            {isAssignedTechnician && onDeletePhoto && (
              <Button
                size="sm"
                variant="destructive"
                className="
                  absolute top-1 right-1 p-1 h-auto w-auto
                  opacity-0 group-hover:opacity-100 transition-opacity
                "
                onClick={() => setPhotoToDelete(photo)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}

            <p className="text-xs text-gray-600 mt-1 truncate">
              {PHOTO_LABELS[photo.photo_type] || photo.photo_type}
            </p>
          </div>
        ))}
      </div>

      {/* Photo Detail Dialog */}
      <Dialog open={!!selectedPhoto} onOpenChange={(open: boolean) => !open && setSelectedPhoto(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{PHOTO_LABELS[selectedPhoto?.photo_type || ''] || selectedPhoto?.photo_type}</DialogTitle>
            {selectedPhoto && (
              <DialogDescription>
                Uploaded {formatDistanceToNow(new Date(selectedPhoto.uploaded_at), { addSuffix: true })}
              </DialogDescription>
            )}
          </DialogHeader>

          {selectedPhoto && (
            <div className="space-y-4">
              <div className="bg-gray-100 rounded-lg overflow-hidden max-h-96">
                {isVideo(selectedPhoto) ? (
                  <video
                    src={selectedPhoto.public_url}
                    controls
                    className="w-full h-auto max-h-96"
                  />
                ) : (
                  <img
                    src={selectedPhoto.public_url}
                    alt={PHOTO_LABELS[selectedPhoto.photo_type] || selectedPhoto.photo_type}
                    className="w-full h-auto max-h-96 object-contain"
                  />
                )}
              </div>

                <div className="flex gap-2 justify-between text-sm text-gray-500">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    <span>
                      {new Date(selectedPhoto.uploaded_at).toLocaleDateString()} at{' '}
                      {new Date(selectedPhoto.uploaded_at).toLocaleTimeString()}
                    </span>
                  </div>
                  {selectedPhoto.file_size_bytes && (
                    <span>Size: {(selectedPhoto.file_size_bytes / 1024).toFixed(2)} KB</span>
                  )}
                </div>

              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void triggerDownload(selectedPhoto)}
                  className="inline-flex items-center gap-1"
                >
                  <Download className="h-4 w-4" />
                  Download Full File
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!photoToDelete} onOpenChange={(open: boolean) => !open && setPhotoToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Photo</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this photo? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-2 justify-end">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={isDeleting}
              onClick={() => {
                if (photoToDelete && onDeletePhoto) {
                  onDeletePhoto(photoToDelete.id, photoToDelete.storage_path);
                  setPhotoToDelete(null);
                }
              }}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
