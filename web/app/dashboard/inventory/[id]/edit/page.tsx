'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { InventoryForm } from '@/components/inventory/InventoryForm';
import { useInventoryItem } from '@/hooks/inventory/useInventoryItem';
import { useInventory } from '@/hooks/inventory/useInventory';
import { usePermission } from '@/hooks/auth/usePermission';
import type { CreateInventoryInput } from '@/modules/inventory/inventory.types';

export default function EditInventoryItemPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { can } = usePermission();
  const { item, isLoading, error } = useInventoryItem(id);
  const { updateMutation } = useInventory();

  if (!can('inventory:edit')) {
    return (
      <div className="p-6 text-sm text-rose-600">
        You do not have permission to edit inventory items.
      </div>
    );
  }

  if (isLoading) {
    return <div className="p-6 text-sm text-slate-500">Loading item…</div>;
  }

  if (error || !item) {
    return (
      <div className="p-6">
        <p className="text-sm text-rose-600">{error ?? 'Item not found.'}</p>
        <Link
          href="/dashboard/inventory"
          className="mt-2 inline-block text-xs text-slate-500 hover:underline"
        >
          ← Back to inventory
        </Link>
      </div>
    );
  }

  function handleSubmit(values: CreateInventoryInput) {
    updateMutation.mutate(
      { id, input: values },
      {
        onSuccess: (result) => {
          if (result.ok) router.push(`/dashboard/inventory/${id}`);
        },
      },
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center gap-3">
        <Link href={`/dashboard/inventory/${id}`} className="text-sm text-slate-500 hover:text-slate-700">
          ← {item.item_name}
        </Link>
        <span className="text-slate-300">/</span>
        <h1 className="text-lg font-semibold text-slate-900">Edit item</h1>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <InventoryForm
          initialValues={item}
          submitLabel="Save changes"
          isSubmitting={updateMutation.isPending}
          onSubmit={handleSubmit}
          onCancel={() => router.push(`/dashboard/inventory/${id}`)}
        />
      </div>
    </div>
  );
}
