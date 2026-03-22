/**
 * @file useProductCategories.ts
 * @module hooks/product-categories
 *
 * @description
 * React Query hook that manages ALL product category data and mutations
 * for the entire application.
 *
 * WHAT THIS HOOK PROVIDES
 * -----------------------
 * Reading:
 *  - data        : The current array of product categories
 *  - isLoading   : True while the initial fetch is in progress
 *  - error       : String error message if the fetch failed
 *
 * Writing (mutations):
 *  - createMutation : Create a new category
 *  - updateMutation : Rename or toggle active status of a category
 *  - deleteMutation : Soft-delete a category (blocked if products use it)
 *
 * WHY REACT QUERY?
 * ----------------
 * React Query handles:
 *  - Caching: The category list is cached globally. Multiple components
 *    can call this hook and they all share the same cached data (no duplicate fetches).
 *  - Background refetching: Stale data is automatically refreshed when
 *    the user returns to the tab or the window regains focus.
 *  - Optimistic invalidation: After any mutation succeeds, we call
 *    `queryClient.invalidateQueries({ queryKey: KEY })` which marks the
 *    cache as stale and triggers a background refetch. The UI updates automatically.
 *
 * TOAST NOTIFICATIONS
 * -------------------
 * Success/error toasts are fired inside `onSuccess` callbacks rather than in
 * the page components. This keeps UI feedback logic in one place instead of
 * scattered across every page that uses categories.
 *
 * USAGE EXAMPLE
 * -------------
 * ```tsx
 * const { data, createMutation } = useProductCategories();
 * // data is ProductCategory[]
 * // createMutation.mutateAsync({ name: 'Electronics' })
 * ```
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  addProductCategory,
  editProductCategory,
  getProductCategories,
  removeProductCategory,
} from '@/modules/product-categories/product-category.service';

/**
 * Cache key for product categories.
 * Using a const ensures all queries and invalidations reference the exact same key.
 * A single string in the array is fine — React Query does deep-equality matching.
 */
const KEY = ['product-categories'] as const;

export function useProductCategories() {
  const queryClient = useQueryClient();

  // ---- READ: Fetch all categories ----
  const query = useQuery({
    queryKey: KEY,
    queryFn: getProductCategories,
    // No staleTime set — uses the default (0s), so it refetches on every mount.
    // This is intentional: categories change infrequently but must be current.
  });

  // ---- WRITE: Create a new category ----
  const createMutation = useMutation({
    mutationFn: addProductCategory,
    onSuccess: async (result) => {
      if (!result.ok) { toast.error(result.error.message); return; }
      toast.success('Category added');
      // Invalidate the cache so the list refetches and shows the new item
      await queryClient.invalidateQueries({ queryKey: KEY });
    },
  });

  // ---- WRITE: Update an existing category (name or active status) ----
  const updateMutation = useMutation({
    // Destructure id from the payload and pass the rest as the update input
    mutationFn: ({ id, name, is_active }: { id: string; name?: string; is_active?: boolean }) =>
      editProductCategory(id, { name, is_active }),
    onSuccess: async (result) => {
      if (!result.ok) { toast.error(result.error.message); return; }
      toast.success('Category updated');
      await queryClient.invalidateQueries({ queryKey: KEY });
    },
  });

  // ---- WRITE: Soft-delete a category ----
  const deleteMutation = useMutation({
    mutationFn: (id: string) => removeProductCategory(id),
    onSuccess: async (result) => {
      if (!result.ok) { toast.error(result.error.message); return; }
      toast.success('Category deleted');
      await queryClient.invalidateQueries({ queryKey: KEY });
    },
  });

  return {
    /** Array of ProductCategory records. Empty array while loading. */
    data: query.data?.ok ? query.data.data : [],
    isLoading: query.isLoading,
    /** Error message string if the fetch failed; null otherwise */
    error: query.data && !query.data.ok ? query.data.error.message : null,
    createMutation,
    updateMutation,
    deleteMutation,
  };
}
