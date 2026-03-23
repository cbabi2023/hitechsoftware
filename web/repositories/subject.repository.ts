// ─────────────────────────────────────────────────────────────────────────────
// subject.repository.ts
//
// Lowest-level data access layer — all Supabase queries for the subjects table.
// No business logic lives here; validation and rule enforcement belong in the
// service layer (subject.service.ts / subject.job-workflow.ts).
//
// Two Supabase clients are used:
//   supabase (browser client)  — honours RLS, used for client-side list/detail
//   createAdminClient()        — service-role key, bypasses RLS, used for
//                                server-side writes (status transitions, billing)
// ─────────────────────────────────────────────────────────────────────────────
import { createClient } from '@/lib/supabase/client';
import type { CreateSubjectInput, IncompleteReason, SubjectListFilters, UpdateSubjectInput } from '@/modules/subjects/subject.types';
import { createAdminClient } from '@/lib/supabase/admin';

// Browser-scoped Supabase client (honours RLS).
// Used for read queries that run on the client side (list page, detail page).
const supabase = createClient();

/**
 * Fetches a paginated, filtered list of subjects.
 *
 * Query strategy:
 *   - Joins brands, dealers, service_categories via FK with (name) select.
 *   - All filters are applied as chainable .eq()/.or()/.gte() calls before
 *     the terminal .range() call so Supabase builds a single SQL query.
 *   - The count: 'exact' option adds a COUNT(*) on the same query, returned
 *     as result.count — needed for pagination total_pages calculation.
 *
 * Special filter modes:
 *   overdue_only  → past-due assigned jobs (latest ordering by allocated date)
 *   due_only      → completed customer-pay jobs awaiting payment collection
 *   pending_only  → uses completed_at IS NULL (schema-safe, index-friendly)
 */
export async function listSubjects(filters: SubjectListFilters) {
  const page = filters.page && filters.page > 0 ? filters.page : 1;
  const pageSize = filters.page_size && filters.page_size > 0 ? filters.page_size : 10;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // Choose source table/view based on filter context.
  // Migration 017 views pre-filter rows, removing the need for inline conditions.
  let source: string = 'subjects';
  if (filters.overdue_only) {
    source = 'overdue_subjects';
  } else if (filters.technician_pending_only) {
    source = 'active_subjects_today';
  } else if (filters.pending_only && !filters.assigned_technician_id) {
    source = 'pending_unassigned_subjects';
  }

  let query = supabase
    .from(source)
    .select(
      `
      id,
      subject_number,
      source_type,
      brand_id,
      dealer_id,
      assigned_technician_id,
      priority,
      status,
      allocated_date,
      technician_allocated_date,
      technician_allocated_notes,
      technician_acceptance_status,
      is_rejected_pending_reschedule,
      en_route_at,
      arrived_at,
      work_started_at,
      completed_at,
      incomplete_at,
      incomplete_reason,
      completion_proof_uploaded,
      customer_name,
      customer_phone,
      type_of_service,
      service_charge_type,
      is_amc_service,
      is_warranty_service,
      billing_status,
      category_id,
      created_at,
      brands:brand_id(name),
      dealers:dealer_id(name),
      service_categories:category_id(name)
      `,
      { count: 'exact' },
    )
    .eq('is_deleted', false)
    .order('created_at', { ascending: false });

  if (filters.search?.trim()) {
    const terms = filters.search.trim().replaceAll(',', ' ');
    query = query.or(
      `subject_number.plfts(simple).${terms},customer_phone.plfts(simple).${terms},customer_name.plfts(simple).${terms}`,
    );
  }

  if (filters.source_type && filters.source_type !== 'all') {
    query = query.eq('source_type', filters.source_type);
  }

  if (filters.priority && filters.priority !== 'all') {
    query = query.eq('priority', filters.priority);
  }

  if (filters.status?.trim()) {
    query = query.eq('status', filters.status.trim().toUpperCase());
  }

  // When using a view, skip filters the view already applies.
  if (source === 'subjects' && (filters.pending_only || filters.technician_pending_only)) {
    query = query.is('completed_at', null);
  }

  if (source === 'subjects' && filters.overdue_only) {
    const today = new Date().toISOString().split('T')[0];
    query = query
      .is('completed_at', null)
      .not('assigned_technician_id', 'is', null)
      .is('rescheduled_date', null)
      .lt('technician_allocated_date', today)
      .order('technician_allocated_date', { ascending: true });
  }

  if (filters.due_only) {
    query = query
      .eq('bill_generated', true)
      .eq('service_charge_type', 'customer')
      .eq('billing_status', 'due')
      .eq('status', 'COMPLETED')
      .order('completed_at', { ascending: true });
  }

  if (filters.assigned_technician_id) {
    query = query.eq('assigned_technician_id', filters.assigned_technician_id);
  }

  if (filters.category_id) {
    query = query.eq('category_id', filters.category_id);
  }

  if (filters.brand_id) {
    query = query.eq('brand_id', filters.brand_id);
  }

  if (filters.dealer_id) {
    query = query.eq('dealer_id', filters.dealer_id);
  }

  if (filters.technician_date) {
    query = query.eq('technician_allocated_date', filters.technician_date);
  } else {
    if (filters.from_date) {
      query = query.gte('allocated_date', filters.from_date);
    }

    if (filters.to_date) {
      query = query.lte('allocated_date', filters.to_date);
    }
  }

  const result = await query.range(from, to);

  return {
    data: result.data,
    error: result.error,
    count: result.count ?? 0,
    page,
    pageSize,
  };
}

