import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

export async function listTechnicians() {
  return supabase.from('technicians').select('*');
}
