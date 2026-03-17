-- ============================================================================
-- Fix subject audit history inserts under RLS
-- Migration: 20260317_009_fix_subject_history_rls.sql
--
-- Subject update triggers write into public.subject_status_history, but that table
-- only exposes a SELECT policy to the application role. Trigger functions were
-- running with invoker rights, so authenticated updates that changed assignment,
-- status, reschedule date, or priority failed with:
--   new row violates row-level security policy for table "subject_status_history"
--
-- Recreate the audit trigger functions as SECURITY DEFINER so internal audit
-- writes bypass table RLS while keeping the history table read-only to the app.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.log_subject_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.subject_status_history(subject_id, event_type, status, old_value, new_value, changed_by)
    VALUES (NEW.id, 'status_change', NEW.status::text, NULL, NEW.status::text, NEW.created_by);
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.subject_status_history(subject_id, event_type, status, old_value, new_value, changed_by)
    VALUES (
      NEW.id,
      'status_change',
      NEW.status::text,
      OLD.status::text,
      NEW.status::text,
      COALESCE(auth.uid(), NEW.assigned_by, NEW.created_by)
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_subject_assignment_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_tech_name TEXT;
  new_tech_name TEXT;
  evt_type      VARCHAR(40);
BEGIN
  IF NEW.assigned_technician_id IS NOT DISTINCT FROM OLD.assigned_technician_id THEN
    RETURN NEW;
  END IF;

  IF OLD.assigned_technician_id IS NOT NULL THEN
    SELECT display_name INTO old_tech_name
    FROM public.profiles
    WHERE id = OLD.assigned_technician_id;
  END IF;

  IF NEW.assigned_technician_id IS NOT NULL THEN
    SELECT display_name INTO new_tech_name
    FROM public.profiles
    WHERE id = NEW.assigned_technician_id;
  END IF;

  evt_type := CASE
    WHEN OLD.assigned_technician_id IS NULL THEN 'assignment'
    WHEN NEW.assigned_technician_id IS NULL THEN 'unassignment'
    ELSE 'reassignment'
  END;

  INSERT INTO public.subject_status_history(subject_id, event_type, status, old_value, new_value, changed_by)
  VALUES (
    NEW.id,
    evt_type,
    COALESCE(new_tech_name, 'Unassigned'),
    old_tech_name,
    new_tech_name,
    COALESCE(auth.uid(), NEW.assigned_by, NEW.created_by)
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_subject_reschedule()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.allocated_date IS NOT DISTINCT FROM OLD.allocated_date THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.subject_status_history(subject_id, event_type, status, old_value, new_value, changed_by)
  VALUES (
    NEW.id,
    'reschedule',
    'RESCHEDULED',
    OLD.allocated_date::text,
    NEW.allocated_date::text,
    COALESCE(auth.uid(), NEW.created_by)
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_subject_priority_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.priority IS NOT DISTINCT FROM OLD.priority THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.subject_status_history(subject_id, event_type, status, old_value, new_value, changed_by)
  VALUES (
    NEW.id,
    'priority_change',
    NEW.priority,
    OLD.priority,
    NEW.priority,
    COALESCE(auth.uid(), NEW.created_by)
  );

  RETURN NEW;
END;
$$;