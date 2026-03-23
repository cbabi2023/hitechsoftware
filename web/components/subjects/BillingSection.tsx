// ─────────────────────────────────────────────────────────────────────────────
// BillingSection.tsx
//
// Billing control panel on the Subject Detail page.
// Responsibility matrix:
//   Technician (assigned)  — upload media, add/remove accessories, generate bill
//   Office staff           — view bill, update payment status (cash/UPI/...)
//   Super admin            — all of the above + edit existing bill charges
//
// Warranty state is derived from subject fields at render time and controls:
//   • What label appears in the warranty badge
//   • Whether a payment_mode field is required on bill generation
//   • Whether grand_total is shown as 'brand dealer invoice' or 'customer receipt'
//
// canGenerate guard: assigned technician + status=IN_PROGRESS + no existing bill
// canGenerateAndComplete: additionally requires at least one photo uploaded
//   (matches the API route's photos count check).
// ─────────────────────────────────────────────────────────────────────────────
'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { AlertCircle, Upload, Video, X } from 'lucide-react';
import type { PaymentMode, SubjectDetail, SubjectPhoto } from '@/modules/subjects/subject.types';
import { SUBJECT_QUERY_KEYS } from '@/modules/subjects/subject.constants';
import { PAYMENT_MODES } from '@/modules/subjects/subject.constants';
import {
  useDownloadBill,
  useEditBill,
  useGenerateBill,
  useSubjectAccessories,
  useSubjectBill,
  useUpdateBillPaymentStatus,
} from '@/hooks/subjects/useBilling';
import { BillCard } from '@/components/subjects/BillCard';
import { BillEditPanel } from '@/components/subjects/BillEditPanel';
import { isLikelyVideoFile, isLikelyImageFile, compressImageForUpload } from '@/lib/utils/image-compression';
import { formatMoney } from '@/lib/utils/format';

interface Props {
  subject: SubjectDetail;
  userRole: string | null;
  userId: string | null;
}

