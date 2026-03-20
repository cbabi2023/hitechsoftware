import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createTeamMemberSchema } from '@/modules/technicians/technician.validation';
import type { TeamMember } from '@/modules/technicians/technician.types';

// ============================================================================
// Error Response Types
// ============================================================================
interface ErrorDetails {
  step: string;
  code: string;
  message: string;
  userMessage: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

interface ApiErrorResponse {
  ok: false;
  error: {
    message: string;
    code: string;
    step?: string;
    userMessage?: string;
    details?: Record<string, unknown>;
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function logError(error: ErrorDetails) {
  const logEntry = {
    timestamp: error.timestamp,
    step: error.step,
    code: error.code,
    message: error.message,
    details: error.details,
  };
  console.error('[TEAM/MEMBERS API]', JSON.stringify(logEntry, null, 2));
}

function createErrorResponse(error: ErrorDetails, statusCode: number): NextResponse<ApiErrorResponse> {
  logError(error);
  return NextResponse.json(
    {
      ok: false,
      error: {
        message: error.message,
        code: error.code,
        step: error.step,
        userMessage: error.userMessage,
        ...(process.env.NODE_ENV === 'development' && { details: error.details }),
      },
    },
    { status: statusCode },
  );
}

async function ensureSuperAdmin(): Promise<{ ok: true } | { ok: false; response: NextResponse<ApiErrorResponse> }> {
  try {
    const supabase = await createServerClient();
    const authState = await supabase.auth.getUser();

    if (authState.error || !authState.data.user) {
      return {
        ok: false,
        response: createErrorResponse(
          {
            step: '1. Authorization Check',
            code: 'AUTH_NOT_FOUND',
            message: 'User session not found or invalid',
            userMessage: 'You must be logged in to create team members',
            details: { error: authState.error?.message },
            timestamp: new Date().toISOString(),
          },
          401,
        ),
      };
    }

    const profileResult = await supabase
      .from('profiles')
      .select('role')
      .eq('id', authState.data.user.id)
      .maybeSingle<{ role: string }>();

    if (profileResult.error || profileResult.data?.role !== 'super_admin') {
      return {
        ok: false,
        response: createErrorResponse(
          {
            step: '1. Authorization Check',
            code: 'FORBIDDEN_NOT_SUPER_ADMIN',
            message: `User role is "${profileResult.data?.role || 'unknown'}", requires 'super_admin'`,
            userMessage: 'Only super admin users can create team members',
            details: { userRole: profileResult.data?.role },
            timestamp: new Date().toISOString(),
          },
          403,
        ),
      };
    }

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      response: createErrorResponse(
        {
          step: '1. Authorization Check',
          code: 'AUTH_ERROR_UNEXPECTED',
          message: 'Unexpected error during auth check',
          userMessage: 'An unexpected error occurred during authorization',
          details: { error: err instanceof Error ? err.message : String(err) },
          timestamp: new Date().toISOString(),
        },
        500,
      ),
    };
  }
}

export async function POST(request: Request) {
  const now = new Date().toISOString();
  console.log('[TEAM/MEMBERS API] POST request started', { timestamp: now });

  // Step 1: Authorization
  const access = await ensureSuperAdmin();
  if (!access.ok) {
    return access.response;
  }
  console.log('[TEAM/MEMBERS API] ✓ Authorization passed');

  // Step 2: Parse JSON body
  let body: unknown;
  try {
    body = await request.json();
    console.log('[TEAM/MEMBERS API] ✓ JSON parsed successfully');
  } catch (err) {
    return createErrorResponse(
      {
        step: '2. Parse Request Body',
        code: 'INVALID_JSON',
        message: 'Request body is not valid JSON',
        userMessage: 'Invalid request format. Please check your JSON payload.',
        details: { error: err instanceof Error ? err.message : String(err) },
        timestamp: now,
      },
      400,
    );
  }

  // Step 3: Validate input schema
  const parsed = createTeamMemberSchema.safeParse(body);
  if (!parsed.success) {
    const validationErrors = parsed.error.issues.map((issue) => ({
      field: issue.path.length > 0 ? issue.path.join('.') : 'unknown',
      message: issue.message,
      type: issue.code,
    }));

    return createErrorResponse(
      {
        step: '3. Validate Input Schema',
        code: 'VALIDATION_FAILED',
        message: `Validation failed: ${validationErrors.length} field(s) invalid`,
        userMessage: `Please fix the following errors: ${validationErrors.map((e) => `${e.field} - ${e.message}`).join('; ')}`,
        details: { validationErrors },
        timestamp: now,
      },
      400,
    );
  }
  console.log('[TEAM/MEMBERS API] ✓ Input validation passed', { role: parsed.data.role });

  const admin = createAdminClient();

  // Step 4: Create auth user
  console.log('[TEAM/MEMBERS API] 4. Creating auth user...', { email: parsed.data.email });
  const authCreate = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: {
      display_name: parsed.data.display_name,
      role: parsed.data.role,
    },
  });

  if (authCreate.error || !authCreate.data.user) {
    const authErrorMsg = authCreate.error?.message ?? 'Unknown auth error';
    const isDuplicateEmail = /User already exists|duplicate/.test(authErrorMsg);

    return createErrorResponse(
      {
        step: '4. Create Auth User',
        code: isDuplicateEmail ? 'EMAIL_ALREADY_EXISTS' : 'AUTH_USER_CREATION_FAILED',
        message: `Auth user creation failed: ${authErrorMsg}`,
        userMessage: isDuplicateEmail
          ? `Email "${parsed.data.email}" is already registered. Please use a different email.`
          : `Failed to create user account: ${authErrorMsg}`,
        details: {
          email: parsed.data.email,
          error: authErrorMsg,
          code: authCreate.error?.code,
        },
        timestamp: now,
      },
      400,
    );
  }

