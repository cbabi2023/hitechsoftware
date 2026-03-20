import { z } from 'zod';

export const subjectNumberSchema = z
  .string()
  .trim()
  .min(3, 'Subject number is required')
  .max(50, 'Subject number is too long');

export const subjectPrioritySchema = z.enum(['critical', 'high', 'medium', 'low']);

export const subjectFormSchema = z
  .object({
    subject_number: subjectNumberSchema,
    source_type: z.enum(['brand', 'dealer']),
    brand_id: z.string().uuid('Invalid brand id').optional().or(z.literal('')),
    dealer_id: z.string().uuid('Invalid dealer id').optional().or(z.literal('')),
    assigned_technician_id: z.string().uuid('Invalid technician id').optional().or(z.literal('')),
    priority: subjectPrioritySchema,
    priority_reason: z.string().trim().min(5, 'Priority reason is required').max(1000, 'Reason is too long'),
    allocated_date: z.string().min(10, 'Allocated date is required'),
    type_of_service: z.enum(['installation', 'service']),
    category_id: z.string().uuid('Category is required'),
    customer_phone: z.string().trim().max(20).optional().or(z.literal('')),
    customer_name: z.string().trim().max(255).optional().or(z.literal('')),
    customer_address: z.string().trim().max(2000).optional().or(z.literal('')),
    product_name: z.string().trim().max(255).optional().or(z.literal('')),
    serial_number: z.string().trim().max(255).optional().or(z.literal('')),
    product_description: z.string().trim().max(2000).optional().or(z.literal('')),
    purchase_date: z.string().optional().or(z.literal('')),
    warranty_end_date: z.string().optional().or(z.literal('')),
    amc_start_date: z.string().optional().or(z.literal('')),
    amc_end_date: z.string().optional().or(z.literal('')),
  })
  .superRefine((value, ctx) => {
    if (value.source_type === 'brand' && !value.brand_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['brand_id'],
        message: 'Brand is required when source is brand.',
      });
    }

    if (value.source_type === 'dealer' && !value.dealer_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['dealer_id'],
        message: 'Dealer is required when source is dealer.',
      });
    }

    if (value.purchase_date && value.warranty_end_date && value.warranty_end_date < value.purchase_date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['warranty_end_date'],
        message: 'Warranty end date cannot be before purchase date.',
      });
    }

    if (value.amc_end_date && !value.amc_start_date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['amc_start_date'],
        message: 'AMC purchase/start date is required when AMC end date is set.',
      });
    }

    if (value.amc_start_date && value.amc_end_date && value.amc_end_date < value.amc_start_date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['amc_end_date'],
        message: 'AMC end date cannot be before AMC start date.',
      });
    }
  });

export const createSubjectSchema = subjectFormSchema.extend({
  created_by: z.string().uuid('Invalid creator id'),
});

export const updateSubjectSchema = subjectFormSchema;
