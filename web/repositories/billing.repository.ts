import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

export async function listBilling() {
  return supabase.from('billing').select('*');
}
