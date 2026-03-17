import { ROLES } from '@/lib/constants/roles';
import type { UserRole } from '@/types/database.types';

export const MODULE_ACTIONS = {
  customer: ['view', 'create', 'edit', 'delete'],
  subject: ['view', 'create', 'edit', 'update', 'delete'],
  inventory: ['view', 'create', 'edit', 'delete'],
  stock: ['view', 'create', 'edit', 'delete'],
  'digital-bag': ['view', 'create', 'edit', 'delete'],
  billing: ['view', 'create', 'edit', 'delete'],
  amc: ['view', 'create', 'edit', 'delete'],
  technician: ['view', 'create', 'edit', 'delete'],
  payout: ['view', 'create', 'edit', 'delete'],
  reports: ['view'],
  settings: ['view', 'edit'],
  attendance: ['view', 'create', 'edit', 'delete'],
  notifications: ['view', 'create', 'edit', 'delete'],
  auth: ['view', 'create', 'edit', 'delete'],
  'service-settings': ['view', 'edit'],
} as const;

type ModuleName = keyof typeof MODULE_ACTIONS;
type ModuleAction<M extends ModuleName> = (typeof MODULE_ACTIONS)[M][number];
export type Permission = {
  [M in ModuleName]: `${M}:${ModuleAction<M>}`;
}[ModuleName];

export const PERMISSIONS: Record<Permission, UserRole[]> = {
  'customer:view': [ROLES.SUPER_ADMIN, ROLES.OFFICE_STAFF, ROLES.TECHNICIAN],
  'customer:create': [ROLES.SUPER_ADMIN, ROLES.OFFICE_STAFF],
  'customer:edit': [ROLES.SUPER_ADMIN, ROLES.OFFICE_STAFF],
  'customer:delete': [ROLES.SUPER_ADMIN],

  'subject:view': [ROLES.SUPER_ADMIN, ROLES.OFFICE_STAFF, ROLES.STOCK_MANAGER, ROLES.TECHNICIAN],
  'subject:create': [ROLES.SUPER_ADMIN, ROLES.OFFICE_STAFF],
  'subject:edit': [ROLES.SUPER_ADMIN, ROLES.OFFICE_STAFF],
  'subject:update': [ROLES.SUPER_ADMIN, ROLES.OFFICE_STAFF],
  'subject:delete': [ROLES.SUPER_ADMIN],

  'inventory:view': [ROLES.SUPER_ADMIN, ROLES.OFFICE_STAFF, ROLES.STOCK_MANAGER, ROLES.TECHNICIAN],
  'inventory:create': [ROLES.SUPER_ADMIN, ROLES.OFFICE_STAFF, ROLES.STOCK_MANAGER],
  'inventory:edit': [ROLES.SUPER_ADMIN, ROLES.OFFICE_STAFF, ROLES.STOCK_MANAGER],
  'inventory:delete': [ROLES.SUPER_ADMIN],

  'stock:view': [ROLES.SUPER_ADMIN, ROLES.OFFICE_STAFF, ROLES.STOCK_MANAGER, ROLES.TECHNICIAN],
  'stock:create': [ROLES.SUPER_ADMIN, ROLES.OFFICE_STAFF, ROLES.STOCK_MANAGER],
  'stock:edit': [ROLES.SUPER_ADMIN, ROLES.OFFICE_STAFF, ROLES.STOCK_MANAGER],
  'stock:delete': [ROLES.SUPER_ADMIN],

  'digital-bag:view': [ROLES.SUPER_ADMIN, ROLES.TECHNICIAN],
  'digital-bag:create': [ROLES.SUPER_ADMIN],
  'digital-bag:edit': [ROLES.SUPER_ADMIN, ROLES.TECHNICIAN],
  'digital-bag:delete': [ROLES.SUPER_ADMIN],

  'billing:view': [ROLES.SUPER_ADMIN, ROLES.OFFICE_STAFF],
  'billing:create': [ROLES.SUPER_ADMIN, ROLES.OFFICE_STAFF],
  'billing:edit': [ROLES.SUPER_ADMIN, ROLES.OFFICE_STAFF],
  'billing:delete': [ROLES.SUPER_ADMIN],

  'amc:view': [ROLES.SUPER_ADMIN, ROLES.OFFICE_STAFF],
  'amc:create': [ROLES.SUPER_ADMIN, ROLES.OFFICE_STAFF],
  'amc:edit': [ROLES.SUPER_ADMIN, ROLES.OFFICE_STAFF],
  'amc:delete': [ROLES.SUPER_ADMIN],

  'technician:view': [ROLES.SUPER_ADMIN, ROLES.OFFICE_STAFF],
  'technician:create': [ROLES.SUPER_ADMIN],
  'technician:edit': [ROLES.SUPER_ADMIN],
  'technician:delete': [ROLES.SUPER_ADMIN],

  'payout:view': [ROLES.SUPER_ADMIN, ROLES.OFFICE_STAFF],
  'payout:create': [ROLES.SUPER_ADMIN, ROLES.OFFICE_STAFF],
  'payout:edit': [ROLES.SUPER_ADMIN],
  'payout:delete': [ROLES.SUPER_ADMIN],

  'reports:view': [ROLES.SUPER_ADMIN, ROLES.OFFICE_STAFF],

  'settings:view': [ROLES.SUPER_ADMIN, ROLES.OFFICE_STAFF],
  'settings:edit': [ROLES.SUPER_ADMIN],

  'attendance:view': [ROLES.SUPER_ADMIN, ROLES.OFFICE_STAFF, ROLES.TECHNICIAN],
  'attendance:create': [ROLES.SUPER_ADMIN, ROLES.OFFICE_STAFF, ROLES.TECHNICIAN],
  'attendance:edit': [ROLES.SUPER_ADMIN, ROLES.OFFICE_STAFF, ROLES.TECHNICIAN],
  'attendance:delete': [ROLES.SUPER_ADMIN],

  'notifications:view': [ROLES.SUPER_ADMIN, ROLES.OFFICE_STAFF, ROLES.TECHNICIAN],
  'notifications:create': [ROLES.SUPER_ADMIN, ROLES.OFFICE_STAFF],
  'notifications:edit': [ROLES.SUPER_ADMIN, ROLES.OFFICE_STAFF],
  'notifications:delete': [ROLES.SUPER_ADMIN],

  'auth:view': [ROLES.SUPER_ADMIN, ROLES.OFFICE_STAFF, ROLES.TECHNICIAN],
  'auth:create': [ROLES.SUPER_ADMIN],
  'auth:edit': [ROLES.SUPER_ADMIN],
  'auth:delete': [ROLES.SUPER_ADMIN],

  'service-settings:view': [ROLES.SUPER_ADMIN],
  'service-settings:edit': [ROLES.SUPER_ADMIN],
};

export function hasPermission(role: UserRole | null, permission: Permission): boolean {
  if (!role) {
    return false;
  }

  return (PERMISSIONS[permission] ?? []).includes(role);
}
