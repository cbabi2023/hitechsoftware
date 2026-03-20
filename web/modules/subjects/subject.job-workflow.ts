import type { ServiceResult } from '@/types/common.types';
import type {
  JobCompletionRequirements,
  PhotoType,
  IncompleteReason,
  IncompleteJobInput,
} from '@/modules/subjects/subject.types';
import {
  uploadPhoto as uploadPhotoRepo,
  findBySubjectId,
  findBySubjectAndType,
  deletePhoto as deletePhotoRepo,
} from '@/repositories/photo.repository';
import {
  getSubjectById as getSubjectRepo,
  markArrived as repoMarkArrived,
  markInProgress as repoMarkInProgress,
} from '@/repositories/subject.repository';
import { createAdminClient } from '@/lib/supabase/admin';

// Valid status transitions for job workflow
// EN_ROUTE was removed — flow goes directly ACCEPTED → ARRIVED
const VALID_TRANSITIONS: Record<string, string[]> = {
  ACCEPTED: ['ARRIVED'],
  ARRIVED: ['IN_PROGRESS'],
  IN_PROGRESS: ['COMPLETED', 'INCOMPLETE', 'AWAITING_PARTS'],
};

export async function updateJobStatus(
  subjectId: string,
  technicianId: string,
  newStatus: string,
): Promise<ServiceResult<{ id: string; status: string }>> {
  // Get current subject
  const subjectResult = await getSubjectRepo(subjectId);
  if (subjectResult.error || !subjectResult.data) {
    return { ok: false, error: { message: 'Subject not found' } };
  }

  const subject = subjectResult.data as { assigned_technician_id: string | null; status: string };

  // Verify technician owns this
  if (subject.assigned_technician_id !== technicianId) {
    return { ok: false, error: { message: 'You are not assigned to this subject' } };
  }

  // Map display status to enum (ALLOCATED -> ACCEPTED already done, but ensure in_progress exists)
  const currentStatus = subject.status;
  const allowedNextStates = VALID_TRANSITIONS[currentStatus] ?? [];

  if (!allowedNextStates.includes(newStatus)) {
    return { ok: false, error: { message: `Cannot transition from ${currentStatus} to ${newStatus}` } };
  }

  // Determine timestamp column to set
  // Delegate to specialised repository function (sets the correct timestamp)
  let repoResult: { data: { id: string; status: string } | null; error: { message: string } | null };

  if (newStatus === 'ARRIVED') {
    repoResult = await repoMarkArrived(subjectId);
  } else if (newStatus === 'IN_PROGRESS') {
    repoResult = await repoMarkInProgress(subjectId);
  } else {
    // Fallback for other allowed transitions (e.g. AWAITING_PARTS)
    const admin = createAdminClient();
    repoResult = await admin
      .from('subjects')
      .update({ status: newStatus })
      .eq('id', subjectId)
      .select('id,status')
      .single<{ id: string; status: string }>();
  }

  if (repoResult.error) {
    return { ok: false, error: { message: repoResult.error.message } };
  }

  if (!repoResult.data) {
    return { ok: false, error: { message: 'Status update returned no data' } };
  }

  return { ok: true, data: repoResult.data };
}

export async function getRequiredPhotos(subjectId: string): Promise<ServiceResult<PhotoType[]>> {
  const subjectResult = await getSubjectRepo(subjectId);
  if (subjectResult.error || !subjectResult.data) {
    return { ok: false, error: { message: 'Subject not found' } };
  }

  const subject = subjectResult.data as { is_warranty_service: boolean; is_amc_service: boolean };

  // In-warranty or AMC: 6 photo types + 1 video = 7 uploads
  if (subject.is_warranty_service || subject.is_amc_service) {
    return {
      ok: true,
      data: [
        'serial_number',
        'machine',
        'bill',
        'job_sheet',
        'defective_part',
        'service_video',
      ],
    };
  }

  // Out-of-warranty: 3 photo types minimal
  return {
    ok: true,
    data: ['serial_number', 'machine', 'bill'],
  };
}

export async function checkCompletionRequirements(
  subjectId: string,
): Promise<ServiceResult<JobCompletionRequirements>> {
  const requiredResult = await getRequiredPhotos(subjectId);
  if (!requiredResult.ok) {
    return requiredResult;
  }

  const photosResult = await findBySubjectId(subjectId);
  if (photosResult.error) {
    return { ok: false, error: { message: photosResult.error.message } };
  }

  const uploaded = (photosResult.data ?? []).map(
    (p) => (p as { photo_type: PhotoType }).photo_type,
  );
  const required = requiredResult.data;
  const missing = required.filter((p) => !uploaded.includes(p));

  return {
    ok: true,
    data: {
      required,
      uploaded,
      missing,
      canComplete: missing.length === 0,
    },
  };
}

