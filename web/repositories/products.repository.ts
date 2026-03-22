/**
 * @file products.repository.ts
 * @module repositories
 *
 * @description
 * Raw database access layer for the `products` table, including joins to
 * `product_categories` and `product_types`.
 *
 * WHAT IS A PRODUCT?
 * ------------------
 * A product is a physical inventory item tracked by the company. Key fields:
 *  - product_name   : Human-readable display name
 *  - material_code  : Unique internal identifier (alphanumeric, always UPPERCASE)
 *  - category_id    : Foreign key to product_categories (e.g. "Electronics")
 *  - product_type_id: Foreign key to product_types (e.g. "Spare Part")
 *  - is_refurbished : Flag for refurbished/used items; triggers refurbished_label
 *  - hsn_sac_code   : India GST harmonised system code for tax purposes
 *  - is_active      : Whether this product is currently in use / available
 *
 * MATERIAL CODE RULES
 * --------------------
 * Material codes are the primary lookup key used in stock entries and search.
 * Rules enforced here AND in validation:
 *  1. Must be at least 2 characters and at most 100
 *  2. Alphanumeric + hyphens/underscores/slashes only
 *  3. Always stored as UPPERCASE (normalised on insert + update)
 *  4. Unique per active product (DB unique index on `upper(material_code)` WHERE is_deleted=false)
 *
 * RELATIONAL JOINS
 * ----------------
 * SELECT_COLS includes PostgREST foreign-table joins:
 *  `category:product_categories(id,name)` → embedded category object
 *  `product_type:product_types(id,name)`  → embedded product_type object
 * This avoids a separate query for category/type names in the UI.
 *
 * ARCHITECTURE
 * ------------
 * UI Page  →  Hook (useProducts / useProduct)  →  Service (product.service)  →  THIS FILE  →  Supabase
 *
 * DATABASE TABLE: public.products
 * See migration 20260322_016_product_inventory.sql for full schema.
 */
import { createClient } from '@/lib/supabase/client';

/** Supabase browser client singleton */
const supabase = createClient();

/**
 * Flat row from the `products` table (no relational joins).
 * Used internally; prefer `ProductWithRelations` in most contexts.
 */
