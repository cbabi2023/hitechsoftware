import { assignSubjectTechnician, assignTechnicianFull, createSubject, deleteSubject, getSubjectById, getSubjectTimeline, listSubjects, recalculateSubjectBillingType, updateSubject, updateSubjectWarranty } from '@/repositories/subject.repository';
import { getAssignableTechnicianById, getAssignableTechnicians } from '@/modules/technicians/technician.service';
import type { ServiceResult } from '@/types/common.types';
import type {
  CreateSubjectInput,
  SubjectDetail,
  SubjectFormValues,
  SubjectListItem,
  SubjectListResponse,
  SubjectListFilters,
  UpdateSubjectInput,
  AssignTechnicianInput,
  WarrantyPeriod,
} from '@/modules/subjects/subject.types';
import { createSubjectSchema, updateSubjectSchema } from '@/modules/subjects/subject.validation';
import { SUBJECT_DEFAULT_PAGE_SIZE, WARRANTY_PERIODS } from '@/modules/subjects/subject.constants';

function normalizeOptional(value?: string) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function normalizeSubjectNumber(value: string) {
  return value.trim().toUpperCase();
}

function addMonths(dateText: string, months: number) {
  const date = new Date(dateText);
  date.setMonth(date.getMonth() + months);
  return date.toISOString().split('T')[0];
}

function monthsForWarrantyPeriod(period: WarrantyPeriod): number | null {
  const periodOption = WARRANTY_PERIODS.find((item) => item.value === period);
  return periodOption?.months ?? null;
}

function normalizeSubjectPayload(input: SubjectFormValues) {
  return {
    subject_number: normalizeSubjectNumber(input.subject_number),
    source_type: input.source_type,
    brand_id: normalizeOptional(input.brand_id),
    dealer_id: normalizeOptional(input.dealer_id),
    assigned_technician_id: normalizeOptional(input.assigned_technician_id),
    priority: input.priority,
    priority_reason: input.priority_reason.trim(),
    allocated_date: input.allocated_date,
    type_of_service: input.type_of_service,
    category_id: input.category_id,
    customer_phone: normalizeOptional(input.customer_phone),
    customer_name: normalizeOptional(input.customer_name),
    customer_address: normalizeOptional(input.customer_address),
    product_name: normalizeOptional(input.product_name),
    serial_number: normalizeOptional(input.serial_number),
    product_description: normalizeOptional(input.product_description),
    purchase_date: normalizeOptional(input.purchase_date),
    warranty_end_date: normalizeOptional(input.warranty_end_date),
    amc_end_date: normalizeOptional(input.amc_end_date),
  };
}

function mapRepositoryError(message?: string, code?: string) {
  const safeMessage = message?.trim() ?? 'Failed to process subject';

  if (code === '23505' || /duplicate key.*subject_number/i.test(safeMessage)) {
    return 'Subject number already exists for this source.';
  }

  if (code === '23514' || /violates check constraint/i.test(safeMessage)) {
    return 'Subject data violates business rules (source, priority, or service type).';
  }

  return safeMessage;
}

function mapRawSubjectList(data: unknown[]): SubjectListItem[] {
  return data.map((row) => {
    const typed = row as {
      id: string;
      subject_number: string;
      source_type: 'brand' | 'dealer';
      assigned_technician_id: string | null;
      priority: 'critical' | 'high' | 'medium' | 'low';
      status: string;
      allocated_date: string;
      customer_name: string | null;
      customer_phone: string | null;
      type_of_service: 'installation' | 'service';
      service_charge_type: 'customer' | 'brand_dealer';
      is_amc_service: boolean;
      is_warranty_service: boolean;
      billing_status: 'not_applicable' | 'due' | 'partially_paid' | 'paid' | 'waived';
      created_at: string;
      brands?: { name?: string | null } | null;
      dealers?: { name?: string | null } | null;
      service_categories?: { name?: string | null } | null;
    };

    return {
      id: typed.id,
      subject_number: typed.subject_number,
      source_type: typed.source_type,
      source_name: typed.source_type === 'brand' ? typed.brands?.name ?? '-' : typed.dealers?.name ?? '-',
      assigned_technician_id: typed.assigned_technician_id,
      assigned_technician_name: null,
      assigned_technician_code: null,
      priority: typed.priority,
      status: typed.status,
      allocated_date: typed.allocated_date,
      technician_allocated_date: (typed as { technician_allocated_date?: string | null }).technician_allocated_date ?? null,
      technician_allocated_notes: (typed as { technician_allocated_notes?: string | null }).technician_allocated_notes ?? null,
      technician_acceptance_status: ((typed as { technician_acceptance_status?: string }).technician_acceptance_status ?? 'pending') as 'pending' | 'accepted' | 'rejected',
      is_rejected_pending_reschedule: (typed as { is_rejected_pending_reschedule?: boolean }).is_rejected_pending_reschedule ?? false,
      customer_name: typed.customer_name,
      customer_phone: typed.customer_phone,
      category_name: typed.service_categories?.name ?? null,
      type_of_service: typed.type_of_service,
      service_charge_type: typed.service_charge_type,
      is_amc_service: typed.is_amc_service,
      is_warranty_service: typed.is_warranty_service,
      billing_status: typed.billing_status,
      created_at: typed.created_at,
    };
  });
}

