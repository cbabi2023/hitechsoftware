# Hitech Software - Implementation & Deployment Guide

## Table of Contents
1. [Quick Start](#quick-start)
2. [Entity Relationship Diagram](#entity-relationship-diagram)
3. [Common API Queries](#common-api-queries)
4. [Deployment Checklist](#deployment-checklist)
5. [Cron Job Setup](#cron-job-setup)
6. [Troubleshooting](#troubleshooting)

---

## Quick Start

### Step 1: Create Supabase Project
1. Go to [supabase.com](https://supabase.com)
2. Create new project (choose PostgreSQL)
3. Wait for database provisioning (2-3 minutes)
4. Go to SQL Editor

### Step 2: Load the Schema
1. Open `hitech_database_schema.sql`
2. Copy entire content
3. Paste into Supabase SQL Editor
4. Click "Run" button
5. Wait for completion (should see "All done" message)

### Step 3: Verify Installation
```sql
-- Check all tables created
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;

-- Should show 20 tables
-- Verify RLS is enabled
SELECT tablename FROM pg_tables WHERE schemaname='public'
INTERSECT
SELECT tablename FROM information_schema.table_privileges 
WHERE grantee='authenticated';
```

### Step 4: Test a Sample Insert
```sql
-- Insert test user (requires valid auth.users record first)
INSERT INTO profiles (id, email, display_name, phone_number, role)
VALUES (
  'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'::uuid,
  'joby@hitech.com',
  'Joby Sir',
  '+919876543210',
  'super_admin'
);

SELECT * FROM profiles;
```

---

## Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                          AUTHENTICATION                          │
├─────────────────────────────────────────────────────────────────┤
│  auth.users (Supabase) ──1──→ PROFILES (Core User Table)        │
│                               (email, role, phone)               │
└──────────────┬──────────────────────────────────────────────────┘
               │
        ┌──────┴──────┬──────────┬──────────┐
        ↓             ↓          ↓          ↓
   TECHNICIANS    [STAFF]    [MANAGERS]  [ADMIN]
   (specialized)


┌─────────────────────────────────────────────────────────────────┐
│                        CUSTOMERS & SERVICES                      │
├─────────────────────────────────────────────────────────────────┤
│ CUSTOMERS ──1──→ SUBJECTS (Service Tickets)                     │
│    ↑               ├──→ SUBJECT_MEDIA (Images/Videos)           │
│    │               ├──→ INCOMPLETE_REASONS                      │
│    │               └──→ TECHNICIAN ASSIGNMENT                   │
│    │                                                             │
│    └───────────────────────── Associated With                   │
│                          (Service + Parts Used)                 │
└─────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────┐
│                    PRODUCTS & WARRANTY/AMC                       │
├─────────────────────────────────────────────────────────────────┤
│ PRODUCTS ──1──→ WARRANTY (Per Customer)                         │
│          └───→ AMC (Per Customer)                               │
│                                                                 │
│ Rules:                                                          │
│ • Product has default_warranty_months                           │
│ • Product has default_amc_price                                │
│ • Warranty: product-specific, not global                       │
│ • AMC: product-specific + customer-specific                    │
│ • AMC requires 30-day notice before activation                 │
│ • New AMC waits until current warranty/AMC ends                │
└─────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────┐
│                    INVENTORY & STOCK MANAGEMENT                  │
├─────────────────────────────────────────────────────────────────┤
│ INVENTORY (Master) ──1──→ STOCK (Current Levels)                │
│              ├───────────→ STOCK_TRANSACTIONS (Audit Trail)     │
│              └───────────→ BILLING_ITEMS (Used in invoices)     │
│                                                                 │
│ INVENTORY ──1──→ DIGITAL_BAG_ITEMS                              │
│    (Parts)         └──→ DIGITAL_BAG (Daily per Technician)      │
│                                                                 │
│ Rules:                                                          │
│ • quantity_available = quantity_on_hand - quantity_reserved    │
│ • Digital Bag capacity: 50 items/technician/day                │
│ • Each item tracked: Issued → Used/Returned → Variance         │
│ • Variance automatically flagged                               │
└─────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────┐
│                         BILLING & PAYMENTS                       │
├─────────────────────────────────────────────────────────────────┤
│ SUBJECTS ──1──→ BILLING (Auto-generated invoices)               │
│             ├──→ BILLING_ITEMS (Line items)                     │
│             └──→ BRAND_DEALER_PAYMENTS (Payment tracking)       │
│                                                                 │
│ CUSTOMERS ──1──→ BILLING                                        │
│                                                                 │
│ Payment Status Flow:                                            │
│ PENDING ──→ RECEIVED (terminal)                                 │
│   ↓                                                             │
│ DISPUTED ──→ PENDING (reversal)                                 │
│   ↓                                                             │
│ WAIVED (terminal - cannot change)                               │
└─────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────┐
│                    TECHNICIAN MANAGEMENT                         │
├─────────────────────────────────────────────────────────────────┤
│ TECHNICIANS ──1──→ TECHNICIAN_ATTENDANCE (Daily)                │
│            ├───→ SUBJECTS (Assigned work)                       │
│            ├───→ DIGITAL_BAG (Daily issuance)                   │
│            └───→ PAYOUTS (Commission/Salary)                    │
│                                                                 │
│ Attendance Rules:                                               │
│ • ON toggle: 12:00 AM - 10:30 AM                               │
│ • OFF toggle: After 6:00 PM only                               │
│ • One ON + One OFF per day maximum                              │
│ • Auto-OFF at 11:59 PM                                         │
│ • Auto-flag ABSENT at 10:30 AM if not ON                       │
│ • Leave: Max 1 week in advance                                 │
└─────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────┐
│                    NOTIFICATIONS & AUDIT                         │
├─────────────────────────────────────────────────────────────────┤
│ NOTIFICATIONS (WhatsApp audit log)                              │
│ • All messages tracked                                         │
│ • Retry logic built-in                                         │
│ • Status: PENDING → SENT/FAILED/RETRYING                       │
│                                                                 │
│ AUDIT_LOG (Complete trail)                                     │
│ • All INSERT/UPDATE/DELETE tracked                             │
│ • JSONB stores before/after values                             │
│ • Compliance: 1 year retention                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Common API Queries

### 1. Subject Management

#### Create a Service Ticket
```sql
INSERT INTO subjects (
  subject_number,
  customer_id,
  product_id,
  status,
  job_type,
  description,
  complaint_details,
  serial_number,
  schedule_date,
  created_by
) VALUES (
  'SUB-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(
    (SELECT COUNT(*) + 1 FROM subjects WHERE created_at::DATE = CURRENT_DATE)::TEXT, 
    4, 
    '0'
  ),
  'customer-uuid-here',
  'product-uuid-here',
  'PENDING'::subject_status,
  'IN_WARRANTY'::job_type,
  'Description of problem',
  'Customer complaint details',
  'SN123456',
  CURRENT_DATE + INTERVAL '2 days',
  auth.uid()
)
RETURNING *;
```

#### Assign Technician to Subject
```sql
UPDATE subjects
SET 
  assigned_technician_id = 'technician-uuid',
  status = 'ALLOCATED'::subject_status,
  allocated_at = NOW()
WHERE id = 'subject-uuid'
RETURNING *;
```

#### Get Technician's Daily Subjects
```sql
SELECT 
  s.id,
  s.subject_number,
  s.status,
  c.customer_name,
  c.phone_number,
  c.address,
  s.schedule_date,
  p.product_name,
  s.complaint_details
FROM subjects s
JOIN customers c ON c.id = s.customer_id
JOIN products p ON p.id = s.product_id
WHERE s.assigned_technician_id = 'tech-uuid'
  AND s.schedule_date = CURRENT_DATE
  AND s.is_deleted = false
ORDER BY s.schedule_date ASC;
```

#### Mark Subject Complete (In-Warranty)
```sql
UPDATE subjects
SET 
  status = 'COMPLETED'::subject_status,
  is_completed = true,
  actual_completion_date = CURRENT_DATE,
  completed_at = NOW()
WHERE id = 'subject-uuid'
RETURNING *;
```

#### Mark Subject Incomplete with Reason
```sql
UPDATE subjects
SET 
  status = 'INCOMPLETE'::subject_status,
  is_completed = false,
  incompletion_reason = 'SPARE_PARTS_NOT_AVAILABLE'::incomplete_reason,
  incompletion_remarks = 'Part XYZ not in stock, ordered',
  actual_completion_date = CURRENT_DATE,
  completed_at = NOW()
WHERE id = 'subject-uuid'
RETURNING *;
```

### 2. Attendance Management

#### Technician Toggles ON
```sql
INSERT INTO technician_attendance (
  technician_id,
  attendance_date,
  status,
  time_on
) VALUES (
  auth.uid(),
  CURRENT_DATE,
  'ON'::attendance_status,
  CURRENT_TIME
)
ON CONFLICT (technician_id, attendance_date) 
DO UPDATE SET 
  status = 'ON'::attendance_status,
  time_on = CURRENT_TIME
RETURNING *;
```

#### Technician Toggles OFF
```sql
UPDATE technician_attendance
SET 
  status = 'OFF'::attendance_status,
  time_off = CURRENT_TIME
WHERE technician_id = auth.uid()
  AND attendance_date = CURRENT_DATE
  AND status != 'OFF'::attendance_status
RETURNING *;
```

#### Mark Leave
```sql
INSERT INTO technician_attendance (
  technician_id,
  attendance_date,
  status,
  leave_reason
) VALUES (
  auth.uid(),
  CURRENT_DATE,
  'LEAVE'::attendance_status,
  'Reason for leave'
)
ON CONFLICT (technician_id, attendance_date) 
DO UPDATE SET 
  status = 'LEAVE'::attendance_status,
  leave_reason = EXCLUDED.leave_reason
RETURNING *;
```

#### Check Attendance Status
```sql
SELECT 
  ta.attendance_date,
  ta.status,
  ta.time_on,
  ta.time_off,
  ta.is_absent_flagged,
  ta.leave_reason
FROM technician_attendance ta
WHERE ta.technician_id = 'tech-uuid'
  AND ta.attendance_date = CURRENT_DATE
LIMIT 1;
```

### 3. Digital Bag Management

#### Issue Digital Bag (Staff)
```sql
INSERT INTO digital_bag (
  technician_id,
  bag_date,
  status,
  issued_by
) VALUES (
  'tech-uuid',
  CURRENT_DATE,
  'ACTIVE',
  auth.uid()
)
ON CONFLICT (technician_id, bag_date) 
DO UPDATE SET 
  status = 'ACTIVE',
  issued_by = auth.uid()
RETURNING *;
```

#### Add Items to Bag (Staff Manager)
```sql
INSERT INTO digital_bag_items (
  digital_bag_id,
  inventory_id,
  quantity_issued
) VALUES (
  'bag-uuid',
  'item-uuid',
  5
)
RETURNING *;
```

#### Mark Items as Used (Technician)
```sql
UPDATE digital_bag_items
SET quantity_used = quantity_used + 2
WHERE digital_bag_id = 'bag-uuid'
  AND inventory_id = 'item-uuid'
RETURNING *;
```

#### Close Digital Bag (Technician)
```sql
UPDATE digital_bag
SET 
  total_items_issued = (SELECT SUM(quantity_issued) FROM digital_bag_items WHERE digital_bag_id = 'bag-uuid'),
  total_items_used = (SELECT SUM(COALESCE(quantity_used, 0)) FROM digital_bag_items WHERE digital_bag_id = 'bag-uuid'),
  total_items_returned = (SELECT SUM(COALESCE(quantity_returned, 0)) FROM digital_bag_items WHERE digital_bag_id = 'bag-uuid'),
  status = 'CLOSED'
WHERE id = 'bag-uuid'
RETURNING *, variance, variance_flagged;
```

#### Get Digital Bag Status
```sql
SELECT 
  db.id,
  db.bag_date,
  db.status,
  db.total_items_issued,
  db.total_items_used,
  db.total_items_returned,
  db.variance,
  db.variance_flagged,
  COUNT(dbi.id) as item_types,
  SUM(dbi.quantity_issued) as total_quantity
FROM digital_bag db
LEFT JOIN digital_bag_items dbi ON db.id = dbi.digital_bag_id
WHERE db.technician_id = 'tech-uuid'
  AND db.bag_date = CURRENT_DATE
GROUP BY db.id, db.bag_date, db.status, db.total_items_issued, 
         db.total_items_used, db.total_items_returned, db.variance, db.variance_flagged
LIMIT 1;
```

### 4. Warranty & AMC

#### Create Warranty Record
```sql
INSERT INTO warranty (
  customer_id,
  product_id,
  purchase_date,
  warranty_start_date,
  warranty_months,
  subject_id
) VALUES (
  'customer-uuid',
  'product-uuid',
  CURRENT_DATE - INTERVAL '7 days',
  CURRENT_DATE,
  24,
  'subject-uuid'
)
RETURNING *; -- warranty_end_date auto-calculated
```

#### Check Warranty Status
```sql
SELECT 
  w.id,
  w.product_id,
  p.product_name,
  w.warranty_start_date,
  w.warranty_end_date,
  w.status,
  (w.warranty_end_date - CURRENT_DATE) as days_remaining,
  CASE 
    WHEN w.status = 'ACTIVE' THEN 'Valid'
    WHEN w.status = 'EXPIRING_SOON' THEN 'Expiring Soon (30 days)'
    WHEN w.status = 'EXPIRED' THEN 'Expired'
  END as warranty_status_display
FROM warranty w
JOIN products p ON p.id = w.product_id
WHERE w.customer_id = 'customer-uuid'
ORDER BY w.warranty_end_date DESC;
```

#### Create AMC with 30-Day Notice
```sql
INSERT INTO amc (
  customer_id,
  product_id,
  amc_start_date,
  amc_duration_months,
  amc_price,
  required_notice_days
) VALUES (
  'customer-uuid',
  'product-uuid',
  CURRENT_DATE + INTERVAL '30 days',
  12,
  9999.00,
  30
)
RETURNING *; -- amc_end_date auto-calculated, activation_date set after 30 days
```

### 5. Billing

#### Generate Invoice
```sql
INSERT INTO billing (
  subject_id,
  customer_id,
  technician_id,
  invoice_date,
  total_amount,
  tax_amount,
  grand_total,
  created_by
) VALUES (
  'subject-uuid',
  'customer-uuid',
  'tech-uuid',
  CURRENT_DATE,
  5000.00,
  900.00,
  5900.00,
  auth.uid()
)
RETURNING invoice_number, grand_total, amount_due; -- invoice_number auto-generated
```

#### Add Line Item to Invoice
```sql
INSERT INTO billing_items (
  billing_id,
  inventory_id,
  description,
  quantity,
  unit_price,
  line_total,
  is_parts,
  is_oow_parts
) VALUES (
  'billing-uuid',
  'item-uuid',
  'Compressor Replacement',
  1,
  5000.00,
  5000.00,
  true,
  false
)
RETURNING *;
```

#### Record Brand/Dealer Payment
```sql
INSERT INTO brand_dealer_payments (
  billing_id,
  payment_amount,
  payment_date,
  payment_status,
  payment_reference
) VALUES (
  'billing-uuid',
  2500.00, -- Partial payment
  CURRENT_DATE,
  'RECEIVED'::payment_status,
  'CHQ-001234'
)
RETURNING *;
```

#### Check Invoice Status
```sql
SELECT 
  b.invoice_number,
  b.invoice_date,
  b.grand_total,
  b.amount_paid,
  b.amount_due,
  ROUND((b.amount_paid / b.grand_total * 100)::NUMERIC, 2) as percentage_paid,
  c.customer_name,
  s.subject_number,
  COUNT(DISTINCT bdp.id) as payments_received
FROM billing b
JOIN customers c ON c.id = b.customer_id
JOIN subjects s ON s.id = b.subject_id
LEFT JOIN brand_dealer_payments bdp ON b.id = bdp.billing_id 
  AND bdp.payment_status = 'RECEIVED'::payment_status
WHERE b.id = 'billing-uuid'
GROUP BY b.id, b.invoice_number, b.invoice_date, b.grand_total, 
         b.amount_paid, b.amount_due, c.customer_name, s.subject_number;
```

### 6. Notifications

#### Send Notification
```sql
INSERT INTO notifications (
  recipient_phone,
  recipient_name,
  notification_type,
  message,
  status,
  reference_type,
  reference_id
) VALUES (
  '+919876543210',
  'Customer Name',
  'SUBJECT_COMPLETED',
  'Your appliance repair is complete. Amount due: ₹5900',
  'PENDING'::notification_status,
  'SUBJECT',
  'subject-uuid'
)
RETURNING *;
```

#### Check Notification Status
```sql
SELECT 
  id,
  recipient_phone,
  notification_type,
  status,
  retry_count,
  fast2sms_response_id,
  created_at,
  sent_at,
  failed_reason
FROM notifications
WHERE recipient_phone = '+919876543210'
ORDER BY created_at DESC
LIMIT 20;
```

### 7. Payouts

#### Create Technician Payout
```sql
INSERT INTO payouts (
  technician_id,
  payout_period_start,
  payout_period_end,
  total_amount,
  status,
  created_at
) VALUES (
  'tech-uuid',
  CURRENT_DATE - INTERVAL '1 month',
  CURRENT_DATE - INTERVAL '1 day',
  45000.00,
  'PENDING'::payout_status,
  NOW()
)
RETURNING payout_number, total_amount, status;
```

#### Approve & Mark Paid
```sql
UPDATE payouts
SET 
  status = 'PAID'::payout_status,
  approval_by = auth.uid(),
  approved_at = NOW(),
  paid_by = auth.uid(),
  payment_date = CURRENT_DATE
WHERE id = 'payout-uuid'
RETURNING *;
```

### 8. Dashboard Queries

#### Daily Status Summary
```sql
SELECT 
  (SELECT COUNT(*) FROM subjects WHERE status = 'PENDING'::subject_status) as pending_subjects,
  (SELECT COUNT(*) FROM subjects WHERE status = 'IN_PROGRESS'::subject_status) as in_progress,
  (SELECT COUNT(*) FROM subjects WHERE status = 'COMPLETED'::subject_status 
    AND completed_at::DATE = CURRENT_DATE) as completed_today,
  (SELECT COUNT(*) FROM technician_attendance 
    WHERE attendance_date = CURRENT_DATE AND status = 'ON'::attendance_status) as technicians_on_duty,
  (SELECT COUNT(*) FROM technician_attendance 
    WHERE attendance_date = CURRENT_DATE AND status = 'ABSENT'::attendance_status) as technicians_absent,
  (SELECT COUNT(*) FROM digital_bag 
    WHERE bag_date = CURRENT_DATE AND variance_flagged = true) as bags_with_variance;
```

#### Revenue Reports
```sql
SELECT 
  DATE_TRUNC('month', b.invoice_date)::DATE as month,
  COUNT(*) as invoices,
  SUM(b.grand_total) as revenue,
  SUM(b.amount_paid) as collected,
  SUM(b.amount_due) as pending
FROM billing b
WHERE b.invoice_date >= CURRENT_DATE - INTERVAL '12 months'
GROUP BY DATE_TRUNC('month', b.invoice_date)
ORDER BY month DESC;
```

---

## Deployment Checklist

- [ ] **Database Setup**
  - [ ] Create Supabase project
  - [ ] Copy entire SQL schema into SQL Editor
  - [ ] Run schema and verify all tables created
  - [ ] Verify RLS is enabled on all tables
  - [ ] Confirm sequences created (invoice_number_seq)

- [ ] **Authentication**
  - [ ] Enable Supabase Auth
  - [ ] Configure email provider
  - [ ] Set redirect URLs for Next.js web app
  - [ ] Set redirect URLs for Flutter apps
  - [ ] Test login flow end-to-end

- [ ] **Storage**
  - [ ] Create Supabase Storage bucket: `subject-media`
  - [ ] Set upload size limits (2MB images, 50MB videos)
  - [ ] Configure CORS for your domains
  - [ ] Test file upload/download

- [ ] **Initial Data**
  - [ ] Create Super Admin user (Joby Sir)
  - [ ] Create office staff profiles
  - [ ] Create stock manager profile
  - [ ] Create technician profiles (20)
  - [ ] Seed product catalog
  - [ ] Seed inventory items (500)
  - [ ] Create sample customers

- [ ] **RLS Policies**
  - [ ] Verify all policies are created
  - [ ] Test role-based access:
    - [ ] Super Admin sees all data
    - [ ] Office Staff see assigned data
    - [ ] Stock Manager see inventory/stock
    - [ ] Technician see only own records
  - [ ] Test INSERT/UPDATE/DELETE permissions

- [ ] **Stored Procedures**
  - [ ] Test `flag_absent_attendance()` manually
  - [ ] Test `auto_off_attendance()` manually
  - [ ] Test `send_warranty_expiry_reminders()` manually
  - [ ] Test `send_amc_expiry_reminders()` manually
  - [ ] Verify notifications created in DB

- [ ] **Triggers**
  - [ ] Verify warranty_end_date auto-calculated
  - [ ] Verify amc_end_date auto-calculated
  - [ ] Verify stock quantity_available auto-calculated
  - [ ] Verify digital_bag variance auto-calculated
  - [ ] Verify billing amount_due auto-calculated
  - [ ] Verify invoice numbers auto-generated

- [ ] **Scheduled Jobs** (Setup External Cron)
  - [ ] Setup 10:30 AM: `flag_absent_attendance()`
  - [ ] Setup 11:59 PM: `auto_off_attendance()`
  - [ ] Setup 8:00 AM Daily: `send_warranty_expiry_reminders()`
  - [ ] Setup 8:00 AM Daily: `send_amc_expiry_reminders()`
  - [ ] Setup Every 5 min: Retry failed notifications

- [ ] **API Integration**
  - [ ] Connect Fast2SMS for WhatsApp
  - [ ] Test notification sending
  - [ ] Setup notification retry logic
  - [ ] Monitor notification logs

- [ ] **Performance Tuning**
  - [ ] Verify all indexes are created
  - [ ] Run ANALYZE on tables
  - [ ] Check query plans for common queries
  - [ ] Monitor slow queries

- [ ] **Monitoring & Alerts**
  - [ ] Setup database monitoring
  - [ ] Configure disk space alerts
  - [ ] Setup backup alerts
  - [ ] Configure failed notification alerts

- [ ] **Security Review**
  - [ ] Verify passwords hashed (Supabase handles)
  - [ ] Verify RLS enforced
  - [ ] Verify audit logs tracked
  - [ ] Test for SQL injection (use parameterized queries)
  - [ ] Verify soft deletes working

- [ ] **Backup & Recovery**
  - [ ] Enable automated backups
  - [ ] Setup weekly manual backups
  - [ ] Test restore procedure
  - [ ] Document recovery steps

---

## Cron Job Setup

### Option 1: Supabase Edge Functions (Recommended)

Create file: `functions/daily-attendance-tasks.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const supabase = createClient(supabaseUrl, supabaseKey);

serve(async (req) => {
  try {
    // Flag absent at 10:30 AM
    if (new Date().getHours() === 10 && new Date().getMinutes() === 30) {
      const { data, error } = await supabase.rpc("flag_absent_attendance");
      if (error) throw error;
      console.log("Flagged absent:", data);
    }

    // Auto-OFF at 11:59 PM
    if (new Date().getHours() === 23 && new Date().getMinutes() === 59) {
      const { data, error } = await supabase.rpc("auto_off_attendance");
      if (error) throw error;
      console.log("Auto-OFF attendance:", data);
    }

    // Send warranty reminders at 8:00 AM
    if (new Date().getHours() === 8 && new Date().getMinutes() === 0) {
      const { data: warrantData, error: warrantError } = await supabase.rpc(
        "send_warranty_expiry_reminders"
      );
      const { data: amcData, error: amcError } = await supabase.rpc(
        "send_amc_expiry_reminders"
      );
      if (warrantError) throw warrantError;
      if (amcError) throw amcError;
      console.log("Warranty reminders:", warrantData);
      console.log("AMC reminders:", amcData);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
```

Deploy:
```bash
supabase functions deploy daily-attendance-tasks
# Setup external cron to call:
# https://your-project.functions.supabase.co/daily-attendance-tasks
# Every minute (checks internal time)
```

### Option 2: AWS Lambda + CloudWatch Events

```python
# lambda_function.py
import psycopg2
import os
from datetime import datetime

def lambda_handler(event, context):
    conn = psycopg2.connect(
        host=os.environ['DB_HOST'],
        database=os.environ['DB_NAME'],
        user=os.environ['DB_USER'],
        password=os.environ['DB_PASSWORD']
    )
    cur = conn.cursor()
    
    try:
        current_hour = datetime.now().hour
        current_minute = datetime.now().minute
        
        # 10:30 AM - Flag absent
        if current_hour == 10 and current_minute == 30:
            cur.execute("SELECT flag_absent_attendance();")
            conn.commit()
            print("Flagged absent attendance")
        
        # 11:59 PM - Auto-OFF
        if current_hour == 23 and current_minute == 59:
            cur.execute("SELECT auto_off_attendance();")
            conn.commit()
            print("Auto-OFF attendance")
        
        # 8:00 AM - Send reminders
        if current_hour == 8 and current_minute == 0:
            cur.execute("SELECT send_warranty_expiry_reminders();")
            cur.execute("SELECT send_amc_expiry_reminders();")
            conn.commit()
            print("Sent reminders")
        
        return {
            'statusCode': 200,
            'body': 'Success'
        }
    finally:
        cur.close()
        conn.close()
```

### Option 3: Easy Cron (External Service)

Go to https://easycron.com
- Create new cron job: `https://api.supabase.co/...` 
- Schedule:
  - Daily at 10:30 AM
  - Daily at 11:59 PM
  - Daily at 8:00 AM

---

## Troubleshooting

### Problem: "Permission denied" errors

**Solution:** Check RLS policies
```sql
-- Verify RLS enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname='public' 
AND rowsecurity=true;

-- Should show all 20 tables with rowsecurity=true
```

### Problem: "Duplicate key value" on invoice_number

**Solution:** Reset sequence
```sql
SELECT MAX(CAST(SUBSTRING(invoice_number FROM 10) AS INTEGER)) 
FROM billing;

-- Then update sequence
SELECT SETVAL('invoice_number_seq', 1234); -- Replace 1234 with max above
```

### Problem: Warranty status not updating

**Solution:** Check trigger
```sql
-- Verify trigger exists
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE trigger_name LIKE '%warranty%';

-- Manually trigger refresh
UPDATE warranty
SET updated_at = NOW()
WHERE warranty_end_date <= CURRENT_DATE
AND status != 'EXPIRED'::warranty_status;
```

### Problem: Digital Bag variance not calculated

**Solution:** Check trigger and recalculate
```sql
-- Force recalculation
UPDATE digital_bag
SET updated_at = NOW()
WHERE variance = 0;

-- Check for variances
SELECT * FROM digital_bag 
WHERE variance_flagged = true
ORDER BY updated_at DESC
LIMIT 10;
```

### Problem: RLS blocking technician from seeing own subject

**Solution:** Check subject assignment
```sql
-- Verify assignment
SELECT s.id, s.assigned_technician_id, p.role
FROM subjects s
JOIN profiles p ON s.assigned_technician_id = p.id
WHERE s.id = 'subject-uuid';

-- Make sure technician role is set
SELECT id, email, role FROM profiles 
WHERE id = auth.uid();
```

### Problem: Notification not sent

**Solution:** Check notification status
```sql
-- Find unsent notifications
SELECT * FROM notifications
WHERE status IN ('PENDING', 'FAILED', 'RETRYING')
ORDER BY created_at DESC
LIMIT 10;

-- Check retry count
SELECT recipient_phone, status, retry_count, failed_reason
FROM notifications
WHERE status = 'FAILED'::notification_status
ORDER BY created_at DESC
LIMIT 5;
```

---

**Ready for Production!** 🚀
