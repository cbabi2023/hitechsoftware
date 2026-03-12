import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import type { UserRole } from '@/types/database.types';

interface AuthStoreState {
  user: User | null;
  session: Session | null;
  role: UserRole | null;
  isHydrated: boolean;
  setAuth: (payload: { user: User | null; session: Session | null; role: UserRole | null }) => void;
  clearAuth: () => void;
  setHydrated: (value: boolean) => void;
}

export const useAuthStore = create<AuthStoreState>((set) => ({
  user: null,
  session: null,
  role: null,
  isHydrated: false,
  setAuth: ({ user, session, role }) => set({ user, session, role }),
  clearAuth: () => set({ user: null, session: null, role: null }),
  setHydrated: (value) => set({ isHydrated: value }),
}));