export async function getSubjects(filters: SubjectListFilters = {}): Promise<ServiceResult<SubjectListResponse>> {
  const safeFilters: SubjectListFilters = {
    ...filters,
    page: filters.page && filters.page > 0 ? filters.page : 1,
    page_size: filters.page_size && filters.page_size > 0 ? filters.page_size : SUBJECT_DEFAULT_PAGE_SIZE,
  };

  const { data, error, count, page, pageSize } = await listSubjects(safeFilters);

  if (error) {
    return { ok: false, error: { message: error.message, code: error.code } };
  }

  const subjects = mapRawSubjectList((data ?? []) as unknown[]);
  const technicianResult = await getAssignableTechnicians();

  const technicianById = technicianResult.ok
    ? new Map(technicianResult.data.map((technician) => [technician.id, technician]))
    : new Map();

  const subjectsWithAssignment = subjects.map((subject) => {
    const technician = subject.assigned_technician_id ? technicianById.get(subject.assigned_technician_id) : undefined;

    return {
      ...subject,
      assigned_technician_name: technician?.display_name ?? null,
      assigned_technician_code: technician?.technician_code ?? null,
    };
  });

  return {
    ok: true,
    data: {
      data: subjectsWithAssignment,
      total: count,
      page,
      page_size: pageSize,
      total_pages: Math.max(1, Math.ceil(count / pageSize)),
    },
  };
}

export async function createSubjectTicket(input: CreateSubjectInput): Promise<ServiceResult<{ id: string }>> {
  const parsed = createSubjectSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: { message: parsed.error.issues[0]?.message ?? 'Invalid subject data' } };
  }

  const createPayload = {
    ...normalizeSubjectPayload(parsed.data),
    created_by: parsed.data.created_by,
  };

  const result = await createSubject(createPayload);

  if (result.error || !result.data || typeof result.data !== 'string') {
    return {
      ok: false,
      error: { message: mapRepositoryError(result.error?.message, result.error?.code), code: result.error?.code },
    };
  }

  return { ok: true, data: { id: result.data } };
}

export async function updateSubjectRecord(id: string, input: UpdateSubjectInput): Promise<ServiceResult<{ id: string }>> {
  const parsed = updateSubjectSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: { message: parsed.error.issues[0]?.message ?? 'Invalid subject data' } };
  }

  const result = await updateSubject(id, normalizeSubjectPayload(parsed.data));

  if (result.error || !result.data) {
    return {
      ok: false,
      error: { message: mapRepositoryError(result.error?.message, result.error?.code), code: result.error?.code },
    };
  }

  return { ok: true, data: result.data };
}

