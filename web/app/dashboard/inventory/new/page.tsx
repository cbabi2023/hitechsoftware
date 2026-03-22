'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { InventoryForm } from '@/components/inventory/InventoryForm';
import { useInventory } from '@/hooks/inventory/useInventory';
import { usePermission } from '@/hooks/auth/usePermission';

export default function NewInventoryItemPage() {
  const { can } = usePermission();
  const router = useRouter();
  const { createMutation } = useInventory();

  if (!can('inventory:create')) {
    return (
      <div className="p-6 text-sm text-rose-600">
        You do not have permission to add inventory items.
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/dashboard/inventory" className="text-sm text-slate-500 hover:text-slate-700">
          ← Inventory
        </Link>
        <span className="text-slate-300">/</span>
        <h1 className="text-lg font-semibold text-slate-900">Add item</h1>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <InventoryForm
          submitLabel="Add item"
          isSubmitting={createMutation.isPending}
          onSubmit={(values) => {
            createMutation.mutate(values);
            router.push('/dashboard/inventory');
          }}
          onCancel={() => router.push('/dashboard/inventory')}
        />
      </div>
    </div>
  );
}
