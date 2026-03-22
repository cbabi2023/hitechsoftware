/**
 * @file product-type.service.ts
 * @module modules/product-types
 *
 * @description
 * Business logic layer for Product Types — structurally identical to
 * the product-category service, adapted for the product_types table.
 *
 * ARCHITECTURE REMINDER
 * ---------------------
 * Hook  →  THIS SERVICE  →  Repository  →  Supabase
 *
 * Responsibilities:
 *  - Validate inputs with Zod before writing to DB
 *  - Enforce "in-use" guard before deletion
 *  - Translate Postgres errors to friendly strings
 *  - Wrap all results in the ServiceResult discriminated union
 */
import type { ServiceResult } from '@/types/common.types';
import {
  createProductType,
  hasProductsByType,
  listProductTypes,
  softDeleteProductType,
  updateProductType,
} from '@/repositories/product-types.repository';
import type { CreateProductTypeInput, ProductType, UpdateProductTypeInput } from './product-type.types';
import { createProductTypeSchema } from './product-type.validation';

/**
 * Maps raw DB/Postgres errors to user-friendly messages.
 * Handles unique constraint violations (duplicate type name).
 */
function mapError(message?: string): string {
  const safe = message?.trim() ?? 'Failed to process product type';
  if (/duplicate key|unique/i.test(safe)) return 'A product type with this name already exists.';
  return safe;
}

/** Returns all non-deleted product types. Empty array if none exist. */
export async function getProductTypes(): Promise<ServiceResult<ProductType[]>> {
  const result = await listProductTypes();
  if (result.error) return { ok: false, error: { message: result.error.message, code: result.error.code } };
  return { ok: true, data: result.data ?? [] };
}

/**
 * Creates a new product type after validating the name.
 * @param input - { name: string }
 */
export async function addProductType(input: CreateProductTypeInput): Promise<ServiceResult<ProductType>> {
  const parsed = createProductTypeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { message: parsed.error.issues[0]?.message ?? 'Invalid input' } };
  }

  const result = await createProductType(parsed.data.name);
  if (result.error || !result.data) {
    return { ok: false, error: { message: mapError(result.error?.message), code: result.error?.code } };
  }
  return { ok: true, data: result.data };
}

/**
 * Updates a product type’s name and/or active status.
 * @param id    - UUID of the type to update
 * @param input - Fields to change (both optional)
 */
export async function editProductType(
  id: string,
  input: UpdateProductTypeInput,
): Promise<ServiceResult<ProductType>> {
  const payload: UpdateProductTypeInput = {
    name: input.name?.trim() || undefined,
    is_active: input.is_active,
  };

  const result = await updateProductType(id, payload);
  if (result.error || !result.data) {
    return { ok: false, error: { message: mapError(result.error?.message), code: result.error?.code } };
  }
  return { ok: true, data: result.data };
}

/**
 * Soft-deletes a product type with an in-use guard.
 *
 * BUSINESS RULE: Cannot delete a type while active products reference it.
 * The error message explains why to the user so they can take corrective action
 * (reassign or delete those products first).
 *
 * @param id - UUID of the type to remove
 */
export async function removeProductType(id: string): Promise<ServiceResult<{ id: string }>> {
  // Check if any products currently use this type
  const usage = await hasProductsByType(id);
  if (usage.error) return { ok: false, error: { message: usage.error.message, code: usage.error.code } };
  if (usage.data) return { ok: false, error: { message: 'Cannot delete: products are using this type.' } };

  const result = await softDeleteProductType(id);
  if (result.error || !result.data) {
    return {

      ok: false,
      error: { message: result.error?.message ?? 'Failed to delete product type', code: result.error?.code },
    };
  }
  return { ok: true, data: result.data };
}
