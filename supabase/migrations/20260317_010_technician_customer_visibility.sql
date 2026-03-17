-- ============================================================================
-- Restrict technician customer visibility to current-day assigned services
-- Migration: 20260317_010_technician_customer_visibility.sql
-- ============================================================================

DROP POLICY IF EXISTS customers_technician_read ON public.customers;

CREATE POLICY customers_technician_read ON public.customers
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.subjects s
      WHERE s.customer_id = customers.id
        AND s.assigned_technician_id = auth.uid()
        AND s.is_deleted = false
        AND s.technician_allocated_date = CURRENT_DATE
    )
  );
