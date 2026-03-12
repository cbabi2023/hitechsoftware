# Hitech Software - Database Schema Documentation

## Overview
Complete PostgreSQL schema for a Service Management System handling:
- **3,000 service calls/month**
- **500 inventory items**
- **20+ technicians**
- **3 platforms**: Web (Next.js), Admin Mobile (Flutter), Technician Mobile (Flutter)
- **4 user roles**: Super Admin, Office Staff, Stock Manager, Technician

---

## Database Architecture

### Normalization
- **3NF Normalized** - Eliminates data redundancy and anomalies
- **Optimized for OLTP** - Transaction-focused design for real-time operations
- **Production-Ready** - Includes error handling, triggers, and audit trails

### Technology Stack
- **Database**: PostgreSQL (Supabase)
- **Authentication**: Supabase Auth + Row Level Security (RLS)
- **Storage**: Supabase Storage (images/videos)
- **Notifications**: Fast2SMS API (WhatsApp only)

---

## Core Entities & Data Model

### 1. **PROFILES (User Management)**
Central user management table extending Supabase auth.users.

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID (PK) | Links to auth.users |
| email | VARCHAR UNIQUE | Unique identifier |
| display_name | VARCHAR | User's full name |
| phone_number | VARCHAR UNIQUE | For SMS/WhatsApp |
| role | user_role ENUM | super_admin, office_staff, stock_manager, technician |
| is_active | BOOLEAN | Account status |

**Key Features:**
- Soft delete with `is_deleted` flag
- Audit timestamp tracking
- Indexed by email, role, and phone

---

### 2. **CUSTOMERS (Customer Information)**
Stores all customer details including location for service routing.

| Column | Type | Purpose |
|--------|------|---------|
| phone_number | VARCHAR UNIQUE | Primary identifier for WhatsApp |
| email | VARCHAR | Secondary contact |
| address | TEXT | Complete service location |
| city | VARCHAR | For area-based reporting |
| latitude/longitude | DECIMAL | GPS coordinates for routing |

**Key Features:**
- Location indexes for geographic queries
- Soft delete support
- Phone number is unique (one customer per number)

---

### 3. **PRODUCTS (Product Catalog)**
Master list of all appliances and products.

| Column | Type | Purpose |
|--------|------|---------|
| product_name | VARCHAR | Display name |
| product_category | VARCHAR | Category for filtering (AC, Fridge, etc.) |
| brand_name | VARCHAR | Brand management |
| model_number | VARCHAR UNIQUE | Model identification |
| default_warranty_months | INTEGER | Default warranty period |
| default_amc_price | DECIMAL | Base AMC price |

**Business Rule:** Each product has product-specific warranty and AMC terms.

---

### 4. **TECHNICIANS (Technician Management)**
Specialized profile for technicians with work-related attributes.

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID (FK to profiles) | Links technician to user profile |
| technician_code | VARCHAR UNIQUE | Identification code (e.g., TECH001) |
| daily_subject_limit | INTEGER | Max 10-12 subjects/day (default 10) |
| digital_bag_capacity | INTEGER | Fixed at 50 items/day per technician |
| bank_account_number | VARCHAR | For payout transfers |

**Key Features:**
- Inherits from profiles (one-to-one relationship)
- Bank details for automated payouts
- Capacity limits enforced at application level

---

### 5. **TECHNICIAN_ATTENDANCE (Daily Attendance)**
Tracks technician check-in/out and attendance status.

```
Business Rules:
✓ ON toggle must be between 12:00 AM - 10:30 AM
✓ OFF toggle allowed only after 6:00 PM
✓ One ON and one OFF only per day
✓ Auto-OFF at 11:59 PM if left ON
✓ Absent flag triggered at 10:30 AM if not ON
✓ Leave entries created in advance (up to 1 week)
```

| Column | Type | Values |
|--------|------|--------|
| status | attendance_status | ON, OFF, LEAVE, ABSENT |
| is_absent_flagged | BOOLEAN | Flagged status for reporting |
| flagged_at | TIMESTAMP | When flagged |

**Indexes:**
```sql
(technician_id, attendance_date) -- For daily reports
UNIQUE(technician_id, attendance_date) -- Only one record per day
```

**Triggers:**
- `flag_absent_attendance()` - Runs at 10:30 AM daily
- `auto_off_attendance()` - Runs at 11:59 PM daily

---

### 6. **SUBJECTS (Service Tickets - Core)**
Main service/CRM tickets representing each service call.