export async function getSubjectDetails(id: string): Promise<ServiceResult<SubjectDetail>> {
  const [subjectResult, timelineResult] = await Promise.all([
    getSubjectById(id),
    getSubjectTimeline(id),
  ]);

  if (subjectResult.error || !subjectResult.data) {
    return {
      ok: false,
      error: { message: subjectResult.error?.message ?? 'Subject not found', code: subjectResult.error?.code },
    };
  }

  if (timelineResult.error) {
    return { ok: false, error: { message: timelineResult.error.message, code: timelineResult.error.code } };
  }

  const typed = subjectResult.data as {
    id: string;
    subject_number: string;
    source_type: 'brand' | 'dealer';
    brand_id: string | null;
    dealer_id: string | null;
    assigned_technician_id: string | null;
    priority: 'critical' | 'high' | 'medium' | 'low';
    priority_reason: string;
    status: string;
    allocated_date: string;
    technician_allocated_date: string | null;
    technician_allocated_notes: string | null;
    technician_acceptance_status: 'pending' | 'accepted' | 'rejected';
    technician_rejection_reason: string | null;
    rejected_by_technician_id: string | null;
    is_rejected_pending_reschedule: boolean;
    customer_phone: string | null;
    customer_name: string | null;
    customer_address: string | null;
    type_of_service: 'installation' | 'service';
    category_id: string | null;
    product_name: string | null;
    serial_number: string | null;
    product_description: string | null;
    purchase_date: string | null;
    warranty_period_months: number | null;
    warranty_end_date: string | null;
    warranty_status: 'active' | 'expired' | null;
    amc_end_date: string | null;
    service_charge_type: 'customer' | 'brand_dealer';
    is_amc_service: boolean;
    is_warranty_service: boolean;
    billing_status: 'not_applicable' | 'due' | 'partially_paid' | 'paid' | 'waived';
    created_at: string;
    created_by: string | null;
    assigned_by: string | null;
    brands?: { name?: string | null } | null;
    dealers?: { name?: string | null } | null;
    rejected_by_profile?: { display_name?: string | null } | null;
    service_categories?: { name?: string | null } | null;
  };

  const assignedTechnicianResult = typed.assigned_technician_id
    ? await getAssignableTechnicianById(typed.assigned_technician_id)
    : { ok: true as const, data: null };

  const assignedTechnician = assignedTechnicianResult.ok ? assignedTechnicianResult.data : null;

  return {
    ok: true,
    data: {
      id: typed.id,
      subject_number: typed.subject_number,
      source_type: typed.source_type,
      source_name: typed.source_type === 'brand' ? typed.brands?.name ?? '-' : typed.dealers?.name ?? '-',
      brand_id: typed.brand_id,
      dealer_id: typed.dealer_id,
      assigned_technician_id: typed.assigned_technician_id,
      assigned_technician_name: assignedTechnician?.display_name ?? null,
      assigned_technician_code: assignedTechnician?.technician_code ?? null,
      priority: typed.priority,
      priority_reason: typed.priority_reason,
      status: typed.status,
      allocated_date: typed.allocated_date,
      technician_allocated_date: typed.technician_allocated_date,
      technician_allocated_notes: typed.technician_allocated_notes,
      technician_acceptance_status: typed.technician_acceptance_status ?? 'pending',
      technician_rejection_reason: typed.technician_rejection_reason ?? null,
      rejected_by_technician_id: typed.rejected_by_technician_id ?? null,
      rejected_by_technician_name: typed.rejected_by_profile?.display_name ?? null,
      is_rejected_pending_reschedule: typed.is_rejected_pending_reschedule ?? false,
      customer_phone: typed.customer_phone,
      customer_name: typed.customer_name,
      customer_address: typed.customer_address,
      type_of_service: typed.type_of_service,
      category_id: typed.category_id,
      category_name: typed.service_categories?.name ?? null,
      product_name: typed.product_name,
      serial_number: typed.serial_number,
      product_description: typed.product_description,
      purchase_date: typed.purchase_date,
      warranty_period_months: typed.warranty_period_months,
      warranty_end_date: typed.warranty_end_date,
      warranty_status: typed.warranty_status,
      amc_end_date: typed.amc_end_date,
      service_charge_type: typed.service_charge_type,
      is_amc_service: typed.is_amc_service,
      is_warranty_service: typed.is_warranty_service,
      billing_status: typed.billing_status,
      created_at: typed.created_at,
      created_by: typed.created_by,
      assigned_by: typed.assigned_by,
      timeline: ((timelineResult.data ?? []) as Array<{
        id: string;
        event_type: string;
        status: string;
        changed_at: string;
        note: string | null;
        old_value: string | null;
        new_value: string | null;
        changed_by: string | null;
        changed_by_profile?: { display_name?: string | null } | null;
      }>).map(
        (item) => ({
          id: item.id,
          event_type: item.event_type ?? 'status_change',
          status: item.status,
          changed_at: item.changed_at,
          note: item.note,
          old_value: item.old_value,
          new_value: item.new_value,
          changed_by: item.changed_by,
          changed_by_name: item.changed_by_profile?.display_name ?? null,
        }),
      ),
    },
  };
}

