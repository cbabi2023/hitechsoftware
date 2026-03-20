-- Add AMC purchase/start date support on subjects.
ALTER TABLE public.subjects
  ADD COLUMN IF NOT EXISTS amc_start_date DATE;

-- Replace helper RPC to accept AMC start date separately from product purchase date.
DROP FUNCTION IF EXISTS public.create_subject_with_customer(
  TEXT, TEXT, UUID, UUID, TEXT, TEXT, DATE, TEXT, UUID,
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, DATE, DATE, DATE, UUID
);

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
  p_amc_start_date DATE,
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
    amc_start_date,
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
    p_amc_start_date,
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

REVOKE ALL ON FUNCTION public.create_subject_with_customer(
  TEXT, TEXT, UUID, UUID, TEXT, TEXT, DATE, TEXT, UUID,
  TEXT, TEXT, TEXT, TEXT, UUID
) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.create_subject_with_customer(
  TEXT, TEXT, UUID, UUID, TEXT, TEXT, DATE, TEXT, UUID,
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, DATE, DATE, DATE, DATE, UUID
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_subject_with_customer(
  TEXT, TEXT, UUID, UUID, TEXT, TEXT, DATE, TEXT, UUID,
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, DATE, DATE, DATE, DATE, UUID
) TO authenticated;
