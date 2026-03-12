import type { UserRole } from '@/types/database.types';

export const PERMISSIONS: Record<UserRole, string[]> = {
  super_admin: ['*'],
  office_staff: ['customers:read', 'subjects:read', 'subjects:write', 'inventory:read', 'stock:read'],
  stock_manager: ['inventory:read', 'inventory:write', 'stock:read', 'stock:write', 'digital_bag:write'],
  technician: ['subjects:read_own', 'subjects:update_own', 'inventory:read', 'stock:read'],
};

export function hasPermission(role: UserRole | null, permission: string) {
  if (!role) return false;
  const allowed = PERMISSIONS[role] ?? [];
  return allowed.includes('*') || allowed.includes(permission);
}
