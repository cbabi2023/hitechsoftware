/**
 * @file useProduct.ts
 * @module hooks/products
 *
 * @description
 * React Query hook for fetching a SINGLE product by its UUID.
 *
 * WHEN TO USE THIS vs useProducts
 * --------------------------------
 * - `useProducts` (plural): Used for the products LIST page with filters and pagination.
 * - `useProduct` (singular): Used for the product EDIT page, where you have a
 *   specific product ID and need its full details pre-populated in the form.
 *
 * ENABLED GUARD
 * -------------
 * `enabled: !!id` prevents the query from running when `id` is undefined.
 * This is necessary because Next.js App Router params are available async.
 * The edit page may render before `params.id` resolves, so we guard against
 * a premature query with `undefined` as the query key.
 *
 * CACHE KEY
 * ---------
 * Key: `['products', 'detail', id]`
 * This matches `PRODUCT_QUERY_KEYS.detail(id)` from product.constants.ts.
 * When `useProducts` invalidates `['products']` after a mutation, this
 * detail query is also invalidated automatically (because it is a child
 * of the `['products']` namespace).
 *
 * USAGE EXAMPLE
 * -------------
 * ```tsx
 * // In edit page: params.id comes from the URL
 * const { product, isLoading } = useProduct(params.id);
 * if (isLoading) return <Spinner />;
 * if (!product) return <NotFound />;
 * return <ProductForm defaultValues={product} />;
 * ```
 */
import { useQuery } from '@tanstack/react-query';
import { getProduct } from '@/modules/products/product.service';

/**
 * Fetches a single product by UUID.
 *
 * @param id - The product UUID (can be undefined while the route param is loading)
 * @returns `{ product, isLoading, error }` — product is null while loading or if not found
 */
export function useProduct(id: string | undefined) {
  const query = useQuery({
    queryKey: ['products', 'detail', id],
    // Non-null assertion (id!) is safe here because `enabled: !!id`
    // guarantees this function only runs when id is defined
    queryFn: () => getProduct(id!),
    enabled: !!id, // Do not run the query until we have a valid id
  });

  return {
    /** The fetched product, or null if loading / not found */
    product: query.data?.ok ? query.data.data : null,
    isLoading: query.isLoading,
    error: query.data && !query.data.ok ? query.data.error.message : null,
  };
}