export interface ProductRow {
  id: string;
  product_name: string;
  description: string | null;
  material_code: string;
  category_id: string | null;
  product_type_id: string | null;
  is_refurbished: boolean;
  refurbished_label: string | null;
  hsn_sac_code: string | null;
  is_active: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Extended product row that includes the resolved category and product_type
 * names via PostgREST foreign-table joins. This is what most UI consumers use.
 */
export interface ProductWithRelations extends ProductRow {
  category: { id: string; name: string } | null;
  product_type: { id: string; name: string } | null;
}

/**
 * Input shape for creating a new product. All fields except product_name and
 * material_code are optional and default to null/false in the DB.
 */
export interface CreateProductInput {
  product_name: string;
  description?: string | null;
  material_code: string;
  category_id?: string | null;
  product_type_id?: string | null;
  is_refurbished?: boolean;
  refurbished_label?: string | null;
  hsn_sac_code?: string | null;
  is_active?: boolean;
}

/**
 * Filters accepted by `listProducts` for server-side filtering and pagination.
 * All fields are optional — calling with no arguments returns all active products.
 */
export interface ProductFilters {
  search?: string;
  category_id?: string;
  product_type_id?: string;
  is_active?: boolean;
  is_refurbished?: boolean;
  page?: number;
  page_size?: number;
}

/**
 * Reusable SELECT clause string for Supabase.
 * Listing it once here ensures create/read/update all return the same shape,
 * so the TypeScript type ProductWithRelations always matches what comes back.
 *
 * The PostgREST syntax `category:product_categories(id,name)` creates an
 * embedded object on the response called `category` with fields id and name.
 */
const SELECT_COLS = `
  id,product_name,description,material_code,
  category_id,product_type_id,
  is_refurbished,refurbished_label,hsn_sac_code,
  is_active,is_deleted,created_at,updated_at,
  category:product_categories(id,name),
  product_type:product_types(id,name)
`.trim();

/**
 * Returns a paginated, filtered list of products.
 *
 * HOW PAGINATION WORKS
 * --------------------
 * Supabase uses range-based pagination. Given page=2, page_size=20:
 *   from = (2-1) * 20 = 20   (first row index, 0-based)
 *   to   = 20 + 20 - 1 = 39  (last row index, inclusive)
 * `{ count: 'exact' }` tells Supabase to also return the total row count,
 * which is used to calculate total_pages in the service layer.
 *
 * HOW SEARCH WORKS
 * ----------------
 * `ilike` is case-insensitive LIKE. We search across three fields using `.or()`:
 *  - product_name
 *  - material_code
 *  - hsn_sac_code
 * This lets users find products by typing a partial material code, name, or GST code.
 *
 * @param filters - Optional filter/pagination parameters
 */
export async function listProducts(filters: ProductFilters = {}) {
  const { search, category_id, product_type_id, is_active, is_refurbished, page = 1, page_size = 20 } = filters;
  const from = (page - 1) * page_size;
  const to = from + page_size - 1;

  let query = supabase
    .from('inventory_products')
    .select(SELECT_COLS, { count: 'exact' })
    .eq('is_deleted', false)
    .order('product_name', { ascending: true })
    .range(from, to);

  if (search) {
    query = query.or(
      `product_name.ilike.%${search}%,material_code.ilike.%${search}%,hsn_sac_code.ilike.%${search}%`,
    );
  }
  if (category_id) query = query.eq('category_id', category_id);
  if (product_type_id) query = query.eq('product_type_id', product_type_id);
  if (is_active !== undefined) query = query.eq('is_active', is_active);
  if (is_refurbished !== undefined) query = query.eq('is_refurbished', is_refurbished);

  return query.returns<ProductWithRelations[]>();
}

/**
 * Fetches a single product by its UUID, including category and type joins.
 * Returns an error if the product does not exist or is soft-deleted.
 */
export async function findProductById(id: string) {
  return supabase
    .from('inventory_products')
    .select(SELECT_COLS)
    .eq('id', id)
    .eq('is_deleted', false)
    .single<ProductWithRelations>();
}

/**
 * Looks up a product by its material code (case-insensitive via `ilike`).
 * Returns null (not an error) when no match is found (using `maybeSingle`).
 * Used in stock entry forms to auto-fill product details when a code is typed.
 */
export async function findProductByMaterialCode(materialCode: string) {
  return supabase
    .from('inventory_products')
    .select(SELECT_COLS)
    .eq('is_deleted', false)
    .ilike('material_code', materialCode)
    .maybeSingle<ProductWithRelations>();
}

/**
 * Inserts a new product row after normalising the inputs:
 *  - product_name is trimmed of whitespace
 *  - material_code is trimmed AND converted to UPPERCASE (enforced convention)
 *  - description and optionals default to null if not provided
 *  - refurbished_label is only saved when is_refurbished=true; otherwise null
 *    (prevents stale label data when a product is un-marked as refurbished)
 *
 * The database unique index on `upper(material_code)` WHERE is_deleted=false
 * prevents two active products with the same code even if this function is
 * called concurrently (race-condition safe at DB level).
 */
export async function createProduct(input: CreateProductInput) {
  return supabase
    .from('inventory_products')
    .insert({
      product_name: input.product_name.trim(),
      description: input.description?.trim() ?? null,
      material_code: input.material_code.trim().toUpperCase(),
      category_id: input.category_id ?? null,
      product_type_id: input.product_type_id ?? null,
      is_refurbished: input.is_refurbished ?? false,
      refurbished_label: input.is_refurbished ? (input.refurbished_label?.trim() ?? null) : null,
      hsn_sac_code: input.hsn_sac_code?.trim() ?? null,
      is_active: input.is_active ?? true,
    })
    .select(SELECT_COLS)
    .single<ProductWithRelations>();
}

/**
 * Partially updates a product (PATCH semantics).
 *
 * WHY THE DYNAMIC PAYLOAD OBJECT?
 * We build `payload` by only including fields that are explicitly provided in
 * `input`. This avoids accidentally overwriting a field with `undefined` when
 * the caller only wants to change one thing (e.g. just toggle is_active).
 *
 * REFURBISHED LABEL CLEARING:
 * If `is_refurbished` is being set to false, we also clear `refurbished_label`
 * to avoid stale data. The label should only exist when the product IS refurbished.
 */
export async function updateProduct(id: string, input: Partial<CreateProductInput>) {
  const payload: Record<string, unknown> = {};
  if (input.product_name !== undefined) payload.product_name = input.product_name.trim();
  if (input.description !== undefined) payload.description = input.description?.trim() ?? null;
  if (input.material_code !== undefined) payload.material_code = input.material_code.trim().toUpperCase();
  if (input.category_id !== undefined) payload.category_id = input.category_id ?? null;
  if (input.product_type_id !== undefined) payload.product_type_id = input.product_type_id ?? null;
  if (input.is_refurbished !== undefined) {
    payload.is_refurbished = input.is_refurbished;
    if (!input.is_refurbished) payload.refurbished_label = null;
  }
  if (input.refurbished_label !== undefined) payload.refurbished_label = input.refurbished_label?.trim() ?? null;
  if (input.hsn_sac_code !== undefined) payload.hsn_sac_code = input.hsn_sac_code?.trim() ?? null;
  if (input.is_active !== undefined) payload.is_active = input.is_active;

  return supabase
    .from('inventory_products')
    .update(payload)
    .eq('id', id)
    .eq('is_deleted', false)
    .select(SELECT_COLS)
    .single<ProductWithRelations>();
}

/**
 * Soft-deletes a product by setting is_deleted=true and is_active=false.
 * The product remains in the database so that stock entry history that
 * referenced this product maintains valid relational data.
 */
export async function softDeleteProduct(id: string) {
  return supabase
    .from('inventory_products')
    .update({ is_deleted: true, is_active: false })
    .eq('id', id)
    .select('id')
    .single<{ id: string }>();
}
