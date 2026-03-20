# HitechSoftware API Documentation

Base API for the Service Management System consumed by:
- `web` (Next.js)
- `hitech_admin` (Flutter)
- `hitech_technician` (Flutter)

This document is mandatory project documentation. Any change to implemented route handlers, request or response schemas, authentication or authorization behavior, or other client-consumed backend contracts must update this file in the same task before the work is considered complete.

## API Documentation Maintenance Workflow (Mandatory)

Use this checklist for every completed task:

1. Review whether backend or contract behavior changed.
2. If changed, update this file in the same task with:
  - Endpoint/path and method changes
  - Request and response schema changes
  - Auth/permission changes
  - Error/status code behavior changes
  - Client-impact notes (web, hitech_admin, hitech_technician)
3. If not changed, record in `doc/WORK_LOG.md` that API docs were reviewed and no update was required.

Definition of done:
- Task is incomplete unless API documentation impact is explicitly documented in `doc/WORK_LOG.md`.

## Current Implementation Status (Source of Truth)

This document previously contained a planned `/api/v1` contract. The currently implemented backend routes in this repository are under Next.js route handlers at `web/app/api/**`.

As of now, implemented routes are:
- `POST /api/team/members`
- `DELETE /api/team/members/{id}`
- `GET /api/team/members/completed-counts`
- `GET /api/team/members/{id}/performance`
- `POST /api/subjects/{id}/respond`
- `POST /api/subjects/{id}/billing`
- `DELETE /api/subjects/{id}/billing`
- `PATCH /api/subjects/{id}/billing`
- `GET /api/bills/{id}/download`
- `POST /api/attendance/toggle`
- `GET /api/cron/attendance-absent-flag`
- `GET /api/cron/attendance-reset`
- `GET /api/dashboard/technician/completed-summary`

Important notes:
- Most read/list/create/update operations in the web app are currently executed directly via Supabase client/repository services (not through REST route handlers).
- Any `/api/v1/...` sections below should be treated as target/planned architecture unless explicitly marked implemented.

## Auth & Permission Modules (MNC Standard)

For the full implementation guide, see `web/docs/AUTH_MODULE_MNC_IMPLEMENTATION.md`.

Module-wise permission domains used across web and Flutter clients:
- customer
- subject
- inventory
- stock
- digital-bag
- billing
- amc
- technician
- payout
- reports
- settings
- attendance
- notifications
- auth

Key integration points:
- Login returns role and a role-based landing route from auth service.
- Route protection is enforced at middleware level for `/dashboard/**`.
- Session expiry is handled via auth state events (`SIGNED_OUT`, `TOKEN_REFRESHED`).
- Auth events are auditable in `auth_logs` with RLS-restricted read access for `super_admin`.

## 1. API Overview

- API style: REST (JSON)
- Backend location: Next.js Route Handlers under `web/app/api/**`
- Versioning: currently unversioned (`/api/...`) for implemented handlers
- Auth: Supabase session/cookie auth (server-side validation with Supabase `auth.getUser()`)
- Time format: ISO 8601 (UTC)
- Idempotency: not currently implemented in existing route handlers

### Base URLs

- Local: `http://localhost:3000/api`
- Production: `https://<your-domain>/api`

## 1.1 Implemented Endpoints (Accurate)

### Create Team Member

- Method/Path: `POST /api/team/members`
- AuthZ: `super_admin` only
- Behavior:
  - Validates payload using `createTeamMemberSchema`.
  - Creates Supabase Auth user (`email_confirm: true`).
  - Inserts `profiles` row.
  - If role is `technician`, inserts `technicians` row.
  - Rolls back auth user if profile/technician insert fails.

Response shape:

```json
{
  "ok": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "display_name": "Name",
    "phone_number": "9999999999",
    "role": "technician",
    "is_active": true,
    "is_deleted": false,
    "created_at": "2026-03-13T09:00:00.000Z",
    "updated_at": "2026-03-13T09:00:00.000Z",
    "technician": {
      "id": "uuid",
      "technician_code": "TECH-001",
      "qualification": null,
      "experience_years": null,
      "daily_subject_limit": 10,
      "digital_bag_capacity": 50,
      "is_active": true,
      "is_deleted": false
    }
  }
}
```

### Delete Team Member

