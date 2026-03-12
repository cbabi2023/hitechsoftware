import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

export async function listAmc() {
  return supabase.from('amc').select('*');
}
