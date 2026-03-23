import { createClient } from '@/lib/supabase/client';
import type {
  CreateCustomerInput,
  Customer,
  CustomerFilters,
  UpdateCustomerInput,
} from '@/modules/customers/customer.types';

const supabase = createClient();

function normalizeNullable(value?: string) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function buildLegacyAddress(line1?: string, line2?: string) {
  return [line1?.trim(), line2?.trim()].filter(Boolean).join(', ');
}

export async function findAll(filters: CustomerFilters) {
  const page = filters.page && filters.page > 0 ? filters.page : 1;
  const pageSize = filters.page_size && filters.page_size > 0 ? filters.page_size : 10;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('customers')
    .select(
      'id,customer_name,phone_number,email,is_active,is_deleted,created_at,updated_at,deleted_at,primary_address_line1,primary_address_line2,primary_area,primary_city,primary_postal_code,secondary_address_label,secondary_address_line1,secondary_address_line2,secondary_area,secondary_city,secondary_postal_code',
      { count: 'exact' },
    )
    .eq('is_deleted', false);

  if (typeof filters.is_active === 'boolean') {
    query = query.eq('is_active', filters.is_active);
  }

  if (filters.city?.trim()) {
    query = query.eq('primary_city', filters.city.trim());
  }

  if (filters.area?.trim()) {
    query = query.eq('primary_area', filters.area.trim());
  }

  if (filters.search?.trim()) {
    const terms = filters.search.trim().replaceAll(',', ' ');
    query = query.or(
      `customer_name.plfts(simple).${terms},phone_number.plfts(simple).${terms}`,
    );
  }

  const result = await query.order('created_at', { ascending: false }).range(from, to).returns<Customer[]>();

  return {
    data: result.data,
    error: result.error,
    count: result.count ?? 0,
    page,
    pageSize,
  };
}

export async function findById(id: string) {
  return supabase
    .from('customers')
    .select(
      'id,customer_name,phone_number,email,is_active,is_deleted,created_at,updated_at,deleted_at,primary_address_line1,primary_address_line2,primary_area,primary_city,primary_postal_code,secondary_address_label,secondary_address_line1,secondary_address_line2,secondary_area,secondary_city,secondary_postal_code',
    )
    .eq('id', id)
    .eq('is_deleted', false)
    .single<Customer>();
}

export async function findByPhone(phoneNumber: string, excludeCustomerId?: string) {
  let query = supabase
    .from('customers')
    .select('id,customer_name,phone_number,primary_address_line1,primary_address_line2,primary_area,primary_city')
    .eq('phone_number', phoneNumber)
    .eq('is_deleted', false);

  if (excludeCustomerId) {
    query = query.neq('id', excludeCustomerId);
  }

  return query.maybeSingle<Pick<Customer, 'id' | 'customer_name' | 'phone_number'> & {
    primary_address_line1: string | null;
    primary_address_line2: string | null;
    primary_area: string | null;
    primary_city: string | null;
  }>();
}

export async function create(input: CreateCustomerInput) {
  const legacyAddress = buildLegacyAddress(input.primary_address_line1, input.primary_address_line2);

  return supabase
    .from('customers')
    .insert({
      customer_name: input.customer_name,
      phone_number: input.phone_number,
      email: normalizeNullable(input.email),
      address: legacyAddress,
      city: input.primary_city,
      postal_code: input.primary_postal_code,
      is_active: input.is_active ?? true,
      primary_address_line1: input.primary_address_line1,
      primary_address_line2: normalizeNullable(input.primary_address_line2),
      primary_area: input.primary_area,
      primary_city: input.primary_city,
      primary_postal_code: input.primary_postal_code,
      secondary_address_label: normalizeNullable(input.secondary_address_label),
      secondary_address_line1: normalizeNullable(input.secondary_address_line1),
      secondary_address_line2: normalizeNullable(input.secondary_address_line2),
      secondary_area: normalizeNullable(input.secondary_area),
      secondary_city: normalizeNullable(input.secondary_city),
      secondary_postal_code: normalizeNullable(input.secondary_postal_code),
    })
    .select(
      'id,customer_name,phone_number,email,is_active,is_deleted,created_at,updated_at,deleted_at,primary_address_line1,primary_address_line2,primary_area,primary_city,primary_postal_code,secondary_address_label,secondary_address_line1,secondary_address_line2,secondary_area,secondary_city,secondary_postal_code',
    )
    .single<Customer>();
}

export async function update(id: string, input: UpdateCustomerInput) {
  const legacyAddress =
    input.primary_address_line1 !== undefined || input.primary_address_line2 !== undefined
      ? buildLegacyAddress(input.primary_address_line1, input.primary_address_line2)
      : undefined;

  const updatePayload: Record<string, string | boolean | null | undefined> = {
    customer_name: input.customer_name,
    phone_number: input.phone_number,
    email: input.email !== undefined ? normalizeNullable(input.email) : undefined,
    address: legacyAddress,
    city: input.primary_city,
    postal_code: input.primary_postal_code,
    is_active: input.is_active,
    primary_address_line1: input.primary_address_line1,
    primary_address_line2: input.primary_address_line2 !== undefined ? normalizeNullable(input.primary_address_line2) : undefined,
    primary_area: input.primary_area,
    primary_city: input.primary_city,
    primary_postal_code: input.primary_postal_code,
    secondary_address_label:
      input.secondary_address_label !== undefined ? normalizeNullable(input.secondary_address_label) : undefined,
    secondary_address_line1:
      input.secondary_address_line1 !== undefined ? normalizeNullable(input.secondary_address_line1) : undefined,
    secondary_address_line2:
      input.secondary_address_line2 !== undefined ? normalizeNullable(input.secondary_address_line2) : undefined,
    secondary_area: input.secondary_area !== undefined ? normalizeNullable(input.secondary_area) : undefined,
    secondary_city: input.secondary_city !== undefined ? normalizeNullable(input.secondary_city) : undefined,
    secondary_postal_code:
      input.secondary_postal_code !== undefined ? normalizeNullable(input.secondary_postal_code) : undefined,
  };

  return supabase
    .from('customers')
    .update(updatePayload)
    .eq('id', id)
    .eq('is_deleted', false)
    .select(
      'id,customer_name,phone_number,email,is_active,is_deleted,created_at,updated_at,deleted_at,primary_address_line1,primary_address_line2,primary_area,primary_city,primary_postal_code,secondary_address_label,secondary_address_line1,secondary_address_line2,secondary_area,secondary_city,secondary_postal_code',
    )
    .single<Customer>();
}

export async function destroy(id: string) {
  return supabase
    .from('customers')
    .delete()
    .eq('id', id)
    .select('id')
    .single<{ id: string }>();
}

export async function hasActiveSubjects(customerId: string) {
  const result = await supabase
    .from('subjects')
    .select('id')
    .eq('customer_id', customerId)
    .eq('is_deleted', false)
    .eq('is_active', true)
    .neq('status', 'COMPLETED')
    .limit(1);

  return {
    data: (result.data ?? []).length > 0,
    error: result.error,
  };
}
