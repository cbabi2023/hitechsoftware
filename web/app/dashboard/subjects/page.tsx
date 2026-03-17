'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Filter, Plus } from 'lucide-react';
import { usePermission } from '@/hooks/usePermission';
import { useSubjects } from '@/hooks/useSubjects';
import { useBrands } from '@/hooks/useBrands';
import { useDealers } from '@/hooks/useDealers';
import { useServiceCategories } from '@/hooks/useServiceCategories';
import { ROUTES } from '@/lib/constants/routes';
import { SUBJECT_PRIORITY_OPTIONS, SUBJECT_SOURCE_OPTIONS, SUBJECT_STATUS_OPTIONS } from '@/modules/subjects/subject.constants';
import type { SubjectListItem } from '@/modules/subjects/subject.types';

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-GB');
}

function formatStatus(value: string) {
  return value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

function truncateText(value: string, limit: number) {
  if (value.length <= limit) {
    return value;
  }

  return `${value.slice(0, limit)}...`;
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
    return { label: 'Under Warranty', className: 'bg-blue-100 text-blue-700' };
  }
  return { label: 'Chargeable', className: 'bg-slate-100 text-slate-600' };
}

export default function SubjectsDashboardPage() {
  const { can } = usePermission();
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const brands = useBrands();
  const dealers = useDealers();
  const categories = useServiceCategories();
  const {
    subjects,
    pagination,
    searchInput,
    pageSize,
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
    setPageSize,
  } = useSubjects();

  const advancedFilterCount = [
    sourceType !== 'all',
    Boolean(categoryId),
    Boolean(brandId),
    Boolean(dealerId),
    priority !== 'all',
    Boolean(fromDate),
    Boolean(toDate),
  ].filter(Boolean).length;

  function clearAdvancedFilters() {
    setSourceType('all');
    setCategoryId('');
    setBrandId('');
    setDealerId('');
    setPriority('all');
    setFromDate('');
    setToDate('');
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Service Subjects</h1>
        <p className="mt-1 text-sm text-slate-600">Filter, track, and audit all service subjects.</p>
      </div>

      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Search</label>
            <input
              value={searchInput}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Subject number, customer name or phone"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="w-full lg:w-56">
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

          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <button
              type="button"
              onClick={() => setShowAdvancedFilters((current) => !current)}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                showAdvancedFilters || advancedFilterCount > 0
                  ? 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Filter size={16} />
              Filters
              {advancedFilterCount > 0 ? (
                <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-blue-600 px-1.5 py-0.5 text-[11px] font-semibold text-white">
                  {advancedFilterCount}
                </span>
              ) : null}
            </button>

            {can('subject:create') ? (
              <Link
                href={ROUTES.DASHBOARD_SUBJECTS_NEW}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
              >
                <Plus size={16} />
                Create Subject
              </Link>
            ) : null}
          </div>
        </div>

        {showAdvancedFilters ? (
          <div className="mt-4 border-t border-slate-200 pt-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-slate-700">Advanced filters</p>
              <button
                type="button"
                onClick={clearAdvancedFilters}
                className="text-xs font-medium text-slate-500 hover:text-slate-700"
              >
                Clear advanced filters
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Source</label>
                <select
                  value={sourceType}
                  onChange={(event) => {
                    const nextSource = event.target.value as 'all' | 'brand' | 'dealer';
                    setSourceType(nextSource);
                    if (nextSource === 'brand') {
                      setDealerId('');
                    }
                    if (nextSource === 'dealer') {
                      setBrandId('');
                    }
                    if (nextSource === 'all') {
                      setBrandId('');
                      setDealerId('');
                    }
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
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Brand</label>
                <select
                  value={brandId}
                  onChange={(event) => {
                    const nextBrandId = event.target.value;
                    setBrandId(nextBrandId);
                    if (nextBrandId) {
                      setSourceType('brand');
                      setDealerId('');
                    } else if (!dealerId) {
                      setSourceType('all');
                    }
                  }}
                  disabled={sourceType === 'dealer'}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                >
                  <option value="">All Brands</option>
                  {brands.data.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Dealer</label>
                <select
                  value={dealerId}
                  onChange={(event) => {
                    const nextDealerId = event.target.value;
                    setDealerId(nextDealerId);
                    if (nextDealerId) {
                      setSourceType('dealer');
                      setBrandId('');
                    } else if (!brandId) {
                      setSourceType('all');
                    }
                  }}
                  disabled={sourceType === 'brand'}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                >
                  <option value="">All Dealers</option>
                  {dealers.data.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
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
        ) : null}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="min-w-[150px] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Subject</th>
                <th className="w-[180px] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Customer</th>
                <th className="w-[150px] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Source</th>
                <th className="w-[110px] px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-600">Priority</th>
                <th className="w-[130px] px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-600">Status</th>
                <th className="w-[150px] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Assigned To</th>
                <th className="w-[150px] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Service Type</th>
                <th className="w-[120px] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Date</th>
                <th className="w-20 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <tr key={`subject-skeleton-${index}`} className="animate-pulse">
                    <td className="px-4 py-3">
                      <div className="h-4 w-24 rounded bg-slate-200" />
                      <div className="mt-2 h-3 w-16 rounded bg-slate-100" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-4 w-28 rounded bg-slate-200" />
                      <div className="mt-2 h-3 w-20 rounded bg-slate-100" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-4 w-24 rounded bg-slate-200" />
                      <div className="mt-2 h-3 w-14 rounded bg-slate-100" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-6 w-20 rounded-full bg-slate-200" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-6 w-24 rounded-full bg-slate-200" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-6 w-24 rounded-full bg-slate-200" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-6 w-24 rounded-full bg-slate-200" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-4 w-20 rounded bg-slate-200" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-8 w-16 rounded-md bg-slate-200" />
                    </td>
                  </tr>
                ))
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
                  const isUnassigned = !subject.assigned_technician_id;
                  const priorityMeta = getPriorityMeta(subject.priority);
                  const statusMeta = getStatusMeta(subject.status);
                  const serviceTypeMeta = getServiceTypeMeta(subject);
                  const needsAttentionBorder = isUnassigned || subject.priority === 'critical';

                  return (
                    <tr
                      key={subject.id}
                      className={`hover:bg-slate-50/70${needsAttentionBorder ? ' border-l-4 border-l-rose-400' : ''}`}
                    >
                      <td className="min-w-[150px] px-4 py-3 text-sm">
                        <Link
                          href={ROUTES.DASHBOARD_SUBJECTS_DETAIL(subject.id)}
                          className="block whitespace-nowrap font-bold text-blue-600 hover:underline"
                          title={subject.subject_number}
                        >
                          {subject.subject_number}
                        </Link>
                        <p
                          className="max-w-[130px] truncate text-xs text-slate-500"
                          title={subject.category_name ?? '-'}
                        >
                          {subject.category_name ?? '-'}
                        </p>
                      </td>
                      <td className="w-[180px] px-4 py-3 text-sm">
                        {subject.customer_name ? (
                          <>
                            <p
                              className="max-w-[150px] truncate whitespace-nowrap font-medium text-slate-900"
                              title={subject.customer_name}
                            >
                              {truncateText(subject.customer_name, 15)}
                            </p>
                            <p className="max-w-[150px] truncate whitespace-nowrap text-xs text-slate-500" title={subject.customer_phone ?? ''}>
                              {subject.customer_phone ?? ''}
                            </p>
                          </>
                        ) : (
                          <span className="max-w-[150px] truncate whitespace-nowrap italic text-slate-400" title="Walk-in">Walk-in</span>
                        )}
                      </td>
                      <td className="w-[150px] px-4 py-3 text-sm">
                        <p
                          className="max-w-[120px] truncate whitespace-nowrap font-medium text-slate-900"
                          title={subject.source_name}
                        >
                          {truncateText(subject.source_name, 12)}
                        </p>
                        <p
                          className="max-w-[120px] truncate whitespace-nowrap text-xs text-slate-500"
                          title={subject.source_type === 'brand' ? 'Brand' : 'Dealer'}
                        >
                          {subject.source_type === 'brand' ? 'Brand' : 'Dealer'}
                        </p>
                      </td>
                      <td className="w-[110px] px-4 py-3 text-center">
                        <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${priorityMeta.className}`}>
                          {priorityMeta.label}
                        </span>
                      </td>
                      <td className="w-[130px] px-4 py-3 text-center">
                        <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${statusMeta.className}`}>
                          {statusMeta.label}
                        </span>
                      </td>
                      <td className="w-[150px] px-4 py-3 text-sm">
                        {subject.assigned_technician_name ? (
                          <>
                            <p
                              className="max-w-[120px] truncate whitespace-nowrap font-medium text-slate-900"
                              title={subject.assigned_technician_name}
                            >
                              {truncateText(subject.assigned_technician_name, 12)}
                            </p>
                            <p
                              className="max-w-[120px] truncate whitespace-nowrap text-xs text-slate-500"
                              title={subject.assigned_technician_code ?? 'Assigned technician'}
                            >
                              {subject.assigned_technician_code ?? 'Assigned technician'}
                            </p>
                          </>
                        ) : (
                          <span className="inline-flex whitespace-nowrap rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-600">
                            Unassigned
                          </span>
                        )}
                      </td>
                      <td className="w-[150px] px-4 py-3">
                        <span
                          className={`inline-flex max-w-[120px] truncate whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${serviceTypeMeta.className}`}
                          title={serviceTypeMeta.label}
                        >
                          {serviceTypeMeta.label}
                        </span>
                      </td>
                      <td className="w-[120px] px-4 py-3 text-sm text-slate-600">
                        <span className="max-w-[90px] truncate whitespace-nowrap" title={formatDate(subject.allocated_date)}>
                          {formatDate(subject.allocated_date)}
                        </span>
                      </td>
                      <td className="w-20 px-4 py-3">
                        <Link
                          href={ROUTES.DASHBOARD_SUBJECTS_DETAIL(subject.id)}
                          className="inline-flex items-center whitespace-nowrap rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-600">
          <div className="flex items-center gap-3">
            <p>
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
            </p>
            <div className="flex items-center gap-2">
              <label htmlFor="subjects-page-size" className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Rows
              </label>
              <select
                id="subjects-page-size"
                value={pageSize}
                onChange={(event) => setPageSize(Number(event.target.value))}
                className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 focus:border-blue-500 focus:outline-none"
              >
                {PAGE_SIZE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>
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
