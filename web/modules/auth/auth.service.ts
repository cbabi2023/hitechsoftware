import type { AuthState, SignInInput } from '@/modules/auth/auth.types';
import { signInSchema } from '@/modules/auth/auth.validation';
import {
  createAuthLog,
  getAuthSession,
  getProfileByUserId,
  signInWithPassword,
  signOutSession,
} from '@/repositories/auth.repository';
import type { ServiceResult } from '@/types/common.types';
import { ROLES } from '@/lib/constants/roles';
import { ROUTES } from '@/lib/constants/routes';

export function getDashboardRouteByRole(role: string | null): string {
  switch (role) {
    case ROLES.SUPER_ADMIN:
      return ROUTES.DASHBOARD;
    case ROLES.OFFICE_STAFF:
      return ROUTES.DASHBOARD_SUBJECTS;
    case ROLES.STOCK_MANAGER:
      return ROUTES.DASHBOARD_INVENTORY;
    case ROLES.TECHNICIAN:
      return ROUTES.DASHBOARD_TECHNICIAN;
    default:
      return ROUTES.DASHBOARD;
  }
}

export async function getCurrentAuthState(): Promise<ServiceResult<AuthState>> {
  const { data, error } = await getAuthSession();

  if (error) {
    return { ok: false, error: { message: error.message, code: error.code } };
  }

  if (!data.session?.user) {
    return { ok: true, data: { user: null, session: null, role: null } };
  }

  const user = data.session.user;
  const profileResult = await getProfileByUserId(user.id);

  if (profileResult.error) {
    return { ok: false, error: { message: profileResult.error.message } };
  }

  return {
    ok: true,
    data: {
      user,
      session: data.session,
      role: profileResult.data?.role ?? null,
    },
  };
}

export async function signIn(input: SignInInput): Promise<ServiceResult<AuthState>> {
  const parsed = signInSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: { message: parsed.error.issues[0]?.message ?? 'Invalid credentials' } };
  }

  const { email, password } = parsed.data;
  const { data, error } = await signInWithPassword(email, password);

  if (error) {
    return { ok: false, error: { message: error.message, code: error.code } };
  }

  if (!data.user || !data.session) {
    return { ok: false, error: { message: 'Authentication failed. Please try again.' } };
  }

  const profileResult = await getProfileByUserId(data.user.id);

  if (profileResult.error) {
    return { ok: false, error: { message: profileResult.error.message } };
  }

  const role = profileResult.data?.role ?? null;
  const redirectTo = getDashboardRouteByRole(role);

  await createAuthLog({
    user_id: data.user.id,
    event: 'LOGIN_SUCCESS',
    role,
    ip_address: input.ipAddress ?? null,
    user_agent: input.userAgent ?? null,
  });

  return {
    ok: true,
    data: {
      user: data.user,
      session: data.session,
      role,
      redirectTo,
    },
  };
}

export async function signOut(): Promise<ServiceResult<null>> {
  const { error } = await signOutSession();
  if (error) {
    return { ok: false, error: { message: error.message, code: error.code } };
  }
  return { ok: true, data: null };
}
