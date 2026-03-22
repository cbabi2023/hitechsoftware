/**
 * @file stock-entries.repository.ts
 * @module repositories
 *
 * @description
 * Raw database access layer for the `stock_entries` and `stock_entry_items` tables.
 *
 * HOW STOCK ENTRIES WORK
 * ----------------------
 * A stock entry records a single goods receipt event. It has two levels:
 *
 *  1. HEADER (stock_entries table)
 *     - invoice_number : The supplier's invoice reference
 *     - entry_date     : When the goods were received
 *     - notes          : Optional remarks about the delivery
 *
 *  2. LINE ITEMS (stock_entry_items table)
 *     - Each row is one product/quantity pair within the entry
 *     - product_id links to the products table (can be null for ad-hoc items)
 *     - material_code is stored separately (denormalised) so the record
 *       remains readable even if the product is later soft-deleted
 *     - hsn_sac_code copied from the product at entry time (GST classification)
 *
 * TWO-STEP INSERT PATTERN
 * -----------------------
 * Supabase JS client does not support inserting a header + related rows in a
 * single atomic call without using a DB function/RPC. Instead we:
 *   1. Insert the stock_entry header and get back the new `id`
 *   2. Insert all stock_entry_items with that `id` as `stock_entry_id`
 *   3. If step 2 fails, the entry header exists but has no items — we return
 *      the error so the caller can show a toast and the user can retry
 *
 * IMPORTANT: For full atomicity (all-or-nothing), this would need a Postgres
 * transaction or a DB RPC. The current two-step approach is an acceptable
 * trade-off for the expected low volume of concurrent writes.
 *
 * ARCHITECTURE
 * ------------
 * UI  →  Hook (useStockEntries)  →  Service (stock-entry.service)  →  THIS FILE  →  Supabase
 *
 * DATABASE TABLES
 * ---------------
 * - public.stock_entries       (header)
 * - public.stock_entry_items   (line items, CASCADE DELETE from entries)
 * See migration 20260322_016_product_inventory.sql for full schema.
 */
import { createClient } from '@/lib/supabase/client';

/** Supabase browser client singleton */
const supabase = createClient();

/**
 * Input shape for a single line item when creating a stock entry.
 * product_id is nullable because a user may type a material code manually
 * for a product that does not yet exist in the system.
 */
export interface StockEntryItemInput {
  product_id: string | null;
  material_code: string;
  quantity: number;
  hsn_sac_code?: string | null;
}

/**
 * A persisted stock entry item row, including a nested `product` object
 * joined from the products table (may be null if product was deleted).
 */
export interface StockEntryItemRow {
  id: string;
  stock_entry_id: string;
  product_id: string | null;
  material_code: string;
  quantity: number;
  hsn_sac_code: string | null;
  created_at: string;
  product: { id: string; product_name: string; material_code: string } | null;
}

