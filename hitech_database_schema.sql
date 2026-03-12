-- ============================================================================
-- HITECH SOFTWARE SERVICE MANAGEMENT SYSTEM
-- Complete PostgreSQL Schema for Supabase
-- Production-Ready | 3NF Normalized | Optimized for 3K calls/month
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- SECTION 1: ENUMS (All Status Fields)
-- ============================================================================

-- User Roles
CREATE TYPE user_role AS ENUM ('super_admin', 'office_staff', 'stock_manager', 'technician');

-- Subject (Service Ticket) Status Flow
CREATE TYPE subject_status AS ENUM (
  'PENDING',
  'ALLOCATED',
  'ACCEPTED',
  'IN_PROGRESS',
  'COMPLETED',
  'INCOMPLETE',
  'AWAITING_PARTS',
  'RESCHEDULED'
);

-- Incomplete Visit Reasons
CREATE TYPE incomplete_reason AS ENUM (
  'CUSTOMER_CANNOT_AFFORD',
  'POWER_ELECTRICITY_ISSUE',
  'DOOR_LOCKED_CUSTOMER_UNAVAILABLE',
  'SPARE_PARTS_NOT_AVAILABLE',
  'SITE_NOT_READY',
  'OTHER'
);

-- Warranty Status
CREATE TYPE warranty_status AS ENUM (
  'ACTIVE',
  'EXPIRING_SOON',
  'EXPIRED',
  'RENEWED',
  'CANCELLED'
);

-- AMC Status
CREATE TYPE amc_status AS ENUM (
  'ACTIVE',
  'EXPIRING_SOON',
  'EXPIRED',
  'RENEWED',
  'CANCELLED'
);

-- Brand/Dealer Payment Status
CREATE TYPE payment_status AS ENUM (
  'PENDING',
  'RECEIVED',
  'DISPUTED',
  'WAIVED'
);

-- Attendance Status
CREATE TYPE attendance_status AS ENUM (
  'ON',
  'OFF',
  'LEAVE',
  'ABSENT'
);

-- Payout Status
CREATE TYPE payout_status AS ENUM (
  'PENDING',
  'APPROVED',
  'PAID',
  'REJECTED',
  'DISPUTED'
);

-- Notification Status
CREATE TYPE notification_status AS ENUM (
  'PENDING',
  'SENT',
  'FAILED',
  'RETRYING'
);

-- Job Type
CREATE TYPE job_type AS ENUM (
  'IN_WARRANTY',
  'OUT_OF_WARRANTY',
  'AMC'
);

-- Digital Bag Transaction Type
CREATE TYPE bag_transaction_type AS ENUM (
  'ISSUED',
  'USED',
  'RETURNED',
  'VARIANCE'
);

-- ============================================================================
-- SECTION 2: CORE TABLES
-- ============================================================================

-- 1. PROFILES (User Management & Authentication)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL UNIQUE,
  display_name VARCHAR(255) NOT NULL,
  phone_number VARCHAR(20) UNIQUE,
  role user_role NOT NULL DEFAULT 'technician',
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_phone ON profiles(phone_number);
CREATE INDEX idx_profiles_is_active ON profiles(is_active);

-- 2. CUSTOMERS (Customer Information)
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name VARCHAR(255) NOT NULL,
  phone_number VARCHAR(20) NOT NULL UNIQUE,
  email VARCHAR(255),
  address TEXT NOT NULL,
  city VARCHAR(100) NOT NULL,
  postal_code VARCHAR(20),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_customers_phone ON customers(phone_number);
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_city ON customers(city);
CREATE INDEX idx_customers_location ON customers(latitude, longitude);

-- 3. PRODUCTS (Product Catalog)
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_name VARCHAR(255) NOT NULL,
  product_category VARCHAR(100) NOT NULL,
  brand_name VARCHAR(100) NOT NULL,
  model_number VARCHAR(100) UNIQUE,
  description TEXT,
  default_warranty_months INTEGER,
  default_amc_price DECIMAL(10, 2),
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_products_category ON products(product_category);
CREATE INDEX idx_products_brand ON products(brand_name);
CREATE INDEX idx_products_model ON products(model_number);

