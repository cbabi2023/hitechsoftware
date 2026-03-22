-- ============================================================================
-- Product Inventory Module
-- Migration: 20260322_016_product_inventory.sql
-- Tables: product_categories, product_types, inventory_products, stock_entries, stock_entry_items
-- ============================================================================

-- --------------------------------------------------------------------------
-- Product Categories
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.product_categories (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(150) NOT NULL,
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  is_deleted  BOOLEAN     NOT NULL DEFAULT false,
  created_by  UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_categories_name_unique
  ON public.product_categories (lower(name))
  WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_product_categories_active
  ON public.product_categories (is_active)
  WHERE is_deleted = false;

DROP TRIGGER IF EXISTS trg_product_categories_updated_at ON public.product_categories;
CREATE TRIGGER trg_product_categories_updated_at
  BEFORE UPDATE ON public.product_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS product_categories_read ON public.product_categories;
CREATE POLICY product_categories_read ON public.product_categories
  FOR SELECT TO authenticated
  USING (is_deleted = false);

DROP POLICY IF EXISTS product_categories_write ON public.product_categories;
CREATE POLICY product_categories_write ON public.product_categories
  FOR ALL TO authenticated
  USING (
    public.current_user_role() IN ('super_admin', 'office_staff', 'stock_manager')
  )
  WITH CHECK (
    public.current_user_role() IN ('super_admin', 'office_staff', 'stock_manager')
  );

-- --------------------------------------------------------------------------
-- Product Types
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.product_types (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(150) NOT NULL,
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  is_deleted  BOOLEAN     NOT NULL DEFAULT false,
  created_by  UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_types_name_unique
  ON public.product_types (lower(name))
  WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_product_types_active
  ON public.product_types (is_active)
  WHERE is_deleted = false;

DROP TRIGGER IF EXISTS trg_product_types_updated_at ON public.product_types;
CREATE TRIGGER trg_product_types_updated_at
  BEFORE UPDATE ON public.product_types
  FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

ALTER TABLE public.product_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS product_types_read ON public.product_types;
CREATE POLICY product_types_read ON public.product_types
  FOR SELECT TO authenticated
  USING (is_deleted = false);

DROP POLICY IF EXISTS product_types_write ON public.product_types;
CREATE POLICY product_types_write ON public.product_types
  FOR ALL TO authenticated
  USING (
    public.current_user_role() IN ('super_admin', 'office_staff', 'stock_manager')
  )
  WITH CHECK (
    public.current_user_role() IN ('super_admin', 'office_staff', 'stock_manager')
  );

-- --------------------------------------------------------------------------
-- Inventory Products
-- (Distinct from the service-module `products` table in migration 001, which
--  tracks appliance types for service jobs/warranty/AMC. This table tracks
--  physical stock items by material code for warehouse receiving.)
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.inventory_products (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_name      VARCHAR(255) NOT NULL,
  description       TEXT,
  material_code     VARCHAR(100) NOT NULL,
  category_id       UUID        REFERENCES public.product_categories(id) ON DELETE SET NULL,
  product_type_id   UUID        REFERENCES public.product_types(id) ON DELETE SET NULL,
  is_refurbished    BOOLEAN     NOT NULL DEFAULT false,
  refurbished_label VARCHAR(100),
  hsn_sac_code      VARCHAR(20),
  is_active         BOOLEAN     NOT NULL DEFAULT true,
  is_deleted        BOOLEAN     NOT NULL DEFAULT false,
  created_by        UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_products_material_code_unique
  ON public.inventory_products (upper(material_code))
  WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_inventory_products_category_id
  ON public.inventory_products (category_id)
  WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_inventory_products_product_type_id
  ON public.inventory_products (product_type_id)
  WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_inventory_products_active
  ON public.inventory_products (is_active)
  WHERE is_deleted = false;

DROP TRIGGER IF EXISTS trg_inventory_products_updated_at ON public.inventory_products;
CREATE TRIGGER trg_inventory_products_updated_at
  BEFORE UPDATE ON public.inventory_products
  FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

ALTER TABLE public.inventory_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inventory_products_read ON public.inventory_products;
CREATE POLICY inventory_products_read ON public.inventory_products
  FOR SELECT TO authenticated
  USING (is_deleted = false);

DROP POLICY IF EXISTS inventory_products_write ON public.inventory_products;
CREATE POLICY inventory_products_write ON public.inventory_products
  FOR ALL TO authenticated
  USING (
    public.current_user_role() IN ('super_admin', 'office_staff', 'stock_manager')
  )
  WITH CHECK (
    public.current_user_role() IN ('super_admin', 'office_staff', 'stock_manager')
  );

-- --------------------------------------------------------------------------
-- Stock Entries (invoice-level header)
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.stock_entries (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number  VARCHAR(100) NOT NULL,
  entry_date      DATE        NOT NULL DEFAULT CURRENT_DATE,
  notes           TEXT,
  is_deleted      BOOLEAN     NOT NULL DEFAULT false,
  created_by      UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_entries_entry_date
  ON public.stock_entries (entry_date DESC)
  WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_stock_entries_invoice_number
  ON public.stock_entries (invoice_number)
  WHERE is_deleted = false;

DROP TRIGGER IF EXISTS trg_stock_entries_updated_at ON public.stock_entries;
CREATE TRIGGER trg_stock_entries_updated_at
  BEFORE UPDATE ON public.stock_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

ALTER TABLE public.stock_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS stock_entries_read ON public.stock_entries;
CREATE POLICY stock_entries_read ON public.stock_entries
  FOR SELECT TO authenticated
  USING (is_deleted = false);

DROP POLICY IF EXISTS stock_entries_write ON public.stock_entries;
CREATE POLICY stock_entries_write ON public.stock_entries
  FOR ALL TO authenticated
  USING (
    public.current_user_role() IN ('super_admin', 'office_staff', 'stock_manager')
  )
  WITH CHECK (
    public.current_user_role() IN ('super_admin', 'office_staff', 'stock_manager')
  );

-- --------------------------------------------------------------------------
-- Stock Entry Items (line items per entry)
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.stock_entry_items (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_entry_id  UUID        NOT NULL REFERENCES public.stock_entries(id) ON DELETE CASCADE,
  product_id      UUID        REFERENCES public.inventory_products(id) ON DELETE SET NULL,
  material_code   VARCHAR(100) NOT NULL,
  quantity        INTEGER     NOT NULL CHECK (quantity > 0),
  hsn_sac_code    VARCHAR(20),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_entry_items_entry_id
  ON public.stock_entry_items (stock_entry_id);

CREATE INDEX IF NOT EXISTS idx_stock_entry_items_product_id
  ON public.stock_entry_items (product_id);

ALTER TABLE public.stock_entry_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS stock_entry_items_read ON public.stock_entry_items;
CREATE POLICY stock_entry_items_read ON public.stock_entry_items
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS stock_entry_items_write ON public.stock_entry_items;
CREATE POLICY stock_entry_items_write ON public.stock_entry_items
  FOR ALL TO authenticated
  USING (
    public.current_user_role() IN ('super_admin', 'office_staff', 'stock_manager')
  )
  WITH CHECK (
    public.current_user_role() IN ('super_admin', 'office_staff', 'stock_manager')
  );
