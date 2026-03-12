import { createClient } from '@/lib/supabase/client';
import type { ProfileRow } from '@/types/database.types';

const supabase = createClient();

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
