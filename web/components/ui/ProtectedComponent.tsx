'use client';

import type { ReactNode } from 'react';
import { usePermission } from '@/hooks/usePermission';
import type { Permission } from '@/config/permissions';

interface ProtectedComponentProps {
  permission?: Permission;
  anyPermissions?: Permission[];
  allPermissions?: Permission[];
  fallback?: ReactNode;
  children: ReactNode;
}

export function ProtectedComponent({
  permission,
  anyPermissions,
  allPermissions,
  fallback = null,
  children,
}: ProtectedComponentProps) {
  const { can, canAny, canAll } = usePermission();

  const isAllowed =
    (permission ? can(permission) : true) &&
    (anyPermissions ? canAny(anyPermissions) : true) &&
    (allPermissions ? canAll(allPermissions) : true);

  if (!isAllowed) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
