/**
 * @file product.service.ts
 * @module modules/products
 *
 * @description
 * Business logic layer for the Products module.
 *
 * ARCHITECTURE POSITION
 * ---------------------
 * Hook / Page  →  THIS SERVICE  →  Repository  →  Supabase DB
 *
 * Responsibilities:
 *  1. VALIDATE  — run Zod schema against all inputs before reaching the DB
 *  2. PAGINATE  — normalise page defaults and compute pagination metadata
 *  3. MAP ERRORS — translate raw Postgres constraint errors to friendly text
 *  4. WRAP      — return all results as ServiceResult<T> discriminated union
 *
 * PAGINATION
 * ----------
 * The service is responsible for computing `total_pages` from the raw `count`
 * returned by Supabase (when `{ count: 'exact' }` is used in the query).
 * Formula: total_pages = Math.ceil(total / page_size)
 */
import type { ServiceResult } from '@/types/common.types';
import {
  createProduct,
  findProductById,
  listProducts,
  softDeleteProduct,
  updateProduct,
} from '@/repositories/products.repository';
import type { CreateProductInput, Product, ProductFilters, ProductListResponse, UpdateProductInput } from './product.types';
import { createProductSchema, updateProductSchema } from './product.validation';

/** Default page size for paginated product lists */
const PAGE_SIZE = 20;

/**
 * Maps Postgres/Supabase error messages to user-friendly text.
 * Catches unique constraint violations on material_code.
 */
function mapError(message?: string): string {
  const safe = message?.trim() ?? 'Failed to process product';
  if (/duplicate key|unique/i.test(safe)) return 'A product with this material code already exists.';
  return safe;
}

/**
 * Returns a paginated, filtered list of products.
 *
 * The raw `result.count` from Supabase is the TOTAL number of matching rows
 * (not just the current page). We use it to calculate total_pages and return
 * the full pagination metadata that the list page needs for its nav controls.
 *
 * @param filters - Optional search, category/type filters, and pagination
 */
export async function getProducts(filters: ProductFilters = {}): Promise<ServiceResult<ProductListResponse>> {
  const page = filters.page ?? 1;
  const page_size = filters.page_size ?? PAGE_SIZE;

  const result = await listProducts({ ...filters, page, page_size });
  if (result.error) return { ok: false, error: { message: result.error.message, code: result.error.code } };

  const total = result.count ?? 0;
  return {
    ok: true,
    data: {
      data: result.data ?? [],
      total,
      page,
      page_size,
      total_pages: Math.ceil(total / page_size),
    },
  };
}

/**
 * Fetches a single product by its UUID for the edit form.
 * Returns a friendly "not found" error if the product doesn’t exist.
 */
export async function getProduct(id: string): Promise<ServiceResult<Product>> {
  const result = await findProductById(id);
  if (result.error || !result.data) {
    return { ok: false, error: { message: result.error?.message ?? 'Product not found', code: result.error?.code } };
  }
  return { ok: true, data: result.data };
}

/**
 * Validates and creates a new product.
 *
 * Validation includes the cross-field refurbished label check.
 * If validation fails, returns an error immediately without hitting the DB.
 *
 * @param input - All required product fields
 */
export async function addProduct(input: CreateProductInput): Promise<ServiceResult<Product>> {
  const parsed = createProductSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { message: parsed.error.issues[0]?.message ?? 'Invalid input' } };
  }

  const result = await createProduct(parsed.data);
  if (result.error || !result.data) {
    return { ok: false, error: { message: mapError(result.error?.message), code: result.error?.code } };
  }
  return { ok: true, data: result.data };
}

/**
 * Validates and applies a partial update to an existing product.
 * Uses `updateProductSchema` which makes all fields optional (PATCH).
 *
 * @param id    - UUID of the product to update
 * @param input - Partial set of product fields to change
 */
export async function editProduct(id: string, input: UpdateProductInput): Promise<ServiceResult<Product>> {
  const parsed = updateProductSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { message: parsed.error.issues[0]?.message ?? 'Invalid input' } };
  }

  const result = await updateProduct(id, parsed.data);
  if (result.error || !result.data) {
    return { ok: false, error: { message: mapError(result.error?.message), code: result.error?.code } };
  }
  return { ok: true, data: result.data };
}

/**
 * Soft-deletes a product.
 *
 * NOTE: Products are not checked for stock-entry references before deletion,
 * because keeping stock history intact is the priority. The product FK on
 * stock_entry_items is SET NULL on delete, so history remains readable.
 *
 * @param id - UUID of the product to delete
 */
export async function removeProduct(id: string): Promise<ServiceResult<{ id: string }>> {
  const result = await softDeleteProduct(id);
  if (result.error || !result.data) {
    return {
      ok: false,
      error: { message: result.error?.message ?? 'Failed to delete product', code: result.error?.code },
    };
  }
  return { ok: true, data: result.data };
}
  }
  return { ok: true, data: result.data };
}
