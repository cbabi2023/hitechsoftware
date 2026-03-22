import { z } from 'zod';

const inventoryBaseSchema = z.object({
  item_code: z
    .string()
    .trim()
    .min(1, 'Item code is required')
    .max(100, 'Item code must be 100 characters or fewer')
    .regex(/^[A-Z0-9\-_]+$/i, 'Item code may only contain letters, numbers, hyphens, and underscores'),
  item_name: z.string().trim().min(2, 'Item name is required').max(255, 'Item name must be 255 characters or fewer'),
  item_category: z.string().trim().min(1, 'Category is required'),
  description: z.string().trim().optional().or(z.literal('')),
  unit_cost: z
    .number({ error: 'Unit cost must be a number' })
    .min(0, 'Unit cost cannot be negative')
    .multipleOf(0.01, 'Unit cost supports up to 2 decimal places'),
  mrp_price: z
    .number({ error: 'MRP price must be a number' })
    .min(0, 'MRP cannot be negative')
    .multipleOf(0.01, 'MRP supports up to 2 decimal places'),
  reorder_level: z
    .number({ error: 'Reorder level must be a number' })
    .int('Reorder level must be a whole number')
    .min(0, 'Reorder level cannot be negative')
    .optional(),
  is_active: z.boolean().optional(),
});

export const createInventorySchema = inventoryBaseSchema.refine(
  (data) => data.mrp_price >= data.unit_cost,
  {
    path: ['mrp_price'],
    message: 'MRP must be greater than or equal to the unit cost',
  },
);

export const updateInventorySchema = inventoryBaseSchema.partial().refine(
  (data) => {
    if (data.mrp_price !== undefined && data.unit_cost !== undefined) {
      return data.mrp_price >= data.unit_cost;
    }
    return true;
  },
  {
    path: ['mrp_price'],
    message: 'MRP must be greater than or equal to the unit cost',
  },
);

export const stockAdjustmentSchema = z.object({
  adjustment: z
    .number({ error: 'Adjustment must be a number' })
    .int('Adjustment must be a whole number')
    .refine((v) => v !== 0, { message: 'Adjustment cannot be zero' }),
  warehouse_location: z.string().trim().optional(),
  last_stock_date: z.string().optional(),
});

export type CreateInventoryFormValues = z.infer<typeof createInventorySchema>;
export type UpdateInventoryFormValues = z.infer<typeof updateInventorySchema>;
export type StockAdjustmentFormValues = z.infer<typeof stockAdjustmentSchema>;
