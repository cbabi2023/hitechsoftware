import { listSubjects } from '@/repositories/subject.repository';
import type { ServiceResult } from '@/types/common.types';

export async function getSubjects(): Promise<ServiceResult<Record<string, unknown>[]>> {
  const { data, error } = await listSubjects();

  if (error) {
    return { ok: false, error: { message: error.message, code: error.code } };
  }

  return { ok: true, data: (data ?? []) as Record<string, unknown>[] };
}
