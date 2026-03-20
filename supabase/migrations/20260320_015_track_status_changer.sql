-- ============================================================================
-- Track actual user making status changes for accurate audit history
-- Migration: 20260320_015_track_status_changer.sql
-- ============================================================================

-- Add column to track who actually made the status change (set by application before update)
ALTER TABLE public.subjects
  ADD COLUMN IF NOT EXISTS status_changed_by_id UUID;

-- Update the trigger to use status_changed_by_id if available before falling back to auth.uid()
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
      COALESCE(NEW.status_changed_by_id, auth.uid(), NEW.assigned_by, NEW.created_by)
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Clear status_changed_by_id after each update to prevent reuse
CREATE OR REPLACE FUNCTION public.clear_status_changer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.subjects
  SET status_changed_by_id = NULL
  WHERE id = NEW.id
  AND status_changed_by_id IS NOT NULL;
  
  RETURN NEW;
END;
$$;

-- Create trigger to clear the column after status change
DROP TRIGGER IF EXISTS trg_clear_status_changer ON public.subjects;
CREATE TRIGGER trg_clear_status_changer
  AFTER UPDATE ON public.subjects
  FOR EACH ROW
  WHEN (NEW.status IS DISTINCT FROM OLD.status)
  EXECUTE FUNCTION public.clear_status_changer();

-- ============================================================================
-- Notes
-- ============================================================================
-- This allows the API to set status_changed_by_id before updating the status.
-- The trigger will then use this value for the audit history instead of auth.uid().
-- After the update, the trigger clears the column so it's ready for the next change.
--
-- Working flow:
-- 1. API calls: UPDATE subjects SET status_changed_by_id = '{tech_id}', status = 'ARRIVED' WHERE id = '{subject_id}'
-- 2. Trigger reads NEW.status_changed_by_id and records it in subject_status_history.changed_by
-- 3. Cleanup trigger clears status_changed_by_id for next update