**Status Flow:**
```
PENDING → ALLOCATED → ACCEPTED → IN_PROGRESS → COMPLETED/INCOMPLETE/AWAITING_PARTS/RESCHEDULED
```

| Column | Type | Purpose |
|--------|------|---------|
| subject_number | VARCHAR UNIQUE | Auto-generated ticket ID |
| job_type | job_type | IN_WARRANTY, OUT_OF_WARRANTY, AMC |
| assigned_technician_id | UUID FK | Who's assigned |
| incompletion_reason | incomplete_reason | Dropdown list |
| serial_number | VARCHAR | Product identifier |
| schedule_date | DATE | Planned visit date |

**Job Type Rules:**
- **IN_WARRANTY**: Must upload 7 required items (serial, machine, bill, sheet, defective part, 3 photos, 1 video)
- **OUT_OF_WARRANTY**: Must upload 3 items (serial, machine, invoice)
- **AMC**: Covered under contract

**Incomplete Reasons:**
- CUSTOMER_CANNOT_AFFORD
- POWER_ELECTRICITY_ISSUE
- DOOR_LOCKED_CUSTOMER_UNAVAILABLE
- SPARE_PARTS_NOT_AVAILABLE
- SITE_NOT_READY
- OTHER (requires mandatory text)

**Performance Indexes:**
```sql
(customer_id)
(assigned_technician_id)
(status)
(schedule_date)
(created_at)
(job_type)
```

---

### 7. **WARRANTY (Warranty Management)**
Tracks warranty for each product at each customer.

| Column | Type | Purpose |
|--------|------|---------|
| warranty_start_date | DATE | From purchase/installation |
| warranty_end_date | DATE | Calculated from start + months |
| warranty_months | INTEGER | Duration in months |
| status | warranty_status | ACTIVE, EXPIRING_SOON (30d), EXPIRED, RENEWED, CANCELLED |

**Status Auto-Update Logic:**
```sql
IF TODAY > warranty_end_date: EXPIRED
ELSE IF TODAY > (warranty_end_date - 30 days): EXPIRING_SOON
ELSE: ACTIVE
```

**Notification Flags:**
- `expiry_notified_30_days` - Set when 30-day reminder sent
- `expiry_notified_15_days` - Set when 15-day reminder sent
- `expiry_notified_7_days` - Set when 7-day reminder sent

**Trigger:** Automatically calculates `warranty_end_date` from `warranty_start_date + warranty_months`

---

### 8. **AMC (Annual Maintenance Contracts)**
Product-specific, customer-specific flexible contracts.

```
Business Rules:
✓ 30-day notice period required before activation
✓ New AMC activates ONLY after current warranty/AMC ends
✓ No global defaults - fully configurable per customer
✓ Flexible duration, price, and terms
```

| Column | Type | Purpose |
|--------|------|---------|
| amc_start_date | DATE | Planned start |
| activation_date | DATE | Actual activation (after 30-day notice) |
| required_notice_days | INTEGER | Default 30 days |
| payment_status | payment_status | PENDING, RECEIVED, DISPUTED, WAIVED |

**Status Progression:**
```
ACTIVE → EXPIRING_SOON (30d before) → EXPIRED → RENEWED/CANCELLED
```

---

### 9. **INVENTORY (Parts Catalog)**
Master inventory of all stock items/parts.

| Column | Type | Purpose |
|--------|------|---------|
| item_code | VARCHAR UNIQUE | SKU |
| unit_cost | DECIMAL | Purchase cost |
| mrp_price | DECIMAL | Maximum retail price (MRP) |
| reorder_level | INTEGER | Stock alert threshold |

**Business Rule:** OOW parts - technician can increase above MRP but cannot decrease below MRP.

---

### 10. **STOCK (Current Stock Levels)**
Real-time inventory tracking per item.

| Column | Type | Purpose |
|--------|------|---------|
| quantity_on_hand | INTEGER | Physical quantity |
| quantity_reserved | INTEGER | Allocated to digital bags |
| quantity_available | INTEGER | on_hand - reserved (auto-calculated) |

**Trigger:** `update_stock_available()` auto-calculates available quantity

---

### 11. **STOCK_TRANSACTIONS (Stock Movement History)**
Audit trail for all inventory movements.

| Column | Type | Purpose |
|--------|------|---------|
| transaction_type | VARCHAR | ISSUED, USED, RETURNED, VARIANCE, ADJUSTMENT |
| reference_type | VARCHAR | DIGITAL_BAG, BILLING, SUBJECT |
| reference_id | UUID | Links to originating record |

