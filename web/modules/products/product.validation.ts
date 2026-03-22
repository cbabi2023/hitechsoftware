/**
 * @file product.validation.ts
 * @module modules/products
 *
 * @description
 * Zod validation schemas for the Products module.
 *
 * SCHEMAS IN THIS FILE
 * --------------------
 * createProductSchema  → Full validation for creating a product
 * updateProductSchema  → Partial version for editing (all fields optional)
 *
 * IMPORTANT: ZOD + REACT HOOK FORM COMPATIBILITY
 * -----------------------------------------------
 * We intentionally do NOT use `.default(value)` on boolean fields (is_refurbished,
 * is_active). Zod’s `.default()` changes the OUTPUT type (boolean) without changing
 * the INPUT type (boolean | undefined), which causes a type mismatch when React
 * Hook Form’s resolver tries to reconcile them.
 *
 * Instead, defaults for booleans are provided in `useForm({ defaultValues: ... })`
 * within the form component. The schema simply requires them to be boolean.
 *
 * CROSS-FIELD VALIDATION
 * ----------------------
 * We use Zod’s `.refine()` to enforce a cross-field rule:
 *   "If is_refurbished=true, then refurbished_label must be non-empty."
 * This cannot be expressed as a per-field rule because it depends on another field.
 *
 * MATERIAL CODE FORMAT
 * --------------------
 * Regex: ^[A-Za-z0-9\-_/]+$
 * Valid examples:  MC-001, BRKT/EL-42, ITEM_99, ABC123
 * Invalid examples: MC 001 (space), MC#001 (hash), @item (special char)
 * Always stored UPPERCASE in the DB (applied in the repository).
 */
import { z } from 'zod';

/**
 * Shared material code validation rule, used in both product and stock-entry schemas.
 * Min 2 chars to avoid single-character codes; max 100 matches the DB VARCHAR(100).
 */
const materialCodeSchema = z
  .string()
  .min(2, 'Material code must be at least 2 characters')
  .max(100, 'Material code must be 100 characters or fewer')
  .regex(/^[A-Za-z0-9\-_/]+$/, 'Material code may only contain letters, numbers, hyphens, underscores, and slashes')
  .trim();

/**
 * Full validation schema for creating a new product.
 *
 * The `.refine()` at the end adds a cross-field rule:
 * when is_refurbished is true, refurbished_label must be non-empty.
 * The error is attached to the `refurbished_label` field path so it appears
 * directly below that field in the form UI.
 */
export const createProductSchema = z
  .object({
    product_name: z.string().min(1, 'Product name is required').max(255).trim(),
    description: z.string().max(2000).trim().nullish(),
    material_code: materialCodeSchema,
    category_id: z.string().uuid('Invalid category').nullish(),
    product_type_id: z.string().uuid('Invalid product type').nullish(),
    // NOTE: No .default() here — defaults are provided in useForm({ defaultValues })
    is_refurbished: z.boolean(),
    refurbished_label: z.string().max(100).trim().nullish(),
    hsn_sac_code: z.string().max(20).trim().nullish(),
    is_active: z.boolean(),
  })
  .refine(
    // Cross-field rule: label required when product is marked as refurbished
    (data) => !data.is_refurbished || (data.refurbished_label && data.refurbished_label.trim().length > 0),
    { message: 'Refurbished label is required when product is marked as refurbished', path: ['refurbished_label'] },
  );

/**
 * Partial schema for editing an existing product.
 * `.partial()` makes every field optional — you only need to send the fields
 * that are actually changing (PATCH semantics).
 */
export const updateProductSchema = createProductSchema.partial();

/** TypeScript type derived from the create schema (what the form produces) */
export type CreateProductFormValues = z.infer<typeof createProductSchema>;
/** TypeScript type derived from the update schema */
export type UpdateProductFormValues = z.infer<typeof updateProductSchema>;
