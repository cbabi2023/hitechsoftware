/**
 * @file useStockEntries.ts
 * @module hooks/stock-entries
 *
 * @description
 * React Query hook that manages the paginated stock entries list and mutations.
 *
 * WHAT THIS HOOK PROVIDES
 * -----------------------
 * Reading:
 *  - entries      : Array of StockEntry records (with embedded items)
 *  - pagination   : { total, page, pageSize, totalPages }
 *  - isLoading    : True during initial fetch
 *  - error        : Error message string or null
 *
 * Writing:
 *  - createMutation : Record a new stock entry (header + line items)
 *  - deleteMutation : Soft-delete a stock entry
 *
 * Filtering:
 *  - setSearch : Filter by invoice number (partial match)
 *  - setPage   : Navigate pages
 *
 * DESIGN DECISIONS
 * ----------------
 * 1. No editMutation: Stock entries are intentionally immutable after creation.
 *    If an error was made, the user deletes the entry and creates a new one.
 *    This preserves accounting integrity (goods receipts should not be silently edited).
 *
 * 2. placeholderData: The previous page’s data is shown while loading the next
 *    page, preventing the "flash to empty" UX issue on pagination.
 *
 * 3. Invalidation scope: Both mutations invalidate BASE_KEY = ['stock-entries'],
 *    which refreshes all list queries regardless of filter state.
 *
 * USAGE EXAMPLE
 * -------------
 * ```tsx
 * const { entries, pagination, setSearch, createMutation } = useStockEntries();
 * ```
 */
import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { addStockEntry, getStockEntries, removeStockEntry } from '@/modules/stock-entries/stock-entry.service';
import type { StockEntryFilters } from '@/modules/stock-entries/stock-entry.types';

/** Top-level cache key for all stock entry queries. */
const BASE_KEY = ['stock-entries'] as const;

export function useStockEntries() {
  const queryClient = useQueryClient();

  // Active filter state — search text, date range, and current page
  const [filters, setFilters] = useState<StockEntryFilters>({ page: 1, page_size: 20 });

  // Include filters in key so React Query caches each filter combination separately
  const queryKey = [...BASE_KEY, 'list', filters] as const;

  const query = useQuery({
    queryKey,
    queryFn: () => getStockEntries(filters),
    placeholderData: (prev) => prev, // Show previous data while loading new filters/page
  });

  /**
   * Updates the invoice number search filter and resets to page 1.
   * Empty string clears the filter.
   */
  const setSearch = useCallback((search: string) => {
    setFilters((prev) => ({ ...prev, search: search || undefined, page: 1 }));
  }, []);

  /** Navigates to a specific page without resetting other filters. */
  const setPage = useCallback((page: number) => {
    setFilters((prev) => ({ ...prev, page }));
  }, []);

  // Create a new stock entry, invalidate cache on success
  const createMutation = useMutation({
    mutationFn: addStockEntry,
    onSuccess: async (result) => {
      if (!result.ok) { toast.error(result.error.message); return; }
      toast.success('Stock entry recorded');
      await queryClient.invalidateQueries({ queryKey: BASE_KEY });
    },
  });

  // Soft-delete a stock entry, invalidate cache on success
  const deleteMutation = useMutation({
    mutationFn: (id: string) => removeStockEntry(id),
    onSuccess: async (result) => {
      if (!result.ok) { toast.error(result.error.message); return; }
      toast.success('Stock entry deleted');
      await queryClient.invalidateQueries({ queryKey: BASE_KEY });
    },
  });

  // Normalise the ServiceResult shape for easy page consumption
  const listResponse = query.data?.ok ? query.data.data : null;

  return {
    /** Array of StockEntry records (each includes embedded items array) */
    entries: listResponse?.data ?? [],
    pagination: listResponse
      ? { total: listResponse.total, page: listResponse.page, pageSize: listResponse.page_size, totalPages: listResponse.total_pages }
      : null,
    filters,
    isLoading: query.isLoading,
    error: query.data && !query.data.ok ? query.data.error.message : null,
    setSearch,
    setPage,
    createMutation,
    deleteMutation,
  };
}
