-- ============================================================================
-- Service Module Core (Master Data + Subjects Enhancements)
-- Migration: 20260314_006_service_module.sql
-- ============================================================================

-- Keep role helper available.
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

-- --------------------------------------------------------------------------
-- Master Tables
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.service_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.dealers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_categories_active ON public.service_categories(is_active);
CREATE INDEX IF NOT EXISTS idx_brands_active ON public.brands(is_active);
CREATE INDEX IF NOT EXISTS idx_dealers_active ON public.dealers(is_active);

DROP TRIGGER IF EXISTS trg_service_categories_updated_at ON public.service_categories;
CREATE TRIGGER trg_service_categories_updated_at
BEFORE UPDATE ON public.service_categories
FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

DROP TRIGGER IF EXISTS trg_brands_updated_at ON public.brands;
CREATE TRIGGER trg_brands_updated_at
BEFORE UPDATE ON public.brands
FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

DROP TRIGGER IF EXISTS trg_dealers_updated_at ON public.dealers;
CREATE TRIGGER trg_dealers_updated_at
BEFORE UPDATE ON public.dealers
FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

INSERT INTO public.service_categories (name)
VALUES
  ('AC'),
  ('Washing Machine'),
  ('Dishwasher'),
  ('Microwave'),
  ('Refrigerator'),
  ('TV'),
  ('Water Heater'),
  ('Other')
ON CONFLICT (name) DO NOTHING;

-- --------------------------------------------------------------------------
-- Subjects Table Enhancements
-- --------------------------------------------------------------------------

ALTER TABLE public.subjects
  DROP CONSTRAINT IF EXISTS subjects_subject_number_key;

ALTER TABLE public.subjects
  ALTER COLUMN customer_id DROP NOT NULL;

