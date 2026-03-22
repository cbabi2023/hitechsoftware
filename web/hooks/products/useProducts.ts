/**
 * @file useProducts.ts
 * @module hooks/products
 *
 * @description
 * React Query hook that manages the paginated, filterable product list
 * plus all product mutations (create, update, delete).
 *
 * FILTER STATE MANAGEMENT
 * -----------------------
 * Filters (search, category_id, product_type_id, is_active) are managed as
 * local React state inside this hook. The query key includes the filters
 * object, so React Query re-fetches automatically whenever a filter changes.
 *
 * Each filter setter resets `page` to 1 to avoid showing an empty page when
 * the result set shrinks after filtering.
 *
 *   setSearch(‘motor’)     → filters.search = 'motor', page = 1
 *   setCategoryFilter(uuid) → filters.category_id = uuid, page = 1
 *   setTypeFilter(uuid)     → filters.product_type_id = uuid, page = 1
 *   setStatusFilter(true)   → filters.is_active = true, page = 1
 *   setPage(2)              → filters.page = 2 (only this changes)
 *
 * PLACEHOLDER DATA
 * ----------------
 * `placeholderData: (prev) => prev` keeps showing the previous page’s data
 * while a new page/filter is loading. This prevents the "flash to empty" UX
 * issue where the list briefly disappears during a transition.
 *
 * MUTATION CACHE INVALIDATION
 * ---------------------------
 * All three mutations (create, update, delete) invalidate `BASE_KEY = ['products']`.
 * Because React Query uses prefix matching, this invalidates:
 *  - All list queries: ['products', 'list', ...]
 *  - All detail queries: ['products', 'detail', ...]
 * So after any write, all consumers of product data are refreshed.
 *
 * USAGE EXAMPLE
 * -------------
 * ```tsx
 * const {
 *   items, pagination, isLoading,
 *   setSearch, setCategoryFilter, setPage,
 *   createMutation, deleteMutation
 * } = useProducts();
 * ```
 */
import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getProducts, addProduct, editProduct, removeProduct } from '@/modules/products/product.service';
import type { ProductFilters } from '@/modules/products/product.types';

/**
 * Top-level cache key namespace for all product queries.
 * Invalidating this key refreshes every list and detail query.
 */
const BASE_KEY = ['products'] as const;

export function useProducts() {
  const queryClient = useQueryClient();

  // searchInput mirrors the filter but is kept separate so the input field
  // can be a controlled component independently of the debounced filter
  const [searchInput, setSearchInput] = useState('');

  // All active filter state (including pagination)
  const [filters, setFilters] = useState<ProductFilters>({ page: 1, page_size: 20 });

  // Query key includes filters so each unique filter combination is cached independently
  const queryKey = [...BASE_KEY, 'list', filters] as const;

  const query = useQuery({
    queryKey,
    queryFn: () => getProducts(filters),
    // Keep previous data visible while loading new page/filter to prevent UI flash
    placeholderData: (prev) => prev,
  });

  /**
   * Updates the search text and resets to page 1.
   * Passing an empty string clears the search filter (shows all products).
   */
  const setSearch = useCallback((search: string) => {
    setSearchInput(search);
    setFilters((prev) => ({ ...prev, search: search || undefined, page: 1 }));
  }, []);

  /** Filters products by category UUID. Pass undefined to clear the filter. */
  const setCategoryFilter = useCallback((category_id: string | undefined) => {
    setFilters((prev) => ({ ...prev, category_id, page: 1 }));
  }, []);

  /** Filters products by product type UUID. Pass undefined to clear the filter. */
  const setTypeFilter = useCallback((product_type_id: string | undefined) => {
    setFilters((prev) => ({ ...prev, product_type_id, page: 1 }));
  }, []);

  /** Filters by active status. Pass undefined to show both active and inactive. */
  const setStatusFilter = useCallback((is_active: boolean | undefined) => {
    setFilters((prev) => ({ ...prev, is_active, page: 1 }));
  }, []);

  /** Changes the current page without resetting other filters. */
  const setPage = useCallback((page: number) => {
    setFilters((prev) => ({ ...prev, page }));
  }, []);

  // ---- MUTATIONS ----

  const createMutation = useMutation({
    mutationFn: addProduct,
    onSuccess: async (result) => {
      if (!result.ok) { toast.error(result.error.message); return; }
      toast.success('Product created');
      // Invalidate all product queries (list + detail) to reflect the new item
      await queryClient.invalidateQueries({ queryKey: BASE_KEY });
    },
  });

  const updateMutation = useMutation({
    // Destructure id from the mutation input and pass the rest as update data
    mutationFn: ({ id, ...data }: { id: string } & Parameters<typeof editProduct>[1]) =>
      editProduct(id, data),
    onSuccess: async (result) => {
      if (!result.ok) { toast.error(result.error.message); return; }
      toast.success('Product updated');
      await queryClient.invalidateQueries({ queryKey: BASE_KEY });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => removeProduct(id),
    onSuccess: async (result) => {
      if (!result.ok) { toast.error(result.error.message); return; }
      toast.success('Product deleted');
      await queryClient.invalidateQueries({ queryKey: BASE_KEY });
    },
  });

  // Normalise the service response shape for easy consumption by the page
  const listResponse = query.data?.ok ? query.data.data : null;

  return {
    /** Flat array of Product records for the current page */
    items: listResponse?.data ?? [],
    /** Pagination metadata: total count, current page, page size, total pages */
    pagination: listResponse
      ? { total: listResponse.total, page: listResponse.page, pageSize: listResponse.page_size, totalPages: listResponse.total_pages }
      : null,
    /** Current active filter state (useful for controlled filter UI) */
    filters,
    /** Current value of the search text input */
    searchInput,
    isLoading: query.isLoading,
    error: query.data && !query.data.ok ? query.data.error.message : null,
    setSearch,
    setCategoryFilter,
    setTypeFilter,
    setStatusFilter,
    setPage,
    createMutation,
    updateMutation,
    deleteMutation,
  };
}
}