-- 4. TECHNICIANS (Technician Management)
CREATE TABLE technicians (
  id UUID PRIMARY KEY REFERENCES profiles ON DELETE CASCADE,
  technician_code VARCHAR(50) UNIQUE NOT NULL,
  qualification VARCHAR(100),
  experience_years INTEGER,
  bank_account_number VARCHAR(50),
  bank_name VARCHAR(100),
  ifsc_code VARCHAR(20),
  daily_subject_limit INTEGER NOT NULL DEFAULT 10,
  digital_bag_capacity INTEGER NOT NULL DEFAULT 50,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_technicians_code ON technicians(technician_code);
CREATE INDEX idx_technicians_is_active ON technicians(is_active);

-- 5. TECHNICIAN_ATTENDANCE (Daily Attendance Tracking)
CREATE TABLE technician_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  technician_id UUID NOT NULL REFERENCES technicians ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  status attendance_status NOT NULL DEFAULT 'OFF',
  time_on TIME,
  time_off TIME,
  leave_reason TEXT,
  is_absent_flagged BOOLEAN NOT NULL DEFAULT false,
  flagged_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_technician_attendance_technician_date ON technician_attendance(technician_id, attendance_date);
CREATE INDEX idx_technician_attendance_date ON technician_attendance(attendance_date);
CREATE UNIQUE INDEX idx_technician_attendance_unique ON technician_attendance(technician_id, attendance_date);

-- 6. SUBJECTS (Service/CRM - Main Service Tickets)
CREATE TABLE subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_number VARCHAR(50) UNIQUE NOT NULL,
  customer_id UUID NOT NULL REFERENCES customers ON DELETE RESTRICT,
  product_id UUID REFERENCES products ON DELETE SET NULL,
  assigned_technician_id UUID REFERENCES technicians ON DELETE SET NULL,
  status subject_status NOT NULL DEFAULT 'PENDING',
  job_type job_type NOT NULL,
  description TEXT NOT NULL,
  complaint_details TEXT,
  serial_number VARCHAR(100),
  schedule_date DATE,
  expected_completion_date DATE,
  actual_completion_date DATE,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  incompletion_reason incomplete_reason,
  incompletion_remarks TEXT,
  rescheduled_reason TEXT,
  rescheduled_date DATE,
  created_by UUID NOT NULL REFERENCES profiles ON DELETE RESTRICT,
  allocated_at TIMESTAMP WITH TIME ZONE,
  accepted_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_subjects_customer_id ON subjects(customer_id);
CREATE INDEX idx_subjects_technician_id ON subjects(assigned_technician_id);
CREATE INDEX idx_subjects_status ON subjects(status);
CREATE INDEX idx_subjects_schedule_date ON subjects(schedule_date);
CREATE INDEX idx_subjects_created_at ON subjects(created_at);
CREATE INDEX idx_subjects_number ON subjects(subject_number);
CREATE INDEX idx_subjects_job_type ON subjects(job_type);

-- 7. WARRANTY (Warranty Records)
CREATE TABLE warranty (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID REFERENCES subjects ON DELETE SET NULL,
  customer_id UUID NOT NULL REFERENCES customers ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products ON DELETE RESTRICT,
  purchase_date DATE NOT NULL,
  warranty_start_date DATE NOT NULL,
  warranty_end_date DATE NOT NULL,
  warranty_months INTEGER NOT NULL,
  status warranty_status NOT NULL DEFAULT 'ACTIVE',
  expiry_notified_30_days BOOLEAN NOT NULL DEFAULT false,
  expiry_notified_15_days BOOLEAN NOT NULL DEFAULT false,
  expiry_notified_7_days BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_warranty_customer_id ON warranty(customer_id);
CREATE INDEX idx_warranty_product_id ON warranty(product_id);
CREATE INDEX idx_warranty_warranty_end_date ON warranty(warranty_end_date);
CREATE INDEX idx_warranty_status ON warranty(status);

-- 8. AMC (Annual Maintenance Contracts)
CREATE TABLE amc (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products ON DELETE RESTRICT,
  amc_start_date DATE NOT NULL,
  amc_end_date DATE NOT NULL,
  amc_duration_months INTEGER NOT NULL,
  amc_price DECIMAL(12, 2) NOT NULL,
  payment_status payment_status NOT NULL DEFAULT 'PENDING',
  status amc_status NOT NULL DEFAULT 'ACTIVE',
  activation_date DATE,
  required_notice_days INTEGER NOT NULL DEFAULT 30,
  expiry_notified_30_days BOOLEAN NOT NULL DEFAULT false,
  expiry_notified_15_days BOOLEAN NOT NULL DEFAULT false,
  expiry_notified_7_days BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_amc_customer_id ON amc(customer_id);
CREATE INDEX idx_amc_product_id ON amc(product_id);
CREATE INDEX idx_amc_amc_end_date ON amc(amc_end_date);
CREATE INDEX idx_amc_status ON amc(status);
CREATE INDEX idx_amc_activation_date ON amc(activation_date);

-- 9. INVENTORY (Inventory Items - Individual Parts/Products for Stock)
CREATE TABLE inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_code VARCHAR(100) UNIQUE NOT NULL,
  item_name VARCHAR(255) NOT NULL,
  item_category VARCHAR(100) NOT NULL,
  description TEXT,
  unit_cost DECIMAL(10, 2) NOT NULL,
  mrp_price DECIMAL(10, 2) NOT NULL,
  reorder_level INTEGER NOT NULL DEFAULT 10,
  supplier_id UUID,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_inventory_code ON inventory(item_code);
CREATE INDEX idx_inventory_category ON inventory(item_category);
CREATE INDEX idx_inventory_is_active ON inventory(is_active);

-- 10. STOCK (Current Stock Levels)
CREATE TABLE stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id UUID NOT NULL REFERENCES inventory ON DELETE CASCADE,
  quantity_on_hand INTEGER NOT NULL DEFAULT 0,
  quantity_reserved INTEGER NOT NULL DEFAULT 0,
  quantity_available INTEGER NOT NULL DEFAULT 0,
  last_stock_date DATE,
  last_counted_date DATE,
  warehouse_location VARCHAR(100),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_stock_inventory_id ON stock(inventory_id);

-- 11. STOCK_TRANSACTIONS (Stock Movement History)
CREATE TABLE stock_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id UUID NOT NULL REFERENCES inventory ON DELETE CASCADE,
  transaction_type VARCHAR(50) NOT NULL,
  quantity INTEGER NOT NULL,
  reference_type VARCHAR(50),
  reference_id UUID,
  notes TEXT,
  created_by UUID REFERENCES profiles ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stock_transactions_inventory_id ON stock_transactions(inventory_id);
CREATE INDEX idx_stock_transactions_created_at ON stock_transactions(created_at);

-- 12. DIGITAL_BAG (Daily Digital Bag per Technician)
CREATE TABLE digital_bag (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  technician_id UUID NOT NULL REFERENCES technicians ON DELETE CASCADE,
  bag_date DATE NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
  total_items_issued INTEGER NOT NULL DEFAULT 0,
  total_items_used INTEGER NOT NULL DEFAULT 0,
  total_items_returned INTEGER NOT NULL DEFAULT 0,
  variance INTEGER NOT NULL DEFAULT 0,
  variance_flagged BOOLEAN NOT NULL DEFAULT false,
  variance_reason TEXT,
  issued_by UUID REFERENCES profiles ON DELETE SET NULL,
  approved_by UUID REFERENCES profiles ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_digital_bag_technician_date ON digital_bag(technician_id, bag_date);
CREATE UNIQUE INDEX idx_digital_bag_unique ON digital_bag(technician_id, bag_date);

-- 13. DIGITAL_BAG_ITEMS (Individual Items in Digital Bag)
CREATE TABLE digital_bag_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  digital_bag_id UUID NOT NULL REFERENCES digital_bag ON DELETE CASCADE,
  inventory_id UUID NOT NULL REFERENCES inventory ON DELETE RESTRICT,
  quantity_issued INTEGER NOT NULL,
  quantity_used INTEGER NOT NULL DEFAULT 0,
  quantity_returned INTEGER NOT NULL DEFAULT 0,
  subject_id UUID REFERENCES subjects ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_digital_bag_items_digital_bag_id ON digital_bag_items(digital_bag_id);
CREATE INDEX idx_digital_bag_items_inventory_id ON digital_bag_items(inventory_id);

-- 14. SUBJECT_MEDIA (Images, Videos, Documents for Subjects)
CREATE TABLE subject_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES subjects ON DELETE CASCADE,
  media_type VARCHAR(50) NOT NULL,
  media_category VARCHAR(100) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  storage_path VARCHAR(500) NOT NULL,
  file_url VARCHAR(500),
  uploaded_by UUID NOT NULL REFERENCES profiles ON DELETE RESTRICT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subject_media_subject_id ON subject_media(subject_id);
CREATE INDEX idx_subject_media_type ON subject_media(media_type);
CREATE INDEX idx_subject_media_created_at ON subject_media(created_at);

-- 15. BILLING (Invoices and Billing)
CREATE TABLE billing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  subject_id UUID NOT NULL REFERENCES subjects ON DELETE RESTRICT,
  customer_id UUID NOT NULL REFERENCES customers ON DELETE RESTRICT,
  technician_id UUID REFERENCES technicians ON DELETE SET NULL,
  invoice_date DATE NOT NULL,
  due_date DATE,
  total_amount DECIMAL(12, 2) NOT NULL,
  tax_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  grand_total DECIMAL(12, 2) NOT NULL,
  amount_paid DECIMAL(12, 2) NOT NULL DEFAULT 0,
  amount_due DECIMAL(12, 2) NOT NULL,
  payment_status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  is_sent_to_brand_dealer BOOLEAN NOT NULL DEFAULT false,
  sent_at TIMESTAMP WITH TIME ZONE,
  sent_by UUID REFERENCES profiles ON DELETE SET NULL,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES profiles ON DELETE RESTRICT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_billing_customer_id ON billing(customer_id);
CREATE INDEX idx_billing_subject_id ON billing(subject_id);
CREATE INDEX idx_billing_invoice_number ON billing(invoice_number);
CREATE INDEX idx_billing_invoice_date ON billing(invoice_date);
CREATE INDEX idx_billing_payment_status ON billing(payment_status);

-- 16. BILLING_ITEMS (Line Items in Billing)
CREATE TABLE billing_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_id UUID NOT NULL REFERENCES billing ON DELETE CASCADE,
  inventory_id UUID REFERENCES inventory ON DELETE SET NULL,
  service_type VARCHAR(100),
  description TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10, 2) NOT NULL,
  line_total DECIMAL(12, 2) NOT NULL,
  is_parts BOOLEAN NOT NULL DEFAULT false,
  is_oow_parts BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX idx_billing_items_billing_id ON billing_items(billing_id);

-- 17. BRAND_DEALER_PAYMENTS (Payments from Brand/Dealer)
CREATE TABLE brand_dealer_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_id UUID NOT NULL REFERENCES billing ON DELETE CASCADE,
  payment_amount DECIMAL(12, 2) NOT NULL,
  payment_date DATE,
  payment_status payment_status NOT NULL DEFAULT 'PENDING',
  payment_reference VARCHAR(100),
  remarks TEXT,
  dispute_reason TEXT,
  waive_reason TEXT,
  approval_by UUID REFERENCES profiles ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_brand_dealer_payments_billing_id ON brand_dealer_payments(billing_id);
CREATE INDEX idx_brand_dealer_payments_status ON brand_dealer_payments(payment_status);

-- 18. PAYOUTS (Technician Payouts)
CREATE TABLE payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_number VARCHAR(50) UNIQUE NOT NULL,
  technician_id UUID NOT NULL REFERENCES technicians ON DELETE CASCADE,
  payout_period_start DATE NOT NULL,
  payout_period_end DATE NOT NULL,
  total_amount DECIMAL(12, 2) NOT NULL,
  status payout_status NOT NULL DEFAULT 'PENDING',
  approval_by UUID REFERENCES profiles ON DELETE SET NULL,
  approved_at TIMESTAMP WITH TIME ZONE,
  payment_date DATE,
  paid_by UUID REFERENCES profiles ON DELETE SET NULL,
  remarks TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payouts_technician_id ON payouts(technician_id);
CREATE INDEX idx_payouts_status ON payouts(status);
CREATE INDEX idx_payouts_created_at ON payouts(created_at);

-- 19. NOTIFICATIONS (WhatsApp Notifications Log)
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_phone VARCHAR(20) NOT NULL,
  recipient_name VARCHAR(255),
  notification_type VARCHAR(100) NOT NULL,
  message TEXT NOT NULL,
  status notification_status NOT NULL DEFAULT 'PENDING',
  reference_type VARCHAR(50),
  reference_id UUID,
  sent_at TIMESTAMP WITH TIME ZONE,
  failed_reason TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_retry_at TIMESTAMP WITH TIME ZONE,
  fast2sms_response_id VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_recipient_phone ON notifications(recipient_phone);
CREATE INDEX idx_notifications_status ON notifications(status);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);
CREATE INDEX idx_notifications_reference ON notifications(reference_type, reference_id);

-- 20. AUDIT_LOG (System Audit Trail)
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles ON DELETE SET NULL,
  action VARCHAR(255) NOT NULL,
  resource_type VARCHAR(100) NOT NULL,
  resource_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_log_resource ON audit_log(resource_type, resource_id);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at);

-- ============================================================================
-- SECTION 3: TRIGGERS (Auto-Calculations & Business Logic)
-- ============================================================================

-- Trigger: Auto-calculate warranty end date based on purchase date and months
CREATE OR REPLACE FUNCTION calculate_warranty_end_date()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.warranty_end_date IS NULL THEN
    NEW.warranty_end_date := NEW.warranty_start_date + (INTERVAL '1 month' * NEW.warranty_months);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_warranty_calculate_end_date
BEFORE INSERT OR UPDATE ON warranty
FOR EACH ROW
EXECUTE FUNCTION calculate_warranty_end_date();

-- Trigger: Update warranty status based on end date
CREATE OR REPLACE FUNCTION update_warranty_status()
RETURNS TRIGGER AS $$
BEGIN
  IF CURRENT_DATE > NEW.warranty_end_date THEN
    NEW.status := 'EXPIRED'::warranty_status;
  ELSIF CURRENT_DATE > (NEW.warranty_end_date - INTERVAL '30 days')::DATE THEN
    NEW.status := 'EXPIRING_SOON'::warranty_status;
  ELSIF NEW.status = 'EXPIRED'::warranty_status OR NEW.status = 'CANCELLED'::warranty_status THEN
    NULL; -- Keep status as is
  ELSE
    NEW.status := 'ACTIVE'::warranty_status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_warranty_update_status
BEFORE INSERT OR UPDATE ON warranty
FOR EACH ROW
EXECUTE FUNCTION update_warranty_status();

-- Trigger: Auto-calculate AMC end date
CREATE OR REPLACE FUNCTION calculate_amc_end_date()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.amc_end_date IS NULL THEN
    NEW.amc_end_date := NEW.amc_start_date + (INTERVAL '1 month' * NEW.amc_duration_months);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_amc_calculate_end_date
BEFORE INSERT OR UPDATE ON amc
FOR EACH ROW
EXECUTE FUNCTION calculate_amc_end_date();

-- Trigger: Update AMC status based on end date
CREATE OR REPLACE FUNCTION update_amc_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'WAIVED'::amc_status THEN
    RETURN NEW; -- WAIVED is terminal
  END IF;
  
  IF CURRENT_DATE > NEW.amc_end_date THEN
    NEW.status := 'EXPIRED'::amc_status;
  ELSIF CURRENT_DATE > (NEW.amc_end_date - INTERVAL '30 days')::DATE THEN
    NEW.status := 'EXPIRING_SOON'::amc_status;
  ELSE
    NEW.status := 'ACTIVE'::amc_status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_amc_update_status
BEFORE INSERT OR UPDATE ON amc
FOR EACH ROW
EXECUTE FUNCTION update_amc_status();

-- Trigger: Update stock quantity_available
CREATE OR REPLACE FUNCTION update_stock_available()
RETURNS TRIGGER AS $$
BEGIN
  NEW.quantity_available := NEW.quantity_on_hand - NEW.quantity_reserved;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_stock_update_available
BEFORE INSERT OR UPDATE ON stock
FOR EACH ROW
EXECUTE FUNCTION update_stock_available();

-- Trigger: Update digital bag variance
CREATE OR REPLACE FUNCTION update_digital_bag_variance()
RETURNS TRIGGER AS $$
DECLARE
  calc_variance INTEGER;
BEGIN
  calc_variance := NEW.total_items_issued - NEW.total_items_used - NEW.total_items_returned;
  NEW.variance := calc_variance;
  
  IF calc_variance != 0 THEN
    NEW.variance_flagged := true;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_digital_bag_update_variance
BEFORE INSERT OR UPDATE ON digital_bag
FOR EACH ROW
EXECUTE FUNCTION update_digital_bag_variance();

-- Trigger: Auto-update billing amount_due
CREATE OR REPLACE FUNCTION update_billing_amount_due()
RETURNS TRIGGER AS $$
BEGIN
  NEW.amount_due := NEW.grand_total - NEW.amount_paid;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_billing_update_amount_due
BEFORE INSERT OR UPDATE ON billing
FOR EACH ROW
EXECUTE FUNCTION update_billing_amount_due();

-- Trigger: Auto-generate invoice number
CREATE OR REPLACE FUNCTION auto_generate_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.invoice_number IS NULL THEN
    NEW.invoice_number := 'INV-' || TO_CHAR(NOW(), 'YYYYMM') || '-' || LPAD(NEXTVAL('invoice_number_seq')::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE SEQUENCE invoice_number_seq START WITH 1;

CREATE TRIGGER trg_billing_auto_invoice_number
BEFORE INSERT ON billing
FOR EACH ROW
EXECUTE FUNCTION auto_generate_invoice_number();

-- Trigger: Update profile updated_at timestamp
CREATE OR REPLACE FUNCTION update_profile_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profile_update_timestamp
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION update_profile_timestamp();

-- Similar timestamp triggers for other tables
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_customers_update_timestamp BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER trg_subjects_update_timestamp BEFORE UPDATE ON subjects FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER trg_warranty_update_timestamp BEFORE UPDATE ON warranty FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER trg_amc_update_timestamp BEFORE UPDATE ON amc FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER trg_billing_update_timestamp BEFORE UPDATE ON billing FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER trg_notifications_update_timestamp BEFORE UPDATE ON notifications FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER trg_payouts_update_timestamp BEFORE UPDATE ON payouts FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- ============================================================================
-- SECTION 4: ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE technicians ENABLE ROW LEVEL SECURITY;
ALTER TABLE technician_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE warranty ENABLE ROW LEVEL SECURITY;
ALTER TABLE amc ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE digital_bag ENABLE ROW LEVEL SECURITY;
ALTER TABLE digital_bag_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE subject_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_dealer_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PROFILES RLS
-- ============================================================================
CREATE POLICY profiles_super_admin_all ON profiles 
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY profiles_self_read ON profiles 
  FOR SELECT USING (id = auth.uid());

CREATE POLICY profiles_staff_read_all ON profiles 
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('office_staff', 'super_admin', 'stock_manager'))
  );

