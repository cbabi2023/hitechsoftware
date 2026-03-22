export const INVENTORY_QUERY_KEYS = {
  all: ['inventory'] as const,
  list: ['inventory', 'list'] as const,
  detail: (id: string) => ['inventory', 'detail', id] as const,
};

export const INVENTORY_DEFAULT_PAGE_SIZE = 20;

export const INVENTORY_CATEGORIES: string[] = [
  'Compressors',
  'Motors',
  'PCB / Control Boards',
  'Capacitors',
  'Filters',
  'Refrigerant & Gas',
  'Coils',
  'Valves',
  'Sensors',
  'Cables & Wiring',
  'Fan Blades',
  'Remote Controls',
  'Brackets & Mounts',
  'Tools & Consumables',
  'Other',
];
