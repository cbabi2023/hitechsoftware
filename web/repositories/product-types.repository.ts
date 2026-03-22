/**
 * @file product-types.repository.ts
 * @module repositories
 *
 * @description
 * Raw database access layer for the `product_types` table.
 *
 * WHAT IS A PRODUCT TYPE?
 * -----------------------
 * A product type describes the nature or form of a product — for example:
 * "Spare Part", "Consumable", "Tool", "Assembly Unit". It is a separate
 * classification axis from product categories. Together, category + type
 * give a full two-dimensional classification of any product.
 *
 * ARCHITECTURE
 * ------------
 * UI Page  →  Hook (useProductTypes)  →  Service (product-type.service)  →  THIS FILE  →  Supabase
 *
 * This file only handles raw database queries. Business rules (validation,
 * in-use checks, error mapping) live in the service layer.
 *
 * SOFT DELETE
 * -----------
 * Same pattern as product-categories: `is_deleted = true` hides a type
 * without removing its database row. This maintains FK integrity for any
 * existing products that reference the type.
 *
 * DATABASE TABLE: public.product_types
 * Columns: id, name, is_active, is_deleted, created_by, created_at, updated_at
 */
import { createClient } from '@/lib/supabase/client';

/** Supabase browser client singleton - reused across all queries in this file */
const supabase = createClient();

/**
 * Shape of a single row from the `product_types` table.
 * Fields mirror the database columns exactly for type safety.
 */
export interface ProductTypeRow {
  id: string;
  name: string;
  is_active: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Returns all active (non-deleted) product types, sorted A→Z.
 * Used to populate dropdowns on product create/edit forms and filter bars.
 */
export async function listProductTypes() {
  return supabase
    .from('product_types')
    .select('id,name,is_active,is_deleted,created_at,updated_at')
    .eq('is_deleted', false)
    .order('name', { ascending: true })
    .returns<ProductTypeRow[]>();
}

/**
 * Creates a new product type with the given name.
 * The DB enforces uniqueness on `lower(name)` WHERE is_deleted=false,
 * so duplicate names produce a unique-violation error (handled by service).
 */
export async function createProductType(name: string) {
  return supabase
    .from('product_types')
    .insert({ name: name.trim(), is_active: true })
    .select('id,name,is_active,is_deleted,created_at,updated_at')
    .single<ProductTypeRow>();
}

/**
 * Partially updates a product type. Only provided fields are changed (PATCH).
 * Guard `.eq('is_deleted', false)` prevents updating already-deleted records.
 */
export async function updateProductType(
  id: string,
  payload: { name?: string; is_active?: boolean },
) {
  return supabase
    .from('product_types')
    .update(payload)
    .eq('id', id)
    .eq('is_deleted', false)
    .select('id,name,is_active,is_deleted,created_at,updated_at')
    .single<ProductTypeRow>();
}

/**
 * Soft-deletes a product type by setting is_deleted=true and is_active=false.
 * The record remains in the database for referential integrity.
 */
export async function softDeleteProductType(id: string) {
  return supabase
    .from('product_types')
    .update({ is_deleted: true, is_active: false })
    .eq('id', id)
    .select('id')
    .single<{ id: string }>();
}

/**
 * Checks if any non-deleted products are currently using this product type.
 *
 * Called by the service before allowing a soft-delete. If products are still
 * referencing this type, deletion is blocked to preserve data integrity.
 * `.limit(1)` makes this query as fast as possible (we only need a yes/no).
 *
 * @param typeId - UUID of the product type to check
 * @returns `{ data: true }` if products reference this type, `{ data: false }` otherwise
 */
export async function hasProductsByType(typeId: string) {
  const result = await supabase
    .from('inventory_products')
    .select('id')
    .eq('product_type_id', typeId)
    .eq('is_deleted', false)
    .limit(1);
  return { data: (result.data ?? []).length > 0, error: result.error };
}
