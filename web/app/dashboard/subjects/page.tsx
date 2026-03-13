'use client';

import Link from 'next/link';
import { usePermission } from '@/hooks/usePermission';
import { useSubjects } from '@/hooks/useSubjects';
import { useBrands } from '@/hooks/useBrands';
import { useDealers } from '@/hooks/useDealers';
import { useServiceCategories } from '@/hooks/useServiceCategories';
import { ROUTES } from '@/lib/constants/routes';
import { SUBJECT_PRIORITY_OPTIONS, SUBJECT_SOURCE_OPTIONS, SUBJECT_STATUS_OPTIONS } from '@/modules/subjects/subject.constants';
import type { SubjectListItem } from '@/modules/subjects/subject.types';

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-GB');
}

function formatStatus(value: string) {
  return value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

function getPriorityMeta(priority: SubjectListItem['priority']) {
  switch (priority) {
    case 'critical':
      return { label: 'Critical', className: 'bg-rose-100 text-rose-700' };
    case 'high':
      return { label: 'High', className: 'bg-orange-100 text-orange-700' };
    case 'medium':
      return { label: 'Medium', className: 'bg-yellow-100 text-yellow-700' };
    case 'low':
      return { label: 'Low', className: 'bg-green-100 text-green-700' };
  }
}

function getStatusMeta(status: string) {
  switch (status) {
    case 'PENDING':
      return { label: 'Pending', className: 'bg-slate-100 text-slate-600' };
    case 'ALLOCATED':
      return { label: 'Allocated', className: 'bg-blue-100 text-blue-700' };
    case 'ACCEPTED':
      return { label: 'Accepted', className: 'bg-indigo-100 text-indigo-700' };
    case 'IN_PROGRESS':
      return { label: 'In Progress', className: 'bg-orange-100 text-orange-700' };
    case 'COMPLETED':
      return { label: 'Completed', className: 'bg-green-100 text-green-700' };
    case 'INCOMPLETE':
      return { label: 'Incomplete', className: 'bg-rose-100 text-rose-700' };
    case 'AWAITING_PARTS':
      return { label: 'Awaiting Parts', className: 'bg-yellow-100 text-yellow-700' };
    case 'RESCHEDULED':
      return { label: 'Rescheduled', className: 'bg-purple-100 text-purple-700' };
    case 'CANCELLED':
      return { label: 'Cancelled', className: 'bg-slate-200 text-slate-600' };
    default:
      return { label: formatStatus(status), className: 'bg-slate-100 text-slate-600' };
  }
}

function getServiceTypeMeta(subject: SubjectListItem) {
  if (subject.is_amc_service) {
    return { label: 'AMC Free', className: 'bg-emerald-100 text-emerald-700' };
  }
  if (subject.is_warranty_service) {
    return { label: 'Warranty', className: 'bg-blue-100 text-blue-700' };
  }
  return { label: 'Chargeable', className: 'bg-slate-100 text-slate-600' };
}

export default function SubjectsDashboardPage() {
  const { can } = usePermission();
  const brands = useBrands();
  const dealers = useDealers();
  const categories = useServiceCategories();
  const {
    subjects,
    pagination,
    searchInput,
    sourceType,
    priority,
    status,
    categoryId,
    brandId,
    dealerId,
    fromDate,
    toDate,
    isLoading,
    error,
    setSearch,
    setSourceType,
    setPriority,
    setStatus,
    setCategoryId,
    setBrandId,
    setDealerId,
    setFromDate,
    setToDate,
    setPage,
  } = useSubjects();

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Service Subjects</h1>
          <p className="mt-1 text-sm text-slate-600">Filter, track, and audit all service subjects.</p>
        </div>

        {can('subject:create') ? (
          <Link href={ROUTES.DASHBOARD_SUBJECTS_NEW} className="ht-btn ht-btn-primary">
            Create subject
          </Link>
        ) : null}
      </div>

      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Search</label>
            <input
              value={searchInput}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Subject number, customer name or phone"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Source</label>
            <select
              value={sourceType}
              onChange={(event) => {
                setSourceType(event.target.value as 'all' | 'brand' | 'dealer');
                setBrandId('');
                setDealerId('');
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="all">All</option>
              {SUBJECT_SOURCE_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
              {sourceType === 'dealer' ? 'Dealer' : 'Brand'}
            </label>
            {sourceType === 'dealer' ? (
              <select
                value={dealerId}
                onChange={(event) => setDealerId(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="">All Dealers</option>
                {dealers.data.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            ) : (
              <select
                value={brandId}
                onChange={(event) => setBrandId(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="">All Brands</option>
                {brands.data.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Category</label>
            <select
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="">All Categories</option>
              {categories.data.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Priority</label>
            <select
              value={priority}
              onChange={(event) => setPriority(event.target.value as 'all' | 'critical' | 'high' | 'medium' | 'low')}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="all">All</option>
              {SUBJECT_PRIORITY_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Status</label>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="">All</option>
              {SUBJECT_STATUS_OPTIONS.map((item) => (
                <option key={item} value={item}>
                  {formatStatus(item)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">From</label>
            <input
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">To</label>
            <input
              type="date"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Subject</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Source</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Priority</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Assigned To</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Service Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-sm text-slate-500">
                    Loading subjects...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-sm text-rose-600">
                    {error}
                  </td>
                </tr>
              ) : subjects.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-sm text-slate-500">
                    No subjects found.
                  </td>
                </tr>
              ) : (
                subjects.map((subject) => {
                  const isUnassignedPending = !subject.assigned_technician_id && subject.status === 'PENDING';
                  const priorityMeta = getPriorityMeta(subject.priority);
                  const statusMeta = getStatusMeta(subject.status);
                  const serviceTypeMeta = getServiceTypeMeta(subject);

                  return (
                    <tr
                      key={subject.id}
                      className={`hover:bg-slate-50/70${isUnassignedPending ? ' border-l-4 border-l-rose-400' : ''}`}
                    >
                      <td className="px-4 py-3 text-sm">
                        <Link
                          href={ROUTES.DASHBOARD_SUBJECTS_DETAIL(subject.id)}
                          className="font-bold text-blue-600 hover:underline"
                        >
                          {subject.subject_number}
                        </Link>
                        <p className="mt-0.5 text-xs text-slate-500">{subject.category_name ?? '-'}</p>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {subject.customer_name ? (
                          <>
                            <p className="font-medium text-slate-900">{subject.customer_name}</p>
                            <p className="mt-0.5 text-xs text-slate-500">{subject.customer_phone ?? ''}</p>
                          </>
                        ) : (
                          <span className="italic text-slate-400">Walk-in</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <p className="font-medium text-slate-900">{subject.source_name}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{subject.source_type === 'brand' ? 'Brand' : 'Dealer'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${priorityMeta.className}`}>
                          {priorityMeta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusMeta.className}`}>
                          {statusMeta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {subject.assigned_technician_name ? (
                          <span className="text-slate-900">{subject.assigned_technician_name}</span>
                        ) : (
                          <span className="inline-flex rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-600">
                            Unassigned
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${serviceTypeMeta.className}`}>
                          {serviceTypeMeta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{formatDate(subject.allocated_date)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Link
                            href={ROUTES.DASHBOARD_SUBJECTS_DETAIL(subject.id)}
                            className="inline-flex items-center rounded-md bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
                          >
                            View
                          </Link>
                          {can('subject:edit') ? (
                            <Link
                              href={ROUTES.DASHBOARD_SUBJECTS_EDIT(subject.id)}
                              className="inline-flex items-center rounded-md bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200"
                            >
                              Edit
                            </Link>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-600">
          <p>
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
