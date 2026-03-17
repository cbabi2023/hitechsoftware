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
