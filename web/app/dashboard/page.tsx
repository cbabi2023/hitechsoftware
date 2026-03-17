'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Users, ClipboardList, Package, ArrowRight } from 'lucide-react';
import { getCustomerList } from '@/modules/customers/customer.service';
import { CUSTOMER_QUERY_KEYS } from '@/modules/customers/customer.constants';
import { getTeamMembers } from '@/modules/technicians/technician.service';
import { TEAM_QUERY_KEYS } from '@/modules/technicians/technician.constants';
import { ROUTES } from '@/lib/constants/routes';

export default function DashboardPage() {
  const customerCountQuery = useQuery({
    queryKey: [...CUSTOMER_QUERY_KEYS.all, 'count'],
    queryFn: async () => {
      const result = await getCustomerList({ page: 1, page_size: 1 });
      if (!result.ok) {
        throw new Error(result.error.message);
      }
      return result.data.total;
    },
    staleTime: 30 * 1000,
  });

  const teamMemberCountQuery = useQuery({
    queryKey: [...TEAM_QUERY_KEYS.all, 'count'],
    queryFn: async () => {
      const result = await getTeamMembers();
      if (!result.ok) {
        throw new Error(result.error.message);
      }
      return result.data.length;
    },
    staleTime: 30 * 1000,
  });

  const stats = [
    {
      label: 'Customers',
      value: customerCountQuery.isLoading ? '...' : customerCountQuery.data ?? 0,
      icon: Users,
      href: ROUTES.DASHBOARD_CUSTOMERS,
    },
    {
      label: 'Team Members',
      value: teamMemberCountQuery.isLoading ? '...' : teamMemberCountQuery.data ?? 0,
      icon: Users,
      href: ROUTES.DASHBOARD_TEAM,
    },
    {
      label: 'Subjects',
      value: '-',
      icon: ClipboardList,
      href: ROUTES.DASHBOARD_SUBJECTS,
    },
    {
      label: 'Inventory Items',
      value: '-',
      icon: Package,
      href: ROUTES.DASHBOARD_INVENTORY,
      isAvailable: false,
    },
  ];

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6 rounded-2xl border border-ht-border bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-ht-text-900">Dashboard</h1>
        <p className="mt-2 text-sm text-ht-text-500">
          Use the sidebar to navigate modules. Customer module is now available from the menu.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((item) =>
          item.isAvailable === false ? (
            <div key={item.label} className="rounded-2xl border border-ht-border bg-white p-5 shadow-sm opacity-75">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-ht-text-500">{item.label}</p>
                  <p className="mt-2 text-3xl font-bold text-ht-text-900">{item.value}</p>
                </div>
                <div className="rounded-lg bg-slate-100 p-2 text-slate-500">
                  <item.icon size={18} />
                </div>
              </div>
              <div className="mt-4 inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Coming soon
              </div>
            </div>
          ) : (
            <Link
              key={item.label}
              href={item.href}
              className="group rounded-2xl border border-ht-border bg-white p-5 shadow-sm transition hover:border-ht-border-blue hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-ht-text-500">{item.label}</p>
                  <p className="mt-2 text-3xl font-bold text-ht-text-900">{item.value}</p>
                </div>
                <div className="rounded-lg bg-ht-blue-50 p-2 text-ht-blue-600">
                  <item.icon size={18} />
                </div>
              </div>
              <div className="mt-4 flex items-center text-sm font-medium text-ht-blue-600 group-hover:text-ht-navy-800">
                Open module
                <ArrowRight size={16} className="ml-2" />
              </div>
            </Link>
          ),
        )}
      </div>

      {customerCountQuery.isError ? (
        <p className="mt-4 text-sm text-rose-600">Could not load customer count right now.</p>
      ) : null}

      {teamMemberCountQuery.isError ? (
        <p className="mt-2 text-sm text-rose-600">Could not load team member count right now.</p>
      ) : null}
    </div>
  );
}