- Method/Path: `DELETE /api/team/members/{id}`
- AuthZ: `super_admin` only
- Behavior:
  - Verifies target exists and role is one of `technician | office_staff | stock_manager`.
  - Deletes user from Supabase Auth admin API.
  - Linked rows are removed via DB constraints/cascade as configured.

Response shape:

```json
{
  "ok": true,
  "data": null
}
```

### Get Team Completed Counts

- Method/Path: `GET /api/team/members/completed-counts`
- AuthZ: `super_admin` only
- Behavior:
  - Reads all `subjects` where `status = 'COMPLETED'` and `assigned_technician_id IS NOT NULL`.
  - Returns all-time completed counts grouped by technician id.

Response shape:

```json
{
  "counts": {
    "<technician_id>": 12
  }
}
```

### Get Team Member Performance

- Method/Path: `GET /api/team/members/{id}/performance`
- AuthZ: `super_admin` only
- Behavior:
  - Returns last 6 months monthly metrics for the technician.
  - Computes `rejections` from `subject_status_history` (`event_type = 'rejection'`).
  - Computes `reschedules` from `subject_status_history` (`event_type = 'reschedule'`) for subjects rejected by that technician.
  - Computes `completed` monthly plus all-time completed totals from `subjects` where `status = 'COMPLETED'`.

Response shape:

```json
{
  "ok": true,
  "data": {
    "monthly": [
      {
        "month": "2026-03",
        "label": "Mar 2026",
        "rejections": 2,
        "reschedules": 1,
        "completed": 9
      }
    ],
    "totals": {
      "rejections": 5,
      "reschedules": 3,
      "completedLast6Months": 24,
      "completedAllTime": 41
    }
  }
}
```

### Technician Response to Subject

- Method/Path: `POST /api/subjects/{id}/respond`
- AuthZ: `technician` only, and only when the subject is assigned to the current technician
- Request body:

```json
{
  "action": "accept",
  "visit_date": "2026-03-20",
  "visit_time": "14:30"
}
```

or

```json
{
  "action": "reject",
  "rejection_reason": "Customer unavailable"
}
```

- Behavior:
  - Reject/accept is allowed only when `technician_acceptance_status = 'pending'`.
  - `accept` requires `visit_date` and `visit_time`, updates subject to `status = 'ACCEPTED'`, sets `technician_acceptance_status = 'accepted'`, persists `technician_allocated_date = visit_date`, and appends visit time into technician allocation notes.
  - `reject` updates subject to `status = 'RESCHEDULED'`, stores reason, sets `rejected_by_technician_id`, and marks `is_rejected_pending_reschedule = true`.

### Subject Billing Actions

- Method/Path: `POST /api/subjects/{id}/billing`
- AuthZ: `technician` only, and only when subject is assigned to current technician.
- Request body action modes:

```json
{
  "action": "add_accessory",
  "item_name": "Capacitor",
  "quantity": 2,
  "unit_price": 150
}
```

```json
{
  "action": "generate_bill",
  "visit_charge": 300,
  "service_charge": 500,
  "apply_gst": true,
  "payment_mode": "cash"
}
```

- Behavior:
  - `add_accessory` only while subject is `IN_PROGRESS`.
  - `generate_bill` requires at least 1 uploaded media item.
  - For non-AMC jobs, warranty end date must be present; otherwise API returns `WARRANTY_DATE_NOT_NOTED`.
  - Bill type is derived by runtime warranty state:
    - AMC / in-warranty -> `brand_dealer_invoice`
    - out-of-warranty -> `customer_receipt`
  - Completes subject and persists bill/payment fields.

- Method/Path: `DELETE /api/subjects/{id}/billing`
- AuthZ: `technician` only, assigned technician only.
- Request body:

```json
{
  "action": "remove_accessory",
  "accessoryId": "uuid"
}
```

- Behavior:
  - Accessory removal allowed only before bill generation while subject is `IN_PROGRESS`.

- Method/Path: `PATCH /api/subjects/{id}/billing`
- AuthZ: `office_staff` or `super_admin`.
- Request body:

```json
{
  "action": "update_payment_status",
  "billId": "uuid",
  "paymentStatus": "paid",
  "paymentMode": "upi"
}
```

