# Subject and Service Module Reference

## 1) Scope

This document covers the complete subject/service lifecycle in the web module, including:
- User role flows
- State transitions
- Service-layer function map
- API surface used by the module
- Critical scenarios and expected outcomes
- Test checklist for high-risk paths

## 2) Roles and Ownership Model

- technician:
  - Can update assigned job workflow state.
  - Can upload service proof media.
  - Can add/remove accessories only while job is IN_PROGRESS.
- office_staff:
  - Can update billing payment status from due/partial to paid or waived.
  - Can perform approved media maintenance actions from web APIs.
- super_admin:
  - Full operational and reporting visibility.
  - Can access office-level APIs where role checks allow super_admin.

Primary rule:
- Workflow actions are ownership-scoped to assigned technician for subject-level updates.

## 3) End-to-End User Flows

### 3.1 Subject Creation Flow

1. User opens subject create page.
2. Form validates source, category, priority, and coverage dates.
3. Warranty/AMC dates are normalized in service layer.
4. Repository persists subject and returns new subject id.

Key validations:
- source_type=brand requires brand_id.
- source_type=dealer requires dealer_id.
- warranty_end_date must be >= purchase_date.
- amc_end_date requires amc_start_date.
- amc_end_date must be >= amc_start_date.

### 3.2 Assignment and Technician Acceptance Flow

1. Office assigns technician and allocation metadata.
2. Technician receives allocated job.
3. Technician transitions through status path:
   - ACCEPTED -> ARRIVED -> IN_PROGRESS
4. Status changes are guarded by allowed transition map.

### 3.3 In-Progress Service and Billing Flow

1. Technician uploads required media by service type.
2. Technician can add/remove accessories during IN_PROGRESS only.
3. Bill generation checks completion requirements.
4. Bill creation sets charge split:
   - Warranty/AMC -> brand_dealer invoice, payment due.
   - Out-of-warranty -> customer receipt, payment mode required.
5. Subject financial columns and billing status are synchronized.

### 3.4 Completion and Post-Completion Flow

1. Completion requires required media for the job type.
2. Subject status updates to COMPLETED with timestamps.
3. Payment collection updates are available via billing API paths (office/super_admin role policy).
4. Authorized post-completion media maintenance can be performed via API guards.

### 3.5 Incomplete and Reschedule Flow

1. Technician marks INCOMPLETE with required reason.
2. For reason=other, note is mandatory (minimum length).
3. For reason=spare_parts_not_available, spare part details are mandatory.
4. Optional rescheduled date and parts metadata are stored.

## 4) Status Transition Matrix

Allowed transitions in current workflow implementation:
- ACCEPTED -> ARRIVED
- ARRIVED -> IN_PROGRESS
- IN_PROGRESS -> COMPLETED
- IN_PROGRESS -> INCOMPLETE
- IN_PROGRESS -> AWAITING_PARTS

Blocked transitions must return a clear error including current status and allowed next states.

## 5) Core Function Map

### 5.1 Subject Service Layer

File: modules/subjects/subject.service.ts

- getSubjects(filters)
  - Lists subjects with pagination, filters, and technician name mapping.
- createSubjectTicket(input)
  - Validates with createSubjectSchema and persists normalized payload.
- updateSubjectRecord(id, input)
  - Validates with updateSubjectSchema and updates normalized payload.
- getSubjectDetails(id)
  - Returns subject details plus timeline and assignment context.
- assignTechnicianWithDate(...)
  - Assignment guard rails and allocation metadata updates.
- updateSubjectWarrantyFields(...)
  - Warranty and AMC flags/status recalculation path.

### 5.2 Billing Service Layer

File: modules/subjects/billing.service.ts

- addAccessory(subjectId, technicianId, input)
  - Assignment + IN_PROGRESS guard; validates quantity and unit price.
- removeAccessory(accessoryId, technicianId)
  - Ownership + IN_PROGRESS guard before delete.
- getAccessoriesBySubject(subjectId)
  - Returns accessory list and computed total.
- generateBill(subjectId, technicianId, input)
  - Enforces completion requirements, inserts bill, updates subject billing columns.
