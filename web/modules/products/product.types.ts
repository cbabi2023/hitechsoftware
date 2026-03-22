/**
 * @file product.types.ts
 * @module modules/products
 *
 * @description
 * TypeScript domain types for the Products module.
 *
 * A PRODUCT in this system is a physical inventory item. It has:
 *  - A unique material code (the primary lookup key)
 *  - Classification (category + product type)
 *  - Optional refurbished marking (is_refurbished + refurbished_label)
 *  - HSN/SAC code for India GST compliance
 *  - Active/inactive status
 *
 * TYPES IN THIS FILE
 * ------------------
 * Product              → Full product record as returned from the API
 * CreateProductInput   → What you send to create a new product
 * UpdateProductInput   → Partial version for editing (all fields optional)
 * ProductFilters       → Query filter options for the list page
 * ProductListResponse  → Paginated list result with metadata
 */

/**
 * A complete product record as returned from the service layer.
 * Nested `category` and `product_type` objects are joined from their tables.
 */
export interface Product {
  id: string;
  product_name: string;
  /** Optional description or notes about the product */
  description: string | null;
  /**
   * Unique internal reference code (e.g. "MC-001", "BRKT/EL-42").
   * Always stored and returned in UPPERCASE.
   */
  material_code: string;
  /** Foreign key to product_categories. Null if uncategorised. */
  category_id: string | null;
  /** Foreign key to product_types. Null if untyped. */
  product_type_id: string | null;
  /** When true, this product is a refurbished/used item. */
  is_refurbished: boolean;
  /**
   * Short label displayed on refurbished items, e.g. "Grade A Refurb".
   * REQUIRED when is_refurbished=true; null otherwise.
   */
  refurbished_label: string | null;
  /**
   * India GST Harmonised System of Nomenclature / Services Accounting Code.
   * Used for tax classification on invoices.
   */
  hsn_sac_code: string | null;
  /** Whether this product is currently available for use/stock entries */
  is_active: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  /** Resolved category object (joined from product_categories table) */
  category: { id: string; name: string } | null;
  /** Resolved product type object (joined from product_types table) */
  product_type: { id: string; name: string } | null;
}

/**
 * Input for creating a new product.
 * material_code will be normalised to UPPERCASE in the repository.
 */
export interface CreateProductInput {
  product_name: string;
  description?: string | null;
  material_code: string;
  category_id?: string | null;
  product_type_id?: string | null;
  is_refurbished?: boolean;
  refurbished_label?: string | null;
  hsn_sac_code?: string | null;
  is_active?: boolean;
}

/** Partial update — all fields optional, only provided ones are changed. */
export type UpdateProductInput = Partial<CreateProductInput>;

/**
 * Server-side filter parameters for the product list.
 * All fields are optional; omitting all returns all active products.
 */
export interface ProductFilters {
  /** Searches product_name, material_code, and hsn_sac_code (case-insensitive) */
  search?: string;
  /** Filter to a specific category UUID */
  category_id?: string;
  /** Filter to a specific product type UUID */
  product_type_id?: string;
  /** Filter by active status */
  is_active?: boolean;
  is_refurbished?: boolean;
  page?: number;
  page_size?: number;
}

/**
 * The response shape returned by `getProducts()`.
 * Includes the items array plus pagination metadata.
 */
export interface ProductListResponse {
  data: Product[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}