- Behavior:
  - Updates bill payment status and synchronizes subject payment fields.
  - When `paymentStatus = paid`, `paymentMode` is mandatory.
  - Sets `payment_collected_at` for paid status and clears it for non-paid statuses.

### Subject Media Upload and Removal

- Method/Path: `POST /api/subjects/{id}/photos/upload`
- AuthZ:
  - `technician` only for subjects assigned to current technician.
  - `office_staff` and `super_admin` can upload for any subject.
- Request: multipart form-data with:
  - `file`
  - `photoType` (`service_video` for videos, image types for photos)
- Behavior:
  - Enforces max count (`12`) per subject and file size/type validation.
  - Stores media in `subject-photos` bucket and inserts metadata in `subject_photos`.
  - Allowed for post-completion maintenance by authorized roles.

- Method/Path: `DELETE /api/subjects/{id}/photos`
- AuthZ:
  - Assigned `technician` for own subject.
  - `office_staff` and `super_admin` for any subject.
- Request body:

```json
{
  "photoId": "uuid",
  "storagePath": "subject-id/file-name"
}
```

- Behavior:
  - Soft deletes photo metadata (`is_deleted = true`) and removes storage object.
  - Allowed after job completion for media maintenance.

### Download Bill PDF

- Method/Path: `GET /api/bills/{id}/download`
- AuthZ:
  - Any authenticated role can request, with role guard:
    - `technician` can download only bills where the bill subject is assigned to that technician.
    - `office_staff` and `super_admin` can download any bill.
- Behavior:
  - Reads bill (`subject_bills`) and related subject metadata.
  - Includes category, assigned technician name, and accessories in the PDF payload.
  - Returns generated PDF as an attachment response.
- Response headers:
  - `Content-Type: application/pdf`
  - `Content-Disposition: attachment; filename="<bill_number>.pdf"`

### Technician Attendance Toggle

- Method/Path: `POST /api/attendance/toggle`
- AuthZ: `technician` only
- Behavior:
  - First toggle of the day marks technician online and creates/updates today's attendance row with `toggled_on_at`.
  - Toggle off is allowed only after 18:00 local server time.
  - Toggle off marks profile offline and sets `toggled_off_at`.

### Cron: Attendance Absent Flag

- Method/Path: `GET /api/cron/attendance-absent-flag`
- AuthZ: Bearer token with `CRON_SECRET`
- Behavior:
  - Finds technicians without `toggled_on_at` for current date.
  - Inserts missing absent attendance rows.
  - Queues `ATTENDANCE_ABSENT_FLAG` notifications to office staff and super admins.

### Cron: Attendance Reset

- Method/Path: `GET /api/cron/attendance-reset`
- AuthZ: Bearer token with `CRON_SECRET`
- Behavior:
  - Operates on previous date.
  - Inserts absent records for technicians with no ON toggle.
  - Auto-closes open attendance rows by setting `toggled_off_at`.
  - Resets technician online status (`profiles.is_online = false`).

### Technician Completed Summary

- Method/Path: `GET /api/dashboard/technician/completed-summary`
- AuthZ: `technician` only (current authenticated technician)
- Behavior:
  - Returns completed service counts for:
    - `today`
    - `week` (week starts on Monday)
    - `month`
    - `year`
  - Counts are computed from `subjects` using:
    - `assigned_technician_id = auth.uid()`
    - `status = 'COMPLETED'`
    - `is_deleted = false`
    - date filtering on `completed_at`
  - Also returns sales metrics by the same periods:
    - `products_sold`: customer receipts count (`subject_bills.bill_type = customer_receipt`)
    - `parts_sold_qty`: total accessory quantity (`subject_accessories.quantity`)
    - `parts_sold_amount`: total accessory value (`subject_accessories.total_price`)

- Response shape:

```json
{
  "ok": true,
  "data": {
    "today": 2,
    "week": 9,
    "month": 26,
    "year": 104,
    "sales": {
      "today": { "products_sold": 1, "parts_sold_qty": 3, "parts_sold_amount": 1450 },
      "week": { "products_sold": 4, "parts_sold_qty": 11, "parts_sold_amount": 5320 },
      "month": { "products_sold": 16, "parts_sold_qty": 39, "parts_sold_amount": 18760 },
      "year": { "products_sold": 74, "parts_sold_qty": 188, "parts_sold_amount": 89210 }
    }
  }
}
```