CREATE POLICY profiles_self_update ON profiles 
  FOR UPDATE USING (id = auth.uid());

-- ============================================================================
-- CUSTOMERS RLS
-- ============================================================================
CREATE POLICY customers_super_admin_all ON customers 
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY customers_staff_all ON customers 
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('office_staff', 'stock_manager'))
  );

CREATE POLICY customers_technician_read ON customers 
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'technician')
  );

-- ============================================================================
-- SUBJECTS (Service Tickets) RLS
-- ============================================================================
CREATE POLICY subjects_super_admin_all ON subjects 
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY subjects_staff_all ON subjects 
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'office_staff')
  );

CREATE POLICY subjects_technician_own ON subjects 
  FOR SELECT USING (
    assigned_technician_id = 
      (SELECT id FROM profiles WHERE id = auth.uid() AND role = 'technician' LIMIT 1)
  );

CREATE POLICY subjects_technician_update_own ON subjects 
  FOR UPDATE USING (
    assigned_technician_id = 
      (SELECT id FROM profiles WHERE id = auth.uid() AND role = 'technician' LIMIT 1)
  );

-- ============================================================================
-- TECHNICIAN_ATTENDANCE RLS
-- ============================================================================
CREATE POLICY technician_attendance_super_admin_all ON technician_attendance 
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY technician_attendance_staff_all ON technician_attendance 
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'office_staff')
  );

