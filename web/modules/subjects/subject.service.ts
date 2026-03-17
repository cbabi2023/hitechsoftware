import { createSubject, deleteSubject, getSubjectById, getSubjectTimeline, listSubjects, updateSubject } from '@/repositories/subject.repository';
import { getAssignableTechnicians } from '@/modules/technicians/technician.service';
import type { ServiceResult } from '@/types/common.types';
import type {
  CreateSubjectInput,
  SubjectDetail,
  SubjectFormValues,
  SubjectListItem,
  SubjectListResponse,
  SubjectListFilters,
  UpdateSubjectInput,
} from '@/modules/subjects/subject.types';
import { createSubjectSchema, updateSubjectSchema } from '@/modules/subjects/subject.validation';
import { SUBJECT_DEFAULT_PAGE_SIZE } from '@/modules/subjects/subject.constants';

function normalizeOptional(value?: string) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function normalizeSubjectNumber(value: string) {
  return value.trim().toUpperCase();
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
  const [subjectResult, timelineResult, technicianResult] = await Promise.all([
    getSubjectById(id),
    getSubjectTimeline(id),
    getAssignableTechnicians(),
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
    customer_phone: string | null;
    customer_name: string | null;
    customer_address: string | null;
    type_of_service: 'installation' | 'service';
    category_id: string | null;
    product_name: string | null;
    serial_number: string | null;
    product_description: string | null;
    purchase_date: string | null;
    warranty_end_date: string | null;
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
    service_categories?: { name?: string | null } | null;
  };

  const assignedTechnician =
    technicianResult.ok && typed.assigned_technician_id
      ? technicianResult.data.find((technician) => technician.id === typed.assigned_technician_id) ?? null
      : null;

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
      warranty_end_date: typed.warranty_end_date,
      amc_end_date: typed.amc_end_date,
      service_charge_type: typed.service_charge_type,
      is_amc_service: typed.is_amc_service,
      is_warranty_service: typed.is_warranty_service,
      billing_status: typed.billing_status,
      created_at: typed.created_at,
      created_by: typed.created_by,
      assigned_by: typed.assigned_by,
      timeline: ((timelineResult.data ?? []) as Array<{ id: string; status: string; changed_at: string; note: string | null }>).map(
        (item) => ({
          id: item.id,
          status: item.status,
          changed_at: item.changed_at,
          note: item.note,
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
