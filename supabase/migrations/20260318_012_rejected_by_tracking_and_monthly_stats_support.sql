-- ============================================================================
-- Track Rejected-By Technician for Service Analytics
-- Migration: 20260318_012_rejected_by_tracking_and_monthly_stats_support.sql
--
-- Adds explicit linkage between a rejected subject and the technician who
-- rejected it. This enables accurate reporting even after reassignment.
-- ============================================================================

ALTER TABLE public.subjects
  ADD COLUMN IF NOT EXISTS rejected_by_technician_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_subjects_rejected_by_technician
  ON public.subjects(rejected_by_technician_id)
  WHERE rejected_by_technician_id IS NOT NULL;
