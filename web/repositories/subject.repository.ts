import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

export async function listSubjects() {
  return supabase.from('subjects').select('*');
}
