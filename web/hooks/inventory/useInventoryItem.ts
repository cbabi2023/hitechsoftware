'use client';

import { useQuery } from '@tanstack/react-query';
import { INVENTORY_QUERY_KEYS } from '@/modules/inventory/inventory.constants';
import { getInventoryById } from '@/modules/inventory/inventory.service';

export function useInventoryItem(id: string) {
  const query = useQuery({
    queryKey: INVENTORY_QUERY_KEYS.detail(id),
    queryFn: () => getInventoryById(id),
    enabled: Boolean(id),
  });

  return {
    item: query.data?.ok ? query.data.data : null,
    isLoading: query.isLoading,
    error:
      (query.data && !query.data.ok && query.data.error.message) ||
      (query.error instanceof Error ? query.error.message : null),
  };
}
