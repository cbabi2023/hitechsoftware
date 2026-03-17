import { createClient } from '@/lib/supabase/client';
import type { UserRole } from '@/types/database.types';
import type { UpdateTeamMemberInput } from '@/modules/technicians/technician.types';

const supabase = createClient();

function normalizeNullable(value?: string) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

export async function listTeamMembers(role?: UserRole | 'all', search?: string) {
  let query = supabase
    .from('profiles')
    .select('id,email,display_name,phone_number,role,is_active,is_deleted,created_at,updated_at')
    .in('role', ['technician', 'office_staff', 'stock_manager'])
    .eq('is_deleted', false)
    .order('created_at', { ascending: false });

  if (role && role !== 'all') {
    query = query.eq('role', role);
  }

  if (search?.trim()) {
    const escaped = search.trim().replaceAll(',', ' ');
    query = query.or(`display_name.ilike.%${escaped}%,email.ilike.%${escaped}%,phone_number.ilike.%${escaped}%`);
  }

  return query;
}

export async function listTechnicianRowsByIds(ids: string[]) {
  if (ids.length === 0) {
    return { data: [], error: null };
  }

  return supabase
    .from('technicians')
    .select('id,technician_code,qualification,experience_years,daily_subject_limit,digital_bag_capacity,is_active,is_deleted')
    .in('id', ids);
}

export async function getTechnicianAssignmentById(id: string) {
  const [profileResult, technicianResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('id,display_name,is_active,is_deleted')
      .eq('id', id)
      .single<{ id: string; display_name: string; is_active: boolean; is_deleted: boolean }>(),
    supabase
      .from('technicians')
      .select('id,technician_code,is_active,is_deleted')
      .eq('id', id)
      .single<{ id: string; technician_code: string; is_active: boolean; is_deleted: boolean }>(),
  ]);

  return {
    profile: profileResult.data,
    profileError: profileResult.error,
    technician: technicianResult.data,
    technicianError: technicianResult.error,
  };
}

export async function updateProfile(id: string, input: UpdateTeamMemberInput) {
  const payload: Record<string, string | boolean | null | undefined> = {
    display_name: input.display_name,
    phone_number: input.phone_number !== undefined ? normalizeNullable(input.phone_number) : undefined,
    role: input.role,
    is_active: input.is_active,
  };

  return supabase
    .from('profiles')
    .update(payload)
    .eq('id', id)
    .eq('is_deleted', false)
    .select('id,email,display_name,phone_number,role,is_active,is_deleted,created_at,updated_at')
    .single();
}

export async function upsertTechnician(id: string, input: NonNullable<UpdateTeamMemberInput['technician']>) {
  return supabase
    .from('technicians')
    .upsert({
      id,
      technician_code: input.technician_code,
      qualification: normalizeNullable(input.qualification),
      experience_years: input.experience_years,
      daily_subject_limit: input.daily_subject_limit ?? 10,
      digital_bag_capacity: input.digital_bag_capacity ?? 50,
      is_active: input.is_active ?? true,
      is_deleted: input.is_deleted ?? false,
    })
    .select('id,technician_code,qualification,experience_years,daily_subject_limit,digital_bag_capacity,is_active,is_deleted')
    .single();
}

export async function deactivateTechnician(id: string) {
  return supabase
    .from('technicians')
    .update({ is_active: false, is_deleted: true })
    .eq('id', id)
    .select('id')
    .single();
}
