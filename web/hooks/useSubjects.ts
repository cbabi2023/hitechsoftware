import { useQuery } from '@tanstack/react-query';
import { getSubjects } from '@/modules/subjects/subject.service';
import { SUBJECT_QUERY_KEYS } from '@/modules/subjects/subject.constants';

export function useSubjects() {
  const query = useQuery({
    queryKey: SUBJECT_QUERY_KEYS.list,
    queryFn: getSubjects,
  });

  return {
    subjects: query.data?.ok ? query.data.data : [],
    isLoading: query.isLoading,
    error:
      (query.data && !query.data.ok && query.data.error.message) ||
      (query.error instanceof Error ? query.error.message : null),
  };
}