/**
 * Creates a new subject via the Supabase RPC 'create_subject_with_customer'.
 *
 * The RPC is used (instead of a direct INSERT) because it atomically:
 *   1. Upserts the customer record by phone number (avoiding duplicates).
 *   2. Inserts the subject row and returns the new UUID as a plain string.
 *
 * If an assigned_technician_id was provided, a second update assigns the
 * technician after creation. This is two round-trips but keeps the RPC
 * focused on subject + customer creation only.
 */
export async function createSubject(input: CreateSubjectInput) {
  const createResult = await supabase.rpc('create_subject_with_customer', {
    p_subject_number: input.subject_number,
    p_source_type: input.source_type,
    p_brand_id: input.brand_id ?? null,
    p_dealer_id: input.dealer_id ?? null,
    p_priority: input.priority,
    p_priority_reason: input.priority_reason,
    p_allocated_date: input.allocated_date,
    p_type_of_service: input.type_of_service,
    p_category_id: input.category_id,
    p_customer_phone: input.customer_phone ?? null,
    p_customer_name: input.customer_name ?? null,
    p_customer_address: input.customer_address ?? null,
    p_product_name: input.product_name ?? null,
    p_serial_number: input.serial_number ?? null,
    p_product_description: input.product_description ?? null,
    p_purchase_date: input.purchase_date ?? null,
    p_warranty_end_date: input.warranty_end_date ?? null,
    p_amc_start_date: input.amc_start_date ?? null,
    p_amc_end_date: input.amc_end_date ?? null,
    p_created_by: input.created_by,
  });

  if (createResult.error || !createResult.data || typeof createResult.data !== 'string' || !input.assigned_technician_id) {
    return createResult;
  }

  const assignmentResult = await supabase
    .from('subjects')
    .update({
      assigned_technician_id: input.assigned_technician_id,
      assigned_by: input.created_by,
    })
    .eq('id', createResult.data)
    .eq('is_deleted', false)
    .select('id')
    .single<{ id: string }>();

  if (assignmentResult.error) {
    return {
      data: createResult.data,
      error: assignmentResult.error,
    };
  }

  return createResult;
}

/**
 * Updates editable subject fields (form fields only — not workflow/billing fields).
 * The is_deleted=false guard ensures we never accidentally update a soft-deleted row.
 */
