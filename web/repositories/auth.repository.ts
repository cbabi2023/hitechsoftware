import { createClient } from '@/lib/supabase/client';
import type { ProfileRow } from '@/types/database.types';

const supabase = createClient();

export interface AuthLogInsert {
  user_id: string;
  event: string;
  role: string | null;
  ip_address: string | null;
  user_agent: string | null;
}

export async function getAuthSession() {
  return supabase.auth.getSession();
}

export async function signInWithPassword(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signOutSession() {
  return supabase.auth.signOut();
}

export async function getProfileByUserId(userId: string) {
  return supabase
    .from('profiles')
    .select('id,email,display_name,phone_number,role,is_active,is_deleted')
    .eq('id', userId)
    .maybeSingle<ProfileRow>();
}

export function onAuthStateChange(callback: Parameters<typeof supabase.auth.onAuthStateChange>[0]) {
  return supabase.auth.onAuthStateChange(callback);
}

export async function createAuthLog(log: AuthLogInsert) {
  return supabase.from('auth_logs').insert(log);
}
