import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

export async function listInventory() {
  return supabase.from('inventory').select('*');
}