  const userId = authCreate.data.user.id;
  console.log('[TEAM/MEMBERS API] ✓ Auth user created', { userId });

  // Step 5: Create profile record
  console.log('[TEAM/MEMBERS API] 5. Creating profile...', { userId, role: parsed.data.role });
  const profileInsert = await admin
    .from('profiles')
    .upsert({
      id: userId,
      email: parsed.data.email,
      display_name: parsed.data.display_name,
      phone_number: parsed.data.phone_number?.trim() || null,
      role: parsed.data.role,
      is_active: parsed.data.is_active ?? true,
      is_deleted: false,
    }, { onConflict: 'id' })
    .select('id,email,display_name,phone_number,role,is_active,is_deleted,created_at,updated_at')
    .single();

  if (profileInsert.error || !profileInsert.data) {
    // Rollback: Delete the auth user
    await admin.auth.admin.deleteUser(userId);
    console.log('[TEAM/MEMBERS API] ✗ Profile creation failed - rolled back auth user', { userId });

    const profileErrorMsg = profileInsert.error?.message ?? 'Unknown profile error';
    let code = 'PROFILE_CREATION_FAILED';
    let userMsg = `Failed to create user profile: ${profileErrorMsg}`;

    if (/duplicate key value violates unique constraint/.test(profileErrorMsg)) {
      if (/profiles_email_key/.test(profileErrorMsg)) {
        code = 'EMAIL_DUPLICATE_IN_PROFILE';
        userMsg = `Email "${parsed.data.email}" already exists in profiles table (unique constraint violation).`;
      } else if (/profiles_phone_number_key/.test(profileErrorMsg)) {
        code = 'PHONE_DUPLICATE_IN_PROFILE';
        userMsg = `Phone number "${parsed.data.phone_number}" is already in use by another user.`;
      }
    } else if (/permission denied|RLS|row-level-security/i.test(profileErrorMsg)) {
      code = 'PROFILE_RLS_DENIED';
      userMsg = 'Database permission denied. This may be a Row Level Security (RLS) policy issue. Please contact support.';
    }

    const profileErrorCode = typeof profileInsert.error?.code === 'string' ? profileInsert.error.code : null;

    return createErrorResponse(
      {
        step: '5. Create Profile Record',
        code,
        message: `Profile creation failed: ${profileErrorMsg}`,
        userMessage: userMsg,
        details: {
          userId,
          email: parsed.data.email,
          phone: parsed.data.phone_number,
          error: profileErrorMsg,
          dbCode: profileErrorCode,
        },
        timestamp: now,
      },
      400,
    );
  }
  console.log('[TEAM/MEMBERS API] ✓ Profile created', { profileId: profileInsert.data.id });

  let technician: TeamMember['technician'] = null;

  // Step 6: Create technician record (if role is technician)
  if (parsed.data.role === 'technician' && parsed.data.technician) {
    console.log('[TEAM/MEMBERS API] 6. Creating technician record...', { userId, code: parsed.data.technician.technician_code });

    const technicianInsert = await admin
      .from('technicians')
      .insert({
        id: userId,
        technician_code: parsed.data.technician.technician_code,
        qualification: parsed.data.technician.qualification?.trim() || null,
        experience_years: parsed.data.technician.experience_years,
        daily_subject_limit: parsed.data.technician.daily_subject_limit ?? 10,
        digital_bag_capacity: parsed.data.technician.digital_bag_capacity ?? 50,
        is_active: true,
        is_deleted: false,
      })
      .select('id,technician_code,qualification,experience_years,daily_subject_limit,digital_bag_capacity,is_active,is_deleted,total_rejections')
      .single();

    if (technicianInsert.error) {
      // Rollback: Delete auth user and profile
      await admin.auth.admin.deleteUser(userId);
      console.log('[TEAM/MEMBERS API] ✗ Technician creation failed - rolled back all', { userId });

      const techErrorMsg = technicianInsert.error.message ?? 'Unknown technician error';
      let code = 'TECHNICIAN_CREATION_FAILED';
      let userMsg = `Failed to create technician record: ${techErrorMsg}`;

      if (/duplicate key value violates unique constraint/.test(techErrorMsg)) {
        if (/technicians_technician_code_key/.test(techErrorMsg)) {
          code = 'TECHNICIAN_CODE_DUPLICATE';
          userMsg = `Technician code "${parsed.data.technician.technician_code}" is already in use by another technician.`;
        }
      }

      const technicianErrorCode = typeof technicianInsert.error?.code === 'string' ? technicianInsert.error.code : null;

      return createErrorResponse(
        {
          step: '6. Create Technician Record',
          code,
          message: `Technician creation failed: ${techErrorMsg}`,
          userMessage: userMsg,
          details: {
            userId,
            technicianCode: parsed.data.technician.technician_code,
            error: techErrorMsg,
            dbCode: technicianErrorCode,
          },
          timestamp: now,
        },
        400,
      );
    }

    technician = technicianInsert.data;
    console.log('[TEAM/MEMBERS API] ✓ Technician record created', { technicianId: technician.id });
  }

  console.log('[TEAM/MEMBERS API] ✓✓✓ Team member created successfully', {
    userId,
    email: profileInsert.data.email,
    role: profileInsert.data.role,
    timestamp: now,
  });

  return NextResponse.json({
    ok: true,
    data: {
      ...profileInsert.data,
      technician,
    },
  });
}
