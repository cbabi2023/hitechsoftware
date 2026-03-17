'use client';

import Link from 'next/link';
import { CustomerStatusBadge } from '@/components/customers/CustomerStatusBadge';
import { KOTTAYAM_AREAS } from '@/modules/customers/customer.constants';
import { useCustomers } from '@/hooks/customers/useCustomers';
import { usePermission } from '@/hooks/auth/usePermission';

export default function CustomersListPage() {
  const { can, role } = usePermission();
  const {
    customers,
    pagination,
    filters,
    searchInput,
    isLoading,
    error,
    setSearch,
    setArea,
    setStatus,
    setPage,
  } = useCustomers();

  if (!can('customer:view')) {
    return <div className="p-6 text-sm text-rose-600">You do not have access to customer records.</div>;
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Customers</h1>
          <p className="mt-1 text-sm text-slate-600">
            {role === 'technician'
              ? "Only customers assigned to your today's services are visible."
              : 'Manage customer records, addresses, and status.'}
          </p>
        </div>

        {can('customer:create') ? (
          <Link
            href="/dashboard/customers/new"
            className="ht-btn ht-btn-primary"
          >
            New customer
          </Link>
        ) : null}
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-4">
        <div className="md:col-span-2">
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Search</label>
          <input
            value={searchInput}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name or phone"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Area</label>
          <select
            value={filters.area ?? ''}
            onChange={(event) => setArea(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">All areas</option>
            {KOTTAYAM_AREAS.map((area) => (
              <option key={area} value={area}>
                {area}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Status</label>
          <select
            value={filters.status ?? 'all'}
            onChange={(event) => setStatus(event.target.value as 'all' | 'active' | 'inactive')}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Area</th>
              <th className="px-4 py-3">City</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td className="px-4 py-6 text-slate-500" colSpan={6}>
                  Loading customers...
                </td>
              </tr>
            ) : customers.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-slate-500" colSpan={6}>
                  No customers found.
                </td>
              </tr>
            ) : (
              customers.map((customer) => (
                <tr key={customer.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-900">{customer.customer_name}</td>
                  <td className="px-4 py-3 text-slate-700">{customer.phone_number}</td>
                  <td className="px-4 py-3 text-slate-700">{customer.primary_area}</td>
                  <td className="px-4 py-3 text-slate-700">{customer.primary_city}</td>
                  <td className="px-4 py-3">
                    <CustomerStatusBadge isActive={customer.is_active} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/dashboard/customers/${customer.id}`}
                        className="ht-btn ht-btn-secondary ht-btn-sm"
                      >
                        View
                      </Link>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}

      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm text-slate-600">
          Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
        </p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={pagination.page <= 1}
            onClick={() => setPage(pagination.page - 1)}
            className="ht-btn ht-btn-secondary ht-btn-sm"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => setPage(pagination.page + 1)}
            className="ht-btn ht-btn-secondary ht-btn-sm"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
