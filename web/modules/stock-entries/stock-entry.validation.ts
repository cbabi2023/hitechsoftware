/**
 * @file stock-entry.validation.ts
 * @module modules/stock-entries
 *
 * @description
 * Zod validation schemas for the Stock Entries module.
 *
 * SCHEMAS IN THIS FILE
 * --------------------
 * stockEntryItemSchema    → Validates a single line item row
 * createStockEntrySchema  → Validates the full form (header + items array)
 *
 * DYNAMIC FORM VALIDATION
 * -----------------------
 * The stock entry form uses `useFieldArray` from React Hook Form, which manages
 * a dynamic array of line items. The `items` field here is a Zod array with
 * `.min(1)` to enforce that at least one item must be recorded.
 * Each item in the array is validated against `stockEntryItemSchema`.
 *
 * PRODUCT_ID NULLABLE DESIGN
 * --------------------------
 * `product_id` is nullable for a specific reason:
 *   - When a user selects a product from the dropdown, product_id is set
 *   - When a user types a material code for an ad-hoc (unlisted) item,
 *     product_id remains null and only material_code is recorded
 * This gives flexibility for stock-taking without requiring every item
 * to be pre-registered in the product catalogue.
 *
 * IMPORTANT: No `.default(null)` on product_id — same reason as in product.validation.ts:
 * ZodDefault changes the type in a way that conflicts with RHF’s resolver.
 * The default `null` value is provided in `useForm({ defaultValues })` instead.
 */
import { z } from 'zod';

/**
 * Material code reused here (same format as in product.validation.ts):
 * alphanumeric + hyphens/underscores/slashes, 2–100 chars, trimmed.
 */
const materialCodeSchema = z
  .string()
  .min(2, 'Material code must be at least 2 characters')
  .max(100)
  .regex(/^[A-Za-z0-9\-_/]+$/, 'Material code may only contain letters, numbers, hyphens, underscores, and slashes')
  .trim();

/**
 * Validates a single stock entry line item.
 *
 * quantity must be a positive integer (at least 1 unit must be received).
 * hsn_sac_code is optional — copied from product if available, but may be
 * manually overridden for items with different tax treatment.
 */
export const stockEntryItemSchema = z.object({
  // Null = ad-hoc item without a registered product; UUID = linked product
  product_id: z.string().uuid().nullable(),
  material_code: materialCodeSchema,
  // Integer check: ensures no fractional quantities (e.g. 0.5 units is invalid)
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  hsn_sac_code: z.string().max(20).trim().nullish(),
});

/**
 * Validates the full stock entry creation payload.
 *
 * invoice_number is REQUIRED — every goods receipt must be traceable to a
 * supplier invoice for audit and accounting purposes.
 *
 * entry_date defaults to today in the form but can be overridden for
 * backdating entries (e.g. recording a delivery that arrived yesterday).
 *
 * items array must have at least 1 item — an empty stock entry makes no sense.
 */
export const createStockEntrySchema = z.object({
  invoice_number: z
    .string()
    .min(1, 'Invoice number is required')
    .max(100, 'Invoice number must be 100 characters or fewer')
    .trim(),
  entry_date: z.string().min(1, 'Date is required'),
  notes: z.string().max(1000).trim().nullish(),
  items: z
    .array(stockEntryItemSchema)
    .min(1, 'At least one item is required'),
});

export type CreateStockEntryFormValues = z.infer<typeof createStockEntrySchema>;
export type StockEntryItemFormValues = z.infer<typeof stockEntryItemSchema>;
