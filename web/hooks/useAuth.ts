import { useEffect, useMemo } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { getCurrentAuthState, signIn, signOut } from '@/modules/auth/auth.service';
import { useAuthStore } from '@/stores/auth.store';
import { onAuthStateChange } from '@/repositories/auth.repository';
import type { SignInInput } from '@/modules/auth/auth.types';

export function useAuth() {
  const { user, session, role, isHydrated, setAuth, clearAuth, setHydrated } = useAuthStore();

  const authQuery = useQuery({
    queryKey: ['auth', 'state'],
    queryFn: getCurrentAuthState,
    staleTime: 1000 * 60,
  });

  useEffect(() => {
    if (authQuery.data?.ok) {
      setAuth(authQuery.data.data);
      setHydrated(true);
      return;
    }

    if (authQuery.data && !authQuery.data.ok) {
      clearAuth();
      setHydrated(true);
    }
  }, [authQuery.data, clearAuth, setAuth, setHydrated]);

  useEffect(() => {
    const {
      data: { subscription },
    } = onAuthStateChange(async () => {
      const refreshed = await getCurrentAuthState();
      if (refreshed.ok) {
        setAuth(refreshed.data);
      } else {
        clearAuth();
      }
      setHydrated(true);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [clearAuth, setAuth, setHydrated]);

  const signInMutation = useMutation({
    mutationFn: (input: SignInInput) => signIn(input),
    onSuccess: (result) => {
      if (result.ok) {
        setAuth(result.data);
      }
    },
  });

  const signOutMutation = useMutation({
    mutationFn: () => signOut(),
    onSuccess: (result) => {
      if (result.ok) {
        clearAuth();
      }
    },
  });

  const isLoading = authQuery.isLoading || signInMutation.isPending || signOutMutation.isPending || !isHydrated;

  const error = useMemo(() => {
    if (signInMutation.data && !signInMutation.data.ok) {
      return signInMutation.data.error.message;
    }

    if (authQuery.data && !authQuery.data.ok) {
      return authQuery.data.error.message;
    }

    return null;
  }, [authQuery.data, signInMutation.data]);

  return {
    user,
    session,
    userRole: role,
    isLoading,
    error,
    signIn: async (input: SignInInput) => signInMutation.mutateAsync(input),
    signOut: async () => signOutMutation.mutateAsync(),
  };
}