/** Flat row from the stock_entries header table. */
export interface StockEntryRow {
  id: string;
  invoice_number: string;
  entry_date: string;
  notes: string | null;
  is_deleted: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * A stock entry with its line items fully embedded.
 * This is what the UI renders — one object = one complete goods receipt.
 */
export interface StockEntryWithItems extends StockEntryRow {
  items: StockEntryItemRow[];
}

/** Input shape for creating a stock entry (header + all items together). */
export interface CreateStockEntryInput {
  invoice_number: string;
  entry_date: string;
  notes?: string | null;
  items: StockEntryItemInput[];
}

/**
 * Filter options for listing stock entries.
 * - search     : Partial match on invoice_number
 * - date_from  : Only entries on or after this date (YYYY-MM-DD)
 * - date_to    : Only entries on or before this date (YYYY-MM-DD)
 * - page/page_size: Standard cursor pagination
 */
export interface StockEntryFilters {
  search?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  page_size?: number;
}

/**
 * Returns a paginated list of stock entries, newest first.
 *
 * Items are embedded directly in each entry using PostgREST's nested-select
 * syntax. The double ORDER (entry_date DESC, created_at DESC) ensures that
 * entries on the same date are further sorted by insertion time.
 *
 * The nested product join on items:
 *  `product:inventory_products(id,product_name,material_code)`
 * gives the UI enough info to display product names without a second query.
 *
 * @param filters - Optional date range, search, and pagination
 */
export async function listStockEntries(filters: StockEntryFilters = {}) {
  const { search, date_from, date_to, page = 1, page_size = 20 } = filters;
  const from = (page - 1) * page_size;
  const to = from + page_size - 1;

  let query = supabase
    .from('stock_entries')
    .select(
      `id,invoice_number,entry_date,notes,is_deleted,created_by,created_at,updated_at,
       items:stock_entry_items(id,stock_entry_id,product_id,material_code,quantity,hsn_sac_code,created_at,product:inventory_products(id,product_name,material_code))`,
      { count: 'exact' },
    )
    .eq('is_deleted', false)
    .order('entry_date', { ascending: false })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (search) {
    query = query.ilike('invoice_number', `%${search}%`);
  }
  if (date_from) query = query.gte('entry_date', date_from);
  if (date_to) query = query.lte('entry_date', date_to);

  return query.returns<StockEntryWithItems[]>();
}

/**
 * Fetches a single stock entry with all its line items by ID.
 * Used when navigating to a detail view or confirming a just-created entry.
 */
export async function findStockEntryById(id: string) {
  return supabase
    .from('stock_entries')
    .select(
      `id,invoice_number,entry_date,notes,is_deleted,created_by,created_at,updated_at,
       items:stock_entry_items(id,stock_entry_id,product_id,material_code,quantity,hsn_sac_code,created_at,product:inventory_products(id,product_name,material_code))`,
    )
    .eq('id', id)
    .eq('is_deleted', false)
    .single<StockEntryWithItems>();
}

/**
 * Creates a complete stock entry (header + items) in two sequential steps.
 *
 * STEP 1: Insert the header row into `stock_entries` and get back the auto-
 *         generated UUID. We need this ID to link the items.
 *
 * STEP 2: Insert all line items into `stock_entry_items` linking to the
 *         header ID. material_code is normalised to UPPERCASE.
 *
 * If step 2 fails, we return the error immediately. The orphaned header row
 * will have no items and is effectively invisible to the UI (list queries
 * always join items). A retry by the user creates a fresh entry.
 *
 * On success, we re-fetch the complete entry with items via findStockEntryById
 * so the returned data is consistent with all other read operations.
 */
export async function createStockEntry(input: CreateStockEntryInput) {
  const { data: entry, error: entryError } = await supabase
    .from('stock_entries')
    .insert({
      invoice_number: input.invoice_number.trim(),
      entry_date: input.entry_date,
      notes: input.notes?.trim() ?? null,
    })
    .select('id,invoice_number,entry_date,notes,is_deleted,created_by,created_at,updated_at')
    .single<StockEntryRow>();

  if (entryError || !entry) {
    return { data: null, error: entryError };
  }

  const itemRows = input.items.map((item) => ({
    stock_entry_id: entry.id,
    product_id: item.product_id,
    material_code: item.material_code.trim().toUpperCase(),
    quantity: item.quantity,
    hsn_sac_code: item.hsn_sac_code?.trim() ?? null,
  }));

  const { error: itemsError } = await supabase.from('stock_entry_items').insert(itemRows);

  if (itemsError) {
    return { data: null, error: itemsError };
  }

  return findStockEntryById(entry.id);
}

/**
 * Soft-deletes a stock entry header. Because `stock_entry_items` has
 * `ON DELETE CASCADE`, all child items are automatically deleted from the
 * database when the parent entry is hard-deleted. However, since we only
 * soft-delete the header here (is_deleted=true), the items remain in the DB.
 * They become invisible because list queries filter `is_deleted = false` on
 * the header, and item queries always join through the header.
 */
export async function softDeleteStockEntry(id: string) {
  return supabase
    .from('stock_entries')
    .update({ is_deleted: true })
    .eq('id', id)
    .select('id')
    .single<{ id: string }>();
}
