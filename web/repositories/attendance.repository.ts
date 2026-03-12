import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

export async function listAttendance() {
  return supabase.from('technician_attendance').select('*');
}
