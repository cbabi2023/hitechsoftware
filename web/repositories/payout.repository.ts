import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

export async function listPayouts() {
  return supabase.from('payouts').select('*');
}
