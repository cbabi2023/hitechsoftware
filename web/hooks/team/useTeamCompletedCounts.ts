import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

export function useTeamCompletedCounts() {
  return useQuery({
    queryKey: ['team', 'completed-counts'],
    queryFn: async () => {
      // Current month as YYYY-MM-01 to match the materialized view's month column.
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      const result = await supabase
        .from('technician_monthly_performance')
        .select('technician_id,total_completed')
        .eq('month', currentMonth);

      if (result.error) throw new Error(result.error.message);

      const counts: Record<string, number> = {};
      for (const row of result.data ?? []) {
        counts[(row as { technician_id: string; total_completed: number }).technician_id] =
          Number((row as { technician_id: string; total_completed: number }).total_completed ?? 0);
      }
      return counts;
    },
    staleTime: 60_000,
  });
}