CREATE POLICY technician_attendance_own ON technician_attendance 
  FOR SELECT USING (
    technician_id = 
      (SELECT id FROM profiles WHERE id = auth.uid() AND role = 'technician' LIMIT 1)
  );

CREATE POLICY technician_attendance_own_update ON technician_attendance 
  FOR UPDATE USING (
    technician_id = 
      (SELECT id FROM profiles WHERE id = auth.uid() AND role = 'technician' LIMIT 1)
  );

-- ============================================================================
-- WARRANTY RLS
-- ============================================================================
CREATE POLICY warranty_super_admin_all ON warranty 
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY warranty_staff_read ON warranty 
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('office_staff', 'stock_manager'))
  );

CREATE POLICY warranty_technician_read ON warranty 
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'technician')
  );

-- ============================================================================
-- AMC RLS
-- ============================================================================
CREATE POLICY amc_super_admin_all ON amc 
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY amc_staff_read ON amc 
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('office_staff', 'stock_manager'))
  );

CREATE POLICY amc_technician_read ON amc 
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'technician')
  );

-- ============================================================================
-- INVENTORY RLS
-- ============================================================================
CREATE POLICY inventory_super_admin_all ON inventory 
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY inventory_stock_manager_all ON inventory 
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'stock_manager')
  );