Common error shape for implemented handlers:

```json
{
  "ok": false,
  "error": {
    "message": "Forbidden"
  }
}
```

## 2. Common Conventions

### Headers

Required for authenticated routes:

```http
Authorization: Bearer <supabase_access_token>
Content-Type: application/json
Accept: application/json
X-Client-Platform: web | hitech_admin | hitech_technician
X-App-Version: <semantic_version>
X-Timezone: <IANA timezone>
```

Optional:

```http
Idempotency-Key: <unique-key>
X-Request-Id: <trace-id>
```

### Standard Success Response

```json
{
  "success": true,
  "message": "Operation completed",
  "data": {},
  "meta": {
    "requestId": "req_123",
    "timestamp": "2026-03-11T18:30:00.000Z"
  }
}
```

### Standard Error Response

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Input is invalid",
    "details": [
      {
        "field": "customer.phone",
        "reason": "Invalid phone format"
      }
    ]
  },
  "meta": {
    "requestId": "req_123",
    "timestamp": "2026-03-11T18:30:00.000Z"
  }
}
```

### HTTP Status Code Map

- `200` OK
- `201` Created
- `204` No Content
- `400` Bad Request
- `401` Unauthorized
- `403` Forbidden
- `404` Not Found
- `409` Conflict
- `422` Validation Error
- `429` Too Many Requests
- `500` Internal Server Error

## 3. Authentication & Authorization

### Auth Endpoints

- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`
- `POST /auth/refresh`

### Roles

- `superadmin`
- `office_staff`
- `technician`

### Permission Matrix (high level)

- Office staff: create/allocate/reassign subjects, stock/inventory management, billing updates
- Technician: attendance toggle, accept/reject assignment, upload documents, update visit outcomes

## 4. Core Domain Models

### Subject

```json
{
  "id": "sub_001",
  "subjectNumber": "SUB-2026-00001",
  "priority": "P2",
  "allocatedDate": "2026-03-12",
  "typeOfService": "INSTALLATION",
  "category": "AC",
  "status": "PENDING",
  "customer": {
    "name": "John",
    "phone": "+919999999999",
    "address": "Chennai",
    "notes": "Call before visit"
  },
  "brandDealerId": "bd_01",
  "product": {
    "materialCode": "AC-FILT-001",
    "name": "AC Filter",
    "modelNumber": "AF-200",
    "serialNumber": "SN123456",
    "purchaseDate": "2025-03-10",
    "warrantyPeriodMonths": 12,
    "warrantyExpiryDate": "2026-03-10"
  },
  "assignedTechnicianId": null,
  "createdAt": "2026-03-11T12:00:00.000Z",
  "updatedAt": "2026-03-11T12:00:00.000Z"
}
```

### Technician Availability

```json
{
  "technicianId": "tech_01",
  "date": "2026-03-12",
  "isAvailable": true,
  "checkInAt": "2026-03-12T03:15:00.000Z",
  "checkOutAt": null,
  "status": "PRESENT"
}
```

### Inventory Item

```json
{
  "id": "inv_01",
  "materialCode": "WM-MTR-023",
  "stockCategory": "Washing Machine",
  "productType": "Spare Part",
  "productName": "Drain Motor",
  "purchasePrice": 1200,
  "mrp": 1750,
  "brand": "BrandA",
  "hsnSacCode": "8418",
  "warrantyPeriodMonths": 12,
  "uom": "Piece"
}
```

## 5. Subjects API

### Create Subject

- `POST /subjects`
- Roles: `office_staff`, `superadmin`

Request body (minimum):

```json
{
  "priority": "P2",
  "allocatedDate": "2026-03-12",
  "typeOfService": "ORDINARY_SERVICE",
  "category": "AC",
  "customer": {
    "name": "John",
    "phone": "+919999999999",
    "address": "Chennai",
    "notes": "Call before visit"
  },
  "brandDealerId": "bd_01",
  "product": {
    "materialCode": "AC-FILT-001",
    "name": "AC Filter",
    "modelNumber": "AF-200",
    "serialNumber": "SN123456",
    "purchaseDate": "2025-03-10",
    "warrantyPeriodMonths": 12
  }
}
```

### List Subjects

- `GET /subjects?status=PENDING&page=1&pageSize=20&assignedTechnicianId=tech_01`
- Roles: all authenticated users (filtered by role)

