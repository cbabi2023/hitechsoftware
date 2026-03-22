'use client';

/**
 * @file ProductForm.tsx
 * @module components/inventory
 *
 * @description
 * Reusable form component for creating and editing inventory products.
 * Used by both the "Add Product" page and the "Edit Product" page.
 *
 * REUSABILITY DESIGN
 * ------------------
 * This form accepts an optional `defaultValues` prop of type `Partial<Product>`.
 * When creating:  `defaultValues` is undefined → all fields start empty/default.
 * When editing:   `defaultValues` is the existing product → fields pre-filled.
 *
 * The `useEffect` + `reset()` pattern handles the async edit case:
 * The edit page uses `useProduct(id)` which fetches data asynchronously.
 * Initially `defaultValues` is undefined (product still loading), then becomes
 * the product object. The `useEffect` re-runs when `defaultValues` changes,
 * resetting the form to the fetched values.
 *
 * ZODRESOLVER CAST
 * ----------------
 * `createProductSchema` uses `.refine()` (a ZodEffects wrapper) which breaks
 * Zod's type inference for RHF. The cast:
 *   `zodResolver(createProductSchema) as Resolver<CreateProductFormValues>`
 * is required to satisfy TypeScript. This is a known RHF+Zod limitation.
 * See product.validation.ts for more detail.
 *
 * TOGGLE SWITCH IMPLEMENTATION
 * ----------------------------
 * Both `is_refurbished` and `is_active` are implemented as custom toggle buttons
 * using native `<button type="button" role="switch" aria-checked={value}>` elements.
 * WHY: HTML `<input type="checkbox">` styling is browser-dependent and difficult
 * to customise. The custom implementation gives full control over appearance.
 * The `role="switch"` and `aria-checked` attributes maintain accessibility.
 *
 * CONDITIONAL REFURBISHED LABEL
 * ------------------------------
 * The refurbished label field is only shown when `is_refurbished` is true.
 * `watch('is_refurbished')` subscribes to real-time changes and drives
 * the conditional rendering. When the toggle flip from true → false, the
 * field is hidden (and Zod's `.refine()` rule won't fire for it).
 *
 * FORM SECTIONS
 * -------------
 * The form is divided into 4 visual sections:
 *  1. Basic Information: product_name, material_code, hsn_sac_code, description
 *  2. Classification: category_id (dropdown), product_type_id (dropdown)
 *  3. Refurbished Options: is_refurbished toggle + conditional refurbished_label
 *  4. Availability: is_active toggle
 *
 * USAGE EXAMPLE
 * -------------
 * ```tsx
 * // Create mode
 * <ProductForm onSubmit={handleCreate} isSubmitting={isPending} submitLabel="Create" />
 *
 * // Edit mode
 * <ProductForm defaultValues={product} onSubmit={handleUpdate} submitLabel="Save" />
 * ```
 */

