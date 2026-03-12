-- Fix RLS recursion on profiles table.
-- Problem: profiles policies used subqueries against profiles itself, causing
-- "infinite recursion detected in policy for relation \"profiles\"".

-- Helper function runs with definer privileges so policy checks can safely
-- resolve the current user's role without recursive policy evaluation.
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.role
  FROM public.profiles p
  WHERE p.id = auth.uid()
    AND p.is_active = true
    AND p.is_deleted = false
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.current_user_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;

DROP POLICY IF EXISTS profiles_super_admin_all ON public.profiles;
DROP POLICY IF EXISTS profiles_self_read ON public.profiles;
DROP POLICY IF EXISTS profiles_staff_read_all ON public.profiles;
DROP POLICY IF EXISTS profiles_self_update ON public.profiles;

CREATE POLICY profiles_super_admin_all ON public.profiles
  FOR ALL
  USING (public.current_user_role() = 'super_admin')
  WITH CHECK (public.current_user_role() = 'super_admin');

CREATE POLICY profiles_self_read ON public.profiles
  FOR SELECT
  USING (id = auth.uid());

CREATE POLICY profiles_staff_read_all ON public.profiles
  FOR SELECT
  USING (public.current_user_role() IN ('office_staff', 'stock_manager', 'super_admin'));

CREATE POLICY profiles_self_update ON public.profiles
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
