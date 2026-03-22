/**
 * @file product.constants.ts
 * @module modules/products
 *
 * @description
 * Centralised TanStack Query cache key definitions for the Products module.
 *
 * WHY CENTRALISED KEYS?
 * ---------------------
 * React Query identifies cached data by a hierarchical "query key" array.
 * If the same key is used in multiple places (list page, edit page, hooks),
 * they must be identical strings/arrays for cache sharing and invalidation
 * to work correctly.
 *
 * By defining all keys here, we get:
 *  1. One source of truth — change a key once, updates everywhere
 *  2. Type safety — `as const` locks the key shapes
 *  3. Hierarchy — invalidating `all` also invalidates every `list` and `detail`
 *
 * INVALIDATION PATTERN
 * --------------------
 * When a product is created, updated, or deleted, we invalidate:
 *   queryClient.invalidateQueries({ queryKey: PRODUCT_QUERY_KEYS.all })
 * This automatically refetches ALL product queries (list AND detail),
 * ensuring the UI is always consistent with the database.
 *
 * KEY STRUCTURE
 * -------------
 *   all        → ['products']                        (invalidates everything)
 *   list(filters) → ['products', 'list', filters]   (specific filtered list)
 *   detail(id)    → ['products', 'detail', id]       (single product detail)
 */
export const PRODUCT_QUERY_KEYS = {
  /** Top-level key. Invalidating this cascades to all list and detail queries. */
  all: ['products'] as const,
  /** Keyed list query — includes filters so each unique filter set is cached separately. */
  list: (filters?: object) => ['products', 'list', filters] as const,
  /** Single product detail query, keyed by product UUID. */
  detail: (id: string) => ['products', 'detail', id] as const,
} as const;
