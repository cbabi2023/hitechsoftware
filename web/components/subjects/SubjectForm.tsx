'use client';

import { useMemo, useRef, useState } from 'react';
import { useBrands } from '@/hooks/brands/useBrands';
import { useDealers } from '@/hooks/dealers/useDealers';
import { useServiceCategories } from '@/hooks/service-categories/useServiceCategories';
import { useAssignableTechnicians } from '@/hooks/subjects/useSubjects';
import { lookupCustomerByPhone } from '@/modules/customers/customer.service';
import { WARRANTY_PERIODS } from '@/modules/subjects/subject.constants';
import type { SubjectFormValues, SubjectPriority, SubjectSourceType, SubjectTypeOfService } from '@/modules/subjects/subject.types';
import type { WarrantyPeriod } from '@/modules/subjects/subject.types';

const PRIORITY_CONFIG: Record<SubjectPriority, { label: string; active: string; ring: string }> = {
  critical: { label: 'Critical', active: 'bg-rose-600 text-white border-rose-600', ring: 'border-slate-200 text-rose-700 hover:border-rose-300 hover:bg-rose-50' },
  high:     { label: 'High',     active: 'bg-orange-500 text-white border-orange-500', ring: 'border-slate-200 text-orange-700 hover:border-orange-300 hover:bg-orange-50' },
  medium:   { label: 'Medium',   active: 'bg-yellow-500 text-white border-yellow-500', ring: 'border-slate-200 text-yellow-700 hover:border-yellow-300 hover:bg-yellow-50' },
  low:      { label: 'Low',      active: 'bg-green-600 text-white border-green-600', ring: 'border-slate-200 text-green-700 hover:border-green-300 hover:bg-green-50' },
};

const FIELD_BASE = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors';

function toIsoDate(value: string) {
  return new Date(value).toISOString().split('T')[0];
}

function addMonths(dateText: string, months: number) {
  const date = new Date(dateText);
  date.setMonth(date.getMonth() + months);
  return toIsoDate(date.toISOString());
}

function getWarrantyPeriodFromMonths(months: number | null): WarrantyPeriod {
  const match = WARRANTY_PERIODS.find((item) => item.months === months);
  return (match?.value as WarrantyPeriod | undefined) ?? 'custom';
}

function diffInWholeDays(fromDate: string, toDate: string) {
  const from = new Date(fromDate);
  const to = new Date(toDate);
  const ms = to.getTime() - from.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function getRemainingDaysText(endDate: string | undefined) {
  if (!endDate) return 'Not set';
  const today = new Date().toISOString().split('T')[0];
  const days = diffInWholeDays(today, endDate);
  if (days > 0) return `${days} day(s) remaining`;
  if (days === 0) return 'Ends today';
  return `${Math.abs(days)} day(s) overdue`;
}

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="mb-1.5 block text-sm font-medium text-slate-700">
      {children}
      {required && <span className="ml-0.5 text-rose-500">*</span>}
    </label>
  );
}

interface SubjectFormProps {
  heading: string;
  description: string;
  initialValues: SubjectFormValues;
  submitLabel: string;
  submittingLabel: string;
  isSubmitting: boolean;
  onSubmit: (values: SubjectFormValues) => Promise<void> | void;
  onCancel: () => void;
}

