/**
 * @file product-categories.repository.ts
 * @module repositories
 *
 * @description
 * Raw database access layer for the `product_categories` table.
 *
 * WHAT THIS FILE DOES
 * -------------------
 * This file is the ONLY place in the codebase that directly talks to the
 * `product_categories` table in Supabase. Every other part of the system
 * (services, hooks, pages) must go through this file to read or write categories.
 *
 * ARCHITECTURE NOTE
 * -----------------
 * We follow a layered architecture:
 *   UI Page  →  Hook  →  Service  →  Repository  →  Supabase DB
 *
 * This repository is the bottom-most layer. It:
 *  - Constructs Supabase queries
 *  - Applies base filters (e.g. is_deleted = false) so they are never forgotten
 *  - Returns raw Supabase responses ({data, error}) without any business logic
 *  - Leaves error translation and business rules to the service layer
 *
 * SOFT DELETE PATTERN
 * -------------------
 * Records are NEVER physically removed from the database. Instead, we set
 * `is_deleted = true` and `is_active = false`. All read queries filter by
 * `is_deleted = false`, so deleted records are invisible to the application.
 * This preserves data history and allows future auditing or recovery.
 *
 * DATABASE TABLE: public.product_categories
 * Columns: id, name, is_active, is_deleted, created_by, created_at, updated_at
 */
import { createClient } from '@/lib/supabase/client';

/**
 * Supabase browser client singleton.
 * Using a single instance avoids creating multiple connections per render.
 * The client is configured with the public anon key and respects Row Level
 * Security (RLS) policies defined in the database.
 */
const supabase = createClient();

/**
 * Represents exactly one row from the `product_categories` table as returned
 * by Supabase. The service layer maps this to the domain `ProductCategory` type.
 */
export interface ProductCategoryRow {
  id: string;
  name: string;
  is_active: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Fetches all non-deleted product categories, sorted alphabetically by name.
 *
 * Why alphabetical? Categories appear in dropdowns throughout the UI. Alphabetical
 * order makes it easy for users to scan and find a category quickly.
 *
 * @returns Supabase response with an array of ProductCategoryRow or an error
 */
export async function listProductCategories() {
  return supabase
    .from('product_categories')
    .select('id,name,is_active,is_deleted,created_at,updated_at')
    .eq('is_deleted', false)          // Always exclude soft-deleted records
    .order('name', { ascending: true }) // Alphabetical for dropdown usability
    .returns<ProductCategoryRow[]>();
}

/**
 * Inserts a new product category with the given name.
 *
 * The name is pre-trimmed here as a safety net (validation also trims it).
 * `is_active` defaults to true — a new category is immediately usable.
 *
 * The database enforces a unique index on `lower(name)` WHERE is_deleted=false,
 * so duplicate names will produce a PostgreSQL unique-violation error. The service
 * layer translates that error into a user-friendly message.
 *
 * @param name - The display name of the new category
 * @returns The inserted row or an error
 */
export async function createProductCategory(name: string) {
  return supabase
    .from('product_categories')
    .insert({ name: name.trim(), is_active: true })
    .select('id,name,is_active,is_deleted,created_at,updated_at')
    .single<ProductCategoryRow>();
}

/**
 * Partially updates a product category by ID.
 *
 * Only the fields present in `payload` are changed — this is a PATCH operation,
 * not a full replacement. The `.eq('is_deleted', false)` guard prevents
 * accidentally updating a record that was already soft-deleted.
 *
 * @param id      UUID of the category to update
 * @param payload Object with optional `name` and/or `is_active` fields
 * @returns The updated row or an error
 */
export async function updateProductCategory(
  id: string,
  payload: { name?: string; is_active?: boolean },
) {
  return supabase
    .from('product_categories')
    .update(payload)
    .eq('id', id)
    .eq('is_deleted', false) // Do not update already-deleted records
    .select('id,name,is_active,is_deleted,created_at,updated_at')
    .single<ProductCategoryRow>();
}

/**
 * Performs a soft delete on a product category.
 *
 * IMPORTANT: This does NOT remove the row from the database.
 * Setting `is_deleted = true` and `is_active = false` effectively hides it
 * from all other queries (which always filter `is_deleted = false`).
 * This preserves any relational history (e.g. existing products referencing
 * this category) without causing FK constraint violations.
 *
 * @param id - UUID of the category to mark as deleted
 * @returns The deleted row's ID or an error
 */
export async function softDeleteProductCategory(id: string) {
  return supabase
    .from('product_categories')
    .update({ is_deleted: true, is_active: false })
    .eq('id', id)
    .select('id')
    .single<{ id: string }>();
}

/**
 * Checks whether any active (non-deleted) products are currently assigned
 * to this category.
 *
 * WHY THIS EXISTS: Before allowing a category to be deleted, we must ensure
 * no products are still using it. Deleting a referenced category would leave
 * orphaned products with no valid category, causing data quality issues.
 *
 * We use `.limit(1)` for efficiency — we only need to know IF at least one
 * product exists, not how many.
 *
 * @param categoryId - UUID of the category to check
 * @returns `{ data: true }` if products exist, `{ data: false }` if safe to delete
 */
export async function hasProductsByCategory(categoryId: string) {
  const result = await supabase
    .from('inventory_products')
    .select('id')
    .eq('category_id', categoryId)
    .eq('is_deleted', false) // Only check active (non-deleted) products
    .limit(1);               // We only need to know if ANY exist, not the count
  return { data: (result.data ?? []).length > 0, error: result.error };
}
