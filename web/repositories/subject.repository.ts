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

  if (filters.from_date) {
    query = query.gte('allocated_date', filters.from_date);
  }

  if (filters.to_date) {
    query = query.lte('allocated_date', filters.to_date);
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
      type_of_service,
      category_id,
      customer_phone,
      customer_name,
      customer_address,
      product_name,
      serial_number,
      product_description,
      purchase_date,
      warranty_end_date,
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
      service_categories:category_id(name)
      `,
    )
    .eq('id', id)
    .eq('is_deleted', false)
    .single();
}

export async function getSubjectTimeline(subjectId: string) {
  return supabase
    .from('subject_status_history')
    .select('id,status,changed_at,note')
    .eq('subject_id', subjectId)
    .order('changed_at', { ascending: false });
}

export async function deleteSubject(id: string) {
  return supabase
    .from('subjects')
    .update({ is_deleted: true, is_active: false, deleted_at: new Date().toISOString() })
    .eq('id', id)
    .select('id')
    .single<{ id: string }>();
}
