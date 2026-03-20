import { z } from 'zod';

const phoneSchema = z
  .string()
  .trim()
  .refine(
    (val) => {
      if (!val || val.length === 0) return true; // Allow empty/undefined
      return /^(?:\+91|91)?[6-9]\d{9}$/.test(val);
    },
    'Enter a valid Indian phone number (10 digits, starting with 6-9)',
  )
  .optional()
  .transform((val) => (val?.length === 0 ? undefined : val));

const technicianCreateSchema = z.object({
  technician_code: z.string().trim().min(2, 'Technician code is required').max(50),
  qualification: z.string().trim().optional().or(z.literal('')),
  experience_years: z.number().int().min(0).max(60).optional(),
  daily_subject_limit: z.number().int().min(1).max(100).optional(),
  digital_bag_capacity: z.number().int().min(1).max(500).optional(),
});

export const createTeamMemberSchema = z
  .object({
    email: z.string().trim().email('Enter a valid email'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    display_name: z.string().trim().min(2, 'Display name is required'),
    phone_number: phoneSchema,
    role: z.enum(['super_admin', 'office_staff', 'stock_manager', 'technician']),
    is_active: z.boolean().optional(),
    technician: technicianCreateSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.role === 'technician' && !value.technician) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['technician', 'technician_code'],
        message: 'Technician code is required for technician role.',
      });
    }
  });

export const updateTeamMemberSchema = z.object({
  display_name: z.string().trim().min(2).optional(),
  phone_number: phoneSchema.optional().or(z.literal('')),
  role: z.enum(['super_admin', 'office_staff', 'stock_manager', 'technician']).optional(),
  is_active: z.boolean().optional(),
  technician: z
    .object({
      technician_code: z.string().trim().min(2).max(50).optional(),
      qualification: z.string().trim().optional().or(z.literal('')),
      experience_years: z.number().int().min(0).max(60).optional(),
      daily_subject_limit: z.number().int().min(1).max(100).optional(),
      digital_bag_capacity: z.number().int().min(1).max(500).optional(),
      is_active: z.boolean().optional(),
      is_deleted: z.boolean().optional(),
    })
    .optional(),
});
