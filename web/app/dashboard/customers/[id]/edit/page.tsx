'use client';

import { useRouter, useParams } from 'next/navigation';
import { CustomerForm } from '@/components/customers/CustomerForm';
import { useCustomer, useCustomers } from '@/hooks/customers/useCustomers';
import { usePermission } from '@/hooks/auth/usePermission';

export default function EditCustomerPage() {
  const { can } = usePermission();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const customerId = params?.id;

  const { customer, isLoading, error } = useCustomer(customerId);
  const { updateCustomerMutation } = useCustomers();

  if (!can('customer:edit')) {
    return <div className="p-6 text-sm text-rose-600">You do not have permission to edit customers.</div>;
  }

  if (isLoading) {
    return <div className="p-6 text-sm text-slate-600">Loading customer...</div>;
  }

  if (!customer || !customerId) {
    return <div className="p-6 text-sm text-rose-600">{error ?? 'Customer not found.'}</div>;
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Edit customer</h1>
        <p className="mt-1 text-sm text-slate-600">Update customer information and addresses.</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <CustomerForm
          initialValues={customer}
          submitLabel="Update customer"
          isSubmitting={updateCustomerMutation.isPending}
          onSubmit={(values) => {
            updateCustomerMutation.mutate({ id: customerId, input: values });
            router.push(`/dashboard/customers/${customerId}`);
          }}
        />
      </div>
    </div>
  );
}
