'use client';

/**
 * @file page.tsx
 * @module app/dashboard/inventory/products/[id]/edit
 *
 * @description
 * Dynamic page for editing an existing product. The `[id]` segment in the
 * folder name is a Next.js route parameter, captured via `useParams<{ id: string }>()`.
 *
 * HOW THIS PAGE WORKS
 * -------------------
 * 1. `useParams()` gives us the raw product UUID from the URL.
 * 2. `useProduct(params.id)` fetches the product data (guarded with `enabled: !!id`).
 * 3. While loading, we show an animated skeleton placeholder.
 * 4. If the product is not found or errors, we show an error message.
 * 5. Once loaded, `<ProductForm defaultValues={product} />` pre-fills the form.
 * 6. On submit, `updateMutation.mutateAsync({ id, ...values })` PATCHes the record.
 * 7. On success, navigates back to the products list.
 *
 * LOADING STATES
 * --------------
 * Three explicit states are handled:
 *  - `isLoading`    : Show skeleton (animated pulse placeholders)
 *  - `!product`     : Show "Product not found" (404-like)
 *  - default        : Show the form with data
 *
 * WHY TWO HOOKS?
 * --------------
 * - `useProduct(id)` → fetches the SINGLE product for the form default values
 * - `useProducts()` → provides `updateMutation` (the shared write mutation)
 * These are kept separate to respect the single-responsibility principle
 * and allow the list hook to manage its own cache key/filter state.
 */

import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useProduct } from '@/hooks/products/useProduct';
import { useProducts } from '@/hooks/products/useProducts';
import { usePermission } from '@/hooks/auth/usePermission';
import { ProductForm } from '@/components/inventory/ProductForm';
import { ROUTES } from '@/lib/constants/routes';
import type { CreateProductFormValues } from '@/modules/products/product.validation';

export default function EditProductPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { can } = usePermission();
  const { product, isLoading, error } = useProduct(params.id);
  const { updateMutation } = useProducts();

  if (!can('inventory:edit')) {
    return (
      <div className="p-6 text-sm text-rose-600">
        You do not have permission to edit products.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="max-w-2xl space-y-4 animate-pulse">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-12 rounded-xl bg-slate-200" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="p-6 text-sm text-rose-600">{error ?? 'Product not found.'}</div>
    );
  }

  const handleSubmit = async (values: CreateProductFormValues) => {
    const result = await updateMutation.mutateAsync({ id: params.id, ...values });
    if (result.ok) {
      router.push(ROUTES.DASHBOARD_INVENTORY_PRODUCTS);
    }
  };

  return (
    <div className="space-y-5 p-6">
      <div className="flex items-center gap-3">
        <Link
          href={ROUTES.DASHBOARD_INVENTORY_PRODUCTS}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
        >
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Edit Product</h1>
          <p className="mt-0.5 text-sm text-slate-500">{product.product_name}</p>
        </div>
      </div>

      <div className="max-w-2xl">
        <ProductForm
          defaultValues={product}
          onSubmit={handleSubmit}
          isSubmitting={updateMutation.isPending}
          submitLabel="Save Changes"
        />
      </div>
    </div>
  );
}