---

### 12. **DIGITAL_BAG (Daily Bag Issuance)**
Daily issuance of stock items to technicians.

```
Business Rules:
✓ Capacity: Fixed 50 items per technician per day
✓ Tracking: Issued → Used/Returned → Variance detection
✓ Variance: Any discrepancy is flagged
✓ Penalty/Write-off: Configurable policy (not in DB)
```

| Column | Type | Purpose |
|--------|------|---------|
| technician_id + bag_date | UNIQUE | One bag per tech per day |
| total_items_issued | INTEGER | Sum of items issued |
| total_items_used | INTEGER | Sum of items consumed |
| total_items_returned | INTEGER | Sum of items returned |
| variance | INTEGER | issued - used - returned (auto-calc) |
| variance_flagged | BOOLEAN | True if variance != 0 |

**Trigger:** `update_digital_bag_variance()` auto-calculates variance and sets flag

---

### 13. **DIGITAL_BAG_ITEMS (Items in Bag)**
Individual line items in each digital bag.

| Column | Type | Purpose |
|--------|------|---------|
| inventory_id | UUID FK | Which item |
| quantity_issued | INTEGER | How many issued |
| quantity_used | INTEGER | How many used |
| quantity_returned | INTEGER | How many returned |
| subject_id | UUID FK | Applied to which service |

---

### 14. **SUBJECT_MEDIA (Media Files)**
Images, videos, and documents uploaded for service tickets.

```
File Size Limits:
✓ Images: Max 2 MB
✓ Videos: Max 50 MB
```

| Column | Type | Purpose |
|--------|------|---------|
| media_type | VARCHAR | IMAGE, VIDEO, DOCUMENT |
| media_category | VARCHAR | SERIAL_NUMBER, MACHINE, BILL, JOB_SHEET, DEFECTIVE_PART, SITE_PHOTO, SERVICE_VIDEO |
| file_size_bytes | BIGINT | For quota checking |
| storage_path | VARCHAR | Supabase Storage path |
| file_url | VARCHAR | Public/signed URL |

**Indexes:** By subject_id, type, created_at

---

### 15. **BILLING (Invoices)**
Customer invoices for services/parts.

```
Business Rules:
✓ Auto-generated invoice numbers: INV-YYYYMM-00001
✓ In-warranty invoices: Auto-generated by system
✓ Office staff sends to Brand/Dealer manually (not automated)
✓ Technicians have NO role in invoice delivery
✓ Partial payments tracked until fully settled
```

| Column | Type | Purpose |
|--------|------|---------|
| invoice_number | VARCHAR UNIQUE | Auto-generated |
| total_amount | DECIMAL | Subtotal |
| tax_amount | DECIMAL | Tax |
| grand_total | DECIMAL | Total including tax |
| amount_paid | DECIMAL | Received so far |
| amount_due | DECIMAL | Remaining (auto-calc) |
| is_sent_to_brand_dealer | BOOLEAN | Manual tracking |

**Triggers:**
- `auto_generate_invoice_number()` - Generates unique invoice ID
- `update_billing_amount_due()` - Auto-calculates `amount_due`

---

### 16. **BILLING_ITEMS (Invoice Line Items)**
Itemized details in each invoice.

| Column | Type | Purpose |
|--------|------|---------|
| inventory_id | UUID FK | Which item/part |
| service_type | VARCHAR | SERVICE, PARTS, LABOR |
| quantity | INTEGER | Quantity |
| unit_price | DECIMAL | Price per unit |
| line_total | DECIMAL | quantity × unit_price |
| is_oow_parts | BOOLEAN | Out-of-warranty parts |

---

### 17. **BRAND_DEALER_PAYMENTS (Payment Tracking)**
Tracks Brand/Dealer payments against invoices.

**Payment Status Flow:**
```
PENDING → RECEIVED (terminal)
       ↓
    DISPUTED → PENDING (reversal)
       ↓
      WAIVED (terminal - cannot change)
```

| Column | Type | Purpose |
|--------|------|---------|
| payment_amount | DECIMAL | How much paid |
| payment_status | payment_status | PENDING, RECEIVED, DISPUTED, WAIVED |
| dispute_reason | TEXT | If DISPUTED |
| waive_reason | TEXT | If WAIVED |

---

### 18. **PAYOUTS (Technician Payouts)**
Monthly technician salary/commission tracking.