ALTER TABLE public.subjects
  ADD COLUMN IF NOT EXISTS source_type VARCHAR(10),
  ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES public.brands(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS dealer_id UUID REFERENCES public.dealers(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS priority VARCHAR(10),
  ADD COLUMN IF NOT EXISTS priority_reason TEXT,
  ADD COLUMN IF NOT EXISTS allocated_date DATE NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS type_of_service VARCHAR(20),
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.service_categories(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(20),
  ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS customer_address TEXT,
  ADD COLUMN IF NOT EXISTS product_name TEXT,
  ADD COLUMN IF NOT EXISTS product_description TEXT,
  ADD COLUMN IF NOT EXISTS purchase_date DATE,
  ADD COLUMN IF NOT EXISTS warranty_end_date DATE,
  ADD COLUMN IF NOT EXISTS amc_end_date DATE,
  ADD COLUMN IF NOT EXISTS service_charge_type TEXT DEFAULT 'customer',
  ADD COLUMN IF NOT EXISTS is_amc_service BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_warranty_service BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS billing_status TEXT DEFAULT 'not_applicable',
  ADD COLUMN IF NOT EXISTS product_details TEXT,
  ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.subjects
  ADD COLUMN IF NOT EXISTS serial_number TEXT;

ALTER TABLE public.subjects
  DROP CONSTRAINT IF EXISTS subjects_source_type_chk;

ALTER TABLE public.subjects
  ADD CONSTRAINT subjects_source_type_chk
  CHECK (source_type IN ('brand', 'dealer'));

ALTER TABLE public.subjects
  DROP CONSTRAINT IF EXISTS subjects_priority_chk;

ALTER TABLE public.subjects
  ADD CONSTRAINT subjects_priority_chk
  CHECK (priority IN ('critical', 'high', 'medium', 'low'));

ALTER TABLE public.subjects
  DROP CONSTRAINT IF EXISTS subjects_type_of_service_chk;

ALTER TABLE public.subjects
  ADD CONSTRAINT subjects_type_of_service_chk
  CHECK (type_of_service IN ('installation', 'service'));

ALTER TABLE public.subjects
  DROP CONSTRAINT IF EXISTS subjects_source_reference_chk;

ALTER TABLE public.subjects
  ADD CONSTRAINT subjects_source_reference_chk
  CHECK (
    (
      source_type = 'brand'
      AND brand_id IS NOT NULL
      AND dealer_id IS NULL
    )
    OR
    (
      source_type = 'dealer'
      AND dealer_id IS NOT NULL
      AND brand_id IS NULL
    )
  );

ALTER TABLE public.subjects
  DROP CONSTRAINT IF EXISTS subjects_service_charge_type_chk;

ALTER TABLE public.subjects
  ADD CONSTRAINT subjects_service_charge_type_chk
  CHECK (service_charge_type IN ('customer', 'brand_dealer'));

ALTER TABLE public.subjects
  DROP CONSTRAINT IF EXISTS subjects_billing_status_chk;

ALTER TABLE public.subjects
  ADD CONSTRAINT subjects_billing_status_chk
  CHECK (billing_status IN ('not_applicable', 'due', 'partially_paid', 'paid', 'waived'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_subjects_subject_number_per_brand
ON public.subjects(subject_number, brand_id)
WHERE brand_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_subjects_subject_number_per_dealer
ON public.subjects(subject_number, dealer_id)
WHERE dealer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subjects_priority_new ON public.subjects(priority);
CREATE INDEX IF NOT EXISTS idx_subjects_source_type_new ON public.subjects(source_type);
CREATE INDEX IF NOT EXISTS idx_subjects_category_id_new ON public.subjects(category_id);
CREATE INDEX IF NOT EXISTS idx_subjects_brand_id_new ON public.subjects(brand_id);
CREATE INDEX IF NOT EXISTS idx_subjects_dealer_id_new ON public.subjects(dealer_id);
CREATE INDEX IF NOT EXISTS idx_subjects_customer_phone_new ON public.subjects(customer_phone);

CREATE OR REPLACE FUNCTION public.apply_subject_warranty_amc_logic()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.amc_end_date IS NOT NULL AND NEW.amc_end_date >= CURRENT_DATE THEN
    NEW.is_amc_service := true;
    NEW.is_warranty_service := false;
    NEW.service_charge_type := 'brand_dealer';
    NEW.billing_status := 'due';
  ELSIF NEW.warranty_end_date IS NOT NULL AND NEW.warranty_end_date >= CURRENT_DATE THEN
    NEW.is_amc_service := false;
    NEW.is_warranty_service := true;
    NEW.service_charge_type := 'brand_dealer';
    NEW.billing_status := 'due';
  ELSE
    NEW.is_amc_service := false;
    NEW.is_warranty_service := false;
    NEW.service_charge_type := 'customer';
    NEW.billing_status := 'not_applicable';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_subject_apply_warranty_amc_logic ON public.subjects;
CREATE TRIGGER trg_subject_apply_warranty_amc_logic
BEFORE INSERT OR UPDATE ON public.subjects
FOR EACH ROW EXECUTE FUNCTION public.apply_subject_warranty_amc_logic();

-- --------------------------------------------------------------------------
-- Subject Status History (timeline)
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.subject_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  status VARCHAR(40) NOT NULL,
  changed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  note TEXT
);

CREATE INDEX IF NOT EXISTS idx_subject_status_history_subject_id ON public.subject_status_history(subject_id, changed_at DESC);

CREATE OR REPLACE FUNCTION public.log_subject_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.subject_status_history(subject_id, status, changed_by)
    VALUES (NEW.id, NEW.status::text, NEW.created_by);
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.subject_status_history(subject_id, status, changed_by)
    VALUES (NEW.id, NEW.status::text, COALESCE(NEW.assigned_by, NEW.created_by));
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_subject_status_history_ins ON public.subjects;
CREATE TRIGGER trg_subject_status_history_ins
AFTER INSERT ON public.subjects
FOR EACH ROW EXECUTE FUNCTION public.log_subject_status_change();

DROP TRIGGER IF EXISTS trg_subject_status_history_upd ON public.subjects;
CREATE TRIGGER trg_subject_status_history_upd
AFTER UPDATE OF status ON public.subjects
FOR EACH ROW EXECUTE FUNCTION public.log_subject_status_change();

-- --------------------------------------------------------------------------
-- Transactional helper for subject + optional customer creation
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_subject_with_customer(
  p_subject_number TEXT,
  p_source_type TEXT,
  p_brand_id UUID,
  p_dealer_id UUID,
  p_priority TEXT,
  p_priority_reason TEXT,
  p_allocated_date DATE,
  p_type_of_service TEXT,
  p_category_id UUID,
  p_customer_phone TEXT,
  p_customer_name TEXT,
  p_customer_address TEXT,
  p_product_name TEXT,
  p_serial_number TEXT,
  p_product_description TEXT,
  p_purchase_date DATE,
  p_warranty_end_date DATE,
  p_amc_end_date DATE,
  p_created_by UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id UUID;
  v_subject_id UUID;
  v_clean_phone TEXT;
  v_customer_name TEXT;
  v_customer_address TEXT;
BEGIN
  v_clean_phone := NULLIF(TRIM(COALESCE(p_customer_phone, '')), '');
  v_customer_name := NULLIF(TRIM(COALESCE(p_customer_name, '')), '');
  v_customer_address := NULLIF(TRIM(COALESCE(p_customer_address, '')), '');

  IF v_clean_phone IS NOT NULL THEN
    SELECT c.id
      INTO v_customer_id
      FROM public.customers c
     WHERE c.phone_number = v_clean_phone
       AND c.is_deleted = false
     LIMIT 1;

    IF v_customer_id IS NULL THEN
      INSERT INTO public.customers (
        customer_name,
        phone_number,
        email,
        address,
        city,
        postal_code,
        is_active,
        is_deleted,
        primary_address_line1,
        primary_address_line2,
        primary_area,
        primary_city,
        primary_postal_code,
        secondary_address_label,
        secondary_address_line1,
        secondary_address_line2,
        secondary_area,
        secondary_city,
        secondary_postal_code
      )
      VALUES (
        COALESCE(v_customer_name, 'Unknown Customer'),
        v_clean_phone,
        NULL,
        COALESCE(v_customer_address, 'Address Pending'),
        'Unknown',
        '000000',
        true,
        false,
        COALESCE(v_customer_address, 'Address Pending'),
        NULL,
        'Unknown',
        'Unknown',
        '000000',
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL
      )
      RETURNING id INTO v_customer_id;
    END IF;
  END IF;

  INSERT INTO public.subjects (
    subject_number,
    source_type,
    brand_id,
    dealer_id,
    priority,
    priority_reason,
    allocated_date,
    type_of_service,
    category_id,
    customer_id,
    customer_phone,
    customer_name,
    customer_address,
    product_name,
    serial_number,
    product_description,
    purchase_date,
    warranty_end_date,
    amc_end_date,
    status,
    created_by,
    description,
    job_type,
    is_active,
    is_deleted
  )
  VALUES (
    TRIM(p_subject_number),
    p_source_type,
    p_brand_id,
    p_dealer_id,
    p_priority,
    p_priority_reason,
    COALESCE(p_allocated_date, CURRENT_DATE),
    p_type_of_service,
    p_category_id,
    v_customer_id,
    v_clean_phone,
    v_customer_name,
    v_customer_address,
    NULLIF(TRIM(COALESCE(p_product_name, '')), ''),
    NULLIF(TRIM(COALESCE(p_serial_number, '')), ''),
    NULLIF(TRIM(COALESCE(p_product_description, '')), ''),
    p_purchase_date,
    p_warranty_end_date,
    p_amc_end_date,
    'PENDING',
    p_created_by,
    COALESCE(NULLIF(TRIM(COALESCE(p_priority_reason, '')), ''), 'Service subject created'),
    'OUT_OF_WARRANTY',
    true,
    false
  )
  RETURNING id INTO v_subject_id;

  RETURN v_subject_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_subject_with_customer(TEXT, TEXT, UUID, UUID, TEXT, TEXT, DATE, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_subject_with_customer(TEXT, TEXT, UUID, UUID, TEXT, TEXT, DATE, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, DATE, DATE, DATE, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_subject_with_customer(TEXT, TEXT, UUID, UUID, TEXT, TEXT, DATE, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, DATE, DATE, DATE, UUID) TO authenticated;

-- --------------------------------------------------------------------------
-- RLS Policies
-- --------------------------------------------------------------------------

ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dealers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subject_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_categories_read_all ON public.service_categories;
DROP POLICY IF EXISTS service_categories_super_admin_manage ON public.service_categories;
CREATE POLICY service_categories_read_all ON public.service_categories
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY service_categories_super_admin_manage ON public.service_categories
  FOR ALL USING (public.current_user_role() = 'super_admin')
  WITH CHECK (public.current_user_role() = 'super_admin');

DROP POLICY IF EXISTS brands_read_all ON public.brands;
DROP POLICY IF EXISTS brands_super_admin_manage ON public.brands;
CREATE POLICY brands_read_all ON public.brands
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY brands_super_admin_manage ON public.brands
  FOR ALL USING (public.current_user_role() = 'super_admin')
  WITH CHECK (public.current_user_role() = 'super_admin');

DROP POLICY IF EXISTS dealers_read_all ON public.dealers;
DROP POLICY IF EXISTS dealers_super_admin_manage ON public.dealers;
CREATE POLICY dealers_read_all ON public.dealers
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY dealers_super_admin_manage ON public.dealers
  FOR ALL USING (public.current_user_role() = 'super_admin')
  WITH CHECK (public.current_user_role() = 'super_admin');

DROP POLICY IF EXISTS subject_status_history_read_all ON public.subject_status_history;
CREATE POLICY subject_status_history_read_all ON public.subject_status_history
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS subjects_super_admin_all ON public.subjects;
DROP POLICY IF EXISTS subjects_staff_all ON public.subjects;
DROP POLICY IF EXISTS subjects_technician_own ON public.subjects;
DROP POLICY IF EXISTS subjects_technician_update_own ON public.subjects;
DROP POLICY IF EXISTS subjects_read_all_authenticated ON public.subjects;
DROP POLICY IF EXISTS subjects_read_non_technicians ON public.subjects;
DROP POLICY IF EXISTS subjects_read_technician_assigned_only ON public.subjects;
DROP POLICY IF EXISTS subjects_create_staff_admin ON public.subjects;
DROP POLICY IF EXISTS subjects_update_staff_admin ON public.subjects;
DROP POLICY IF EXISTS subjects_delete_super_admin ON public.subjects;

CREATE POLICY subjects_read_non_technicians ON public.subjects
  FOR SELECT USING (public.current_user_role() IN ('super_admin', 'office_staff', 'stock_manager'));

CREATE POLICY subjects_read_technician_assigned_only ON public.subjects
  FOR SELECT USING (
    public.current_user_role() = 'technician'
    AND assigned_technician_id = auth.uid()
  );

CREATE POLICY subjects_create_staff_admin ON public.subjects
  FOR INSERT WITH CHECK (public.current_user_role() IN ('super_admin', 'office_staff'));

CREATE POLICY subjects_update_staff_admin ON public.subjects
  FOR UPDATE USING (public.current_user_role() IN ('super_admin', 'office_staff'))
  WITH CHECK (public.current_user_role() IN ('super_admin', 'office_staff'));

CREATE POLICY subjects_delete_super_admin ON public.subjects
  FOR DELETE USING (public.current_user_role() = 'super_admin');
