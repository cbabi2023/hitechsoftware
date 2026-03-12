import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

export async function listDigitalBags() {
  return supabase.from('digital_bag').select('*');
}
