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

export const SUBJECT_STATUS_OPTIONS = ['PENDING', 'ALLOCATED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'INCOMPLETE'];