export async function updateSubject(id: string, input: UpdateSubjectInput) {
  return supabase
    .from('subjects')
    .update({
      subject_number: input.subject_number,
      source_type: input.source_type,
      brand_id: input.brand_id ?? null,
      dealer_id: input.dealer_id ?? null,
      assigned_technician_id: input.assigned_technician_id ?? null,
      priority: input.priority,
      priority_reason: input.priority_reason,
      allocated_date: input.allocated_date,
      type_of_service: input.type_of_service,
      category_id: input.category_id,
      customer_phone: input.customer_phone ?? null,
      customer_name: input.customer_name ?? null,
      customer_address: input.customer_address ?? null,
      product_name: input.product_name ?? null,
      serial_number: input.serial_number ?? null,
      product_description: input.product_description ?? null,
      purchase_date: input.purchase_date ?? null,
      warranty_end_date: input.warranty_end_date ?? null,
      amc_start_date: input.amc_start_date ?? null,
      amc_end_date: input.amc_end_date ?? null,
    })
    .eq('id', id)
    .eq('is_deleted', false)
    .select('id')
    .single<{ id: string }>();
}

/**
 * Quick assignment — updates only the assigned_technician_id column.
 * Does NOT touch status, dates, or completion/billing fields.
 * Used by the inline quick-assign dropdown on the list page.
 */
export async function assignSubjectTechnician(subjectId: string, technicianId: string | null) {
  return supabase
    .from('subjects')
    .update({
      assigned_technician_id: technicianId,
    })
    .eq('id', subjectId)
    .eq('is_deleted', false)
    .select('id,assigned_technician_id')
    .single<{ id: string; assigned_technician_id: string | null }>();
}

/**
 * Full technician assignment with a complete state reset.
 * Called when a subject is re-assigned after a technician rejection or when
 * a fresh assignment is made via the AssignTechnicianForm.
 *
 * Why so many fields are reset:
 *   - technician_acceptance_status → 'pending' so the new technician sees
 *     the accept/reject UI again.
 *   - All rejection fields cleared so the urgent-reschedule banner disappears.
 *   - completed_at / incomplete_at cleared so the subject re-enters the
 *     pending queue (technician_pending_only filter uses completed_at IS NULL).
 *   - All billing fields zeroed so a re-assigned technician gets a clean
 *     billing slate (prevents stale bill_generated=true from blocking new bill).
 */
export async function assignTechnicianFull(
  subjectId: string,
  technicianId: string | null,
  technicianAllocatedDate: string | null,
  technicianAllocatedNotes: string | null,
  assignedBy: string,
  newStatus: string,
) {
  return supabase
    .from('subjects')
    .update({
      assigned_technician_id: technicianId,
      technician_allocated_date: technicianAllocatedDate,
      technician_allocated_notes: technicianAllocatedNotes,
      assigned_by: assignedBy,
      status: newStatus,
      technician_acceptance_status: 'pending',
      technician_rejection_reason: null,
      rejected_by_technician_id: null,
      is_rejected_pending_reschedule: false,
      // Reset completion fields so the subject re-enters the active pending queue.
      // Without this, a subject with completed_at set would be excluded by the
      // technician_pending_only filter (which uses completed_at IS NULL).
      completed_at: null,
      incomplete_at: null,
      incomplete_reason: null,
      incomplete_note: null,
      completion_proof_uploaded: false,
      completion_notes: null,
      // Reset billing fields so a re-assigned technician gets a clean billing slate.
      // Stale bill data (e.g. from a manually-rolled-back completion) would otherwise
      // block the technician from generating a new bill (bill_generated=true guard).
      bill_generated: false,
      bill_number: null,
      bill_generated_at: null,
      billing_status: null,
      grand_total: 0,
      visit_charge: 0,
      service_charge: 0,
      accessories_total: 0,
      payment_collected: false,
      payment_collected_at: null,
      payment_mode: null,
    })
    .eq('id', subjectId)
    .eq('is_deleted', false)
    .select('id,assigned_technician_id,technician_allocated_date,technician_allocated_notes,status')
    .single<{ id: string; assigned_technician_id: string | null; technician_allocated_date: string | null; technician_allocated_notes: string | null; status: string }>();
}

