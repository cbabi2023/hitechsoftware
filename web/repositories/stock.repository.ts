import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

export async function listStock() {
  return supabase.from('stock').select('*');
}
