export interface Customer {
  id: string;
  customer_name: string;
  phone_number: string;
  email: string | null;
  address: string;
  city: string;
  postal_code: string | null;
  is_active: boolean;
}

export interface CreateCustomerInput {
  customer_name: string;
  phone_number: string;
  email?: string;
  address: string;
  city: string;
  postal_code?: string;
}
