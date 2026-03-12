export type UserRole = 'super_admin' | 'office_staff' | 'stock_manager' | 'technician';

export interface ProfileRow {
  id: string;
  email: string;
  display_name: string;
  phone_number: string | null;
  role: UserRole;
  is_active: boolean;
  is_deleted: boolean;
  created_at?: string;
  updated_at?: string;
}
