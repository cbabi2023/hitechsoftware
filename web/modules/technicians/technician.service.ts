import type { ServiceResult } from '@/types/common.types';
import type {
  AssignableTechnicianOption,
  TeamMember,
  TeamFilters,
  CreateTeamMemberInput,
  UpdateTeamMemberInput,
} from '@/modules/technicians/technician.types';
import { createTeamMemberSchema, updateTeamMemberSchema } from '@/modules/technicians/technician.validation';
import {
  deactivateTechnician,
  getTechnicianAssignmentById,
  listTeamMembers,
  listTechnicianRowsByIds,
  updateProfile,
  upsertTechnician,
} from '@/repositories/technician.repository';

function mapRepositoryError(message?: string, code?: string) {
  const safeMessage = message?.trim() ?? 'Failed to manage team member';

  if (code === '23505' || /duplicate key/i.test(safeMessage)) {
    if (/profiles_email_key/i.test(safeMessage)) {
      return 'A profile with this email already exists.';
    }
    if (/technicians_technician_code_key/i.test(safeMessage)) {
      return 'Technician code already exists. Use a unique code.';
    }
  }

  if (/violates foreign key constraint/i.test(safeMessage) && /profiles_id_fkey/i.test(safeMessage)) {
    return 'Auth user id was not found. Create/invite the auth user first, then add profile.';
  }

  return safeMessage;
}

function normalizePhoneNumber(phoneNumber?: string) {
  if (!phoneNumber) {
    return undefined;
  }

  const digits = phoneNumber.replace(/\D/g, '');

  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  }

  if (digits.length === 10) {
    return digits;
  }

  return digits;
}

export async function getTeamMembers(filters: TeamFilters = {}): Promise<ServiceResult<TeamMember[]>> {
  const { data: profileData, error: profileError } = await listTeamMembers(filters.role, filters.search);

  if (profileError) {
    return { ok: false, error: { message: profileError.message, code: profileError.code } };
  }

  const profiles = (profileData ?? []) as TeamMember[];
  const technicianIds = profiles.filter((row) => row.role === 'technician').map((row) => row.id);
  const { data: technicianData, error: technicianError } = await listTechnicianRowsByIds(technicianIds);

  if (technicianError) {
    return { ok: false, error: { message: technicianError.message, code: technicianError.code } };
  }

  const technicianById = new Map((technicianData ?? []).map((row) => [row.id, row]));

  return {
    ok: true,
    data: profiles.map((profile) => ({
      ...profile,
      technician: profile.role === 'technician' ? technicianById.get(profile.id) ?? null : null,
    })),
  };
}

export async function getAssignableTechnicians(): Promise<ServiceResult<AssignableTechnicianOption[]>> {
  const result = await getTeamMembers({ role: 'technician' });

  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    data: result.data
      .filter((member) => member.is_active && !member.is_deleted && member.technician?.is_active && !member.technician?.is_deleted)
      .map((member) => ({
        id: member.id,
        display_name: member.display_name,
        technician_code: member.technician?.technician_code ?? member.id,
      })),
  };
}

export async function getAssignableTechnicianById(id: string): Promise<ServiceResult<AssignableTechnicianOption | null>> {
  const result = await getTechnicianAssignmentById(id);

  if (result.profileError || result.technicianError) {
    return {
      ok: false,
      error: {
        message: result.profileError?.message ?? result.technicianError?.message ?? 'Failed to load assigned technician',
        code: result.profileError?.code ?? result.technicianError?.code,
      },
    };
  }

  if (!result.profile || !result.technician) {
    return { ok: true, data: null };
  }

  if (
    !result.profile.is_active ||
    result.profile.is_deleted ||
    !result.technician.is_active ||
    result.technician.is_deleted
  ) {
    return { ok: true, data: null };
  }

  return {
    ok: true,
    data: {
      id: result.profile.id,
      display_name: result.profile.display_name,
      technician_code: result.technician.technician_code,
    },
  };
}

export async function createTeamMember(input: CreateTeamMemberInput): Promise<ServiceResult<TeamMember>> {
  const parsed = createTeamMemberSchema.safeParse({
    ...input,
    phone_number: normalizePhoneNumber(input.phone_number),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: { message: parsed.error.issues[0]?.message ?? 'Invalid team member payload' },
    };
  }

  try {
    const response = await fetch('/api/team/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed.data),
    });

    const payload = (await response.json()) as { ok: boolean; data?: TeamMember; error?: { message: string; code?: string } };

    if (!response.ok || !payload.ok || !payload.data) {
      return {
        ok: false,
        error: {
          message: payload.error?.message ?? 'Failed to create team member',
          code: payload.error?.code,
        },
      };
    }

    return {
      ok: true,
      data: payload.data,
    };
  } catch {
    return {
      ok: false,
      error: { message: 'Unable to reach server while creating team member.' },
    };
  }
}

export async function deleteTeamMember(memberId: string): Promise<ServiceResult<null>> {
  try {
    const response = await fetch(`/api/team/members/${memberId}`, {
      method: 'DELETE',
    });

    const payload = (await response.json()) as { ok: boolean; error?: { message: string; code?: string } };

    if (!response.ok || !payload.ok) {
      return {
        ok: false,
        error: {
          message: payload.error?.message ?? 'Failed to delete team member',
          code: payload.error?.code,
        },
      };
    }

    return { ok: true, data: null };
  } catch {
    return {
      ok: false,
      error: { message: 'Unable to reach server while deleting team member.' },
    };
  }
}

export async function updateTeamMember(memberId: string, input: UpdateTeamMemberInput): Promise<ServiceResult<TeamMember>> {
  const parsed = updateTeamMemberSchema.safeParse({
    ...input,
    phone_number: normalizePhoneNumber(input.phone_number),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: { message: parsed.error.issues[0]?.message ?? 'Invalid team member update payload' },
    };
  }

  const profileResult = await updateProfile(memberId, parsed.data);

  if (profileResult.error || !profileResult.data) {
    return {
      ok: false,
      error: { message: mapRepositoryError(profileResult.error?.message, profileResult.error?.code), code: profileResult.error?.code },
    };
  }

  let technician = null;

  if (parsed.data.role === 'technician') {
    if (!parsed.data.technician?.technician_code) {
      return {
        ok: false,
        error: { message: 'Technician code is required when assigning technician role.' },
      };
    }

    const technicianResult = await upsertTechnician(memberId, {
      technician_code: parsed.data.technician.technician_code,
      qualification: parsed.data.technician.qualification,
      experience_years: parsed.data.technician.experience_years,
      daily_subject_limit: parsed.data.technician.daily_subject_limit,
      digital_bag_capacity: parsed.data.technician.digital_bag_capacity,
      is_active: parsed.data.is_active ?? true,
      is_deleted: false,
    });

    if (technicianResult.error) {
      return {
        ok: false,
        error: { message: mapRepositoryError(technicianResult.error.message, technicianResult.error.code), code: technicianResult.error.code },
      };
    }

    technician = technicianResult.data;
  } else if (parsed.data.role) {
    await deactivateTechnician(memberId);
  }

  return {
    ok: true,
    data: {
      ...(profileResult.data as TeamMember),
      technician,
    },
  };
}