### Get Subject Detail

- `GET /subjects/{subjectId}`

### Update Subject

- `PATCH /subjects/{subjectId}`
- Roles: office staff/superadmin (restricted fields)

### Allocate Subject

- `POST /subjects/{subjectId}/allocate`
- Roles: office staff/superadmin

```json
{
  "technicianId": "tech_01",
  "reason": "Nearest available technician"
}
```

### Reassign Subject

- `POST /subjects/{subjectId}/reassign`
- Roles: office staff/superadmin

```json
{
  "newTechnicianId": "tech_02",
  "reason": "Original technician absent"
}
```

### Technician Accept Assignment

- `POST /subjects/{subjectId}/accept`
- Roles: technician

```json
{
  "confirmedVisitAt": "2026-03-12T10:00:00.000Z"
}
```

### Technician Reject Assignment

- `POST /subjects/{subjectId}/reject`
- Roles: technician

```json
{
  "reason": "Already have maximum workload for the day"
}
```

### Mark In Progress

- `POST /subjects/{subjectId}/start`
- Roles: technician

### Mark Incomplete

- `POST /subjects/{subjectId}/incomplete`
- Roles: technician

```json
{
  "reasonCode": "SPARE_PARTS_NOT_AVAILABLE",
  "notes": "Need compressor relay",
  "partsRequest": {
    "partName": "Compressor Relay",
    "partNumber": "CR-120",
    "quantity": 1,
    "estimatedDeliveryDate": "2026-03-15",
    "supplier": "Dealer A"
  }
}
```

### Complete Subject

- `POST /subjects/{subjectId}/complete`
- Roles: technician/office_staff

```json
{
  "warrantyStatus": "IN_WARRANTY",
  "visitCharge": 0,
  "partsCharge": 0,
  "amcCharge": 0,
  "paymentMode": null,
  "usedParts": [
    {
      "materialCode": "WM-MTR-023",
      "quantity": 1,
      "unitPrice": 1750
    }
  ]
}
```

## 6. Attendance & Availability API

### Toggle Availability

- `POST /attendance/toggle`
- Roles: technician

```json
{
  "isAvailable": true
}
```

### Mark Advance Leave

- `POST /attendance/leave`
- Roles: technician

```json
{
  "fromDate": "2026-03-20",
  "toDate": "2026-03-22",
  "reason": "Personal"
}
```

### Attendance Logs

- `GET /attendance/logs?technicianId=tech_01&from=2026-03-01&to=2026-03-31`
- Roles: office_staff/superadmin; technicians can see own

### Availability Dashboard

- `GET /attendance/dashboard?date=2026-03-12`
- Roles: office_staff/superadmin

## 7. Warranty & Documents API

### Check Warranty

- `POST /warranty/check`

```json
{
  "serialNumber": "SN123456",
  "purchaseDate": "2025-03-10",
  "warrantyPeriodMonths": 12
}
```

### Upload Service Media

- `POST /subjects/{subjectId}/documents/presign`
- Returns signed upload URL for Supabase Storage

```json
{
  "fileName": "serial.jpg",
  "contentType": "image/jpeg",
  "documentType": "SERIAL_IMAGE"
}
```

- `POST /subjects/{subjectId}/documents/confirm`

```json
{
  "storagePath": "subjects/sub_001/serial.jpg",
  "documentType": "SERIAL_IMAGE"
}
```

### List Documents

- `GET /subjects/{subjectId}/documents`

## 8. Billing API

### In-Warranty Billing Record

- `GET /billing/in-warranty?status=PENDING&page=1&pageSize=20`
- `GET /billing/in-warranty/{billingId}`

### Update In-Warranty Payment Status

- `PATCH /billing/in-warranty/{billingId}/status`

```json
{
  "status": "RECEIVED",
  "paymentReceivedDate": "2026-03-20",
  "paymentMode": "BANK_TRANSFER",
  "reason": null
}
```

Allowed statuses:
- `PENDING`
- `RECEIVED`
- `DISPUTED`
- `WAIVED`

## 9. AMC API

### Register AMC

- `POST /amc/contracts`