| Column | Type | Purpose |
|--------|------|---------|
| payout_number | VARCHAR UNIQUE | Payout ID |
| payout_period_start/end | DATE | Monthly period |
| total_amount | DECIMAL | Commission amount |
| status | payout_status | PENDING, APPROVED, PAID, REJECTED, DISPUTED |

**Status Progression:**
```
PENDING → APPROVED → PAID
      ↓
    REJECTED
      ↓
    DISPUTED
```

---

### 19. **NOTIFICATIONS (WhatsApp Log)**
Complete audit trail of all WhatsApp messages sent via Fast2SMS.

```
Notification Types:
- SUBJECT_ALLOCATED: Service assigned to customer
- SUBJECT_COMPLETED: Service completed
- WARRANTY_EXPIRY_30_DAYS: Renewal reminder
- WARRANTY_EXPIRY_15_DAYS: Urgent renewal
- WARRANTY_EXPIRY_7_DAYS: Final reminder
- AMC_EXPIRY_30_DAYS: Renewal reminder
- AMC_EXPIRY_15_DAYS: Urgent renewal
- AMC_EXPIRY_7_DAYS: Final reminder
- PAYMENT_PENDING: Invoice sent
- ATTENDANCE_REMINDER: Daily check-in reminder
```

| Column | Type | Purpose |
|--------|------|---------|
| recipient_phone | VARCHAR | Customer/tech phone (with country code) |
| notification_type | VARCHAR | Category of message |
| message | TEXT | Full message body |
| status | notification_status | PENDING, SENT, FAILED, RETRYING |
| fast2sms_response_id | VARCHAR | API response ID for tracking |
| retry_count | INTEGER | Failed attempt count |

**Retry Logic:**
- Auto-retry up to 3 times
- Exponential backoff: 5 min, 15 min, 60 min

---

### 20. **AUDIT_LOG (Complete Audit Trail)**
Records all data changes for compliance and debugging.

| Column | Type | Purpose |
|--------|------|---------|
| user_id | UUID | Who made the change |
| action | VARCHAR | INSERT, UPDATE, DELETE |
| resource_type | VARCHAR | Table name |
| resource_id | UUID | Record ID |
| old_values | JSONB | Before values |
| new_values | JSONB | After values |
| ip_address | INET | Source IP |

---

## Row Level Security (RLS) Policies

### Role-Based Access Control

#### **SUPER_ADMIN (Joby Sir)**
- ✓ Full access to ALL tables and operations
- ✓ View all users, technicians, subjects, billing
- ✓ Approve/reject payments
- ✓ Manage staff access

#### **OFFICE_STAFF**
- ✓ Create/manage subjects (service tickets)
- ✓ Assign technicians
- ✓ Create billing invoices
- ✓ View inventory levels
- ✓ Manage stock
- ✓ Issue digital bags
- ✓ View all customers
- ✗ Cannot delete users
- ✗ Cannot approve payments

#### **STOCK_MANAGER**
- ✓ Full inventory management
- ✓ Full stock management
- ✓ Issue digital bags
- ✓ Manage stock transactions
- ✓ View subjects (read-only)
- ✗ Cannot create subjects
- ✗ Cannot access billing

#### **TECHNICIAN** (Mobile app only)
- ✓ View own assigned subjects
- ✓ Update own subject status
- ✓ Upload media for own subjects
- ✓ View own digital bag
- ✓ Update own attendance
- ✓ View own payouts
- ✗ Cannot view other technicians
- ✗ Cannot view other subjects
- ✗ Cannot create/delete anything

### Sample RLS Policy Structure:

```sql
-- Super Admin: Full access
CREATE POLICY "super_admin_all" ON subjects 
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role = 'super_admin')
  );

-- Office Staff: Full access
CREATE POLICY "staff_all" ON subjects 
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role = 'office_staff')
  );

-- Technician: Own records only
CREATE POLICY "technician_own" ON subjects 
  FOR SELECT USING (
    assigned_technician_id = 
      (SELECT id FROM profiles 
       WHERE id = auth.uid() 
       AND role = 'technician' LIMIT 1)
  );
```

---

## Automated Triggers & Functions

### 1. Warranty Management

**Trigger:** `trg_warranty_calculate_end_date`
```sql
Automatically calculates warranty_end_date = warranty_start_date + (months)
```

**Trigger:** `trg_warranty_update_status`
```sql
Automatically sets status based on current date:
- EXPIRING_SOON if within 30 days of end date
- EXPIRED if past end date
- ACTIVE otherwise
```

### 2. AMC Management

**Trigger:** `trg_amc_calculate_end_date`
```sql
Automatically calculates amc_end_date = amc_start_date + (months)
```

