'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users, ClipboardList, Package, ArrowRight } from 'lucide-react';
import { getCustomerList } from '@/modules/customers/customer.service';
import { CUSTOMER_QUERY_KEYS } from '@/modules/customers/customer.constants';
import { getTeamMembers } from '@/modules/technicians/technician.service';
import { TEAM_QUERY_KEYS } from '@/modules/technicians/technician.constants';
import { useAllTechnicianStatus, useTodayAttendance, useToggleAttendance } from '@/hooks/attendance/useAttendance';
import { ROUTES } from '@/lib/constants/routes';
import { useAuth } from '@/hooks/auth/useAuth';
import { getSubjects } from '@/modules/subjects/subject.service';
import { SUBJECT_QUERY_KEYS } from '@/modules/subjects/subject.constants';

const ACTIVE_PENDING_STATUSES = ['PENDING', 'ALLOCATED', 'ACCEPTED', 'ARRIVED', 'IN_PROGRESS', 'INCOMPLETE', 'AWAITING_PARTS', 'RESCHEDULED', 'REJECTED'];

function formatTime(value: string | null) {
  if (!value) {
    return '-';
  }

  return new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export default function DashboardPage() {
  const { user, userRole } = useAuth();
  const [showTechnicianList, setShowTechnicianList] = useState(false);
  const today = new Date().toISOString().split('T')[0];

  const todayAttendanceQuery = useTodayAttendance(user?.id ?? '');
  const toggleAttendanceMutation = useToggleAttendance();

  const technicianPendingSubjectsQuery = useQuery({
    queryKey: [...SUBJECT_QUERY_KEYS.list, 'technician-dashboard-pending', user?.id],
    queryFn: async () => {
      const result = await getSubjects({
        technician_pending_only: true,
        page: 1,
        page_size: 50,
      });

      if (!result.ok) {
        throw new Error(result.error.message);
      }

      return result.data.data;
    },
    enabled: Boolean(user?.id) && userRole === 'technician',
    staleTime: 30 * 1000,
  });

  const adminPendingSubjectsCountQuery = useQuery({
    queryKey: [...SUBJECT_QUERY_KEYS.list, 'admin-dashboard-pending-count'],
    queryFn: async () => {
      const counts = await Promise.all(
        ACTIVE_PENDING_STATUSES.map(async (status) => {
          const result = await getSubjects({ status, page: 1, page_size: 1 });
          if (!result.ok) {
            throw new Error(result.error.message);
          }
          return result.data.total;
        }),
      );

      return counts.reduce((sum, value) => sum + value, 0);
    },
    enabled: userRole !== 'technician',
    staleTime: 30 * 1000,
  });

  const adminOverduePendingCountQuery = useQuery({
    queryKey: [...SUBJECT_QUERY_KEYS.list, 'admin-dashboard-overdue-pending-count'],
    queryFn: async () => {
      const result = await getSubjects({ overdue_only: true, page: 1, page_size: 1 });
      if (!result.ok) {
        throw new Error(result.error.message);
      }
      return result.data.total;
    },
    enabled: userRole !== 'technician',
    staleTime: 30 * 1000,
  });

  if (userRole === 'technician') {
    const todayAttendance = todayAttendanceQuery.data?.ok ? todayAttendanceQuery.data.data : null;
    const isOnline = Boolean(todayAttendance?.toggled_on_at) && !todayAttendance?.toggled_off_at;
    const pendingSubjects = technicianPendingSubjectsQuery.data ?? [];

    return (
      <div className="p-4 md:p-6">
        <div className="mb-6 rounded-2xl border border-ht-border bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-ht-text-900">Technician Dashboard</h1>
          <p className="mt-2 text-sm text-ht-text-500">Your attendance and today&apos;s services at a glance.</p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-ht-border bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-ht-text-500">Attendance Status</p>
            <p className={`mt-2 text-2xl font-bold ${isOnline ? 'text-emerald-700' : 'text-slate-700'}`}>
              {isOnline ? 'Online' : 'Offline'}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              ON time: {formatTime(todayAttendance?.toggled_on_at ?? null)}
            </p>
            <button
              type="button"
              disabled={toggleAttendanceMutation.isPending || !user?.id}
              onClick={() => {
                if (user?.id) {
                  toggleAttendanceMutation.mutate(user.id);
                }
              }}
              className="mt-4 inline-flex min-h-12 items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {toggleAttendanceMutation.isPending ? 'Updating...' : isOnline ? 'Toggle OFF' : 'Toggle ON'}
            </button>
          </div>

          <div className="rounded-2xl border border-ht-border bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-ht-text-500">Pending Services</p>
            <p className="mt-2 text-2xl font-bold text-ht-text-900">{technicianPendingSubjectsQuery.isLoading ? '...' : pendingSubjects.length}</p>
            <p className="mt-1 text-sm text-slate-600">Includes carry-forward unfinished tasks not yet completed or closed.</p>
            <Link href={ROUTES.DASHBOARD_SUBJECTS} className="mt-4 inline-flex items-center text-sm font-medium text-ht-blue-600 hover:text-ht-navy-800">
              Open Service List
              <ArrowRight size={16} className="ml-2" />
            </Link>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-ht-border bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-ht-text-900">Your Pending Subject Numbers</h2>
          {technicianPendingSubjectsQuery.isLoading ? (
            <p className="mt-2 text-sm text-slate-500">Loading...</p>
          ) : pendingSubjects.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">No pending services assigned.</p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {pendingSubjects.map((subject) => (
                <Link
                  key={subject.id}
                  href={ROUTES.DASHBOARD_SUBJECTS_DETAIL(subject.id)}
                  className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                >
                  {subject.subject_number}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

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

  const liveTechnicianStatusQuery = useAllTechnicianStatus();
  const liveTechnicians = liveTechnicianStatusQuery.data?.ok ? liveTechnicianStatusQuery.data.data : [];

  const liveMeta = useMemo(() => {
    const total = liveTechnicians.length;
    const online = liveTechnicians.filter((item) => item.is_online).length;
    const absent = liveTechnicians.filter((item) => !item.today_attendance || !item.today_attendance.is_present).length;

    return { total, online, absent };
  }, [liveTechnicians]);

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
      label: 'Pending Subjects',
      value: adminPendingSubjectsCountQuery.isLoading ? '...' : adminPendingSubjectsCountQuery.data ?? 0,
      icon: ClipboardList,
      href: `${ROUTES.DASHBOARD_SUBJECTS}?queue=pending`,
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

      <div className="mt-4 rounded-2xl border border-ht-border bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-ht-text-500">Live Technicians</p>
            <p className="mt-1 text-2xl font-bold text-ht-text-900">{liveMeta.total}</p>
          </div>

          <button
            type="button"
            onClick={() => setShowTechnicianList((prev) => !prev)}
            className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
          >
            {showTechnicianList ? 'Hide' : 'View All'}
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
            Online: {liveMeta.online}
          </span>
          <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700">
            Absent Today: {liveMeta.absent}
          </span>
        </div>

        {showTechnicianList ? (
          <div className="mt-3 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
            {liveTechnicians.length === 0 ? (
              <p className="text-sm text-slate-500">No technician status available.</p>
            ) : (
              liveTechnicians.map((tech) => (
                <div key={tech.id} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm">
                  <span className="font-medium text-slate-900">{tech.display_name}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tech.is_online ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                    {tech.is_online ? 'Online' : 'Offline'}
                  </span>
                </div>
              ))
            )}
          </div>
        ) : null}
      </div>

      {customerCountQuery.isError ? (
        <p className="mt-4 text-sm text-rose-600">Could not load customer count right now.</p>
      ) : null}

      {teamMemberCountQuery.isError ? (
        <p className="mt-2 text-sm text-rose-600">Could not load team member count right now.</p>
      ) : null}

      {liveTechnicianStatusQuery.isError ? (
        <p className="mt-2 text-sm text-rose-600">Could not load live technician status right now.</p>
      ) : null}

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Link
          href={`${ROUTES.DASHBOARD_SUBJECTS}?queue=overdue`}
          className="group rounded-2xl border border-rose-200 bg-rose-50 p-5 shadow-sm transition hover:border-rose-300 hover:shadow-md"
        >
          <p className="text-sm font-medium text-rose-700">Overdue Pending (Technician Assigned)</p>
          <p className="mt-2 text-3xl font-bold text-rose-800">
            {adminOverduePendingCountQuery.isLoading ? '...' : adminOverduePendingCountQuery.data ?? 0}
          </p>
          <p className="mt-1 text-xs text-rose-600">Allocated date is older than today and still not closed.</p>
          <div className="mt-3 flex items-center text-sm font-medium text-rose-700 group-hover:text-rose-900">
            Open overdue queue
            <ArrowRight size={16} className="ml-2" />
          </div>
        </Link>

        <Link
          href={`${ROUTES.DASHBOARD_SUBJECTS}?queue=pending`}
          className="group rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm transition hover:border-amber-300 hover:shadow-md"
        >
          <p className="text-sm font-medium text-amber-700">All Pending Queue</p>
          <p className="mt-2 text-3xl font-bold text-amber-800">
            {adminPendingSubjectsCountQuery.isLoading ? '...' : adminPendingSubjectsCountQuery.data ?? 0}
          </p>
          <p className="mt-1 text-xs text-amber-600">All active pending statuses, sorted to prioritize overdue items.</p>
          <div className="mt-3 flex items-center text-sm font-medium text-amber-700 group-hover:text-amber-900">
            Open pending queue
            <ArrowRight size={16} className="ml-2" />
          </div>
        </Link>
      </div>
    </div>
  );
}
