/**
 * @file useProductTypes.ts
 * @module hooks/product-types
 *
 * @description
 * React Query hook that manages product type data and mutations.
 *
 * Structurally identical to `useProductCategories` — see that file for
 * a detailed explanation of the React Query + mutation pattern used here.
 *
 * Product types are used in:
 *  1. Product create/edit forms (classification dropdown)
 *  2. Product list filter bar (filter by type)
 *  3. Product Types admin page (CRUD management)
 *
 * Because all three share the same cache key (`['product-types']`), any
 * mutation (create/update/delete) automatically refreshes all consumers.
 *
 * USAGE EXAMPLE
 * -------------
 * ```tsx
 * const { data: types, createMutation } = useProductTypes();
 * ```
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  addProductType,
  editProductType,
  getProductTypes,
  removeProductType,
} from '@/modules/product-types/product-type.service';

/** Shared cache key for all product type queries in the application. */
const KEY = ['product-types'] as const;

export function useProductTypes() {
  const queryClient = useQueryClient();

  // Fetch all product types (cached under KEY)
  const query = useQuery({
    queryKey: KEY,
    queryFn: getProductTypes,
  });

  // Create new product type and refresh cache on success
  const createMutation = useMutation({
    mutationFn: addProductType,
    onSuccess: async (result) => {
      if (!result.ok) { toast.error(result.error.message); return; }
      toast.success('Product type added');
      await queryClient.invalidateQueries({ queryKey: KEY });
    },
  });

  // Update name and/or active status of an existing type
  const updateMutation = useMutation({
    mutationFn: ({ id, name, is_active }: { id: string; name?: string; is_active?: boolean }) =>
      editProductType(id, { name, is_active }),
    onSuccess: async (result) => {
      if (!result.ok) { toast.error(result.error.message); return; }
      toast.success('Product type updated');
      await queryClient.invalidateQueries({ queryKey: KEY });
    },
  });

  // Soft-delete a type (blocked by service if any products reference it)
  const deleteMutation = useMutation({
    mutationFn: (id: string) => removeProductType(id),
    onSuccess: async (result) => {
      if (!result.ok) { toast.error(result.error.message); return; }
      toast.success('Product type deleted');
      await queryClient.invalidateQueries({ queryKey: KEY });
    },
  });

  return {
    /** Array of ProductType records. Empty while loading. */
    data: query.data?.ok ? query.data.data : [],
    isLoading: query.isLoading,
    error: query.data && !query.data.ok ? query.data.error.message : null,
    createMutation,
    updateMutation,
    deleteMutation,
  };
}