**Trigger:** `trg_amc_update_status`
```sql
Same logic as warranty
```

### 3. Attendance Automation

**Stored Procedure:** `flag_absent_attendance()`
```sql
Runs daily at 10:30 AM
- Checks all technicians with attendance ON or OFF or LEAVE
- Marks ABSENT if not ON and current time >= 10:30 AM
- Sets is_absent_flagged = true
- Sends notification (optional)
```

**Stored Procedure:** `auto_off_attendance()`
```sql
Runs daily at 11:59 PM
- Auto-sets status = OFF for all ON records
- Preserves time_on, sets time_off
```

### 4. Stock Management

**Trigger:** `trg_stock_update_available`
```sql
Automatically calculates: quantity_available = quantity_on_hand - quantity_reserved
```

### 5. Digital Bag Tracking

**Trigger:** `trg_digital_bag_update_variance`
```sql
Automatically calculates: variance = issued - used - returned
Sets variance_flagged = true if variance != 0
```

### 6. Billing

**Trigger:** `trg_billing_auto_invoice_number`
```sql
Generates unique invoice: INV-YYYYMM-00001 format
Uses sequence: invoice_number_seq
```

**Trigger:** `trg_billing_update_amount_due`
```sql
Automatically calculates: amount_due = grand_total - amount_paid
```

### 7. Notification Procedures

**Stored Procedure:** `send_warranty_expiry_reminders()`
```sql
Sends notifications at 30, 15, and 7 days before warranty expiry
Sets flags to prevent duplicate notifications
Integrates with Fast2SMS API
```

**Stored Procedure:** `send_amc_expiry_reminders()`
```sql
Same as warranty but for AMC contracts
```

---

## Performance Optimization

### Index Strategy

1. **Foreign Key Indexes** - Automatic FK lookups
2. **Search Indexes** - Phone, email, codes for filtering
3. **Date Range Indexes** - Subject dates, warranty dates
4. **Composite Indexes** - (technician_id, date), (customer_id, created_at)
5. **Unique Indexes** - Prevent duplicates (invoice_number, subject_number, item_code)

### Query Optimization Examples

```sql
-- Fast: Subject allocation with technician details
SELECT s.*, p.display_name 
FROM subjects s
JOIN technicians t ON s.assigned_technician_id = t.id
JOIN profiles p ON t.id = p.id
WHERE s.assigned_technician_id = $1 
  AND s.status = 'IN_PROGRESS'::subject_status;
-- Uses: idx_subjects_technician_id, idx_subjects_status

-- Fast: Digital bag checkout
SELECT db.*, 
       SUM(dbi.quantity_used) as items_used,
       SUM(dbi.quantity_returned) as items_returned
FROM digital_bag db
LEFT JOIN digital_bag_items dbi ON db.id = dbi.digital_bag_id
WHERE db.technician_id = $1 AND db.bag_date = CURRENT_DATE
GROUP BY db.id;
-- Uses: idx_digital_bag_technician_date

-- Fast: Billing dashboard
SELECT b.*, c.customer_name, COUNT(bi.id) as item_count
FROM billing b
JOIN customers c ON b.customer_id = c.id
LEFT JOIN billing_items bi ON b.id = bi.billing_id
WHERE b.invoice_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY b.id, c.customer_name
ORDER BY b.invoice_date DESC;
-- Uses: idx_billing_customer_id, idx_billing_invoice_date
```

---

## Cron Job Configuration (Required)

Deploy these as serverless functions or scheduled tasks:

| Job | Schedule | Function | Purpose |
|-----|----------|----------|---------|
| Flag Absent | 10:30 AM daily | `flag_absent_attendance()` | Mark missed check-ins |
| Auto-OFF Attendance | 11:59 PM daily | `auto_off_attendance()` | Close daily attendance |
| Warranty Reminders 30d | 8:00 AM daily | `send_warranty_expiry_reminders()` | 30-day notices |
| Warranty Reminders 15d | 8:00 AM daily | `send_warranty_expiry_reminders()` | 15-day notices |
| Warranty Reminders 7d | 8:00 AM daily | `send_warranty_expiry_reminders()` | 7-day notices |
| AMC Reminders 30d | 8:00 AM daily | `send_amc_expiry_reminders()` | 30-day notices |
| AMC Reminders 15d | 8:00 AM daily | `send_amc_expiry_reminders()` | 15-day notices |
| AMC Reminders 7d | 8:00 AM daily | `send_amc_expiry_reminders()` | 7-day notices |
| Update Warranty Status | 12:00 AM daily | SQL: UPDATE warranty SET status... | Refresh statuses |
| Update AMC Status | 12:00 AM daily | SQL: UPDATE amc SET status... | Refresh statuses |
| Retry Failed Notifications | Every 5 min | SQL: Retry FAILED/RETRYING | Resend WhatsApp |
| Cleanup Old Audit Logs | Weekly (Sunday) | DELETE audit_log WHERE created_at < ... | Maintenance |

