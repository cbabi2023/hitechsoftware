import type { Session, User } from '@supabase/supabase-js';
import type { UserRole } from '@/types/database.types';

export interface SignInInput {
  email: string;
  password: string;
}

export interface AuthState {
  user: User | null;
  session: Session | null;
  role: UserRole | null;
}