import { useEffect } from 'react';
import { useForm, Controller, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { RefreshCw } from 'lucide-react';
import { useProductCategories } from '@/hooks/product-categories/useProductCategories';
import { useProductTypes } from '@/hooks/product-types/useProductTypes';
import { createProductSchema, type CreateProductFormValues } from '@/modules/products/product.validation';
import type { Product } from '@/modules/products/product.types';

/**
 * Props for the ProductForm component.
 */
interface ProductFormProps {
  /** Existing product data to pre-fill the form (omit for create mode) */
  defaultValues?: Partial<Product>;
  /** Called with validated form values when the user submits */
  onSubmit: (values: CreateProductFormValues) => Promise<void>;
  /** When true, the submit button shows "Saving…" and is disabled */
  isSubmitting?: boolean;
  /** Submit button label text (defaults to 'Save') */
  submitLabel?: string;
}

export function ProductForm({ defaultValues, onSubmit, isSubmitting, submitLabel = 'Save' }: ProductFormProps) {
  const { data: categories } = useProductCategories();
  const { data: productTypes } = useProductTypes();

  const {
    register,
    handleSubmit,
    watch,
    control,
    reset,
    formState: { errors },
  } = useForm<CreateProductFormValues>({
    resolver: zodResolver(createProductSchema) as Resolver<CreateProductFormValues>,
    defaultValues: {
      product_name: defaultValues?.product_name ?? '',
      description: defaultValues?.description ?? '',
      material_code: defaultValues?.material_code ?? '',
      category_id: defaultValues?.category_id ?? null,
      product_type_id: defaultValues?.product_type_id ?? null,
      is_refurbished: defaultValues?.is_refurbished ?? false,
      refurbished_label: defaultValues?.refurbished_label ?? '',
      hsn_sac_code: defaultValues?.hsn_sac_code ?? '',
      is_active: defaultValues?.is_active ?? true,
    },
  });

  // Watch the checkbox-like toggle to conditionally show the refurbished label field
  const isRefurbished = watch('is_refurbished');

  /**
   * When the product data arrives asynchronously (edit mode),
   * reset the form to the fetched values so the inputs show the correct data.
   * This runs only when `defaultValues` changes (i.e. after the fetch completes).
   */
  useEffect(() => {
    if (defaultValues) {
      reset({
        product_name: defaultValues.product_name ?? '',
        description: defaultValues.description ?? '',
        material_code: defaultValues.material_code ?? '',
        category_id: defaultValues.category_id ?? null,
        product_type_id: defaultValues.product_type_id ?? null,
        is_refurbished: defaultValues.is_refurbished ?? false,
        refurbished_label: defaultValues.refurbished_label ?? '',
        hsn_sac_code: defaultValues.hsn_sac_code ?? '',
        is_active: defaultValues.is_active ?? true,
      });
    }
  }, [defaultValues, reset]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Basic Info */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-700">Basic Information</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Product Name */}
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Product Name <span className="text-rose-500">*</span>
            </label>
            <input
              {...register('product_name')}
              placeholder="e.g. Compressor Unit 1.5 Ton"
              className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                errors.product_name ? 'border-rose-400' : 'border-slate-200 focus:border-blue-500'
              }`}
            />
            {errors.product_name && (
              <p className="mt-1 text-xs text-rose-600">{errors.product_name.message}</p>
            )}
          </div>

          {/* Material Code */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Material Code <span className="text-rose-500">*</span>
            </label>
            <input
              {...register('material_code')}
              placeholder="e.g. MC-12345A"
              className={`w-full rounded-lg border px-3 py-2 font-mono text-sm uppercase focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                errors.material_code ? 'border-rose-400' : 'border-slate-200 focus:border-blue-500'
              }`}
            />
            {errors.material_code && (
              <p className="mt-1 text-xs text-rose-600">{errors.material_code.message}</p>
            )}
            <p className="mt-1 text-xs text-slate-400">Letters, numbers, hyphens, underscores, slashes only.</p>
          </div>

          {/* HSN/SAC Code */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">HSN / SAC Code</label>
            <input
              {...register('hsn_sac_code')}
              placeholder="e.g. 84158100"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* Description */}
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Description</label>
            <textarea
              {...register('description')}
              rows={3}
              placeholder="Brief description of the product…"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>
      </div>

      {/* Classification */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-700">Classification</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Category */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Stock Category</label>
            <Controller
              name="category_id"
              control={control}
              render={({ field }) => (
                <select
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(e.target.value || null)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="">Select category…</option>
                  {categories.filter((c) => c.is_active).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              )}
            />
          </div>

          {/* Product Type */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Product Type</label>
            <Controller
              name="product_type_id"
              control={control}
              render={({ field }) => (
                <select
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(e.target.value || null)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="">Select type…</option>
                  {productTypes.filter((t) => t.is_active).map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              )}
            />
          </div>
        </div>
      </div>

      {/* Refurbished */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-700">Refurbished Options</h2>
        <div className="space-y-4">
          <label className="flex cursor-pointer items-center gap-3">
            <Controller
              name="is_refurbished"
              control={control}
              render={({ field }) => (
                <button
                  type="button"
                  role="switch"
                  aria-checked={field.value}
                  onClick={() => field.onChange(!field.value)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    field.value ? 'bg-amber-500' : 'bg-slate-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      field.value ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              )}
            />
            <div>
              <div className="flex items-center gap-2">
                <RefreshCw size={14} className={isRefurbished ? 'text-amber-600' : 'text-slate-400'} />
                <span className="text-sm font-medium text-slate-700">Refurbished Item</span>
              </div>
              <p className="text-xs text-slate-400">Mark this product as refurbished / second-hand.</p>
            </div>
          </label>

          {isRefurbished && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Refurbished Label <span className="text-rose-500">*</span>
              </label>
              <input
                {...register('refurbished_label')}
                placeholder="e.g. Grade A Refurbished"
                className={`w-full max-w-sm rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                  errors.refurbished_label ? 'border-rose-400' : 'border-slate-200 focus:border-blue-500'
                }`}
              />
              {errors.refurbished_label && (
                <p className="mt-1 text-xs text-rose-600">{errors.refurbished_label.message}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Status */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-700">Availability</h2>
        <label className="flex cursor-pointer items-center gap-3">
          <Controller
            name="is_active"
            control={control}
            render={({ field }) => (
              <button
                type="button"
                role="switch"
                aria-checked={field.value}
                onClick={() => field.onChange(!field.value)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  field.value ? 'bg-green-500' : 'bg-slate-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    field.value ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            )}
          />
          <div>
            <span className="text-sm font-medium text-slate-700">Active</span>
            <p className="text-xs text-slate-400">Inactive products are hidden from stock entry forms.</p>
          </div>
        </label>
      </div>

      {/* Submit */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isSubmitting ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