export async function removeSubject(id: string): Promise<ServiceResult<{ id: string }>> {
  const result = await deleteSubject(id);

  if (result.error || !result.data) {
    const message = result.error?.code === '23503'
      ? 'This subject cannot be deleted because related records exist. Remove linked billing or dependent records first.'
      : result.error?.message ?? 'Failed to delete subject';

    return {
      ok: false,
      error: { message, code: result.error?.code },
    };
  }

  return { ok: true, data: result.data };
}

export async function assignSubjectToTechnician(subjectId: string, technicianId?: string): Promise<ServiceResult<{ id: string; assigned_technician_id: string | null }>> {
  const result = await assignSubjectTechnician(subjectId, technicianId ?? null);

  if (result.error || !result.data) {
    return {
      ok: false,
      error: {
        message: result.error?.message ?? 'Failed to update subject assignment',
        code: result.error?.code,
      },
    };
  }

  return {
    ok: true,
    data: {
      id: result.data.id,
      assigned_technician_id: result.data.assigned_technician_id,
    },
  };
}

export async function assignTechnicianWithDate(input: AssignTechnicianInput): Promise<ServiceResult<{ id: string }>> {
  const { subject_id, technician_id, technician_allocated_date, technician_allocated_notes, assigned_by } = input;

  // Validate technician exists and is active when assigning
  if (technician_id) {
    const techResult = await getAssignableTechnicianById(technician_id);
    if (!techResult.ok || !techResult.data) {
      return { ok: false, error: { message: 'Selected technician is not active or does not exist.' } };
    }
  }

  // Validate date is not in the past when a date is provided
  if (technician_allocated_date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const visitDate = new Date(technician_allocated_date);
    if (visitDate < today) {
      return { ok: false, error: { message: 'Technician visit date cannot be in the past.' } };
    }
  }

  // When assigning a technician, status moves to ALLOCATED; unassigning reverts to PENDING
  const newStatus = technician_id ? 'ALLOCATED' : 'PENDING';

  const result = await assignTechnicianFull(
    subject_id,
    technician_id,
    technician_allocated_date,
    technician_allocated_notes,
    assigned_by,
    newStatus,
  );

  if (result.error || !result.data) {
    return {
      ok: false,
      error: { message: result.error?.message ?? 'Failed to update technician assignment', code: result.error?.code },
    };
  }

  return { ok: true, data: { id: result.data.id } };
}

export async function saveSubjectWarranty(input: {
  subject_id: string;
  purchase_date: string | null;
  warranty_period: WarrantyPeriod;
  warranty_end_date_manual: string | null;
}): Promise<ServiceResult<{ id: string }>> {
  if (!input.subject_id) {
    return { ok: false, error: { message: 'Subject id is required.' } };
  }

  const purchaseDate = input.purchase_date?.trim() || null;
  const manualEndDate = input.warranty_end_date_manual?.trim() || null;
  const periodMonths = monthsForWarrantyPeriod(input.warranty_period);

  let resolvedWarrantyEndDate: string | null = null;

  if (manualEndDate) {
    resolvedWarrantyEndDate = manualEndDate;
  } else if (purchaseDate && periodMonths) {
    resolvedWarrantyEndDate = addMonths(purchaseDate, periodMonths);
  }

  if (resolvedWarrantyEndDate && purchaseDate && resolvedWarrantyEndDate < purchaseDate) {
    return { ok: false, error: { message: 'Warranty end date must be on or after purchase date.' } };
  }

  const result = await updateSubjectWarranty(
    input.subject_id,
    purchaseDate,
    periodMonths,
    resolvedWarrantyEndDate,
  );

  if (result.error || !result.data) {
    return {
      ok: false,
      error: {
        message: result.error?.message ?? 'Failed to update warranty details.',
        code: result.error?.code,
      },
    };
  }

  await recalculateSubjectBillingType(input.subject_id);

  return {
    ok: true,
    data: { id: result.data.id },
  };
}
