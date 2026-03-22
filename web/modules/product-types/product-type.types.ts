/**
 * @file product-type.types.ts
 * @module modules/product-types
 *
 * @description
 * TypeScript domain types for the Product Types feature.
 *
 * WHAT IS A PRODUCT TYPE?
 * -----------------------
 * Product types classify products by their functional nature:
 * e.g. "Spare Part", "Consumable", "Tool", "Component"
 *
 * This is a SECOND classification axis alongside categories:
 *  - Category answers "what group is it in?" (e.g. Electronics, Mechanical)
 *  - Type answers "what kind of item is it?" (e.g. Spare Part, Consumable)
 *
 * Together, category + type give users precise filtering in the product list.
 */

/** A product type record as returned from the database. */
export interface ProductType {
  /** UUID primary key */
  id: string;
  /** Display name, e.g. "Spare Part" */
  name: string;
  /** Whether selectable in forms and visible in filters */
  is_active: boolean;
  /** Soft-delete flag — true means hidden, never physically removed */
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

/** Shape required to create a new product type. */
export interface CreateProductTypeInput {
  name: string;
}

/** Shape for partially updating a product type (PATCH semantics). */
export interface UpdateProductTypeInput {
  name?: string;
  is_active?: boolean;
}
