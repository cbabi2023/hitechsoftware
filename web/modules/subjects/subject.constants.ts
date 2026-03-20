import type { PhotoType } from '@/modules/subjects/subject.types';

export const SUBJECT_QUERY_KEYS = {
  all: ['subjects'] as const,
  list: ['subjects', 'list'] as const,
  detail: (id: string) => ['subject', id] as const,
  assignableTechnicians: ['subjects', 'assignable-technicians'] as const,
};

export const SUBJECT_DEFAULT_PAGE_SIZE = 10;

export const SUBJECT_SOURCE_OPTIONS = [
  { label: 'Brand', value: 'brand' },
  { label: 'Dealer', value: 'dealer' },
] as const;

export const SUBJECT_PRIORITY_OPTIONS = [
  { label: 'Critical', value: 'critical' },
  { label: 'High', value: 'high' },
  { label: 'Medium', value: 'medium' },
  { label: 'Low', value: 'low' },
] as const;

export const SUBJECT_TYPE_OF_SERVICE_OPTIONS = [
  { label: 'Installation', value: 'installation' },
  { label: 'Service', value: 'service' },
] as const;

export const SUBJECT_STATUS_OPTIONS = ['PENDING', 'ALLOCATED', 'ACCEPTED', 'REJECTED', 'IN_PROGRESS', 'COMPLETED', 'INCOMPLETE'];

export const WARRANTY_PERIODS = [
  { label: '6 Months', value: '6_months', months: 6 },
  { label: '1 Year', value: '1_year', months: 12 },
  { label: '2 Years', value: '2_years', months: 24 },
  { label: '3 Years', value: '3_years', months: 36 },
  { label: '4 Years', value: '4_years', months: 48 },
  { label: '5 Years', value: '5_years', months: 60 },
  { label: 'Custom', value: 'custom', months: null },
] as const;

export const INCOMPLETE_REASONS = [
  { value: 'customer_cannot_afford', label: 'Customer Cannot Afford' },
  { value: 'power_issue', label: 'Power or Electricity Issue' },
  { value: 'door_locked', label: 'Door Locked or Customer Unavailable' },
  { value: 'spare_parts_not_available', label: 'Spare Parts Not Available' },
  { value: 'site_not_ready', label: 'Site Not Ready' },
  { value: 'other', label: 'Other' },
] as const;

/** Photos required for in-warranty and AMC jobs before completion is allowed. */
export const REQUIRED_PHOTOS_WARRANTY: PhotoType[] = [
  'serial_number',
  'machine',
  'bill',
  'job_sheet',
  'defective_part',
  'service_video',
];

/** Photos required for out-of-warranty jobs before completion is allowed. */
export const REQUIRED_PHOTOS_OUT_OF_WARRANTY: PhotoType[] = [
  'serial_number',
  'machine',
  'bill',
];

/**
 * Allowed forward-only status transitions for the job workflow.
 * Only the assigned technician triggers these; office-staff transitions
 * (PENDING ↔ ALLOCATED) are handled separately.
 */
export const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  ACCEPTED: ['ARRIVED'],
  ARRIVED: ['IN_PROGRESS'],
  IN_PROGRESS: ['COMPLETED', 'INCOMPLETE', 'AWAITING_PARTS'],
};

/** Maximum file sizes enforced in the service layer before upload. */
export const PHOTO_SIZE_LIMITS = {
  images: 2 * 1024 * 1024,  // 2 MB
  videos: 50 * 1024 * 1024, // 50 MB
} as const;

export const PAYMENT_MODES = [
  { label: 'Cash', value: 'cash' },
  { label: 'UPI', value: 'upi' },
  { label: 'Card', value: 'card' },
  { label: 'Cheque', value: 'cheque' },
] as const;

export const BILL_NUMBER_PREFIX = 'HT-BILL';
