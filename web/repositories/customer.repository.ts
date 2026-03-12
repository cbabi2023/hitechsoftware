import { createClient } from '@/lib/supabase/client';
import type { Customer, CreateCustomerInput } from '@/modules/customers/customer.types';

const supabase = createClient();

export async function listCustomers() {
  return supabase
    .from('customers')
    .select('id,customer_name,phone_number,email,address,city,postal_code,is_active')
    .order('created_at', { ascending: false })
    .returns<Customer[]>();
}

export async function createCustomer(input: CreateCustomerInput) {
  return supabase
    .from('customers')
    .insert({
      customer_name: input.customer_name,
      phone_number: input.phone_number,
      email: input.email || null,
      address: input.address,
      city: input.city,
      postal_code: input.postal_code || null,
    })
    .select('id,customer_name,phone_number,email,address,city,postal_code,is_active')
    .single<Customer>();
}
