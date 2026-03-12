import { listInventory } from '@/repositories/inventory.repository';
import type { ServiceResult } from '@/types/common.types';

export async function getInventory(): Promise<ServiceResult<Record<string, unknown>[]>> {
  const { data, error } = await listInventory();

  if (error) {
    return { ok: false, error: { message: error.message, code: error.code } };
  }

  return { ok: true, data: (data ?? []) as Record<string, unknown>[] };
}
