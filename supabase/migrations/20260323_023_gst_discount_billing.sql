-- Migration 023: GST calculation and per-product discount support
-- MRP is always GST-inclusive. System splits into base_price + gst_amount via /1.18.
-- Discounts (percentage or flat) are applied BEFORE GST split.
-- GST rate: 18% hardcoded.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. ALTER subject_accessories to add GST/discount columns
-- ─────────────────────────────────────────────────────────────────────────────

-- First drop the existing generated column total_price (will be recreated as line_total)
ALTER TABLE public.subject_accessories DROP COLUMN IF EXISTS total_price;

-- Rename unit_price → mrp (MRP is GST-inclusive)
ALTER TABLE public.subject_accessories RENAME COLUMN unit_price TO mrp;

-- Add discount columns
ALTER TABLE public.subject_accessories
  ADD COLUMN discount_type TEXT NOT NULL DEFAULT 'percentage' CHECK (discount_type IN ('percentage', 'flat')),
  ADD COLUMN discount_value NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (discount_value >= 0);

-- Add generated columns for GST calculations
-- discount_amount: how much discount in rupees
ALTER TABLE public.subject_accessories
  ADD COLUMN discount_amount NUMERIC(12,2) GENERATED ALWAYS AS (
    CASE
      WHEN discount_type = 'percentage' THEN ROUND(mrp * discount_value / 100, 2)
      ELSE LEAST(discount_value, mrp)
    END
  ) STORED;

-- discounted_mrp: MRP after discount
ALTER TABLE public.subject_accessories
  ADD COLUMN discounted_mrp NUMERIC(12,2) GENERATED ALWAYS AS (
    CASE
      WHEN discount_type = 'percentage' THEN ROUND(mrp - (mrp * discount_value / 100), 2)
      ELSE GREATEST(mrp - discount_value, 0)
    END
  ) STORED;

-- base_price: price excluding GST (per unit)
ALTER TABLE public.subject_accessories
  ADD COLUMN base_price NUMERIC(12,2) GENERATED ALWAYS AS (
    ROUND(
      CASE
        WHEN discount_type = 'percentage' THEN (mrp - (mrp * discount_value / 100)) / 1.18
        ELSE GREATEST(mrp - discount_value, 0) / 1.18
      END
    , 2)
  ) STORED;

-- gst_amount: GST per unit (18%)
ALTER TABLE public.subject_accessories
  ADD COLUMN gst_amount NUMERIC(12,2) GENERATED ALWAYS AS (
    ROUND(
      CASE
        WHEN discount_type = 'percentage' THEN (mrp - (mrp * discount_value / 100)) - ((mrp - (mrp * discount_value / 100)) / 1.18)
        ELSE GREATEST(mrp - discount_value, 0) - (GREATEST(mrp - discount_value, 0) / 1.18)
      END
    , 2)
  ) STORED;

-- line_total: total for this line item (qty * discounted_mrp)
ALTER TABLE public.subject_accessories
  ADD COLUMN line_total NUMERIC(12,2) GENERATED ALWAYS AS (
    quantity * CASE
      WHEN discount_type = 'percentage' THEN ROUND(mrp - (mrp * discount_value / 100), 2)
      ELSE GREATEST(mrp - discount_value, 0)
    END
  ) STORED;

-- line_base_total: total base price for this line (qty * base_price)
ALTER TABLE public.subject_accessories
  ADD COLUMN line_base_total NUMERIC(12,2) GENERATED ALWAYS AS (
    quantity * ROUND(
      CASE
        WHEN discount_type = 'percentage' THEN (mrp - (mrp * discount_value / 100)) / 1.18
        ELSE GREATEST(mrp - discount_value, 0) / 1.18
      END
    , 2)
  ) STORED;

-- line_gst_total: total GST for this line (qty * gst_amount)
ALTER TABLE public.subject_accessories
  ADD COLUMN line_gst_total NUMERIC(12,2) GENERATED ALWAYS AS (
    quantity * ROUND(
      CASE
        WHEN discount_type = 'percentage' THEN (mrp - (mrp * discount_value / 100)) - ((mrp - (mrp * discount_value / 100)) / 1.18)
        ELSE GREATEST(mrp - discount_value, 0) - (GREATEST(mrp - discount_value, 0) / 1.18)
      END
    , 2)
  ) STORED;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Add GST breakdown columns to subject_bills
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.subject_bills
  ADD COLUMN IF NOT EXISTS total_base_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_gst_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_discount NUMERIC(12,2) NOT NULL DEFAULT 0;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. calculate_bill_totals function
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.calculate_bill_totals(p_subject_id UUID)
RETURNS TABLE (
  accessories_line_total NUMERIC,
  accessories_base_total NUMERIC,
  accessories_gst_total NUMERIC,
  accessories_discount_total NUMERIC
) LANGUAGE sql STABLE AS $$
  SELECT
    COALESCE(SUM(line_total), 0),
    COALESCE(SUM(line_base_total), 0),
    COALESCE(SUM(line_gst_total), 0),
    COALESCE(SUM(quantity * discount_amount), 0)
  FROM public.subject_accessories
  WHERE subject_id = p_subject_id;
$$;
