import { useEffect, useMemo } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { getCurrentAuthState, signIn, signOut } from '@/modules/auth/auth.service';
import { useAuthStore } from '@/stores/auth.store';
import type { SignInInput } from '@/modules/auth/auth.types';

export function useAuth() {
  const { user, session, role, isHydrated, setAuth, clearAuth, setHydrated } = useAuthStore();
  const queryClient = useQueryClient();

  const authQuery = useQuery({
    queryKey: ['auth', 'state'],
    queryFn: getCurrentAuthState,
    staleTime: 1000 * 60,
  });

  const signInMutation = useMutation({
    mutationFn: (input: SignInInput) => signIn(input),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['auth', 'state'] });
    },
    onSuccess: (result) => {
      if (result.ok) {
        setAuth({
          user: result.data.user,
          session: result.data.session,
          role: result.data.role,
        });
        setHydrated(true);
        queryClient.setQueryData(['auth', 'state'], result);
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ['auth', 'state'] });
    },
  });

  const signOutMutation = useMutation({
    mutationFn: () => signOut(),
    onSuccess: (result) => {
      if (result.ok) {
        clearAuth();
        setHydrated(true);
        queryClient.setQueryData(['auth', 'state'], { ok: true, data: { user: null, session: null, role: null } });
      }
    },
  });

  useEffect(() => {
    if (signInMutation.isPending) {
      return;
    }

    if (authQuery.data?.ok) {
      if (signInMutation.isSuccess && user && authQuery.data.data.user === null) {
        return;
      }

      setAuth({
        user: authQuery.data.data.user,
        session: authQuery.data.data.session,
        role: authQuery.data.data.role,
      });
      setHydrated(true);
      return;
    }

    if (authQuery.data && !authQuery.data.ok) {
      clearAuth();
      setHydrated(true);
    }
  }, [authQuery.data, clearAuth, setAuth, setHydrated, signInMutation.isPending, signInMutation.isSuccess, user]);

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
