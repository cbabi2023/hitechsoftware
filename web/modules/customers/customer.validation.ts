import { z } from 'zod';

export const createCustomerSchema = z.object({
  customer_name: z.string().trim().min(2, 'Customer name is required'),
  phone_number: z.string().trim().min(10, 'Phone number is required'),
  email: z.email('Please enter a valid email').optional().or(z.literal('')),
  address: z.string().trim().min(3, 'Address is required'),
  city: z.string().trim().min(2, 'City is required'),
  postal_code: z.string().trim().optional(),
});
