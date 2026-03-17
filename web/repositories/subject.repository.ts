import { createClient } from '@/lib/supabase/client';
import type { CreateSubjectInput, SubjectListFilters, UpdateSubjectInput } from '@/modules/subjects/subject.types';

const supabase = createClient();

export async function listSubjects(filters: SubjectListFilters) {
  const page = filters.page && filters.page > 0 ? filters.page : 1;
  const pageSize = filters.page_size && filters.page_size > 0 ? filters.page_size : 10;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('subjects')
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
    const escaped = filters.search.trim().replaceAll(',', ' ');
    query = query.or(`subject_number.ilike.%${escaped}%,customer_phone.ilike.%${escaped}%,customer_name.ilike.%${escaped}%`);
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
      amc_end_date: input.amc_end_date ?? null,
    })
    .eq('id', id)
    .eq('is_deleted', false)
    .select('id')
    .single<{ id: string }>();
}

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
    })
    .eq('id', subjectId)
    .eq('is_deleted', false)
    .select('id,assigned_technician_id,technician_allocated_date,technician_allocated_notes,status')
    .single<{ id: string; assigned_technician_id: string | null; technician_allocated_date: string | null; technician_allocated_notes: string | null; status: string }>();
}

export async function getSubjectById(id: string) {
  return supabase
    .from('subjects')
    .select(
      `
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
      amc_end_date,
      service_charge_type,
      is_amc_service,
      is_warranty_service,
      billing_status,
      created_by,
      assigned_by,
      created_at,
      brands:brand_id(name),
      dealers:dealer_id(name),
      rejected_by_profile:rejected_by_technician_id(display_name),
      service_categories:category_id(name),
      subject_photos!inner(id,photo_type,storage_path,public_url,uploaded_by,uploaded_at,file_size_bytes,mime_type)
      `,
    )
    .eq('id', id)
    .eq('is_deleted', false)
    .single();
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