export default function SubjectForm({
  heading,
  description,
  initialValues,
  submitLabel,
  submittingLabel,
  isSubmitting,
  onSubmit,
  onCancel,
}: SubjectFormProps) {
  const brands = useBrands();
  const dealers = useDealers();
  const categories = useServiceCategories();
  const techniciansQuery = useAssignableTechnicians();
  const [values, setValues] = useState<SubjectFormValues>(initialValues);
  const [warrantyPeriod, setWarrantyPeriod] = useState<WarrantyPeriod>(() => {
    if (initialValues.purchase_date && initialValues.warranty_end_date) {
      const months = Math.round(diffInWholeDays(initialValues.purchase_date, initialValues.warranty_end_date) / 30);
      return getWarrantyPeriodFromMonths(months);
    }
    return 'custom';
  });
  const [amcPeriod, setAmcPeriod] = useState<WarrantyPeriod>(() => {
    if (initialValues.purchase_date && initialValues.amc_end_date) {
      const months = Math.round(diffInWholeDays(initialValues.purchase_date, initialValues.amc_end_date) / 30);
      return getWarrantyPeriodFromMonths(months);
    }
    return 'custom';
  });
  const [phoneAutoFilled, setPhoneAutoFilled] = useState(false);
  const phoneLookupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setField = <K extends keyof SubjectFormValues>(field: K, value: SubjectFormValues[K]) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  };

  const selectedWarrantyMonths = useMemo(
    () => WARRANTY_PERIODS.find((item) => item.value === warrantyPeriod)?.months ?? null,
    [warrantyPeriod],
  );

  const selectedAmcMonths = useMemo(
    () => WARRANTY_PERIODS.find((item) => item.value === amcPeriod)?.months ?? null,
    [amcPeriod],
  );

  const activeBrands = useMemo(() => brands.data.filter((item) => item.is_active), [brands.data]);
  const activeDealers = useMemo(() => dealers.data.filter((item) => item.is_active), [dealers.data]);
  const activeCategories = useMemo(() => categories.data.filter((item) => item.is_active), [categories.data]);
  const assignableTechnicians = techniciansQuery.data?.ok ? techniciansQuery.data.data : [];

  const submitDisabled =
    isSubmitting ||
    !values.subject_number.trim() ||
    !values.priority_reason.trim() ||
    !values.allocated_date ||
    !values.category_id ||
    (values.source_type === 'brand' ? !values.brand_id : !values.dealer_id);

  const handleSourceToggle = (next: SubjectSourceType) => {
    setValues((prev) => ({
      ...prev,
      source_type: next,
      brand_id: next === 'brand' ? prev.brand_id : undefined,
      dealer_id: next === 'dealer' ? prev.dealer_id : undefined,
    }));
  };

  const handlePhoneChange = (phone: string) => {
    setField('customer_phone', phone || undefined);
    setPhoneAutoFilled(false);
    if (phoneLookupTimerRef.current) clearTimeout(phoneLookupTimerRef.current);
    const digits = phone.replace(/\D/g, '');
    if (digits.length >= 10) {
      phoneLookupTimerRef.current = setTimeout(async () => {
        const result = await lookupCustomerByPhone(phone);
        if (result.ok && result.data) {
          setValues((prev) => ({
            ...prev,
            customer_phone: phone,
            customer_name: result.data!.customer_name,
            customer_address: result.data!.customer_address || prev.customer_address,
          }));
          setPhoneAutoFilled(true);
        }
      }, 500);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    await onSubmit(values);
  };

  const handleCoveragePurchaseDateChange = (nextDate: string) => {
    setField('purchase_date', nextDate || undefined);

    if (nextDate && warrantyPeriod !== 'custom' && selectedWarrantyMonths) {
      setField('warranty_end_date', addMonths(nextDate, selectedWarrantyMonths));
    }

    if (nextDate && amcPeriod !== 'custom' && selectedAmcMonths) {
      setField('amc_end_date', addMonths(nextDate, selectedAmcMonths));
    }
  };

  const handleWarrantyPeriodChange = (nextPeriod: WarrantyPeriod) => {
    setWarrantyPeriod(nextPeriod);
    const months = WARRANTY_PERIODS.find((item) => item.value === nextPeriod)?.months ?? null;
    if (nextPeriod !== 'custom' && values.purchase_date && months) {
      setField('warranty_end_date', addMonths(values.purchase_date, months));
    }
  };

  const handleAmcPeriodChange = (nextPeriod: WarrantyPeriod) => {
    setAmcPeriod(nextPeriod);
    const months = WARRANTY_PERIODS.find((item) => item.value === nextPeriod)?.months ?? null;
    if (nextPeriod !== 'custom' && values.purchase_date && months) {
      setField('amc_end_date', addMonths(values.purchase_date, months));
    }
  };

  const hasProductInfo =
    values.product_name || values.serial_number || values.product_description ||
    values.purchase_date || values.warranty_end_date || values.amc_end_date;

  const [showProduct, setShowProduct] = useState(!!hasProductInfo);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      {/* Page header */}
      <div className="border-b border-slate-200 bg-white px-6 py-5">
        <h1 className="text-xl font-semibold text-slate-900">{heading}</h1>
        <p className="mt-0.5 text-sm text-slate-500">{description}</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-1 flex-col">
        <div className="mx-auto w-full max-w-3xl flex-1 space-y-5 p-6">

          {/* ── Section 1: Service Info ── */}
          <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-3.5">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">1</span>
                <h2 className="text-sm font-semibold text-slate-900">Service Info</h2>
              </div>
            </div>

            <div className="space-y-5 p-5">
              {/* Row 1: Subject number + Category */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label required>Subject Number</Label>
                  <input
                    value={values.subject_number}
                    onChange={(event) => setField('subject_number', event.target.value)}
                    placeholder="e.g. SUB-2026-001"
                    className={FIELD_BASE}
                  />
                </div>
                <div>
                  <Label required>Category</Label>
                  <select
                    value={values.category_id}
                    onChange={(event) => setField('category_id', event.target.value)}
                    className={FIELD_BASE}
                  >
                    <option value="">Select a category</option>
                    {activeCategories.map((item) => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 2: Source toggle + Brand/Dealer select */}
              <div>
                <Label required>Source</Label>
                <div className="flex items-stretch gap-3">
                  {/* Toggle */}
                  <div className="flex rounded-lg border border-slate-200 p-0.5">
                    {(['brand', 'dealer'] as SubjectSourceType[]).map((src) => (
                      <button
                        key={src}
                        type="button"
                        onClick={() => handleSourceToggle(src)}
                        className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                          values.source_type === src
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {src.charAt(0).toUpperCase() + src.slice(1)}
                      </button>
                    ))}
                  </div>
                  {/* Dynamic select */}
                  <div className="flex-1">
                    {values.source_type === 'brand' ? (
                      <select
                        value={values.brand_id ?? ''}
                        onChange={(event) => setField('brand_id', event.target.value || undefined)}
                        className={FIELD_BASE}
                      >
                        <option value="">Select brand</option>
                        {activeBrands.map((item) => (
                          <option key={item.id} value={item.id}>{item.name}</option>
                        ))}
                      </select>
                    ) : (
                      <select
                        value={values.dealer_id ?? ''}
                        onChange={(event) => setField('dealer_id', event.target.value || undefined)}
                        className={FIELD_BASE}
                      >
                        <option value="">Select dealer</option>
                        {activeDealers.map((item) => (
                          <option key={item.id} value={item.id}>{item.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              </div>

              {/* Row 3: Type of service + Allocated date */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label required>Type of Service</Label>
                  <div className="flex rounded-lg border border-slate-200 p-0.5">
                    {(['service', 'installation'] as SubjectTypeOfService[]).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setField('type_of_service', type)}
                        className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
                          values.type_of_service === type
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label required>Allocated Date</Label>
                  <input
                    type="date"
                    value={values.allocated_date}
                    onChange={(event) => setField('allocated_date', event.target.value)}
                    className={FIELD_BASE}
                  />
                </div>
              </div>

              {/* Row 4: Technician */}
              <div>
                <Label>Assign Technician <span className="ml-1 text-xs font-normal text-slate-400">(optional)</span></Label>
                <select
                  value={values.assigned_technician_id ?? ''}
                  onChange={(event) => setField('assigned_technician_id', event.target.value || undefined)}
                  className={FIELD_BASE}
                >
                  <option value="">Leave unassigned for now</option>
                  {assignableTechnicians.map((technician) => (
                    <option key={technician.id} value={technician.id}>
                      {technician.display_name} — {technician.technician_code}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* ── Section 2: Priority ── */}
          <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-3.5">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">2</span>
                <h2 className="text-sm font-semibold text-slate-900">Priority</h2>
              </div>
            </div>

            <div className="space-y-4 p-5">
              {/* Priority pills */}
              <div>
                <Label required>Priority Level</Label>
                <div className="grid grid-cols-4 gap-2">
                  {(Object.entries(PRIORITY_CONFIG) as [SubjectPriority, typeof PRIORITY_CONFIG[SubjectPriority]][]).map(([key, cfg]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setField('priority', key)}
                      className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition-all ${
                        values.priority === key ? cfg.active : cfg.ring
                      }`}
                    >
                      {cfg.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reason */}
              <div>
                <Label required>Reason / Description</Label>
                <textarea
                  value={values.priority_reason}
                  onChange={(event) => setField('priority_reason', event.target.value)}
                  rows={3}
                  placeholder="Briefly describe why this service was raised and what the priority reflects..."
                  className={FIELD_BASE}
                />
              </div>
            </div>
          </section>

          {/* ── Section 3: Customer ── */}
          <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">3</span>
                  <h2 className="text-sm font-semibold text-slate-900">Customer</h2>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">Optional</span>
              </div>
            </div>

            <div className="space-y-4 p-5">
              <div>
                <Label>Phone Number</Label>
                <input
                  value={values.customer_phone ?? ''}
                  onChange={(event) => handlePhoneChange(event.target.value)}
                  placeholder="10-digit mobile number"
                  className={FIELD_BASE}
                />
                {phoneAutoFilled ? (
                  <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-emerald-600">
                    <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                    Customer found — name and address auto-filled
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-slate-400">Enter phone to auto-fill name and address from existing records</p>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label>Customer Name</Label>
                  <input
                    value={values.customer_name ?? ''}
                    onChange={(event) => setField('customer_name', event.target.value || undefined)}
                    placeholder="Full name"
                    className={FIELD_BASE}
                  />
                </div>
                <div>
                  <Label>Address</Label>
                  <input
                    value={values.customer_address ?? ''}
                    onChange={(event) => setField('customer_address', event.target.value || undefined)}
                    placeholder="Area, city"
                    className={FIELD_BASE}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* ── Section 4: Product (collapsible) ── */}
          <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <button
              type="button"
              onClick={() => setShowProduct((p) => !p)}
              className="flex w-full items-center justify-between px-5 py-3.5 text-left"
            >
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">4</span>
                <h2 className="text-sm font-semibold text-slate-900">Product Details</h2>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">Optional</span>
              </div>
              <svg
                className={`h-4 w-4 text-slate-400 transition-transform ${showProduct ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showProduct && (
              <div className="space-y-4 border-t border-slate-100 p-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <Label>Product Name</Label>
                    <input
                      value={values.product_name ?? ''}
                      onChange={(event) => setField('product_name', event.target.value || undefined)}
                      placeholder="e.g. Split AC 1.5 Ton"
                      className={FIELD_BASE}
                    />
                  </div>
                  <div>
                    <Label>Serial Number</Label>
                    <input
                      value={values.serial_number ?? ''}
                      onChange={(event) => setField('serial_number', event.target.value || undefined)}
                      placeholder="Product serial / model number"
                      className={FIELD_BASE}
                    />
                  </div>
                </div>

                <div>
                  <Label>Product Description</Label>
                  <textarea
                    value={values.product_description ?? ''}
                    onChange={(event) => setField('product_description', event.target.value || undefined)}
                    rows={2}
                    placeholder="Any relevant notes about the product condition or model"
                    className={FIELD_BASE}
                  />
                </div>

                <div>
                  <p className="mb-2 text-sm font-medium text-slate-700">Coverage Dates</p>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-xs text-slate-500">Purchase Date</label>
                      <input
                        type="date"
                        value={values.purchase_date ?? ''}
                        onChange={(event) => handleCoveragePurchaseDateChange(event.target.value)}
                        className={FIELD_BASE}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-slate-500">Warranty Period</label>
                      <select
                        value={warrantyPeriod}
                        onChange={(event) => handleWarrantyPeriodChange(event.target.value as WarrantyPeriod)}
                        className={FIELD_BASE}
                      >
                        {WARRANTY_PERIODS.map((period) => (
                          <option key={period.value} value={period.value}>{period.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-slate-500">Warranty Ends</label>
                      <input
                        type="date"
                        value={values.warranty_end_date ?? ''}
                        onChange={(event) => {
                          const next = event.target.value || undefined;
                          setField('warranty_end_date', next);
                          if (values.purchase_date && next) {
                            const months = Math.round(diffInWholeDays(values.purchase_date, next) / 30);
                            setWarrantyPeriod(getWarrantyPeriodFromMonths(months));
                          } else {
                            setWarrantyPeriod('custom');
                          }
                        }}
                        className={FIELD_BASE}
                      />
                      <p className="mt-1 text-xs text-slate-400">{getRemainingDaysText(values.warranty_end_date)}</p>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-slate-500">AMC Period</label>
                      <select
                        value={amcPeriod}
                        onChange={(event) => handleAmcPeriodChange(event.target.value as WarrantyPeriod)}
                        className={FIELD_BASE}
                      >
                        {WARRANTY_PERIODS.map((period) => (
                          <option key={period.value} value={period.value}>{period.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-slate-500">AMC Ends</label>
                      <input
                        type="date"
                        value={values.amc_end_date ?? ''}
                        onChange={(event) => {
                          const next = event.target.value || undefined;
                          setField('amc_end_date', next);
                          if (values.purchase_date && next) {
                            const months = Math.round(diffInWholeDays(values.purchase_date, next) / 30);
                            setAmcPeriod(getWarrantyPeriodFromMonths(months));
                          } else {
                            setAmcPeriod('custom');
                          }
                        }}
                        className={FIELD_BASE}
                      />
                      <p className="mt-1 text-xs text-slate-400">{getRemainingDaysText(values.amc_end_date)}</p>
                    </div>
                  </div>
                  <p className="mt-1.5 text-xs text-slate-400">Pick a period to auto-calculate end date, or set end date manually to auto-detect nearest period.</p>
                </div>
              </div>
            )}
          </section>

          {/* Data load errors */}
          {brands.error || dealers.error || categories.error ? (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
              {brands.error ?? dealers.error ?? categories.error}
            </p>
          ) : null}

        </div>

        {/* ── Sticky footer ── */}
        <div className="sticky bottom-0 z-10 border-t border-slate-200 bg-white px-6 py-4">
          <div className="mx-auto flex max-w-3xl items-center gap-3">
            <button
              type="submit"
              disabled={submitDisabled}
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? submittingLabel : submitLabel}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              Cancel
            </button>
            {submitDisabled && !isSubmitting && (
              <p className="ml-1 text-xs text-slate-400">Fill in all required fields to continue.</p>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
