# HitechSoftware API Documentation

Base API for the Service Management System consumed by:
- `web` (Next.js)
- `hitech_admin` (Flutter)
- `hitech_technician` (Flutter)

## 1. API Overview

- API style: REST (JSON)
- Backend location: Next.js Route Handlers under `web/app/api/**`
- Versioning: `/api/v1/...`
- Auth: Supabase JWT bearer token
- Time format: ISO 8601 (UTC)
- Idempotency: supported for selected create/update endpoints using `Idempotency-Key`

### Base URLs

- Local: `http://localhost:3000/api/v1`
- Production: `https://<your-domain>/api/v1`

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
