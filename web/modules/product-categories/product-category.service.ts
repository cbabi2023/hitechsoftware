/**
 * @file product-category.service.ts
 * @module modules/product-categories
 *
 * @description
 * Business logic layer for Product Categories.
 *
 * RESPONSIBILITIES
 * ----------------
 * This service sits between the hooks/UI and the repository/database:
 *  1. INPUT VALIDATION  — validates all inputs with Zod schemas before
 *     passing them to the repository
 *  2. BUSINESS RULES    — enforces rules that go beyond schema validation:
 *     e.g. "cannot delete a category that still has products"
 *  3. ERROR MAPPING     — translates raw Postgres error messages (e.g.
 *     "duplicate key value violates unique constraint") into friendly
 *     user-facing phrases
 *  4. RESULT WRAPPING   — every function returns a `ServiceResult<T>` which
 *     is either `{ ok: true, data: T }` or `{ ok: false, error: { message } }`
 *     This discriminated union removes the need for try/catch in the UI
 *
 * WHAT THIS FILE DOES NOT DO
 * --------------------------
 *  - Does NOT touch the database directly (that’s the repository’s job)
 *  - Does NOT manage React state or query cache (that’s the hook’s job)
 *  - Does NOT render anything (that’s the page/component’s job)
 *
 * SERVICERESULT TYPE
 * ------------------
 * Defined in `@/types/common.types.ts`. Pattern:
 *   type ServiceResult<T> =
 *     | { ok: true; data: T }
 *     | { ok: false; error: { message: string; code?: string } }
 */
import type { ServiceResult } from '@/types/common.types';
import {
  createProductCategory,
  hasProductsByCategory,
  listProductCategories,
  softDeleteProductCategory,
  updateProductCategory,
} from '@/repositories/product-categories.repository';
import type {
  CreateProductCategoryInput,
  ProductCategory,
  UpdateProductCategoryInput,
} from './product-category.types';
import { createProductCategorySchema } from './product-category.validation';

/**
 * Maps raw Postgres/Supabase error messages to user-friendly strings.
 *
 * The regex `/duplicate key|unique/i` catches the standard Postgres unique-
 * violation error message. This saves users from seeing cryptic DB errors.
 *
 * @param message - Raw error message from Supabase
 * @returns A friendly, human-readable error string
 */
function mapError(message?: string): string {
  const safe = message?.trim() ?? 'Failed to process product category';
  if (/duplicate key|unique/i.test(safe)) return 'A category with this name already exists.';
  return safe;
}

/**
 * Fetches all non-deleted product categories.
 *
 * Returns an empty array (not an error) if no categories exist yet.
 * The calling hook will show appropriate empty-state UI.
 */
export async function getProductCategories(): Promise<ServiceResult<ProductCategory[]>> {
  const result = await listProductCategories();
  if (result.error) return { ok: false, error: { message: result.error.message, code: result.error.code } };
  return { ok: true, data: result.data ?? [] };
}

/**
 * Creates a new product category after validating the input.
 *
 * Validation step: Zod schema checks name length and trims whitespace.
 * If validation fails, returns an error immediately without hitting the DB.
 *
 * @param input - { name: string }
 */
export async function addProductCategory(
  input: CreateProductCategoryInput,
): Promise<ServiceResult<ProductCategory>> {
  // Validate input first — avoids unnecessary DB trips for bad data
  const parsed = createProductCategorySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { message: parsed.error.issues[0]?.message ?? 'Invalid input' } };
  }

  const result = await createProductCategory(parsed.data.name);
  if (result.error || !result.data) {
    return { ok: false, error: { message: mapError(result.error?.message), code: result.error?.code } };
  }
  return { ok: true, data: result.data };
}

/**
 * Updates the name and/or active status of an existing category.
 *
 * Trims name whitespace and converts empty strings to undefined so only
 * genuinely provided values reach the repository.
 *
 * @param id    - UUID of the category to update
 * @param input - Partial update fields (name, is_active)
 */
export async function editProductCategory(
  id: string,
  input: UpdateProductCategoryInput,
): Promise<ServiceResult<ProductCategory>> {
  const payload: UpdateProductCategoryInput = {
    name: input.name?.trim() || undefined,
    is_active: input.is_active,
  };

  const result = await updateProductCategory(id, payload);
  if (result.error || !result.data) {
    return { ok: false, error: { message: mapError(result.error?.message), code: result.error?.code } };
  }
  return { ok: true, data: result.data };
}

/**
 * Deletes (soft) a product category, with a safety check.
 *
 * BUSINESS RULE: A category cannot be deleted if any active products are
 * currently assigned to it. This prevents orphaned products that would
 * appear without a category in the UI.
 *
 * Flow:
 *  1. Check if any products reference this category
 *  2. If yes → return a block error (do not delete)
 *  3. If no  → proceed with soft delete
 *
 * @param id - UUID of the category to delete
 */
export async function removeProductCategory(id: string): Promise<ServiceResult<{ id: string }>> {
  // Guard: block deletion if products are assigned to this category
  const usage = await hasProductsByCategory(id);
  if (usage.error) return { ok: false, error: { message: usage.error.message, code: usage.error.code } };
  if (usage.data) return { ok: false, error: { message: 'Cannot delete: products are using this category.' } };

  const result = await softDeleteProductCategory(id);
  if (result.error || !result.data) {
    return {
      ok: false,
      error: { message: result.error?.message ?? 'Failed to delete category', code: result.error?.code },
    };
  }
  return { ok: true, data: result.data };
}
