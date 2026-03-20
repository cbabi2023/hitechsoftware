-- ============================================================================
-- Billing Completion System
-- Migration: 20260318_011_billing_completion.sql
-- ============================================================================

-- Subjects billing/completion columns
ALTER TABLE public.subjects
  ADD COLUMN IF NOT EXISTS visit_charge NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS service_charge NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS accessories_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS grand_total NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS payment_mode TEXT,
  ADD COLUMN IF NOT EXISTS payment_collected BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payment_collected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bill_generated BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bill_generated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bill_number TEXT;

ALTER TABLE public.subjects
  DROP CONSTRAINT IF EXISTS subjects_payment_mode_chk;

ALTER TABLE public.subjects
  ADD CONSTRAINT subjects_payment_mode_chk CHECK (
    payment_mode IS NULL OR payment_mode IN ('cash', 'upi', 'card', 'cheque')
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'subjects_bill_number_key'
  ) THEN
    CREATE UNIQUE INDEX subjects_bill_number_key ON public.subjects (bill_number) WHERE bill_number IS NOT NULL;
  END IF;
END $$;

-- Accessories table
CREATE TABLE IF NOT EXISTS public.subject_accessories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity >= 1),
  unit_price NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
  total_price NUMERIC(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  added_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subject_accessories_subject_id ON public.subject_accessories(subject_id);
CREATE INDEX IF NOT EXISTS idx_subject_accessories_added_by ON public.subject_accessories(added_by);

-- Bills table
CREATE TABLE IF NOT EXISTS public.subject_bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  bill_number TEXT NOT NULL UNIQUE,
  bill_type TEXT NOT NULL CHECK (bill_type IN ('customer_receipt', 'brand_dealer_invoice')),
  issued_to TEXT NOT NULL,
  issued_to_type TEXT NOT NULL CHECK (issued_to_type IN ('customer', 'brand_dealer')),
  brand_id UUID REFERENCES public.brands(id) ON DELETE SET NULL,
  dealer_id UUID REFERENCES public.dealers(id) ON DELETE SET NULL,
  visit_charge NUMERIC(12,2) NOT NULL DEFAULT 0,
  service_charge NUMERIC(12,2) NOT NULL DEFAULT 0,
  accessories_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  grand_total NUMERIC(12,2) NOT NULL,
  payment_mode TEXT CHECK (payment_mode IN ('cash', 'upi', 'card', 'cheque')),
  payment_status TEXT NOT NULL DEFAULT 'due' CHECK (payment_status IN ('paid', 'due', 'waived')),
  payment_collected_at TIMESTAMPTZ,
  generated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subject_bills_subject_id ON public.subject_bills(subject_id);
CREATE INDEX IF NOT EXISTS idx_subject_bills_brand_id ON public.subject_bills(brand_id) WHERE brand_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_subject_bills_dealer_id ON public.subject_bills(dealer_id) WHERE dealer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_subject_bills_payment_status ON public.subject_bills(payment_status);

-- One bill per subject
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'subject_bills_subject_id_unique'
  ) THEN
    CREATE UNIQUE INDEX subject_bills_subject_id_unique ON public.subject_bills(subject_id);
  END IF;
END $$;

-- Bill number generator
CREATE OR REPLACE FUNCTION public.generate_bill_number()
RETURNS TEXT AS $$
DECLARE
  v_count INT;
  v_year TEXT;
BEGIN
  v_year := TO_CHAR(NOW(), 'YYYY');
  SELECT COUNT(*) + 1 INTO v_count FROM public.subject_bills;
  RETURN 'HT-BILL-' || v_year || '-' || LPAD(v_count::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

-- RLS
ALTER TABLE public.subject_accessories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subject_bills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS subject_accessories_read_all_authenticated ON public.subject_accessories;
DROP POLICY IF EXISTS subject_accessories_insert_assigned_technician ON public.subject_accessories;
DROP POLICY IF EXISTS subject_accessories_delete_assigned_technician ON public.subject_accessories;

CREATE POLICY subject_accessories_read_all_authenticated ON public.subject_accessories
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY subject_accessories_insert_assigned_technician ON public.subject_accessories
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.subjects s
      WHERE s.id = subject_id
        AND s.assigned_technician_id = auth.uid()
        AND s.is_deleted = false
    )
  );

CREATE POLICY subject_accessories_delete_assigned_technician ON public.subject_accessories
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.subjects s
      WHERE s.id = subject_id
        AND s.assigned_technician_id = auth.uid()
        AND s.is_deleted = false
    )
  );

DROP POLICY IF EXISTS subject_bills_read_all_authenticated ON public.subject_bills;
DROP POLICY IF EXISTS subject_bills_insert_staff_or_system ON public.subject_bills;
DROP POLICY IF EXISTS subject_bills_update_payment_staff_admin ON public.subject_bills;

CREATE POLICY subject_bills_read_all_authenticated ON public.subject_bills
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY subject_bills_insert_staff_or_system ON public.subject_bills
  FOR INSERT
  WITH CHECK (
    public.current_user_role() IN ('office_staff', 'super_admin')
    OR EXISTS (
      SELECT 1
      FROM public.subjects s
      WHERE s.id = subject_id
        AND s.assigned_technician_id = auth.uid()
        AND s.is_deleted = false
    )
  );

CREATE POLICY subject_bills_update_payment_staff_admin ON public.subject_bills
  FOR UPDATE
  USING (public.current_user_role() IN ('office_staff', 'super_admin'))
  WITH CHECK (public.current_user_role() IN ('office_staff', 'super_admin'));