- getBillBySubject(subjectId)
  - Fetches generated bill for subject.
- updateBillPaymentStatus(billId, paymentStatus, officeStaffId)
  - Role-scoped payment updates with billing-state synchronization.

### 5.3 Job Workflow Service Layer

File: modules/subjects/subject.job-workflow.ts

- updateJobStatus(subjectId, technicianId, newStatus)
  - Enforces ownership and transition validity.
- getRequiredPhotos(subjectId)
  - Returns required media types based on warranty/AMC state.
- checkCompletionRequirements(subjectId)
  - Computes missing media and canComplete flag.
- uploadJobPhoto(subjectId, technicianId, file, photoType)
  - Ownership + file-size validation + storage upload.
- markJobIncomplete(subjectId, technicianId, input)
  - Reason-specific validation + incomplete metadata persistence.
- markJobComplete(subjectId, technicianId, notes)
  - Requires completion media checks before completion update.

## 6) API Surface (Operationally Critical)

- GET /api/dashboard/technician/completed-summary
  - Returns completed counts and sales summary by period.
- PATCH /api/subjects/{id}/billing
  - Updates bill payment state and payment mode policy.
- POST /api/subjects/{id}/photos/upload
  - Uploads media with role and assignment checks.
- DELETE /api/subjects/{id}/photos
  - Removes media with authorization checks.
- POST /api/subjects/{id}/workflow
  - Workflow state transitions for technician actions.
- POST /api/subjects/{id}/respond
  - Technician response path for accept/reject scheduling flow.

For request/response contracts and field schemas, see API_DOCUMENTATION.md.

## 7) Critical Scenario Matrix

### 7.1 Happy Paths

- Create service subject with valid source, category, and dates.
- Technician progresses ACCEPTED -> ARRIVED -> IN_PROGRESS.
- Required photos uploaded and bill generated successfully.
- Out-of-warranty job records payment mode and marks paid.
- Warranty/AMC job records due billing for brand/dealer.

### 7.2 Validation Failures

- Missing brand_id for brand source is rejected.
- Missing dealer_id for dealer source is rejected.
- warranty_end_date < purchase_date is rejected.
- amc_end_date without amc_start_date is rejected.
- amc_end_date < amc_start_date is rejected.

### 7.3 Permission and Ownership Failures

- Non-assigned technician cannot change job status.
- Non-assigned technician cannot add/remove accessories.
- Unauthorized role cannot mutate office-only billing states.

### 7.4 Workflow Guard Failures

- Invalid status jump (for example ACCEPTED -> COMPLETED) is rejected.
- Bill generation outside IN_PROGRESS is rejected.
- Completion without required photo set is rejected with missing list.

### 7.5 Data-Consistency Checks

- Bill totals match visit + service + accessories.
- Subject billing_status and bill payment_status remain synchronized.
- Payment mode is required when customer payment is collected.

## 8) Critical Test Plan (A-to-Z Priority)

### 8.1 Implemented Now

- subject.validation.test.ts
  - Valid payload accepted.
  - Source-specific required field checks.
  - Warranty date ordering check.
  - AMC start/end dependency and ordering checks.

### 8.2 Must Add Next

- subject.service unit tests:
  - createSubjectTicket normalization and duplicate subject number mapping.
  - assignTechnicianWithDate completed-subject lock.
- subject.job-workflow unit tests:
  - transition matrix enforcement.
  - ownership guard errors.
  - completion requirements missing-photo reporting.
- billing.service unit tests:
  - accessory edit lock outside IN_PROGRESS.
  - out-of-warranty payment mode requirement.
  - warranty/AMC billing status and totals synchronization.
- API route integration tests:
  - /api/subjects/{id}/billing happy and guard failures.
  - /api/subjects/{id}/photos/upload role coverage.
  - /api/dashboard/technician/completed-summary response shape.

## 9) Build and Verification Checklist

- Run unit tests:
  - npm run test:run
- Run lint:
  - npm run lint
- Run production build:
  - npm run build

Release gate recommendation:
- Block deployment if critical scenario tests fail or build fails.
