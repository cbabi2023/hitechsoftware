# HitechSoftware — Service Management System

> **Document Type:** Software Requirements Specification (SRS)
> **Module:** Service Management
> **Version:** 1.2
> **Status:** Draft
> **Prepared By:** Development Team
> **Last Updated:** 2026-03-11

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Monorepo Structure](#2-monorepo-structure)
3. [Tech Stack](#3-tech-stack)
4. [API Documentation](#4-api-documentation)
5. [User Roles & Permissions](#5-user-roles--permissions)
6. [Module 1 — Add Service Subject](#6-module-1--add-service-subject)
7. [Module 2 — Service Allocation](#7-module-2--service-allocation)
8. [Module 3 — Technician Attendance & Availability](#8-module-3--technician-attendance--availability)
9. [Module 4 — On-Site Visit & Incomplete Service](#9-module-4--on-site-visit--incomplete-service)
10. [Module 5 — Warranty Verification](#10-module-5--warranty-verification)
11. [Module 6 — In-Warranty Service Documentation](#11-module-6--in-warranty-service-documentation)
12. [Module 7 — Out-of-Warranty Service & Charge Collection](#12-module-7--out-of-warranty-service--charge-collection)
13. [Module 8 — Annual Maintenance Contract (AMC)](#13-module-8--annual-maintenance-contract-amc)
14. [Module 9 — Inventory Module](#14-module-9--inventory-module)
15. [Module 10 — Stock Module](#15-module-10--stock-module)
16. [Module 11 — Product Distribution (Digital Bag)](#16-module-11--product-distribution-digital-bag)
17. [End-to-End Workflow](#17-end-to-end-workflow)
18. [Business Rules & Constraints](#18-business-rules--constraints)
19. [Open Items & Questions](#19-open-items--questions)
20. [Getting Started](#20-getting-started)
21. [Revision History](#21-revision-history)
22. [Documentation Maintenance During Development](#22-documentation-maintenance-during-development)

---

## 1. Introduction

### 1.1 Purpose
This document defines the functional requirements for the **Service Management System** built by HitechSoftware. It serves as a reference for developers, QA engineers, and stakeholders throughout the development lifecycle.

### 1.2 System Overview
The Service Management System supports two primary user groups who collaborate to handle end-to-end service requests:

| Team | Role | Responsibilities |
|---|---|---|
| Office Staff | Service Coordinator | Log subjects, assign technicians, manage customer data, monitor status |
| Technician | Field Engineer | Accept/reject assigned subjects, perform on-site service, update completion details |

### 1.3 Terminology
Throughout this document, the term **"Subject"** refers to a single service request, as used by the application users.

### 1.4 Scope
This system covers the following functional areas:

- Adding a Service Subject (incl. Product & Warranty Details)
- Service Allocation to Technicians
- Technician Attendance & Availability Management
- On-Site Visit & Incomplete Service Handling
- Warranty Verification
- In-Warranty Service Documentation & Brand/Dealer Billing
- Out-of-Warranty Service & Charge Collection
- Annual Maintenance Contract (AMC) — Registration, Notifications & Renewal
- Inventory Module — Product Catalogue Management
- Stock Module — Stock Receipt & Balance Tracking
- Product Distribution to Technicians (Digital Bag)

---

## 2. Monorepo Structure

```
HitechSoftware/
├── web/                  # Next.js 16.1.6 — Superadmin & Staff web portal (TypeScript + Tailwind + Supabase)
├── hitech_admin/         # Flutter 3.38.9 — Admin & Staff mobile app
└── hitech_technician/    # Flutter 3.38.9 — Technician mobile app
```

---

## 3. Tech Stack

| Project | Platform | Stack | Users |
|---|---|---|---|
| `web` | Web | Next.js 16.1.6, TypeScript, Tailwind CSS, App Router, Supabase | Superadmin, Office Staff |
| `hitech_admin` | Mobile (iOS/Android) | Flutter 3.38.9, Dart 3.10.8 | Admin, Staff |
| `hitech_technician` | Mobile (iOS/Android) | Flutter 3.38.9, Dart 3.10.8 | Technicians |

**Infrastructure:** Supabase (PostgreSQL, Auth, Storage, Realtime)

---

## 4. API Documentation

Complete API contract for Next.js backend and Flutter clients:

- `web/docs/API_DOCUMENTATION.md`

This document is the single source of truth for endpoint paths, request/response contracts, auth rules, and Flutter integration guidance.

API documentation is mandatory maintenance. Any change to route handlers, request or response payloads, auth rules, repository-backed server behavior, or client-consumed data contracts must be reflected in `web/docs/API_DOCUMENTATION.md` before the task is considered complete.

### API Documentation Compliance Gate (Mandatory)

For every completed work item, one of the following must be true:

- API changed:
	- Update `web/docs/API_DOCUMENTATION.md` in the same task.
	- Include exact endpoint/path, auth/permission changes, request/response schema changes, and error behavior changes.
	- Add verification notes in `doc/WORK_LOG.md` that API documentation was updated.
- API not changed:
	- Add an explicit statement in `doc/WORK_LOG.md` that API documentation review was done and no contract change was required.

No task is considered complete until this API documentation check is recorded.

---

## 5. User Roles & Permissions

| Feature | Super Admin | Office Staff | Stock Manager | Technician |
|---|---|---|---|---|
| Toggle Availability (Attendance) | View Only | View Only | View Only | Yes — self-manage |
| Mark Advance Leave | No | No | No | Yes |
| Add Subject | Yes | Yes | No | No |
| Subject List Page | View, Edit, Delete any subject | View and Edit subjects | View only | View only — assigned subjects only |
| Allocate Technician | Yes | Yes | No | No |
| Reassign Subject | Yes | Yes | No | No |
| Accept / Reject Subject | No | No | No | Yes |
| Mark Incomplete Visit Reason | No | No | No | Yes |
| Check Warranty Status | Yes | Yes | Yes | Yes |
| Upload Service Documents | No | No | No | Yes |
| Collect Charges | Yes / System | Yes / System | No | Yes |
| View Attendance Dashboard | Yes | Yes | View only | Self only |

---

## 6. Module 1 — Add Service Subject

Office staff manually log service requests (called **Subjects**) into the system.

### Subject Entry Form Fields

| # | Field | Description | Required | Input Type |
|---|---|---|---|---|
| 1 | Priority | Service urgency level (Low / Medium / High / Critical) with description | Yes | Dropdown + Text |
| 2 | Allocated Date | Scheduled date for service | Yes | Date Picker |
| 3 | Type of Service | Installation or Ordinary Service | Yes | Dropdown |
| 4 | Category | Product category (e.g., AC, Washing Machine, Refrigerator) | Yes | Dropdown |
| 5 | Customer Details | Full name, contact number, address, notes | Yes | Form Group |
| 6 | Brand / Dealer | Name of the brand or dealer providing service | Yes | Dropdown / Text |

### Field 12 — Product Details Section

All Product Details fields are optional.

| Field | Input Type |
|---|---|
| Product Name | Text input |
| Serial Number | Text input |
| Product Description | Text area |
| Purchase Date | Date picker |
| Warranty End Date | Date picker |
| AMC End Date | Date picker |

### Service Charge Determination (Developer Snapshot)

| Condition | Subject Flags | UI Badge | Charged To | Billing Status at Creation/Update |
|---|---|---|---|---|
| `AMC End Date >= today` | `is_amc_service = true`, `is_warranty_service = false` | `Free Service — Under AMC` (green) | Brand/Dealer | `due` |
| `Warranty End Date >= today` and AMC not active | `is_amc_service = false`, `is_warranty_service = true` | `Under Warranty` (blue) | Brand/Dealer | `due` |
| AMC and Warranty both missing/expired | `is_amc_service = false`, `is_warranty_service = false` | `Out of Warranty` | Customer | `not_applicable` |

**Precedence Rule:** AMC has higher priority than Warranty when both are active.

### Priority Levels

| Level | Label | Description |
|---|---|---|
| P1 | Critical | Immediate action required; SLA breach risk |
| P2 | High | Urgent; must be addressed same day |
| P3 | Medium | Standard service within agreed timeline |
| P4 | Low | Can be scheduled at convenience |

### Type of Service
- **Installation** — New product setup at customer premises
- **Ordinary Service** — Routine maintenance, repair, or inspection

### Initial Status
Upon successful submission: **`PENDING`** — Awaiting allocation to a technician.

---

## 7. Module 2 — Service Allocation

### Allocation Flow

| Step | Action | Details |
|---|---|---|
| 1 | Staff Allocates Subject | Staff selects a technician and assigns the Pending subject |
| 2 | Technician Notified | Technician receives notification with subject details |
| 3 | Technician Responds | Technician must Accept or Reject |
| 4A | If Accepted | Technician confirms preferred visit date & time |
| 4B | If Rejected | Technician provides mandatory rejection reason; subject returns to Pending |

### Subject Status Transitions

| From | To | Trigger |
|---|---|---|
| Pending | Allocated | Staff assigns to technician |
| Allocated | Accepted | Technician accepts + provides date/time |
| Allocated | Pending | Technician rejects with reason |
| Accepted | In Progress | Technician visits the site |
| In Progress | Incomplete | Visit done but work not completed |
| In Progress | Completed | Work successfully done |

### Rules
- Rejection reason must be a minimum of **10 characters**
- Confirmed visit date and time is **mandatory** upon acceptance
- Rejection is logged with timestamp and technician details; Office Staff are notified for re-allocation

---

## 8. Module 3 — Technician Attendance & Availability

### Availability Toggle

| Toggle State | Technician Status | Effect |
|---|---|---|
| OFF (Default) | Unavailable | Hidden from allocation pool; cannot be assigned |
| ON | Available | Visible to staff; can be assigned subjects |

**Rules:**
- Defaults to **OFF** at midnight every day (automatic reset)
- Technician must manually toggle **ON** each working day
- System logs exact timestamps when toggled ON and OFF
- Technicians not toggled ON by configurable cut-off time are automatically **flagged as Absent**

### Attendance Log Fields

| Field | Description |
|---|---|
| Technician Name | Full name |
| Date | Calendar date |
| Check-In Time | Timestamp when toggle turned ON |
| Check-Out Time | Timestamp when toggle turned OFF |
| Status | Present / Absent / Half Day (derived) |
| Subjects Handled | Count of subjects assigned that day |

### Staff Availability Dashboard
Real-time panel showing:
- All technicians with current toggle status (Available / Unavailable)
- Number of subjects already assigned today
- Technician skill/category specialisation (AC, Washing Machine, etc.)
- Geographical zone / coverage area

### Forward Scheduling & Conflict Detection

| Trigger | System Action | Notified |
|---|---|---|
| Technician not available by cut-off on scheduled date | Subject flagged as `At Risk — Technician Unavailable` | Office Staff (push/SMS/dashboard) |
| Technician marks advance leave covering scheduled date | Subject immediately flagged for reassignment | Office Staff (proactive alert) |

### Reassignment Flow

| Step | Actor | Action |
|---|---|---|
| 1 | System | Flag subject `At Risk`; alert Office Staff |
| 2 | Office Staff | Open subject → select `Reassign Technician` |
| 3 | System | Display available technicians for that date |
| 4 | Office Staff | Select replacement technician |
| 5 | System | Notify new technician; log reassignment with reason and timestamp |
| 6 | System | Notify original technician of reassignment |
| 7 | New Technician | Accept or reject (same flow as initial allocation) |

**Reassignment Log captures:** original technician, new technician, reason (Absent / Unavailable / Leave / Other), reassigned by (staff name), timestamp.

### Advance Leave
- Technicians mark future date(s) as `On Leave`
- System blocks those dates in the allocation pool
- Subjects already scheduled during that period are immediately flagged for reassignment
- Office Staff receive a proactive alert

---

## 9. Module 4 — On-Site Visit & Incomplete Service

### Incomplete Visit Reasons

| # | Reason | Description & System Action |
|---|---|---|
| 1 | Customer Cannot Afford | Log issue; staff to follow up on payment arrangement |
| 2 | Power / Electricity Issue | Power cut at site; reschedule visit required |
| 3 | Door Lock / Customer Unavailable | Customer not present; mark for follow-up rescheduling |
| 4 | Spare Parts Not Available | Technician initiates parts order request within the system → status `Awaiting Parts` |
| 5 | Site Not Ready | Infrastructure incomplete; requires site readiness before revisit |
| 6 | Other | Mandatory free-text description required |

### Spare Parts Order (Reason #4)
Collects: Part Name / Part Number, Quantity Required, Estimated Delivery Date, Supplier / Source (optional).

---

## 10. Module 5 — Warranty Verification

| Condition | Next Step |
|---|---|
| Warranty **ACTIVE** (not expired) | → Module 6: In-Warranty Service. No charges applicable. |
| Warranty **EXPIRED** | → Module 7: Out-of-Warranty Service. Charges applicable. |

**Data points used:** Product Purchase Date, Warranty Duration (months), Warranty Expiry Date (auto-calculated), Serial Number.

---

## 11. Module 6 — In-Warranty Service Documentation

No charges are collected from the customer. Comprehensive documentation must be uploaded before the subject can be marked **Completed**.

### Required Documentation

| # | Document | Format | Notes |
|---|---|---|---|
| 1 | Serial Number Image | Photo (JPG/PNG) | Clear, readable label |
| 2 | Machine / Product Image | Photo (JPG/PNG) | Full view at customer site |
| 3 | Bill / Invoice Image | Photo (JPG/PNG) | Original purchase bill |
| 4 | Job Sheet | Photo or PDF | Signed by technician and customer |
| 5 | Defective Part Image | Photo (JPG/PNG) | Image of defective part |
| 6–7 | Additional Site Photos | Photo (JPG/PNG) | Up to 2–3 supporting images |
| 8 | Service Video | Video (MP4/MOV) | Walkthrough of issue and service |

**Total required:** 7–8 images + 1 video | **Customer charge:** None

### Brand / Dealer Billing

| Step | Actor | Action |
|---|---|---|
| 1 | System | Auto-generate draft invoice record against linked Brand / Dealer |
| 2 | Office Staff | Review; confirm or adjust amounts |
| 3 | Office Staff | Download / print invoice; send to Brand / Dealer manually (outside app) |
| 4 | Office Staff | Update payment status to `Received` once payment is in |
| 5 | System | Record payment date and mode; mark billing as `Received` |

### In-Warranty Payment Statuses

| Status | Meaning | Who Sets It |
|---|---|---|
| Pending | Service complete; invoice auto-generated; awaiting payment | System (auto) |
| Received | Full payment received from Brand / Dealer | Office Staff |
| Disputed | Brand / Dealer raised an objection; invoice must be corrected and re-issued | Office Staff |
| Waived | Business decided not to collect (mandatory reason required) | Office Staff |

### Payment Status Transition Rules

| From | To | Condition |
|---|---|---|
| Pending | Received | Staff confirms full payment; date and mode entered |
| Pending | Disputed | Staff marks disputed; reason logged |
| Pending | Waived | Staff enters mandatory waiver reason |
| Disputed | Pending | Staff corrects invoice; auto-resets to Pending |
| Received | Pending | Reversal (e.g., bounced cheque); mandatory reversal reason required |
| Waived | — | Terminal state; cannot be changed |

### Overdue Payment Reminder
- Configurable threshold (default: **15 days** after invoice date)
- System flags record as `Overdue` and alerts staff via in-app + optional SMS/push
- Flag clears automatically when status moves to Received, Waived, or Disputed

### Invoice Fields
Auto-generated invoice captures: Invoice Number, Brand/Dealer Name, Subject Reference, Service Date, Description, Labour Charge, Parts Charge, Total Amount Due, Invoice Date, Due Date, Dispute/Waiver/Reversal Reason, Payment Received Date, Payment Mode, Overdue Flag.

---

## 12. Module 7 — Out-of-Warranty Service & Charge Collection

### Required Documentation (3 mandatory images)

| # | Document | Format |
|---|---|---|
| 1 | Serial Number Image | Photo (JPG/PNG) |
| 2 | Product Image | Photo (JPG/PNG) |
| 3 | Invoice / Bill Image | Photo (JPG/PNG) |

### Charge Collection

| # | Charge Type | Description |
|---|---|---|
| 1 | Visiting Charge | Fixed fee for technician's site visit (mandatory) |
| 2 | Parts / Inventory Charge | Cost of spare parts used — auto-populated from Inventory MRP (not negotiable) |
| 3 | AMC | Optional recurring maintenance contract |

### Payment Modes
Cash · Online Transfer / UPI · Card · Cheque

A receipt/acknowledgment is generated upon successful payment recording. Payment mode must be recorded before closing the subject.

---

## 13. Module 8 — Annual Maintenance Contract (AMC)

### AMC Registration Fields

| # | Field | Required | Input Type |
|---|---|---|---|
| 1 | Customer Name | Yes | Auto-fill / Text |
| 2 | Product / Category | Yes | Dropdown |
| 3 | Serial Number | Yes | Text |
| 4 | AMC Plan Type | Yes | Dropdown (Comprehensive / Labour Only) |
| 5 | AMC Start Date | Yes | Date Picker |
| 6 | AMC Duration (months) | Yes | Number |
| 7 | AMC End Date | Auto | Read-only (Start + Duration) |
| 8 | AMC Amount | Yes | Number |
| 9 | Payment Mode | Yes | Dropdown |
| 10 | Number of Service Visits | Yes | Number |
| 11 | Brand / Dealer | Yes | Dropdown |

### WhatsApp Expiry Notifications

| Trigger | Sent To | Purpose |
|---|---|---|
| 30 days before AMC expiry | Customer (WhatsApp) | Early renewal reminder |
| 15 days before AMC expiry | Customer (WhatsApp) | Second reminder |
| 7 days before AMC expiry | Customer (WhatsApp) | Final urgent reminder |
| 30 days before Warranty expiry | Customer (WhatsApp) | Warranty expiry notice; offer AMC enrolment |
| 15 days before Warranty expiry | Customer (WhatsApp) | Second warranty reminder |
| 7 days before Warranty expiry | Customer (WhatsApp) | Final warranty reminder |

> Note: WhatsApp templates must be pre-approved via WhatsApp Business API. Messages include: customer name, product name, expiry date, renewal contact.

### AMC Status Lifecycle

| Status | Description |
|---|---|
| Active | AMC valid; customer entitled to free service visits |
| Expiring Soon | Expiry within 30 days; notifications triggered |
| Expired | End date passed; not renewed |
| Renewed | New AMC cycle paid; new contract record created |
| Cancelled | Cancelled before expiry; partial refund applies per business rule |

### Service Visit Tracking
- Total visits included in plan
- Visits used (linked to completed subjects under this AMC)
- Visits remaining
- Alert when all included visits are exhausted

---

## 14. Module 9 — Inventory Module

Master product catalogue. Every product must be registered here before it can appear in stock entries or be distributed to technicians.

### Add Product Fields

| # | Field | Required | Notes |
|---|---|---|---|
| 1 | Stock Category | Yes | Dropdown + Add New (e.g., AC, Washing Machine) |
| 2 | Product Type | Yes | Dropdown + Add New (e.g., Spare Part, Accessory, Consumable) |
| 3 | Product Name | Yes | Full descriptive name |
| 4 | Product Description | No | Specs, use case, compatibility |
| 5 | Material Code | Yes (Unique) | Primary lookup key; alphanumeric, no spaces (e.g., `AC-FILT-001`) |
| 6 | Purchase Price | Yes | Default cost price from supplier |
| 7 | MRP | Yes | Max Retail Price — sold to customer |
| 8 | Brand | Yes | Dropdown / Text |
| 9 | HSN / SAC Code | Yes | For GST compliance |
| 10 | Warranty Period (months) | No | Auto-fills Subject creation |
| 11 | Unit of Measure | Yes | Piece, Set, Litre, Metre, etc. |

### Material Code Rules
- Must be **unique system-wide**; duplicates rejected with a clear error
- **Cannot be changed** once assigned (permanent identifier)
- Used as primary lookup key in Stock entries and Product Distribution
- Format: alphanumeric, no spaces (e.g., `AC-FILT-001`, `WM-MTR-023`)

---

## 15. Module 10 — Stock Module

Records physical receipt of products into the warehouse. Each entry is validated by a supplier invoice.

### Add Stock Entry Fields

| # | Field | Required | Notes |
|---|---|---|---|
| 1 | Invoice Number | Yes (Unique per supplier) | Prevents duplicate stock entries |
| 2 | Invoice Date | Yes | Date on supplier invoice |
| 3 | Supplier / Brand | Yes | Dropdown |
| 4 | Material Code | Yes | Auto-lookup from Inventory |
| 5 | Product Name | Auto | Read-only (from Inventory) |
| 6 | Category / Type | Auto | Read-only (from Inventory) |
| 7 | Purchase Price | Yes | Editable per invoice |
| 8 | MRP | Yes | Editable per invoice |
| 9 | Quantity Received | Yes | Number |
| 10 | HSN / SAC Code | Auto | Editable override |
| 11 | Received Date | Yes | Date Picker |
| 12 | Notes | No | Damaged items, partial delivery remarks |

### Anti-Duplication Rule
Combination of **Invoice Number + Supplier** must be unique. Duplicate entries are rejected with a warning showing the original entry date.

### Running Stock Balance

| Component | Description |
|---|---|
| Opening Stock | Quantity at start of period |
| Received | Added via stock entries |
| Distributed to Technicians | Issued via Digital Bag |
| Used in Services | Consumed in completed service subjects |
| Returned by Technicians | Returned to store at end of day |
| **Closing Stock** | Opening + Received − Distributed + Returned − Used |

---

## 16. Module 11 — Product Distribution (Digital Bag)

Manages how products and spare parts are issued from central stock to individual technicians each working day.

### Digital Bag

| Attribute | Details |
|---|---|
| Bag Capacity | Default **50 units** per technician per day (configurable per technician by admin) |
| Visibility | Technician sees bag contents, quantity, and remaining capacity in real-time |
| Overflow Prevention | System blocks issuing if capacity limit is reached |
| Daily Reset | Bag cleared each day via use, sale, or return |

### Issuing Products (Staff → Technician)

| Step | Actor | Action |
|---|---|---|
| 1 | Office Staff | Open technician's Digital Bag from distribution panel |
| 2 | Office Staff | Select product(s) by material code or name |
| 3 | Office Staff | Enter quantity; system checks bag capacity and available stock |
| 4 | System | Deduct from central stock; add to technician's bag |
| 5 | System | Log transaction (technician, product, quantity, date, time, staff) |
| 6 | Technician App | Technician sees updated bag contents immediately |

### Technician Product Request
- Technician submits request (product + quantity) from their app
- Request appears in Staff dashboard as pending
- Staff approves or rejects; technician notified with reason
- If approved, product is issued to Digital Bag

### Daily Return Process

| Step | Actor | Action |
|---|---|---|
| 1 | Technician / Staff | Technician presents remaining items; staff verifies against bag records |
| 2 | Office Staff | Enter return quantities per product |
| 3 | System | Add returned quantities back to central stock |
| 4 | System | Clear returned items from Digital Bag |
| 5 | System | Log: technician, product, quantity returned, date, time |

> **Rule:** Technician must return items from previous days before re-requesting for the current day. This ensures daily tracking cycle accuracy.

### Product Tracking Dashboard (Per Technician Per Day)

| Metric | Description |
|---|---|
| Taken (Issued) | Total quantity issued today |
| Sold / Used | Quantity consumed in completed subjects |
| Remaining (in Bag) | Taken − Sold − Returned |
| Returned | Quantity returned to central stock |
| Variance | Taken − Sold − Returned (must be zero; non-zero is flagged) |

> Any variance (non-zero) must be **flagged and investigated**. Silent discrepancies are not permitted.

### Linking Product Usage to Service Subjects
- Technician selects parts used from Digital Bag during service completion
- Quantity deducted from bag; recorded against the subject
- **OOW services:** parts charge = MRP from Inventory (auto-populated; not negotiable)
- **In-warranty services:** usage recorded for Brand / Dealer billing

---

## 17. End-to-End Workflow

| Step | Actor | Action | Status |
|---|---|---|---|
| 1 | Technician | Toggle Availability ON at start of working day | `AVAILABLE` |
| 2 | Office Staff | Create Subject with all required fields | `PENDING` |
| 3 | Office Staff | Allocate Subject to an available technician | `ALLOCATED` |
| 4A | Technician | Reject with reason | `PENDING` (re-allocate) |
| 4B | Technician | Accept with confirmed date & time | `ACCEPTED` |
| 5 | System | Check technician availability on scheduled date | — |
| 5A | System / Staff | Conflict detected — technician unavailable | `AT RISK / REASSIGNED` |
| 6 | Technician | Visit site on scheduled date | `IN PROGRESS` |
| 7A | Technician | Cannot complete — select reason | `INCOMPLETE / AWAITING PARTS` |
| 7B | Technician | Work completed — proceed to warranty check | `IN PROGRESS` |
| 8A | System / Staff | Warranty ACTIVE — In-warranty process | `IN-WARRANTY DOCS` |
| 8B | System / Staff | Warranty EXPIRED — Out-of-warranty process | `OOW DOCS + CHARGES` |
| 9 | Technician / Staff | Upload all required documents | `DOCUMENTS SUBMITTED` |
| 10 | System / Staff | Confirm charges collected (OOW) / Nil (Warranty) | `COMPLETED` |

---

## 18. Business Rules & Constraints

1. Core Subject Entry fields are mandatory; Product Details section fields are optional.
2. Availability Toggle defaults to **OFF** at midnight every day; technicians must manually toggle ON each working day.
3. A technician who has not toggled ON by the configured cut-off time is automatically marked **Absent**.
4. Staff may only assign a subject to a technician who is **Available** (toggle ON) or confirmed available for the scheduled date.
5. When a scheduled technician is unavailable on the service date, the system must automatically flag the subject and alert Office Staff for reassignment.
6. A Subject may only be assigned to **one technician at a time**.
7. A technician's rejection reason must be a **minimum of 10 characters**.
8. A confirmed visit date and time is **mandatory** upon acceptance.
9. `Spare Parts Not Available` reason must trigger a parts order form.
10. Warranty check must be completed **before** uploading service documentation.
11. In-warranty subjects require **all 7–8 images and 1 video** before marking Completed.
12. Out-of-warranty subjects require **all 3 mandatory images** before marking Completed.
13. At least one charge entry (Visiting Charge) is mandatory for all out-of-warranty subjects.
14. Payment mode must be recorded before closing an out-of-warranty subject.
15. All reassignment events must be logged with original technician, new technician, reason, and acting staff member.
16. Material Code must be **unique** across Inventory; duplicates are rejected.
17. Stock entries require a valid Invoice Number and Invoice Date; duplicate invoice numbers from the same supplier are rejected.
18. Technician Digital Bag capacity defaults to **50 units**; configurable per technician without a code change.
19. Products **cannot be issued** to a technician if their Digital Bag has reached its capacity limit.
20. All unused products must be **returned to central stock** before the bag limit resets for the next day.
21. Product usage during a service must be **linked to a specific Subject**; unlinked consumption is not permitted.
22. Any variance between products issued and (products used + returned) must be **flagged for investigation**.
23. WhatsApp notifications for AMC and warranty expiry must be sent at **30, 15, and 7 days** before expiry. No notification sent on or after expiry.
24. In-warranty services generate a Brand/Dealer billing record automatically upon completion; payment status begins as **Due**.
25. Technicians can only see subjects that are assigned to them. All other roles see all subjects.
26. If `AMC End Date` is filled and greater than today, the subject is flagged as AMC Active.
27. AMC Active subjects must show `Free Service — Under AMC` badge on subject detail and customer is not charged.
28. For AMC Active subjects, invoice is generated against Brand/Dealer, payment status starts as **Due**, and remains Due until office staff marks it as received.
29. If `Warranty End Date` is filled and greater than today (and AMC is not active), the subject is flagged as Under Warranty.
30. Under Warranty subjects must show `Under Warranty` badge on subject detail and follow Brand/Dealer billing with payment due until received.
31. If neither AMC nor Warranty is active, subject is Out of Warranty and customer is charged through normal billing flow.

---

## 19. Open Items & Questions

| # | Open Item | Owner | Status |
|---|---|---|---|
| 1 | Configured cut-off time for attendance toggle (e.g., 9:00 AM)? | Business Team | Open |
| 2 | Can technicians toggle ON/OFF multiple times per day (e.g., lunch breaks)? | Product Owner | Open |
| 3 | Maximum subjects assigned to one technician per day? | Business Team | Open |
| 4 | How many days in advance can a technician mark planned leave? | Business Team | Open |
| 5 | Maximum file size for image/video uploads? | Dev Team | Open |
| 6 | Should customer signature be captured digitally on the job sheet? | Product Owner | Open |
| 7 | Default warranty duration if not provided at entry? | Business Team | Open |
| 8 | AMC offered for all product categories or specific ones? | Business Team | Open |
| 9 | Notification channels — SMS / push notification / email / all three? | Dev Team | Open |
| 10 | Who raises and sends Brand/Dealer invoice? | Product Owner | **Resolved:** System auto-generates; staff sends externally |
| 11 | Can a customer take an AMC while still within manufacturer warranty? | Business Team | Open |
| 12 | Who approves technician product requests — any staff or designated manager? | Business Team | Open |
| 13 | Variance in technician bag — penalty or write-off process? | Business Team | Open |
| 14 | Digital Bag capacity (50 units) — configurable per technician or global? | Product Owner | Open |
| 15 | For OOW service, is parts charge MRP or negotiable per service? | Business Team | **Resolved:** Parts charge = MRP from Inventory (not negotiable) |
| 16 | Are partial invoice payments supported? | Business Team | **Resolved:** No — always full payment or nothing |
| 17 | Can a `Received` payment be reversed if cheque bounces? | Business Team | **Resolved:** Yes — any staff can revert to Pending with mandatory reason |

---

## 20. Getting Started

### Prerequisites
- Node.js v24+ / npm 11+
- Flutter 3.38.9 / Dart 3.10.8
- Supabase account and project

### Web (Next.js — Superadmin & Staff Portal)
```bash
cd web
cp .env.example .env.local   # fill in your Supabase credentials
npm install
npm run dev
```

### Hitech Admin (Flutter — Admin & Staff Mobile)
```bash
cd hitech_admin
flutter pub get
flutter run
```

### Hitech Technician (Flutter — Technician Mobile)
```bash
cd hitech_technician
flutter pub get
flutter run
```

### Environment Variables (`web/.env.local`)
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=your_supabase_publishable_key
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

---

## 21. Revision History

| Version | Date | Changes | Author |
|---|---|---|---|
| 1.0 | 2026-03-11 | Initial draft — Service Management module | Development Team |
| 1.1 | 2026-03-11 | Added Module 3: Technician Attendance, Availability Toggle, Forward Scheduling & Reassignment | Development Team |
| 1.2 | 2026-03-11 | Added Product & Warranty fields to Subject form; In-Warranty Brand/Dealer Billing; AMC Module; Inventory Module; Stock Module; Product Distribution (Digital Bag) | Development Team |
| 1.3 | 2026-03-13 | Added Field 12 optional Product Details section, AMC/Warranty billing decision matrix, and developer documentation-maintenance workflow | Development Team |

---

## 22. Documentation Maintenance During Development

To keep implementation aligned with business logic, developers must update this README whenever behavior changes.

API documentation has equal priority and must always be kept current for any backend or contract-affecting change.

### Mandatory when business rules change

1. Update relevant module section(s) with the exact field/flow changes.
2. Update `18. Business Rules & Constraints` with any new rules or modified defaults.
3. If logic affects billing/status/flags, update the Service Charge Determination table in Module 1.
4. If API routes, payloads, auth behavior, or client-consumed contracts change, update `web/docs/API_DOCUMENTATION.md` in the same work item.
5. Add or update migration notes in code comments and ensure README reflects schema-impacting changes.
6. Add an entry to `doc/WORK_LOG.md` with timestamp, summary, files changed, verification, and issues.

### Developer checklist before pushing

- README and implementation behavior are consistent.
- `web/docs/API_DOCUMENTATION.md` matches the current backend behavior and client-facing contracts.
- UI labels and API/data model names match README terminology.
- Role visibility and permissions in README match actual enforcement.
- Lint/build checks pass after documentation-related code changes.
- `doc/WORK_LOG.md` includes the completed task entry.
