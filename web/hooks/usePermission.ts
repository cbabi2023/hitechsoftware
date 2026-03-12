import { hasPermission, type Permission } from '@/config/permissions';
import { useAuthStore } from '@/stores/auth.store';

export function usePermission() {
  const role = useAuthStore((state) => state.role);

  const can = (permission: Permission) => hasPermission(role, permission);

  const canAny = (permissions: Permission[]) => permissions.some((permission) => can(permission));

  const canAll = (permissions: Permission[]) => permissions.every((permission) => can(permission));

  return {
    role,
    can,
    canAny,
    canAll,
  };
}