export function BillingSection({ subject, userRole, userId }: Props) {
  const queryClient = useQueryClient();
  const accessoriesQuery = useSubjectAccessories(subject.id);
  const billQuery = useSubjectBill(subject.id);
  const generateMutation = useGenerateBill(subject.id);
  const updatePaymentMutation = useUpdateBillPaymentStatus(subject.id);
  const editBillMutation = useEditBill(subject.id);
  const downloadBill = useDownloadBill();

  const [visitCharge, setVisitCharge] = useState(subject.visit_charge ?? 0);
  const [serviceCharge, setServiceCharge] = useState(subject.service_charge ?? 0);
  const [paymentMode, setPaymentMode] = useState<PaymentMode | ''>('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [imagePreviewErrors, setImagePreviewErrors] = useState<Record<string, string>>({});
  const [isEditingBill, setIsEditingBill] = useState(false);

  // ── Warranty state ───────────────────────────────────────────────────────
  // Derived at render time (not from DB) because bill generation compares 
  // warranty_end_date against today's date at generation time.
  const todayIso = new Date().toISOString().split('T')[0];
  const isWarrantyDateNotNoted = !subject.is_amc_service && !subject.warranty_end_date;
  const isUnderWarranty = Boolean(subject.warranty_end_date && subject.warranty_end_date >= todayIso);
  const isOutOfWarranty = !subject.is_amc_service && !isWarrantyDateNotNoted && !isUnderWarranty;
  const warrantyStateLabel = subject.is_amc_service
    ? 'AMC Service'
    : isWarrantyDateNotNoted
      ? 'Warranty Date Not Noted'
      : isUnderWarranty
        ? 'Under Warranty'
        : 'Warranty Out';
  const warrantyStateClassName = subject.is_amc_service
    ? 'border-blue-200 bg-blue-50 text-blue-800'
    : isWarrantyDateNotNoted
      ? 'border-amber-200 bg-amber-50 text-amber-800'
      : isUnderWarranty
        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
        : 'border-slate-200 bg-slate-50 text-slate-700';
  const isCustomerChargeable = subject.service_charge_type === 'customer';
  // ── Permission flags ────────────────────────────────────────────────────
  const isAssignedTechnician = userRole === 'technician' && userId === subject.assigned_technician_id;
  const canGenerate = isAssignedTechnician && subject.status === 'IN_PROGRESS' && !subject.bill_generated;
  const canUpdatePayment = userRole === 'office_staff' || userRole === 'super_admin';
  const canEditBill = userRole === 'super_admin' && Boolean(subject.bill_generated);
  const canManageMedia = isAssignedTechnician || userRole === 'office_staff' || userRole === 'super_admin';
  // Allow privileged roles to add/view media even after job is COMPLETED
  // so records can be corrected or supplemented by office staff.
  const canMaintainCompletedMedia = subject.status === 'COMPLETED' && canManageMedia;

  const accessories = accessoriesQuery.data?.items ?? [];
  const accessoriesTotal = accessoriesQuery.data?.total ?? 0;
  const uploadedMedia = subject.photos ?? [];
  const canGenerateAndComplete = canGenerate && uploadedMedia.length > 0;

  const uploadMediaMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('photoType', isLikelyVideoFile(file) ? 'service_video' : 'machine');

      const res = await fetch(`/api/subjects/${subject.id}/photos/upload`, {
        method: 'POST',
        body: formData,
      });

      let payload: unknown = null;
      const responseText = await res.text();
      if (responseText) {
        try {
          payload = JSON.parse(responseText) as unknown;
        } catch {
          payload = { ok: false, error: { message: responseText } };
        }
      }

      const apiPayload = payload as {
        ok?: boolean;
        error?: { code?: string; step?: string; userMessage?: string; message?: string };
      };

      if (!res.ok || !apiPayload?.ok) {
        const code = apiPayload?.error?.code ?? `HTTP_${res.status}`;
        const step = apiPayload?.error?.step ? ` | ${apiPayload.error.step}` : '';
        const userReason = apiPayload?.error?.userMessage ?? '';
        const technicalReason = apiPayload?.error?.message ?? '';
        const reason = userReason && technicalReason && technicalReason !== userReason
          ? `${userReason} (Reason: ${technicalReason})`
          : (userReason || technicalReason || `Upload failed with status ${res.status}`);
        throw new Error(`[${code}] ${reason}${step}`);
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

  // Accessories GST breakdown from individual items
  const accessoriesBaseTotal = useMemo(() => {
    return accessories.reduce((sum, item) => sum + Number(item.line_base_total || 0), 0);
  }, [accessories]);

  const accessoriesGstTotal = useMemo(() => {
    return accessories.reduce((sum, item) => sum + Number(item.line_gst_total || 0), 0);
  }, [accessories]);

  const accessoriesDiscountTotal = useMemo(() => {
    return accessories.reduce((sum, item) => sum + Number(item.discount_amount || 0) * Number(item.quantity || 0), 0);
  }, [accessories]);

  // Visit/Service charges are also GST-inclusive — split them
  const visitChargeBase = useMemo(() => Math.round(Number(visitCharge || 0) / 1.18 * 100) / 100, [visitCharge]);
  const visitChargeGst = useMemo(() => Math.round((Number(visitCharge || 0) - visitChargeBase) * 100) / 100, [visitCharge, visitChargeBase]);
  const serviceChargeBase = useMemo(() => Math.round(Number(serviceCharge || 0) / 1.18 * 100) / 100, [serviceCharge]);
  const serviceChargeGst = useMemo(() => Math.round((Number(serviceCharge || 0) - serviceChargeBase) * 100) / 100, [serviceCharge, serviceChargeBase]);

  const totalBaseAmount = useMemo(() => accessoriesBaseTotal + visitChargeBase + serviceChargeBase, [accessoriesBaseTotal, visitChargeBase, serviceChargeBase]);
  const totalGstAmount = useMemo(() => accessoriesGstTotal + visitChargeGst + serviceChargeGst, [accessoriesGstTotal, visitChargeGst, serviceChargeGst]);
  const grandTotal = useMemo(() => Number(visitCharge || 0) + Number(serviceCharge || 0) + Number(accessoriesTotal || 0), [visitCharge, serviceCharge, accessoriesTotal]);

  return (
    <div className={`rounded-xl border p-5 ${isCustomerChargeable ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white'}`}>
      <div className="mb-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Billing</h3>
        <p className="mt-1 text-xs text-slate-500">Generate exactly one bill after job completion evidence is ready.</p>
        <div className={`mt-2 rounded-lg border px-3 py-2 ${warrantyStateClassName}`}>
          <p className="text-xs font-semibold uppercase tracking-wide">Warranty Status: {warrantyStateLabel}</p>
          {isWarrantyDateNotNoted ? (
            <p className="mt-0.5 text-xs">Warranty date is missing. Set warranty end date first to allow bill generation.</p>
          ) : null}
        </div>
        {isCustomerChargeable && (
          <div className="mt-2 rounded-lg border border-amber-200 bg-amber-100 px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">Customer Chargeable</p>
            <p className="mt-0.5 text-xs text-amber-800">Use the Record Payment From Customer action after collecting payment.</p>
          </div>
        )}
      </div>

      {billQuery.data ? (
        <>
          <BillCard
            bill={billQuery.data}
            highlightCustomerPayment={isCustomerChargeable}
            canUpdatePayment={canUpdatePayment}
            onUpdatePaymentStatus={(status, paymentMode) => {
              const billId = billQuery.data?.id;
              if (!billId) return;
              updatePaymentMutation.mutate({ billId, paymentStatus: status, paymentMode });
            }}
            isUpdatingPayment={updatePaymentMutation.isPending}
            onDownload={() => {
              const billId = billQuery.data?.id;
              if (!billId) return;
              downloadBill(billId);
            }}
            canEditBill={canEditBill}
            onEditBill={() => setIsEditingBill(true)}
          />
          {isEditingBill && billQuery.data && (
            <BillEditPanel
              bill={billQuery.data}
              accessories={accessories}
              isSaving={editBillMutation.isPending}
              onSave={(payload) => {
                editBillMutation.mutate(payload, {
                  onSuccess: () => setIsEditingBill(false),
                });
              }}
              onCancel={() => setIsEditingBill(false)}
            />
          )}
        </>
      ) : null}

      {!billQuery.isLoading && ((!billQuery.data && canGenerate) || canMaintainCompletedMedia) && (
        <div className="space-y-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm font-semibold text-blue-900">
            {canMaintainCompletedMedia ? 'Post-Service Media Maintenance' : 'Generate Final Bill'}
          </p>

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
                    disabled={!canManageMedia || uploadMediaMutation.isPending || uploadedMedia.length >= 12}
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

                      setUploadError(null);

                      const filesToUpload = files.slice(0, availableSlots);
                      for (const file of filesToUpload) {
                        try {
                          const preparedFile = isLikelyImageFile(file)
                            ? await compressImageForUpload(file)
                            : file;
                          await uploadMediaMutation.mutateAsync(preparedFile);
                        } catch (error) {
                          setUploadError(error instanceof Error ? error.message : 'Failed to upload media');
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
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
                  <p className="text-xs font-semibold text-rose-700">Upload failed</p>
                  <p className="mt-0.5 text-xs text-rose-700">{uploadError}</p>
                </div>
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
                        ) : imagePreviewErrors[item.id] ? (
                          <div className="flex h-24 flex-col items-center justify-center bg-amber-100 px-2 text-center">
                            <p className="text-[10px] font-semibold text-amber-800">Preview unavailable</p>
                            <p className="mt-0.5 text-[10px] text-amber-700">{imagePreviewErrors[item.id]}</p>
                          </div>
                        ) : (
                          <img
                            src={item.public_url}
                            alt="Uploaded item"
                            className="h-24 w-full object-cover"
                            onError={() => {
                              setImagePreviewErrors((prev) => ({
                                ...prev,
                                [item.id]: 'Storage URL is not accessible. Check bucket public/read access.',
                              }));
                            }}
                          />
                        )}
                        {canManageMedia && (
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
              {!canManageMedia && (
                <p className="text-xs text-slate-500">You can view uploads, but only assigned technician, office staff, or super admin can modify media.</p>
              )}
            </div>
          </div>

          {!canMaintainCompletedMedia && (
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
          )}

          {!canMaintainCompletedMedia && (
          <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
            <div className="flex items-center justify-between text-slate-700">
              <span>Accessories Total</span>
              <span>INR {formatMoney(accessoriesTotal)}</span>
            </div>
            {accessoriesDiscountTotal > 0 && (
              <div className="mt-1 flex items-center justify-between text-slate-500">
                <span>Total Discount</span>
                <span>−INR {formatMoney(accessoriesDiscountTotal)}</span>
              </div>
            )}
            <div className="mt-1 flex items-center justify-between text-slate-500">
              <span>Base Amount (excl. GST)</span>
              <span>INR {formatMoney(totalBaseAmount)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-slate-500">
              <span>GST 18%</span>
              <span>INR {formatMoney(totalGstAmount)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between font-semibold text-slate-900">
              <span>Grand Total</span>
              <span>INR {formatMoney(grandTotal)}</span>
            </div>
          </div>
          )}

          {!canMaintainCompletedMedia && (
          <button
            type="button"
            disabled={generateMutation.isPending || uploadMediaMutation.isPending || uploadedMedia.length === 0 || isWarrantyDateNotNoted}
            onClick={() => {
              if (isWarrantyDateNotNoted) {
                setUploadError('Warranty date is not noted. Update warranty end date before generating bill.');
                return;
              }

              if (!canGenerateAndComplete) {
                setUploadError('Upload at least one photo or video before generating bill.');
                return;
              }

              generateMutation.mutate({
                visit_charge: visitCharge,
                service_charge: serviceCharge,
                apply_gst: true,
                payment_mode: isOutOfWarranty && paymentMode ? paymentMode : undefined,
                accessories: accessories.map((item) => ({
                  item_name: item.item_name,
                  quantity: item.quantity,
                  mrp: item.mrp,
                  discount_type: item.discount_type,
                  discount_value: item.discount_value,
                })),
              });
            }}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {generateMutation.isPending ? 'Generating Bill & Completing Job...' : 'Generate Bill & Complete Job'}
          </button>
          )}
          {!canMaintainCompletedMedia && (
          <p className="text-xs text-slate-600">
            Charges and payment mode are optional. Upload at least one media item to continue.
          </p>
          )}
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
