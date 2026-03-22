/**
 * @file product-category.validation.ts
 * @module modules/product-categories
 *
 * @description
 * Zod validation schemas for the Product Categories module.
 *
 * WHY ZOD?
 * --------
 * Zod is a TypeScript-first schema validation library. We use it to validate
 * user input before it reaches the service or repository layers. This is the
 * "input boundary" — data from outside (form submission) is untrusted and
 * must be validated before use.
 *
 * SCHEMAS IN THIS FILE
 * --------------------
 * createProductCategorySchema  → Used when creating a new category
 * updateProductCategorySchema  → Used when editing an existing category
 *
 * NOTE: These schemas are used in the SERVICE layer, not directly in forms.
 * The service calls `schema.safeParse(input)` and returns a typed ServiceResult
 * if validation fails. This keeps validation central and testable.
 */
import { z } from 'zod';

/**
 * Validates input for creating a new product category.
 *
 * Rules:
 *  - name: required, 1–150 characters, leading/trailing whitespace stripped
 *
 * The 150-char limit matches the VARCHAR(150) constraint in the database.
 */
export const createProductCategorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(150, 'Name must be 150 characters or fewer').trim(),
});

/**
 * Validates input for updating an existing product category.
 *
 * All fields are optional (PATCH operation). Only fields explicitly provided
 * will be sent to the repository. This prevents accidentally clearing a field
 * that was not part of the current edit action.
 */
export const updateProductCategorySchema = z.object({
  name: z.string().min(1).max(150).trim().optional(),
  is_active: z.boolean().optional(),
});