CREATE POLICY inventory_staff_read ON inventory 
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'office_staff')
  );

CREATE POLICY inventory_technician_read ON inventory 
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'technician')
  );

-- ============================================================================
-- STOCK RLS
-- ============================================================================
CREATE POLICY stock_super_admin_all ON stock 
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY stock_manager_all ON stock 
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'stock_manager')
  );

CREATE POLICY stock_staff_read ON stock 
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'office_staff')
  );

CREATE POLICY stock_technician_read ON stock 
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'technician')
  );

-- ============================================================================
-- DIGITAL_BAG RLS
-- ============================================================================
CREATE POLICY digital_bag_super_admin_all ON digital_bag 
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY digital_bag_manager_all ON digital_bag 
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'stock_manager')
  );

CREATE POLICY digital_bag_technician_own ON digital_bag 
  FOR SELECT USING (
    technician_id = 
      (SELECT id FROM profiles WHERE id = auth.uid() AND role = 'technician' LIMIT 1)
  );

CREATE POLICY digital_bag_technician_own_update ON digital_bag 
  FOR UPDATE USING (
    technician_id = 
      (SELECT id FROM profiles WHERE id = auth.uid() AND role = 'technician' LIMIT 1)
  );

-- ============================================================================
-- DIGITAL_BAG_ITEMS RLS
-- ============================================================================
CREATE POLICY digital_bag_items_super_admin_all ON digital_bag_items 
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY digital_bag_items_manager_all ON digital_bag_items 
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'stock_manager')
  );

