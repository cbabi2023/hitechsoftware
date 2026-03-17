'use client';

import { useRouter } from 'next/navigation';
import { CustomerForm } from '@/components/customers/CustomerForm';
import { useCustomers } from '@/hooks/customers/useCustomers';
import { usePermission } from '@/hooks/auth/usePermission';

export default function NewCustomerPage() {
  const { can } = usePermission();
  const router = useRouter();
  const { createCustomerMutation } = useCustomers();

  if (!can('customer:create')) {
    return <div className="p-6 text-sm text-rose-600">You do not have permission to create customers.</div>;
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Create customer</h1>
        <p className="mt-1 text-sm text-slate-600">Add a new customer with primary and optional secondary address.</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <CustomerForm
          submitLabel="Create customer"
          isSubmitting={createCustomerMutation.isPending}
          onSubmit={(values) => {
            // Navigate immediately — the mutation's onSuccess/onError handlers
            // show the toast and invalidate the list cache in the background.
            createCustomerMutation.mutate(values);
            router.push('/dashboard/customers');
          }}
        />
      </div>
    </div>
  );
}
