/**
 * @file stock-entry.types.ts
 * @module modules/stock-entries
 *
 * @description
 * TypeScript domain types for the Stock Entries module.
 *
 * WHAT IS A STOCK ENTRY?
 * ----------------------
 * A stock entry records a single goods receipt event — when physical products
 * are received from a supplier and added to inventory. It is modelled as a
 * two-level structure:
 *
 *  StockEntry (header)
 *  └── StockEntryItem[] (line items, one per product received)
 *
 * Domain terminology:
 *  - invoice_number : The supplier’s invoice reference (must be provided)
 *  - entry_date     : Date goods were received (defaults to today)
 *  - items          : One or more product quantities received in this delivery
 *
 * TYPES IN THIS FILE
 * ------------------
 * StockEntryItem       → A single line item (one product + qty in an entry)
 * StockEntry           → Full entry with all line items
 * StockEntryItemInput  → What the form sends per item during creation
 * CreateStockEntryInput→ Full create payload (header + items)
 * StockEntryFilters    → List filter options
 * StockEntryListResponse → Paginated list result
 */

/**
 * A single line item within a stock entry.
 *
 * product_id is NULLABLE because an item may be entered with just a material
 * code (for ad-hoc/unregistered products). When a product IS selected from
 * the dropdown, the `product` object is populated via the DB join.
 *
 * material_code is denormalised (copied from the product at entry time) so
 * that the record remains readable even if the product is later soft-deleted.
 */
export interface StockEntryItem {
  id: string;
  stock_entry_id: string;
  /** Null if item was entered with an ad-hoc material code with no product link */
  product_id: string | null;
  /** Stored in UPPERCASE; denormalised from the product for historical integrity */
  material_code: string;
  quantity: number;
  /** GST HSN/SAC code copied from the product at the time of entry */
  hsn_sac_code: string | null;
  created_at: string;
  /** Resolved product info via DB join; null if product was deleted */
  product: { id: string; product_name: string; material_code: string } | null;
}

/**
 * A complete stock entry with all its line items embedded.
 * This is the main data unit rendered on the stock list page.
 */
export interface StockEntry {
  id: string;
  /** Reference number from the supplier’s invoice */
  invoice_number: string;
  /** Date goods were received (YYYY-MM-DD string) */
  entry_date: string;
  notes: string | null;
  is_deleted: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  /** All line items for this delivery */
  items: StockEntryItem[];
}

/** Input shape for a single line item in the create form. */
export interface StockEntryItemInput {
  /** UUID of the selected product; null if using a manual material code */
  product_id: string | null;
  material_code: string;
  quantity: number;
  hsn_sac_code?: string | null;
}

/** Full input shape for creating a stock entry (header + items together). */
export interface CreateStockEntryInput {
  invoice_number: string;
  /** Date string in YYYY-MM-DD format */
  entry_date: string;
  notes?: string | null;
  /** At least one item is required (enforced by Zod schema) */
  items: StockEntryItemInput[];
}

/**
 * Filter options for the stock entries list.
 * All optional — omitting all returns all non-deleted entries.
 */
export interface StockEntryFilters {
  /** Partial match on invoice_number */
  search?: string;
  /** ISO date string — only entries on or after this date */
  date_from?: string;
  /** ISO date string — only entries on or before this date */
  date_to?: string;
  page?: number;
  page_size?: number;
}

/** Paginated list result returned by getStockEntries(). */
export interface StockEntryListResponse {
  data: StockEntry[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}
