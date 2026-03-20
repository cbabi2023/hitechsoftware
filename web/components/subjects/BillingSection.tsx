'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { AlertCircle, Upload, Video, X } from 'lucide-react';
import type { PaymentMode, SubjectDetail, SubjectPhoto } from '@/modules/subjects/subject.types';
import { SUBJECT_QUERY_KEYS } from '@/modules/subjects/subject.constants';
import { PAYMENT_MODES } from '@/modules/subjects/subject.constants';
import {
  useDownloadBill,
  useGenerateBill,
  useSubjectAccessories,
  useSubjectBill,
  useUpdateBillPaymentStatus,
} from '@/hooks/subjects/useBilling';
import { BillCard } from '@/components/subjects/BillCard';

interface Props {
  subject: SubjectDetail;
  userRole: string | null;
  userId: string | null;
}

const IMAGE_COMPRESSION_RATIO = 0.1; // target ~90% reduction, e.g. 1MB -> ~100KB
const IMAGE_MIN_TARGET_BYTES = 80 * 1024;

async function createImageBitmapFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to read image for compression'));
    };

    image.src = objectUrl;
  });
}

async function canvasToWebpBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Failed to compress image'));
        return;
      }
      resolve(blob);
    }, 'image/webp', quality);
  });
}

async function compressImageForUpload(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) {
    return file;
  }

  const targetBytes = Math.max(IMAGE_MIN_TARGET_BYTES, Math.floor(file.size * IMAGE_COMPRESSION_RATIO));

  if (file.size <= targetBytes) {
    return file;
  }

  const image = await createImageBitmapFromFile(file);

  let width = image.naturalWidth;
  let height = image.naturalHeight;
  let quality = 0.82;

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Image compression is not supported in this browser');
  }

  let bestBlob: Blob | null = null;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    canvas.width = Math.max(1, Math.round(width));
    canvas.height = Math.max(1, Math.round(height));

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const blob = await canvasToWebpBlob(canvas, quality);
    bestBlob = blob;

    if (blob.size <= targetBytes) {
      break;
    }

    if (attempt % 2 === 0) {
      quality = Math.max(0.45, quality - 0.1);
    } else {
      width = Math.max(640, Math.round(width * 0.85));
      height = Math.max(480, Math.round(height * 0.85));
    }
  }

  if (!bestBlob || bestBlob.size >= file.size) {
    return file;
  }

  const compressedName = file.name.replace(/\.[^/.]+$/, '') + '.webp';
  return new File([bestBlob], compressedName, {
    type: 'image/webp',
    lastModified: Date.now(),
  });
}

