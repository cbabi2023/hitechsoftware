'use client';

import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentAuthState } from '@/modules/auth/auth.service';
import { onAuthStateChange } from '@/repositories/auth.repository';
import { useAuthStore } from '@/stores/auth.store';
import { ROUTES } from '@/lib/constants/routes';

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const router = useRouter();
  const { setAuth, clearAuth, setHydrated } = useAuthStore();

  useEffect(() => {
    const {
      data: { subscription },
    } = onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        clearAuth();
        setHydrated(true);
        router.push(ROUTES.LOGIN);
        return;
      }

      if (event === 'TOKEN_REFRESHED' && session) {
        const refreshed = await getCurrentAuthState();
        if (refreshed.ok) {
          setAuth({
            user: refreshed.data.user,
            session: refreshed.data.session,
            role: refreshed.data.role,
          });
          setHydrated(true);
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [clearAuth, router, setAuth, setHydrated]);

  return <>{children}</>;
}