CREATE POLICY digital_bag_items_technician_own ON digital_bag_items 
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM digital_bag db
      WHERE db.id = digital_bag_items.digital_bag_id
      AND db.technician_id = (SELECT id FROM profiles WHERE id = auth.uid() AND role = 'technician' LIMIT 1)
    )
  );

CREATE POLICY digital_bag_items_technician_own_update ON digital_bag_items 
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM digital_bag db
      WHERE db.id = digital_bag_items.digital_bag_id
      AND db.technician_id = (SELECT id FROM profiles WHERE id = auth.uid() AND role = 'technician' LIMIT 1)
    )
  );

-- ============================================================================
-- SUBJECT_MEDIA RLS
-- ============================================================================
CREATE POLICY subject_media_super_admin_all ON subject_media 
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY subject_media_staff_read ON subject_media 
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'office_staff')
  );

CREATE POLICY subject_media_technician_own ON subject_media 
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM subjects s
      WHERE s.id = subject_media.subject_id
      AND s.assigned_technician_id = (SELECT id FROM profiles WHERE id = auth.uid() AND role = 'technician' LIMIT 1)
    )
  );

CREATE POLICY subject_media_technician_insert ON subject_media 
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM subjects s
      WHERE s.id = subject_media.subject_id
      AND s.assigned_technician_id = (SELECT id FROM profiles WHERE id = auth.uid() AND role = 'technician' LIMIT 1)
    )
    AND uploaded_by = auth.uid()
  );

-- ============================================================================
-- BILLING RLS
-- ============================================================================
CREATE POLICY billing_super_admin_all ON billing 
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY billing_staff_all ON billing 
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'office_staff')
  );

CREATE POLICY billing_technician_own ON billing 
  FOR SELECT USING (
    technician_id = 
      (SELECT id FROM profiles WHERE id = auth.uid() AND role = 'technician' LIMIT 1)
  );

-- ============================================================================
-- BILLING_ITEMS RLS (Inherits from billing)
-- ============================================================================
CREATE POLICY billing_items_super_admin_all ON billing_items 
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY billing_items_staff_all ON billing_items 
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() 
      AND p.role IN ('office_staff')
    )
  );

-- ============================================================================
-- BRAND_DEALER_PAYMENTS RLS
-- ============================================================================
CREATE POLICY brand_dealer_payments_super_admin_all ON brand_dealer_payments 
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY brand_dealer_payments_staff_read ON brand_dealer_payments 
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'office_staff')
  );

-- ============================================================================
-- PAYOUTS RLS
-- ============================================================================
CREATE POLICY payouts_super_admin_all ON payouts 
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY payouts_technician_own ON payouts 
  FOR SELECT USING (
    technician_id = 
      (SELECT id FROM profiles WHERE id = auth.uid() AND role = 'technician' LIMIT 1)
  );

-- ============================================================================
-- NOTIFICATIONS RLS
-- ============================================================================
CREATE POLICY notifications_super_admin_all ON notifications 
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY notifications_staff_all ON notifications 
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'office_staff')
  );

-- ============================================================================
-- AUDIT_LOG RLS
-- ============================================================================
CREATE POLICY audit_log_super_admin_read ON audit_log 
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

-- ============================================================================
-- SECTION 5: STORED PROCEDURES (Cron Job Helpers)
-- ============================================================================

-- Procedure: Flag attendance as ABSENT if not ON by 10:30 AM
CREATE OR REPLACE FUNCTION flag_absent_attendance()
RETURNS TABLE (flagged_count INT, flagged_technicians TEXT[]) AS $$
DECLARE
  v_flagged_count INT := 0;
  v_flagged_technicians TEXT[] := ARRAY[]::TEXT[];
  v_tech_record RECORD;
