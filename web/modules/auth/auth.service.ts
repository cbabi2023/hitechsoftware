import type { AuthState, SignInInput } from '@/modules/auth/auth.types';
import { signInSchema } from '@/modules/auth/auth.validation';
import {
  getAuthSession,
  getProfileByUserId,
  signInWithPassword,
  signOutSession,
} from '@/repositories/auth.repository';
import type { ServiceResult } from '@/types/common.types';

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

  return {
    ok: true,
    data: {
      user: data.user,
      session: data.session,
      role: profileResult.data?.role ?? null,
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