```json
{
  "customerId": "cus_01",
  "productCategory": "AC",
  "serialNumber": "SN123456",
  "planType": "COMPREHENSIVE",
  "startDate": "2026-03-12",
  "durationMonths": 12,
  "amount": 5000,
  "paymentMode": "UPI",
  "serviceVisitsIncluded": 4,
  "brandDealerId": "bd_01"
}
```

### AMC Listing / Detail

- `GET /amc/contracts?status=ACTIVE&page=1&pageSize=20`
- `GET /amc/contracts/{contractId}`

### AMC Renewal

- `POST /amc/contracts/{contractId}/renew`

## 10. Inventory API

### Create Inventory Item

- `POST /inventory/items`

### List Inventory Items

- `GET /inventory/items?materialCode=AC-FILT-001&page=1&pageSize=20`

### Get Inventory Item

- `GET /inventory/items/{itemId}`

### Update Inventory Item

- `PATCH /inventory/items/{itemId}`

### Material Code Lookup

- `GET /inventory/lookup/{materialCode}`

## 11. Stock API

### Add Stock Entry

- `POST /stock/entries`

```json
{
  "invoiceNumber": "INV-1234",
  "invoiceDate": "2026-03-11",
  "supplierId": "sup_01",
  "materialCode": "WM-MTR-023",
  "purchasePrice": 1250,
  "mrp": 1750,
  "quantityReceived": 20,
  "hsnSacCode": "8418",
  "receivedDate": "2026-03-11",
  "notes": "Initial lot"
}
```

### List Stock Entries

- `GET /stock/entries?supplierId=sup_01&from=2026-03-01&to=2026-03-31`

### Stock Balance

- `GET /stock/balance?materialCode=WM-MTR-023`

## 12. Digital Bag API

### Issue Product to Technician

- `POST /bag/issue`
- Roles: office_staff/superadmin

```json
{
  "technicianId": "tech_01",
  "materialCode": "WM-MTR-023",
  "quantity": 2,
  "reason": "Scheduled service load"
}
```

### Technician Product Request

- `POST /bag/requests`
- Roles: technician

### Review Product Request

- `PATCH /bag/requests/{requestId}`
- Roles: office_staff/superadmin

```json
{
  "decision": "APPROVED",
  "reason": "In stock"
}
```

### Return Items

- `POST /bag/return`
- Roles: office_staff/superadmin

### Bag Summary

- `GET /bag/summary?technicianId=tech_01&date=2026-03-11`

## 13. Notifications API

### List Notifications

- `GET /notifications?page=1&pageSize=20`

### Mark Read

- `POST /notifications/{notificationId}/read`

### Trigger Reminder Jobs (internal/admin)

- `POST /jobs/reminders/amc-expiry`
- `POST /jobs/reminders/warranty-expiry`
- `POST /jobs/reminders/billing-overdue`

## 14. Flutter Integration Notes

### Recommended Client Layers

- `ApiClient` (Dio/http wrapper)
- `AuthInterceptor` (inject access token, refresh on 401)
- `Repository` per module (`SubjectRepository`, `AttendanceRepository`, etc.)
- `DTO + Mapper` per endpoint

### Sync & Offline Strategy

- Use local cache (Hive/Isar) for subject lists and lookup tables
- Queue write operations when offline and replay with `Idempotency-Key`
- Resolve server conflict using `updatedAt` + server-wins policy for critical records

### Minimum Required Endpoints by App

For `hitech_admin`:
- Subjects CRUD/allocate/reassign
- Attendance dashboard
- Inventory/stock
- Billing/AMC modules

For `hitech_technician`:
- Attendance toggle and leave
- Assigned subjects list
- Accept/reject/start/incomplete/complete
- Document upload presign + confirm
- Product request + bag summary

## 15. Security & Compliance

- Enforce RBAC in every route handler
- Validate payloads using a shared schema validator (e.g., Zod)
- Mask sensitive personal data in logs
- Use signed URLs for media uploads
- Apply rate limiting on auth and write-heavy endpoints

## 16. API Implementation Checklist (Next.js)

- Create route groups by module in `web/app/api/v1`
- Add shared middleware for auth, role checks, request-id, error formatting
- Add schema validation for every request body/query
- Add OpenAPI generation (`/api/docs`) from route schemas
- Add Postman collection export from OpenAPI
- Add integration tests for critical workflows

## 17. Changelog

- `v1.0.0` (2026-03-11): Initial API contract for web + Flutter clients