BEGIN
  FOR v_tech_record IN
    SELECT ta.id, ta.technician_id, p.display_name
    FROM technician_attendance ta
    JOIN technicians t ON t.id = ta.technician_id
    JOIN profiles p ON p.id = t.id
    WHERE ta.attendance_date = CURRENT_DATE
    AND ta.status != 'LEAVE'::attendance_status
    AND ta.status != 'ON'::attendance_status
    AND CURRENT_TIME >= '10:30:00'::TIME
    AND ta.is_absent_flagged = false
  LOOP
    UPDATE technician_attendance
    SET 
      status = 'ABSENT'::attendance_status,
      is_absent_flagged = true,
      flagged_at = NOW()
    WHERE id = v_tech_record.id;
    
    v_flagged_count := v_flagged_count + 1;
    v_flagged_technicians := array_append(v_flagged_technicians, v_tech_record.display_name);
  END LOOP;
  
  RETURN QUERY SELECT v_flagged_count, v_flagged_technicians;
END;
$$ LANGUAGE plpgsql;

-- Procedure: Auto-OFF attendance at 11:59 PM
CREATE OR REPLACE FUNCTION auto_off_attendance()
RETURNS TABLE (auto_off_count INT) AS $$
DECLARE
  v_count INT := 0;
BEGIN
  UPDATE technician_attendance
  SET 
    status = 'OFF'::attendance_status,
    time_off = CURRENT_TIME
  WHERE attendance_date = CURRENT_DATE
  AND status = 'ON'::attendance_status;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  RETURN QUERY SELECT v_count;
END;
$$ LANGUAGE plpgsql;

-- Procedure: Send warranty expiry reminders (30, 15, 7 days)
CREATE OR REPLACE FUNCTION send_warranty_expiry_reminders()
RETURNS TABLE (reminder_count INT) AS $$
DECLARE
  v_count INT := 0;
  v_warranty RECORD;
BEGIN
  -- 30 days before expiry
  FOR v_warranty IN
    SELECT w.id, c.phone_number, c.customer_name, p.product_name, w.warranty_end_date
    FROM warranty w
    JOIN customers c ON c.id = w.customer_id
    JOIN products p ON p.id = w.product_id
    WHERE w.warranty_end_date = (CURRENT_DATE + INTERVAL '30 days')::DATE
    AND w.expiry_notified_30_days = false
    AND w.status = 'ACTIVE'::warranty_status
  LOOP
    INSERT INTO notifications (recipient_phone, recipient_name, notification_type, message, status, reference_type, reference_id)
    VALUES (
      v_warranty.phone_number,
      v_warranty.customer_name,
      'WARRANTY_EXPIRY_30_DAYS',
      'Warranty for ' || v_warranty.product_name || ' expires on ' || v_warranty.warranty_end_date || '. Please renew if needed.',
      'PENDING'::notification_status,
      'WARRANTY',
      v_warranty.id
    );
    
    UPDATE warranty SET expiry_notified_30_days = true WHERE id = v_warranty.id;
    v_count := v_count + 1;
  END LOOP;
  
  -- 15 days before expiry
  FOR v_warranty IN
    SELECT w.id, c.phone_number, c.customer_name, p.product_name, w.warranty_end_date
    FROM warranty w
    JOIN customers c ON c.id = w.customer_id
    JOIN products p ON p.id = w.product_id
    WHERE w.warranty_end_date = (CURRENT_DATE + INTERVAL '15 days')::DATE
    AND w.expiry_notified_15_days = false
    AND w.status = 'ACTIVE'::warranty_status
  LOOP
    INSERT INTO notifications (recipient_phone, recipient_name, notification_type, message, status, reference_type, reference_id)
    VALUES (
      v_warranty.phone_number,
      v_warranty.customer_name,
      'WARRANTY_EXPIRY_15_DAYS',
      'Warranty for ' || v_warranty.product_name || ' expires in 15 days on ' || v_warranty.warranty_end_date || '.',
      'PENDING'::notification_status,
      'WARRANTY',
      v_warranty.id
    );
    
    UPDATE warranty SET expiry_notified_15_days = true WHERE id = v_warranty.id;
    v_count := v_count + 1;
  END LOOP;
  
  -- 7 days before expiry
  FOR v_warranty IN
    SELECT w.id, c.phone_number, c.customer_name, p.product_name, w.warranty_end_date
    FROM warranty w
    JOIN customers c ON c.id = w.customer_id
    JOIN products p ON p.id = w.product_id
    WHERE w.warranty_end_date = (CURRENT_DATE + INTERVAL '7 days')::DATE
    AND w.expiry_notified_7_days = false
    AND w.status = 'ACTIVE'::warranty_status
  LOOP
    INSERT INTO notifications (recipient_phone, recipient_name, notification_type, message, status, reference_type, reference_id)
    VALUES (
      v_warranty.phone_number,
      v_warranty.customer_name,
      'WARRANTY_EXPIRY_7_DAYS',
      'Warranty for ' || v_warranty.product_name || ' expires on ' || v_warranty.warranty_end_date || '. Please renew now.',
      'PENDING'::notification_status,
      'WARRANTY',
      v_warranty.id
    );
    
    UPDATE warranty SET expiry_notified_7_days = true WHERE id = v_warranty.id;
    v_count := v_count + 1;
  END LOOP;
  
  RETURN QUERY SELECT v_count;
