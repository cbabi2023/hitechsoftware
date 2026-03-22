'use client';

import { useCallback, useMemo } from 'react';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';

interface RealtimeSubscribeInput {
  channelName: string;
  schema?: string;
  table: string;
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  filter?: string;
  onChange: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void;
}

export function useRealtime() {
  const supabase = useMemo(() => createClient(), []);

  const subscribe = useCallback(({ channelName, schema = 'public', table, event = '*', filter, onChange }: RealtimeSubscribeInput) => {
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event,
          schema,
          table,
          ...(filter ? { filter } : {}),
        },
        onChange,
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase]);

  return { subscribe };
}
