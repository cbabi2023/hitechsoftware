import type { ServiceResult } from '@/types/common.types';
import type { Customer, CreateCustomerInput } from '@/modules/customers/customer.types';
import { createCustomerSchema } from '@/modules/customers/customer.validation';
import { createCustomer, listCustomers } from '@/repositories/customer.repository';

export async function getCustomers(): Promise<ServiceResult<Customer[]>> {
  const { data, error } = await listCustomers();

  if (error) {
    return { ok: false, error: { message: error.message, code: error.code } };
  }

  return { ok: true, data: data ?? [] };
}

export async function addCustomer(input: CreateCustomerInput): Promise<ServiceResult<Customer>> {
  const parsed = createCustomerSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: { message: parsed.error.issues[0]?.message ?? 'Invalid customer input' } };
  }

  const { data, error } = await createCustomer(parsed.data);

  if (error || !data) {
    return {
      ok: false,
      error: { message: error?.message ?? 'Failed to create customer', code: error?.code },
    };
  }

  return { ok: true, data };
}