---

## Setup Instructions for Supabase

### 1. Copy the complete SQL schema
```bash
# All content from hitech_database_schema.sql
```

### 2. In Supabase Dashboard:
- Go to SQL Editor
- Create new query
- Paste entire schema
- Run

### 3. Enable Realtime (Optional for web pushes):
```sql
-- In SQL Editor
ALTER PUBLICATION supabase_realtime ADD TABLE subjects;
ALTER PUBLICATION supabase_realtime ADD TABLE technician_attendance;
ALTER PUBLICATION supabase_realtime ADD TABLE digital_bag;
```

### 4. Setup Auth:
- Enable Supabase Auth
- Configure providers (Email/Phone)
- Set redirect URLs

### 5. Setup Storage:
- Create bucket: `subject-media`
- Set policy for uploads
- Configure CORS

### 6. Scheduled Functions:
- Use Supabase Edge Functions or external cron (AWS Lambda, Vercel Cron, etc.)
- Call stored procedures at specified times

---

## Data Migration Path

If migrating from existing system:

1. **Users** → profiles (map roles)
2. **Customers** → customers table
3. **Products** → products table
4. **Technicians** → profiles + technicians (two-step)
5. **Historical Data** → Consider data warehouse, archive
6. **Active Records** → Maintain parallel system during transition

---

## Security Best Practices Implemented

✓ **Row Level Security (RLS)** - Enforced at DB level
✓ **Audit Logging** - All changes tracked
✓ **Soft Deletes** - Data never truly deleted
✓ **Timestamps** - created_at, updated_at on all tables
✓ **Unique Constraints** - Prevents duplicates
✓ **Foreign Key Constraints** - Referential integrity
✓ **Enum Types** - Fixed values, prevents invalid data
✓ **JSONB Audit** - Complete change history

---

## Capacity Planning

### Current Schema Supports:
- **Customers**: Unlimited (indexed for performance)
- **Subjects**: 3,000+/month = 100/day (indexed by date)
- **Technicians**: 20+ (capacity limit in digital_bag table)
- **Inventory Items**: 500+ (indexed by code/category)
- **Daily Bags**: 20 technicians × 1 bag = 20 bags/day
- **Digital Bag Items**: 20 × 50 = 1,000 items/day max
- **Media Files**: 1,000s (use Supabase Storage, DB only tracks metadata)
- **Notifications**: Unlimited (indexed for search)

### Storage Estimates:
- **Database**: 50-100 GB for 1 year of data (3K calls/mo)
- **Media Storage**: 1-2 TB for images/videos at 50MB limit
- **Audit Logs**: Archive after 1 year

---

## Frequently Asked Questions

**Q: How is warranty calculated?**
A: `warranty_end_date = warranty_start_date + (warranty_months intervals)`. Auto-calculated by trigger.

**Q: Can technician decrease OOW part price below MRP?**
A: No. Application layer enforces minimum = MRP. DB stores unit_cost.

**Q: What happens if technician forgets to mark attendance?**
A: Flagged ABSENT at 10:30 AM automatically. Can be manually corrected by office staff.

**Q: Can AMC activate immediately?**
A: No. 30-day notice required. activation_date is set after notice period. New AMC waits until current warranty/AMC ends.

**Q: What if stock variance occurs?**
A: Flagged automatically. Variance policy (penalty/write-off) managed by office staff in application layer.

**Q: Are all notifications WhatsApp only?**
A: Yes. No email, no SMS, no push notifications. All via Fast2SMS API.

**Q: Can Brand/Dealer payment be reversed?**
A: Yes, if status is RECEIVED, can change to PENDING with mandatory reversal reason.

---

## Support & Maintenance

- Monitor database size monthly
- Archive audit logs annually
- Review RLS policies quarterly
- Update indexes based on query patterns
- Backup database daily
- Test disaster recovery quarterly

---

**Schema Version**: 1.0
**Last Updated**: March 12, 2026
**Created for**: Hitech Software Service Management System
**Database**: PostgreSQL (Supabase)