function formatMoney(value: number) {
  return value.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function BillingSection({ subject, userRole, userId }: Props) {
  const queryClient = useQueryClient();
  const accessoriesQuery = useSubjectAccessories(subject.id);
  const billQuery = useSubjectBill(subject.id);
  const generateMutation = useGenerateBill(subject.id);
  const updatePaymentMutation = useUpdateBillPaymentStatus(subject.id);
  const downloadBill = useDownloadBill();

  const [visitCharge, setVisitCharge] = useState(subject.visit_charge ?? 0);
  const [serviceCharge, setServiceCharge] = useState(subject.service_charge ?? 0);
  const [paymentMode, setPaymentMode] = useState<PaymentMode | ''>('');
  const [uploadError, setUploadError] = useState<string | null>(null);

  const isOutOfWarranty = !subject.is_warranty_service && !subject.is_amc_service;
  const isCustomerChargeable = subject.service_charge_type === 'customer';
  const isAssignedTechnician = userRole === 'technician' && userId === subject.assigned_technician_id;
  const canGenerate = isAssignedTechnician && subject.status === 'IN_PROGRESS' && !subject.bill_generated;
  const canUpdatePayment = userRole === 'office_staff' || userRole === 'super_admin';

  const accessories = accessoriesQuery.data?.items ?? [];
  const accessoriesTotal = accessoriesQuery.data?.total ?? 0;
  const uploadedMedia = subject.photos ?? [];
  const canGenerateAndComplete = canGenerate && uploadedMedia.length > 0;

  const uploadMediaMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('photoType', file.type.startsWith('video/') ? 'service_video' : 'machine');

      const res = await fetch(`/api/subjects/${subject.id}/photos/upload`, {
        method: 'POST',
        body: formData,
      });

      const json = await res.json() as {
        ok: boolean;
        error?: { userMessage?: string; message?: string };
      };

      if (!json.ok) {
        throw new Error(json.error?.userMessage ?? json.error?.message ?? 'Failed to upload media');
      }
    },
    onSuccess: () => {
      setUploadError(null);
      queryClient.invalidateQueries({ queryKey: SUBJECT_QUERY_KEYS.detail(subject.id) });
    },
    onError: (err: Error) => {
      setUploadError(err.message);
    },
  });

  const removeMediaMutation = useMutation({
    mutationFn: async (photo: SubjectPhoto) => {
      const res = await fetch(`/api/subjects/${subject.id}/photos`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoId: photo.id, storagePath: photo.storage_path }),
      });

      const json = await res.json() as {
        ok: boolean;
        error?: { userMessage?: string; message?: string };
      };

      if (!json.ok) {
        throw new Error(json.error?.userMessage ?? json.error?.message ?? 'Failed to remove media');
      }
    },
    onSuccess: () => {
      setUploadError(null);
      queryClient.invalidateQueries({ queryKey: SUBJECT_QUERY_KEYS.detail(subject.id) });
    },
    onError: (err: Error) => {
      setUploadError(err.message);
    },
  });

  const grandTotal = useMemo(() => {
    return Number(visitCharge || 0) + Number(serviceCharge || 0) + Number(accessoriesTotal || 0);
  }, [visitCharge, serviceCharge, accessoriesTotal]);

  return (
    <div className={`rounded-xl border p-5 ${isCustomerChargeable ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white'}`}>
      <div className="mb-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Billing</h3>
        <p className="mt-1 text-xs text-slate-500">Generate exactly one bill after job completion evidence is ready.</p>
        {isCustomerChargeable && (
          <div className="mt-2 rounded-lg border border-amber-200 bg-amber-100 px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">Customer Chargeable</p>
            <p className="mt-0.5 text-xs text-amber-800">Use the Record Payment From Customer action after collecting payment.</p>
          </div>
        )}
      </div>

      {billQuery.data ? (
        <BillCard
          bill={billQuery.data}
          highlightCustomerPayment={isCustomerChargeable}
          canUpdatePayment={canUpdatePayment}
          onUpdatePaymentStatus={(status) => {
            const billId = billQuery.data?.id;
            if (!billId) return;
            updatePaymentMutation.mutate({ billId, paymentStatus: status });
          }}
          isUpdatingPayment={updatePaymentMutation.isPending}
          onDownload={() => {
            const billId = billQuery.data?.id;
            if (!billId) return;
            downloadBill(billId);
          }}
        />
      ) : null}

      {!billQuery.isLoading && !billQuery.data && canGenerate && (
        <div className="space-y-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm font-semibold text-blue-900">Generate Final Bill</p>

          <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600" />
                <p className="text-sm font-semibold text-slate-900">Upload Photos / Videos</p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-medium text-slate-600">
                <span>Uploaded {uploadedMedia.length} of 12 items</span>
                <span>{uploadedMedia.length > 0 ? 'Ready for billing' : 'Upload at least one item'}</span>
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full bg-emerald-500 transition-all"
                  style={{ width: `${Math.min(100, (uploadedMedia.length / 12) * 100)}%` }}
                />
              </div>

              <div className="flex items-center gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  <Upload className="h-4 w-4" />
                  <span>{uploadMediaMutation.isPending ? 'Uploading...' : 'Upload Media'}</span>
                  <input
                    type="file"
                    className="hidden"
                    disabled={uploadMediaMutation.isPending || uploadedMedia.length >= 12}
                    multiple
                    accept="image/*,video/mp4,video/quicktime"
                    onChange={async (event) => {
                      const files = Array.from(event.currentTarget.files ?? []);
                      event.currentTarget.value = '';

                      if (files.length === 0) return;

                      const availableSlots = Math.max(0, 12 - uploadedMedia.length);
                      if (availableSlots === 0) {
                        setUploadError('Maximum 12 uploads allowed for one job.');
                        return;
                      }

                      const filesToUpload = files.slice(0, availableSlots);
                      for (const file of filesToUpload) {
                        try {
                          const preparedFile = file.type.startsWith('image/')
                            ? await compressImageForUpload(file)
                            : file;
                          await uploadMediaMutation.mutateAsync(preparedFile);
                        } catch {
                          break;
                        }
                      }
                    }}
                  />
                </label>
                <span className="text-xs text-slate-500">Maximum 12 items</span>
              </div>
              <p className="text-xs text-slate-500">Allowed: any image format (up to 10MB each), MP4/MOV videos (up to 50MB each).</p>
              <p className="text-xs text-slate-500">Images are auto-compressed before upload (about 90% smaller when possible).</p>

              {uploadError && (
                <p className="text-xs text-rose-600">{uploadError}</p>
              )}

              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                {uploadedMedia.length === 0 ? (
                  <p className="col-span-full rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-xs text-slate-500">
                    No uploads yet. Add at least one photo/video before generating bill.
                  </p>
                ) : (
                  uploadedMedia.map((item) => {
                    const isVideo = item.mime_type?.startsWith('video/');
                    return (
                      <div key={item.id} className="group relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                        {isVideo ? (
                          <div className="relative flex h-24 items-center justify-center bg-slate-200">
                            <Video className="h-6 w-6 text-slate-600" />
                          </div>
                        ) : (
                          <img src={item.public_url} alt="Uploaded item" className="h-24 w-full object-cover" />
                        )}
                        {subject.status !== 'COMPLETED' && (
                          <button
                            type="button"
                            className="absolute right-1 top-1 rounded-full bg-rose-600 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                            onClick={() => removeMediaMutation.mutate(item)}
                            disabled={removeMediaMutation.isPending}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
              {uploadedMedia.length > 0 && (
                <p className="text-xs text-slate-500">You can remove any uploaded item using the X button on its preview.</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="text-sm text-slate-700">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Visit Charge (Optional)</span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={visitCharge}
                onChange={(event) => setVisitCharge(Math.max(0, Number(event.target.value || 0)))}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
              />
            </label>

            <label className="text-sm text-slate-700">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Service Charge (Optional)</span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={serviceCharge}
                onChange={(event) => setServiceCharge(Math.max(0, Number(event.target.value || 0)))}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
              />
            </label>

            {isOutOfWarranty ? (
              <label className="text-sm text-slate-700">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Payment Mode (Optional)</span>
                <select
                  value={paymentMode}
                  onChange={(event) => setPaymentMode(event.target.value as PaymentMode | '')}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                >
                  <option value="">Select later (mark as due)</option>
                  {PAYMENT_MODES.map((mode) => (
                    <option key={mode.value} value={mode.value}>{mode.label}</option>
                  ))}
                </select>
              </label>
            ) : (
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                Payment will be marked as Due for Brand / Dealer billing.
              </div>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
            <div className="flex items-center justify-between text-slate-700">
              <span>Accessories Total</span>
              <span>INR {formatMoney(accessoriesTotal)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between font-semibold text-slate-900">
              <span>Grand Total</span>
              <span>INR {formatMoney(grandTotal)}</span>
            </div>
          </div>

          <button
            type="button"
            disabled={generateMutation.isPending || uploadMediaMutation.isPending || uploadedMedia.length === 0}
            onClick={() => {
              if (!canGenerateAndComplete) {
                setUploadError('Upload at least one photo or video before generating bill.');
                return;
              }

              generateMutation.mutate({
                visit_charge: visitCharge,
                service_charge: serviceCharge,
                payment_mode: isOutOfWarranty && paymentMode ? paymentMode : undefined,
                accessories: accessories.map((item) => ({
                  item_name: item.item_name,
                  quantity: item.quantity,
                  unit_price: item.unit_price,
                })),
              });
            }}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {generateMutation.isPending ? 'Generating Bill & Completing Job...' : 'Generate Bill & Complete Job'}
          </button>
          <p className="text-xs text-slate-600">
            Charges and payment mode are optional. Upload at least one media item to continue.
          </p>
        </div>
      )}

      {!billQuery.isLoading && !billQuery.data && !canGenerate && (
        <p className="text-sm text-slate-500">
          {subject.bill_generated
            ? 'Bill has been generated for this subject.'
            : 'Billing becomes available when assigned technician reaches In Progress status.'}
        </p>
      )}
    </div>
  );
}
