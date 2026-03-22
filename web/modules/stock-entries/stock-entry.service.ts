/**
 * @file stock-entry.service.ts
 * @module modules/stock-entries
 *
 * @description
 * Business logic layer for the Stock Entries module.
 *
 * ARCHITECTURE POSITION
 * ---------------------
 * Hook (useStockEntries)  →  THIS SERVICE  →  Repository  →  Supabase
 *
 * Responsibilities:
 *  1. VALIDATE  — run the Zod schema (header + items array) before writing
 *  2. PAGINATE  — standardise pagination and compute total_pages metadata
 *  3. MAP ERRORS — return friendly messages instead of raw Postgres errors
 *  4. WRAP      — all results returned as ServiceResult<T> discriminated union
 *
 * Note: Stock entries are append-only for audit purposes. There is no `editStockEntry`
 * function. If an entry was made incorrectly, it should be deleted and re-entered.
 * This preserves a clean audit trail of goods receipts.
 */
import type { ServiceResult } from '@/types/common.types';
import {
  createStockEntry,
  findStockEntryById,
  listStockEntries,
  softDeleteStockEntry,
} from '@/repositories/stock-entries.repository';
import type {
  CreateStockEntryInput,
  StockEntry,
  StockEntryFilters,
  StockEntryListResponse,
} from './stock-entry.types';
import { createStockEntrySchema } from './stock-entry.validation';

/** Default number of entries per page on the list view */
const PAGE_SIZE = 20;

/**
 * Maps raw DB error messages to user-readable strings.
 * Currently passes through most errors unchanged — extended if
 * specific constraint patterns need custom messages in the future.
 */
function mapError(message?: string): string {
  const safe = message?.trim() ?? 'Failed to process stock entry';
  return safe;
}

/**
 * Returns a paginated list of stock entries matching the given filters.
 *
 * Entries are ordered newest-first (entry_date DESC, then created_at DESC).
 * The pagination metadata (total, total_pages) is computed here so the
 * list page can render page navigation without any extra calculations.
 *
 * @param filters - Optional search, date range, and pagination
 */
export async function getStockEntries(
  filters: StockEntryFilters = {},
): Promise<ServiceResult<StockEntryListResponse>> {
  const page = filters.page ?? 1;
  const page_size = filters.page_size ?? PAGE_SIZE;

  const result = await listStockEntries({ ...filters, page, page_size });
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
 * Fetches a single stock entry with all its line items by ID.
 * Used when viewing or confirming a just-created entry.
 */
export async function getStockEntry(id: string): Promise<ServiceResult<StockEntry>> {
  const result = await findStockEntryById(id);
  if (result.error || !result.data) {
    return { ok: false, error: { message: result.error?.message ?? 'Stock entry not found', code: result.error?.code } };
  }
  return { ok: true, data: result.data };
}

/**
 * Validates and creates a new stock entry (header + all items).
 *
 * Validation checks:
 *  - invoice_number must be non-empty
 *  - entry_date must be provided
 *  - items array must have ≥1 item
 *  - Each item: material_code format, quantity ≥1, optional hsn_sac_code
 *
 * The actual two-step insert (header then items) is handled by the repository.
 *
 * @param input - Full stock entry data including all line items
 */
export async function addStockEntry(input: CreateStockEntryInput): Promise<ServiceResult<StockEntry>> {
  const parsed = createStockEntrySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { message: parsed.error.issues[0]?.message ?? 'Invalid input' } };
  }

  const result = await createStockEntry(parsed.data);
  if (result.error || !result.data) {
    return { ok: false, error: { message: mapError(result.error?.message), code: result.error?.code } };
  }
  return { ok: true, data: result.data };
}

/**
 * Soft-deletes a stock entry (marks is_deleted=true on the header).
 * The line items remain in the database but become invisible because
 * list queries always join through the header’s is_deleted filter.
 *
 * @param id - UUID of the entry to delete
 */
export async function removeStockEntry(id: string): Promise<ServiceResult<{ id: string }>> {
  const result = await softDeleteStockEntry(id);
  if (result.error || !result.data) {
    return {
      ok: false,
      error: { message: result.error?.message ?? 'Failed to delete stock entry', code: result.error?.code },
    };
  }
  return { ok: true, data: result.data };
}

export async function getStockEntries(
  filters: StockEntryFilters = {},
): Promise<ServiceResult<StockEntryListResponse>> {
  const page = filters.page ?? 1;
  const page_size = filters.page_size ?? PAGE_SIZE;

  const result = await listStockEntries({ ...filters, page, page_size });
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

export async function getStockEntry(id: string): Promise<ServiceResult<StockEntry>> {
  const result = await findStockEntryById(id);
  if (result.error || !result.data) {
    return { ok: false, error: { message: result.error?.message ?? 'Stock entry not found', code: result.error?.code } };
  }
  return { ok: true, data: result.data };
}

export async function addStockEntry(input: CreateStockEntryInput): Promise<ServiceResult<StockEntry>> {
  const parsed = createStockEntrySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { message: parsed.error.issues[0]?.message ?? 'Invalid input' } };
  }

  const result = await createStockEntry(parsed.data);
  if (result.error || !result.data) {
    return { ok: false, error: { message: mapError(result.error?.message), code: result.error?.code } };
  }
  return { ok: true, data: result.data };
}

export async function removeStockEntry(id: string): Promise<ServiceResult<{ id: string }>> {
  const result = await softDeleteStockEntry(id);
  if (result.error || !result.data) {
    return {
      ok: false,
      error: { message: result.error?.message ?? 'Failed to delete stock entry', code: result.error?.code },
    };
  }
  return { ok: true, data: result.data };
}