// ── SUBJECT_DETAIL_SELECT ──────────────────────────────────────────────────────────
// Full column list for the Subject Detail page.
// Embedded subject_photos join avoids a separate photo-list query.
// rejected_by_profile join resolves the display_name of the rejecting technician.
// Everything from this select is mapped to SubjectDetail in subject.service.ts.
const SUBJECT_DETAIL_SELECT = `
      id,
      subject_number,
      source_type,
      brand_id,
      dealer_id,
      assigned_technician_id,
      priority,
      priority_reason,
      status,
      allocated_date,
      technician_allocated_date,
      technician_allocated_notes,
      technician_acceptance_status,
      technician_rejection_reason,
      rejected_by_technician_id,
      is_rejected_pending_reschedule,
      en_route_at,
      arrived_at,
      work_started_at,
      completed_at,
      incomplete_at,
      incomplete_reason,
      incomplete_note,
      spare_parts_requested,
      spare_parts_quantity,
      completion_proof_uploaded,
      completion_notes,
      rescheduled_date,
      type_of_service,
      category_id,
      customer_phone,
      customer_name,
      customer_address,
      product_name,
      serial_number,
      product_description,
      purchase_date,
      warranty_period_months,
      warranty_end_date,
      warranty_status,
      amc_start_date,
      amc_end_date,
      service_charge_type,
      is_amc_service,
      is_warranty_service,
      billing_status,
      visit_charge,
      service_charge,
      accessories_total,
      grand_total,
      payment_mode,
      payment_collected,
      payment_collected_at,
      bill_generated,
      bill_generated_at,
      bill_number,
      created_by,
      assigned_by,
      created_at,
      brands:brand_id(name),
      dealers:dealer_id(name),
      rejected_by_profile:rejected_by_technician_id(display_name),
      service_categories:category_id(name),
      subject_photos(id,photo_type,storage_path,public_url,uploaded_by,uploaded_at,file_size_bytes,mime_type)
      `;

// Legacy select string that omits amc_start_date.
// Used as a fallback for older DB schemas that may not have that column yet.
// isMissingAmcStartDateColumn() detects the specific Postgres error and triggers
// this fallback automatically, injecting amc_start_date: null into the result.
const SUBJECT_DETAIL_SELECT_LEGACY = SUBJECT_DETAIL_SELECT.replace('      amc_start_date,\n', '');

/** Returns true when the Postgres error indicates the amc_start_date column is missing. */
function isMissingAmcStartDateColumn(errorMessage?: string) {
  return Boolean(errorMessage && /amc_start_date.*does not exist|column .*amc_start_date/i.test(errorMessage));
}

/**
 * Fetches a single subject's full detail using the browser-scoped Supabase
 * client (honoured RLS). Includes all joins needed for the Subject Detail page.
 *
 * Schema-safety fallback:
 *   If the first query fails because the amc_start_date column doesn't exist
 *   (detected by isMissingAmcStartDateColumn), retries with the legacy select
 *   and injects amc_start_date: null into the result shape.
 *   This lets the detail page load on older or partially-migrated DB schemas.
 */
export async function getSubjectById(id: string) {
  const primary = await supabase
    .from('subjects')
    .select(SUBJECT_DETAIL_SELECT)
    .eq('id', id)
    .eq('is_deleted', false)
    .single();

  if (!primary.error || !isMissingAmcStartDateColumn(primary.error.message)) {
    return primary;
  }

  const fallback = await supabase
    .from('subjects')
    .select(SUBJECT_DETAIL_SELECT_LEGACY)
    .eq('id', id)
    .eq('is_deleted', false)
    .single();

  if (!fallback.error && fallback.data) {
    return {
      ...fallback,
      data: {
        ...(fallback.data as unknown as Record<string, unknown>),
        amc_start_date: null,
      },
    };
  }

  return fallback;
}

/**
 * Get subject by ID using admin client (bypasses RLS).
 * Used server-side for internal operations like status transitions.
 */
export async function getSubjectByIdAdmin(id: string) {
  const admin = createAdminClient();
  const primary = await admin
    .from('subjects')
    .select(SUBJECT_DETAIL_SELECT)
    .eq('id', id)
    .eq('is_deleted', false)
    .single();

  if (!primary.error || !isMissingAmcStartDateColumn(primary.error.message)) {
    return primary;
  }

  const fallback = await admin
    .from('subjects')
    .select(SUBJECT_DETAIL_SELECT_LEGACY)
    .eq('id', id)
    .eq('is_deleted', false)
    .single();

  if (!fallback.error && fallback.data) {
    return {
      ...fallback,
      data: {
        ...(fallback.data as unknown as Record<string, unknown>),
        amc_start_date: null,
      },
    };
  }

  return fallback;
}