export async function uploadJobPhoto(
  subjectId: string,
  technicianId: string,
  file: File,
  photoType: PhotoType,
): Promise<ServiceResult<{ id: string; public_url: string }>> {
  // Verify technician owns subject
  const subjectResult = await getSubjectRepo(subjectId);
  if (subjectResult.error || !subjectResult.data) {
    return { ok: false, error: { message: 'Subject not found' } };
  }

  const subject = subjectResult.data as { assigned_technician_id: string | null };
  if (subject.assigned_technician_id !== technicianId) {
    return { ok: false, error: { message: 'You are not assigned to this subject' } };
  }

  // Validate file size
  const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2MB
  const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB
  const maxSize = photoType === 'service_video' ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;

  if (file.size > maxSize) {
    return {
      ok: false,
      error: {
        message: `File too large. Max ${photoType === 'service_video' ? '50MB' : '2MB'} allowed.`,
      },
    };
  }

  try {
    const photo = await uploadPhotoRepo(subjectId, photoType, file);
    return {
      ok: true,
      data: {
        id: photo.id,
        public_url: photo.public_url,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        message: error instanceof Error ? error.message : 'Failed to upload photo',
      },
    };
  }
}

export async function markJobIncomplete(
  subjectId: string,
  technicianId: string,
  input: IncompleteJobInput,
): Promise<ServiceResult<{ id: string; status: string }>> {
  // Verify technician owns subject
  const subjectResult = await getSubjectRepo(subjectId);
  if (subjectResult.error || !subjectResult.data) {
    return { ok: false, error: { message: 'Subject not found' } };
  }

  const subject = subjectResult.data as { assigned_technician_id: string | null };
  if (subject.assigned_technician_id !== technicianId) {
    return { ok: false, error: { message: 'You are not assigned to this subject' } };
  }

  // Validate reason
  const validReasons: IncompleteReason[] = [
    'customer_cannot_afford',
    'power_issue',
    'door_locked',
    'spare_parts_not_available',
    'site_not_ready',
    'other',
  ];

  if (!validReasons.includes(input.reason)) {
    return { ok: false, error: { message: 'Invalid incomplete reason' } };
  }

  // For 'other' reason — note is mandatory, minimum 10 characters
  if (input.reason === 'other') {
    if (!input.note || input.note.trim().length < 10) {
      return {
        ok: false,
        error: { message: 'Note required for "other" reason (minimum 10 characters)' },
      };
    }
  }

  // For spare_parts_not_available — part name and quantity are mandatory
  if (input.reason === 'spare_parts_not_available') {
    const hasItemList = Array.isArray(input.sparePartsItems) && input.sparePartsItems.length > 0;
    const itemListValid = hasItemList
      ? input.sparePartsItems!.every((item) => item.name.trim().length > 0 && item.quantity > 0 && item.price > 0)
      : false;

    if (!itemListValid && (!input.sparePartsRequested || !input.sparePartsQuantity || input.sparePartsQuantity <= 0)) {
      return {
        ok: false,
        error: { message: 'At least one spare part with name, quantity, and price is required' },
      };
    }
  }

  const admin = createAdminClient();
  const updateData: Record<string, unknown> = {
    status: 'INCOMPLETE',
    incomplete_at: new Date().toISOString(),
    incomplete_reason: input.reason,
    incomplete_note: input.note,
  };

  if (input.reason === 'spare_parts_not_available') {
    if (input.sparePartsItems && input.sparePartsItems.length > 0) {
      updateData.spare_parts_requested = JSON.stringify(input.sparePartsItems);
      updateData.spare_parts_quantity = input.sparePartsItems.reduce((sum, item) => sum + item.quantity, 0);
    } else {
      updateData.spare_parts_requested = input.sparePartsRequested ?? null;
      updateData.spare_parts_quantity = input.sparePartsQuantity ?? null;
    }
  }

  if (input.rescheduledDate) {
    updateData.rescheduled_date = input.rescheduledDate;
  }

  const result = await admin
    .from('subjects')
    .update(updateData)
    .eq('id', subjectId)
    .select('id,status')
    .single<{ id: string; status: string }>();

  if (result.error) {
    return { ok: false, error: { message: result.error.message } };
  }

  return { ok: true, data: result.data };
}

export async function markJobComplete(
  subjectId: string,
  technicianId: string,
  notes?: string,
): Promise<ServiceResult<{ id: string; status: string }>> {
  // Check completion requirements
  const requirementsResult = await checkCompletionRequirements(subjectId);
  if (!requirementsResult.ok) {
    return requirementsResult;
  }

  if (!requirementsResult.data.canComplete) {
    return {
      ok: false,
      error: {
        message: `Missing required photos: ${requirementsResult.data.missing.join(', ')}`,
      },
    };
  }

  // Verify technician owns subject
  const subjectResult = await getSubjectRepo(subjectId);
  if (subjectResult.error || !subjectResult.data) {
    return { ok: false, error: { message: 'Subject not found' } };
  }

  const subject = subjectResult.data as {
    assigned_technician_id: string | null;
    service_charge_type: string;
  };

  if (subject.assigned_technician_id !== technicianId) {
    return { ok: false, error: { message: 'You are not assigned to this subject' } };
  }

  const admin = createAdminClient();
  const updateData: Record<string, unknown> = {
    status: 'COMPLETED',
    completed_at: new Date().toISOString(),
    completion_proof_uploaded: true,
    completion_notes: notes ?? null,
  };

  // Auto-update billing status based on service type
  if (subject.service_charge_type === 'brand_dealer') {
    updateData.billing_status = 'due';
  }

  const result = await admin
    .from('subjects')
    .update(updateData)
    .eq('id', subjectId)
    .select('id,status')
    .single<{ id: string; status: string }>();

  if (result.error) {
    return { ok: false, error: { message: result.error.message } };
  }

  return { ok: true, data: result.data };
}
