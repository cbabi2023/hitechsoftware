/**
 * @file product-type.validation.ts
 * @module modules/product-types
 *
 * @description
 * Zod validation schemas for the Product Types module.
 *
 * Identical structure to product-category.validation.ts — a product type
 * has the same simple shape (just a name). If this becomes more complex
 * in the future (e.g. adding a "unit" field to product types), extend
 * the schemas here without touching other files.
 */
import { z } from 'zod';

/**
 * Validates create input. Name must be non-empty, ≤150 chars, trimmed.
 * 150-char matches the VARCHAR(150) DB column constraint.
 */
export const createProductTypeSchema = z.object({
  name: z.string().min(1, 'Name is required').max(150, 'Name must be 150 characters or fewer').trim(),
});

/**
 * Validates update input. All fields optional (PATCH — only send what changes).
 */
export const updateProductTypeSchema = z.object({
  name: z.string().min(1).max(150).trim().optional(),
  is_active: z.boolean().optional(),
});
