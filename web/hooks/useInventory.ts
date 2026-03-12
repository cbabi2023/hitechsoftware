import { useQuery } from '@tanstack/react-query';
import { getInventory } from '@/modules/inventory/inventory.service';
import { INVENTORY_QUERY_KEYS } from '@/modules/inventory/inventory.constants';

export function useInventory() {
  const query = useQuery({
    queryKey: INVENTORY_QUERY_KEYS.list,
    queryFn: getInventory,
  });

  return {
    inventory: query.data?.ok ? query.data.data : [],
    isLoading: query.isLoading,
    error:
      (query.data && !query.data.ok && query.data.error.message) ||
      (query.error instanceof Error ? query.error.message : null),
  };
}