END;
$$ LANGUAGE plpgsql;

-- Procedure: Send AMC expiry reminders (30, 15, 7 days)
CREATE OR REPLACE FUNCTION send_amc_expiry_reminders()
RETURNS TABLE (reminder_count INT) AS $$
DECLARE
  v_count INT := 0;
  v_amc RECORD;
BEGIN
  -- 30 days before expiry
  FOR v_amc IN
    SELECT a.id, c.phone_number, c.customer_name, p.product_name, a.amc_end_date
    FROM amc a
    JOIN customers c ON c.id = a.customer_id
    JOIN products p ON p.id = a.product_id
    WHERE a.amc_end_date = (CURRENT_DATE + INTERVAL '30 days')::DATE
    AND a.expiry_notified_30_days = false
    AND a.status = 'ACTIVE'::amc_status
  LOOP
    INSERT INTO notifications (recipient_phone, recipient_name, notification_type, message, status, reference_type, reference_id)
    VALUES (
      v_amc.phone_number,
      v_amc.customer_name,
      'AMC_EXPIRY_30_DAYS',
      'AMC for ' || v_amc.product_name || ' expires on ' || v_amc.amc_end_date || '. Please renew if needed.',
      'PENDING'::notification_status,
      'AMC',
      v_amc.id
    );
    
    UPDATE amc SET expiry_notified_30_days = true WHERE id = v_amc.id;
    v_count := v_count + 1;
  END LOOP;
  
  -- 15 days before expiry
  FOR v_amc IN
    SELECT a.id, c.phone_number, c.customer_name, p.product_name, a.amc_end_date
    FROM amc a
    JOIN customers c ON c.id = a.customer_id
    JOIN products p ON p.id = a.product_id
    WHERE a.amc_end_date = (CURRENT_DATE + INTERVAL '15 days')::DATE
    AND a.expiry_notified_15_days = false
    AND a.status = 'ACTIVE'::amc_status
  LOOP
    INSERT INTO notifications (recipient_phone, recipient_name, notification_type, message, status, reference_type, reference_id)
    VALUES (
      v_amc.phone_number,
      v_amc.customer_name,
      'AMC_EXPIRY_15_DAYS',
      'AMC for ' || v_amc.product_name || ' expires in 15 days on ' || v_amc.amc_end_date || '.',
      'PENDING'::notification_status,
      'AMC',
      v_amc.id
    );
    
    UPDATE amc SET expiry_notified_15_days = true WHERE id = v_amc.id;
    v_count := v_count + 1;
  END LOOP;
  
  -- 7 days before expiry
  FOR v_amc IN
    SELECT a.id, c.phone_number, c.customer_name, p.product_name, a.amc_end_date
    FROM amc a
    JOIN customers c ON c.id = a.customer_id
    JOIN products p ON p.id = a.product_id
    WHERE a.amc_end_date = (CURRENT_DATE + INTERVAL '7 days')::DATE
    AND a.expiry_notified_7_days = false
    AND a.status = 'ACTIVE'::amc_status
  LOOP
    INSERT INTO notifications (recipient_phone, recipient_name, notification_type, message, status, reference_type, reference_id)
    VALUES (
      v_amc.phone_number,
      v_amc.customer_name,
      'AMC_EXPIRY_7_DAYS',
      'AMC for ' || v_amc.product_name || ' expires on ' || v_amc.amc_end_date || '. Please renew now.',
      'PENDING'::notification_status,
      'AMC',
      v_amc.id
    );
    
    UPDATE amc SET expiry_notified_7_days = true WHERE id = v_amc.id;
    v_count := v_count + 1;
  END LOOP;
  
  RETURN QUERY SELECT v_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SECTION 6: SAMPLE DATA (Optional - for testing)
-- ============================================================================

-- Sample role: Create admin user (you must have actual auth.users records)
-- INSERT INTO profiles (id, email, display_name, phone_number, role)
-- VALUES (uuid_generate_v4(), 'admin@hitech.com', 'Joby Sir', '+919876543210', 'super_admin');

-- ============================================================================
-- SECTION 7: PERFORMANCE INDEXES (Already created above, listed for reference)
-- ============================================================================

-- Summary of all indexes created:
-- - profiles: email, role, phone, is_active
-- - customers: phone, email, city, location
-- - products: category, brand, model
-- - technicians: code, is_active
-- - technician_attendance: (technician_id, date), date, unique(tech_id, date)
-- - subjects: (customer, technician, status, date, created_at, number, job_type)
-- - warranty: (customer, product, end_date, status)
-- - amc: (customer, product, end_date, status, activation_date)
-- - inventory: (code, category, is_active)
-- - stock: unique(inventory_id)
-- - stock_transactions: (inventory_id, created_at)
-- - digital_bag: (tech_id, date), unique(tech_id, date)
-- - digital_bag_items: (digital_bag_id, inventory_id)
-- - subject_media: (subject_id, type, created_at)
-- - billing: (customer, subject, number, date, status)
-- - billing_items: (billing_id)
-- - brand_dealer_payments: (billing_id, status)
-- - payouts: (technician, status, created_at)
-- - notifications: (phone, status, created_at, reference)
-- - audit_log: (user_id, resource, created_at)

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
