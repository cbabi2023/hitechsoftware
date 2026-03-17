-- ============================================================================
-- Job Workflow & Completion System
-- Migration: 20260317_010_job_workflow.sql
--
-- Adds complete job status workflow tracking, photo uploads, and job completion
-- proof system for the Service Module. Technicians track: en_route → arrived →
-- work_started → completed/incomplete. Requires proof photos before completion.
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. Job workflow timestamps and status tracking
-- --------------------------------------------------------------------------

ALTER TABLE public.subjects
  ADD COLUMN IF NOT EXISTS en_route_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS arrived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS work_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS incomplete_at TIMESTAMPTZ;

-- --------------------------------------------------------------------------
-- 2. Incomplete job reason and details
-- --------------------------------------------------------------------------

ALTER TABLE public.subjects
  ADD COLUMN IF NOT EXISTS incomplete_reason VARCHAR(40),
  ADD COLUMN IF NOT EXISTS incomplete_note TEXT,
  ADD COLUMN IF NOT EXISTS spare_parts_requested TEXT,
  ADD COLUMN IF NOT EXISTS spare_parts_quantity INT;

ALTER TABLE public.subjects
  DROP CONSTRAINT IF EXISTS subjects_incomplete_reason_chk;

ALTER TABLE public.subjects
  ADD CONSTRAINT subjects_incomplete_reason_chk CHECK (
    incomplete_reason IS NULL OR incomplete_reason IN (
      'customer_cannot_afford',
      'power_issue',
      'door_locked',
      'spare_parts_not_available',
      'site_not_ready',
      'other'
    )
  );

-- Sparse index for incomplete jobs
CREATE INDEX IF NOT EXISTS idx_subjects_incomplete_reason
  ON public.subjects(incomplete_reason)
  WHERE incomplete_reason IS NOT NULL;

-- --------------------------------------------------------------------------
-- 3. Job completion proof and rescheduling
-- --------------------------------------------------------------------------

ALTER TABLE public.subjects
  ADD COLUMN IF NOT EXISTS completion_proof_uploaded BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS completion_notes TEXT,
  ADD COLUMN IF NOT EXISTS rescheduled_date DATE;

-- --------------------------------------------------------------------------
-- 4. Subject Photos table — stores all uploaded proof/documentation photos
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.subject_photos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  photo_type VARCHAR(40) NOT NULL,
  storage_path TEXT NOT NULL UNIQUE,
  public_url TEXT NOT NULL,
  uploaded_by UUID REFERENCES public.auth.users(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  file_size_bytes INT,
  mime_type VARCHAR(100),
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enforce photo_type values
ALTER TABLE public.subject_photos
  ADD CONSTRAINT subject_photos_photo_type_chk CHECK (
    photo_type IN (
      'serial_number',
      'machine',
      'bill',
      'job_sheet',
      'defective_part',
      'site_photo_1',
      'site_photo_2',
      'site_photo_3',
      'service_video'
    )
  );

-- Indexes for quick lookup
CREATE INDEX IF NOT EXISTS idx_subject_photos_subject_id
  ON public.subject_photos(subject_id)
  WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_subject_photos_subject_type
  ON public.subject_photos(subject_id, photo_type)
  WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_subject_photos_uploaded_by
  ON public.subject_photos(uploaded_by)
  WHERE is_deleted = false;

-- --------------------------------------------------------------------------
-- 5. RLS Policies for subject_photos
-- --------------------------------------------------------------------------

ALTER TABLE public.subject_photos ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view photos
DROP POLICY IF EXISTS subject_photos_read_authenticated ON public.subject_photos;
CREATE POLICY subject_photos_read_authenticated ON public.subject_photos
  FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND is_deleted = false
  );

-- Technicians can upload photos to their assigned subjects only
DROP POLICY IF EXISTS subject_photos_technician_insert ON public.subject_photos;
CREATE POLICY subject_photos_technician_insert ON public.subject_photos
  FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.subjects
      WHERE subjects.id = subject_photos.subject_id
        AND subjects.assigned_technician_id = auth.uid()
        AND subjects.is_deleted = false
    )
  );

-- Technicians can delete their own photos
DROP POLICY IF EXISTS subject_photos_technician_delete ON public.subject_photos;
CREATE POLICY subject_photos_technician_delete ON public.subject_photos
  FOR DELETE
  USING (
    uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.subjects
      WHERE subjects.id = subject_photos.subject_id
        AND subjects.assigned_technician_id = auth.uid()
        AND subjects.is_deleted = false
    )
  );

-- --------------------------------------------------------------------------
-- 6. Job status transition logging via existing trigger
--
--    The trg_subject_status_history_upd trigger already logs status changes.
--    No additional trigger needed; timestamps are set on UPDATE in the app.
-- --------------------------------------------------------------------------

-- Grants for Supabase replication and storage
GRANT SELECT, INSERT, DELETE ON public.subject_photos TO authenticated;
GRANT SELECT ON public.subject_photos TO service_role;