export async function getSubjectTimeline(subjectId: string) {
  return supabase
    .from('subject_status_history')
    .select('id,event_type,status,changed_at,note,old_value,new_value,changed_by,changed_by_profile:changed_by(display_name)')
    .eq('subject_id', subjectId)
    .order('changed_at', { ascending: false });
}

export async function updateSubjectWarranty(
  subjectId: string,
  purchaseDate: string | null,
  warrantyPeriodMonths: number | null,
  warrantyEndDate: string | null,
) {
  return supabase
    .from('subjects')
    .update({
      purchase_date: purchaseDate,
      warranty_period_months: warrantyPeriodMonths,
      warranty_end_date: warrantyEndDate,
    })
    .eq('id', subjectId)
    .eq('is_deleted', false)
    .select('id,purchase_date,warranty_period_months,warranty_end_date,warranty_status,service_charge_type')
    .single<{
      id: string;
      purchase_date: string | null;
      warranty_period_months: number | null;
      warranty_end_date: string | null;
      warranty_status: 'active' | 'expired' | null;
      service_charge_type: 'customer' | 'brand_dealer';
    }>();
}

export async function recalculateSubjectBillingType(subjectId: string) {
  return supabase.rpc('refresh_subject_billing_type', {
    p_subject_id: subjectId,
  });
}

export async function deleteSubject(id: string) {
  return supabase
    .from('subjects')
    .delete()

    .eq('id', id)
    .select('id')
    .single<{ id: string }>();
}

// ---------------------------------------------------------------------------
// Job workflow — status-change helpers (admin client bypasses technician RLS)
// ---------------------------------------------------------------------------

export async function markArrived(subjectId: string, technicianId?: string) {
  const admin = createAdminClient();
  return admin
    .from('subjects')
    .update({
      status: 'ARRIVED',
      arrived_at: new Date().toISOString(),
      status_changed_by_id: technicianId || null,
    })
    .eq('id', subjectId)
    .eq('is_deleted', false)
    .select('id,status,arrived_at')
    .single<{ id: string; status: string; arrived_at: string }>();
}

export async function markInProgress(subjectId: string, technicianId?: string) {
  const admin = createAdminClient();
  return admin
    .from('subjects')
    .update({
      status: 'IN_PROGRESS',
      work_started_at: new Date().toISOString(),
      status_changed_by_id: technicianId || null,
    })
    .eq('id', subjectId)
    .eq('is_deleted', false)
    .select('id,status,work_started_at')
    .single<{ id: string; status: string; work_started_at: string }>();
}

export async function markIncomplete(
  subjectId: string,
  data: {
    incomplete_reason: IncompleteReason;
    incomplete_note: string | null;
    spare_parts_requested: string | null;
    spare_parts_quantity: number | null;
    rescheduled_date: string | null;
  },
  technicianId?: string,
) {
  const admin = createAdminClient();
  return admin
    .from('subjects')
    .update({
      status: 'INCOMPLETE',
      incomplete_at: new Date().toISOString(),
      incomplete_reason: data.incomplete_reason,
      incomplete_note: data.incomplete_note,
      spare_parts_requested: data.spare_parts_requested,
      spare_parts_quantity: data.spare_parts_quantity,
      rescheduled_date: data.rescheduled_date,
      status_changed_by_id: technicianId || null,
    })
    .eq('id', subjectId)
    .eq('is_deleted', false)
    .select('id,status')
    .single<{ id: string; status: string }>();
}

export async function markComplete(
  subjectId: string,
  data: {
    completion_notes: string | null;
    billing_status: 'not_applicable' | 'due' | 'partially_paid' | 'paid' | 'waived';
  },
  technicianId?: string,
) {
  const admin = createAdminClient();
  return admin
    .from('subjects')
    .update({
      status: 'COMPLETED',
      completed_at: new Date().toISOString(),
      completion_proof_uploaded: true,
      completion_notes: data.completion_notes,
      billing_status: data.billing_status,
      status_changed_by_id: technicianId || null,
    })
    .eq('id', subjectId)
    .eq('is_deleted', false)
    .select('id,status,completed_at,billing_status')
    .single<{ id: string; status: string; completed_at: string; billing_status: string }>();
}
