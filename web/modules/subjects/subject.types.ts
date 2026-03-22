// ═════════════════════════════════════════════════════════════════════════════
// subject.types.ts
//
// ──────────────────────────────────────────────────────────────────────────────
// PURPOSE AND SCOPE
// ──────────────────────────────────────────────────────────────────────────────
// This file is the single source of truth for every TypeScript type, interface,
// and union that describes a "Subject" — the HiTech Software term for a service
// job ticket raised on behalf of an AC/appliance brand or dealer.
//
// WHY A CENTRALISED TYPE FILE?
// ──────────────────────────────────────────────────────────────────────────────
// In a large Next.js codebase that spans:
//   • Supabase PostgreSQL database (subject rows with 50+ columns)
//   • Server-side API routes (/api/subjects/[id]/*)
//   • Server-side service layer (subject.service.ts, billing.service.ts)
//   • React Query hooks (useSubjectDetail, useSubjects, useJobWorkflow, …)
//   • Form components (SubjectForm.tsx)
//   • List & detail pages (app/dashboard/subjects/*)
//   • Billing, photo gallery, job workflow sections
//
// …it becomes critical that all layers share the same type definitions. If every
// file defined its own shape for a "subject", subtle inconsistencies would lead
// to runtime bugs (null vs undefined, string vs number, missing fields, etc.).
// Importing from this central file means a single change propagates everywhere,
// and TypeScript's type-checker catches every breaking change at compile time.
//
// DESIGN PHILOSOPHY
// ──────────────────────────────────────────────────────────────────────────────
// 1. DATABASE FIDELITY: Types mirror Supabase table columns precisely;
//    nullable DB columns are typed `X | null`, not optional `X | undefined`.
//    Optional fields (those that may simply not be present in partial queries)
//    use `?` or `| undefined`.
//
// 2. DISCRIMINATED UNIONS for status fields (source_type, priority, …) instead
//    of plain `string` so TypeScript narrows correctly in switch statements and
//    exhaustiveness checks.
//
// 3. LAYERED INTERFACES: SubjectListItem contains only the fields needed for the
//    list view; SubjectDetail extends it with full detail. This avoids fetching
//    50 columns when rendering a list of 100 rows.
//
// 4. INPUT TYPES SEPARATE from display types: CreateSubjectInput, UpdateSubjectInput,
//    AssignTechnicianInput, GenerateBillInput, etc. — these describe what the
//    system writes; display types describe what it reads.
//
// RELATIONSHIP TO THE DATABASE SCHEMA
// ──────────────────────────────────────────────────────────────────────────────
// Primary table: `subjects`  (UUID primary key: id)
// Related tables:
//   • `subject_photos`        (1:many — uploaded proof files)
//   • `subject_accessories`   (1:many — spare parts used during the job)
//   • `subject_bills`         (1:1 — generated bill record)
//   • `subject_timeline`      (1:many — audit log of every change)
//   • `profiles`              (technician FK: assigned_technician_id)
//   • `brands`                (brand FK: brand_id)
//   • `dealers`               (dealer FK: dealer_id)
//   • `service_categories`    (category FK: category_id)
//
// IMPORTING CONVENTIONS
// ──────────────────────────────────────────────────────────────────────────────
// All imports use the path alias @/modules/subjects/subject.types so that
// relative path depth is irrelevant. Example:
//   import type { SubjectDetail } from '@/modules/subjects/subject.types';
//
// ═════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1: PRIMITIVE UNION TYPES
// These are the building blocks — narrow string unions that model finite,
// enumerable values stored in the database as text CHECK constraints.
// Using union types instead of plain `string` means:
//   • The compiler rejects misspellings at the call site
//   • switch statements can be exhaustively checked
//   • IDE auto-completion works for all valid values
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @summary Origin of this service job (which type of partner raised the complaint).
 *
 * @description
 * Every subject must be linked to exactly ONE external partner: either a brand
 * (product manufacturer) or a dealer (reseller/distributor). This field drives
 * several important downstream behaviours:
 *
 * DATABASE IMPACT:
 *   When source_type === 'brand'  → brand_id (FK → brands.id) must be populated.
 *   When source_type === 'dealer' → dealer_id (FK → dealers.id) must be populated.
 *   The opposite FK is set to NULL (a brand subject has no dealer_id and vice versa).
 *   The Zod schema enforces this via cross-field superRefine rules.
 *
 * BILLING IMPACT:
 *   Both brand and dealer subjects can be warranty/AMC — the billing type
 *   (brand_dealer_invoice vs customer_receipt) is determined separately by the
 *   is_warranty_service / is_amc_service flags, not directly by source_type.
 *   However, source_type controls which entity name appears in the "Issued To"
 *   field of the generated invoice.
 *
 * UI IMPACT:
 *   The subject form shows a Brand dropdown when source_type='brand',
 *   or a Dealer dropdown when source_type='dealer'.
 *   The SubjectInfoCard tags the badge as "Brand" (blue) or "Dealer" (purple).
 *
 * FILTER IMPACT:
 *   SubjectListFilters accepts source_type as 'all' | 'brand' | 'dealer'
 *   to let office staff narrow the list to brand-only or dealer-only jobs.
 *
 * STORED IN DB:
 *   Column: subjects.source_type
 *   DB type: text CHECK (source_type IN ('brand', 'dealer'))
 *   NOT NULL constraint — every subject must have a source.
 *
 * @example
 *   const job: SubjectSourceType = 'brand';    // Samsung complaint
 *   const job2: SubjectSourceType = 'dealer';  // ABC Electronics complaint
 */
export type SubjectSourceType = 'brand' | 'dealer';

/**
 * @summary The urgency classification assigned by an admin when creating the service job.
 *
 * @description
 * SubjectPriority is a four-level urgency scale that affects how service jobs are
 * surfaced, sorted, and highlighted across every screen that renders subject lists.
 *
 * DATABASE STORAGE:
 *   Column: subjects.priority
 *   DB type: text CHECK (priority IN ('critical', 'high', 'medium', 'low'))
 *   Default: 'medium' (applied at DB level; the form pre-selects 'medium' for speed)
 *   NOT NULL — every subject must have a declared priority on creation.
 *
 * BADGE COLOUR SCHEME (SubjectPriorityBadge component):
 *   critical → red background  (bg-red-100   text-red-800)   — requires same-day action
 *   high     → orange background (bg-orange-100 text-orange-800) — within 24 hours
 *   medium   → yellow background (bg-yellow-100 text-yellow-800) — normal SLA
 *   low      → green background (bg-green-100  text-green-800)  — flexible
 *
 * SORT ORDER:
 *   The subject list sorts by priority descending then created_at descending so that
 *   'critical' jobs float to the top of the queue automatically.
 *   Sort mapping: critical=4, high=3, medium=2, low=1 (applied in repository ORDER BY).
 *
 * OVERDUE QUEUE BEHAVIOUR:
 *   The subjectRepository.getSubjects() overdue_only flag selects subjects that are:
 *     • Assigned (assigned_technician_id IS NOT NULL)
 *     • Not terminal (status NOT IN ('COMPLETED','CANCELLED','INCOMPLETE'))
 *     • Past their allocated_date
 *   Within the overdue queue, 'critical' jobs appear at the very top, further
 *   highlighting the most severe SLA breaches.
 *
 * FILTER PANEL:
 *   SubjectListFilters.priority accepts SubjectPriority | 'all'.
 *   The list page passes the raw query param ?priority= from the URL search params.
 *   'all' is the default and disables the filter; any specific value sends an
 *   .eq('priority', value) filter to Supabase.
 *
 * BUSINESS RULES FOR CHOOSING A LEVEL:
 *   critical  — Health/safety risk, VIP customer, government contract, public system down.
 *   high      — Commercial property, rapid-deterioration risk, elderly/vulnerable customer.
 *   medium    — Standard household complaint with no risk of escalation (most subjects).
 *   low       — Cosmetic issues, scheduled preventative visits, low-inconvenience faults.
 *
 * MODIFICATION HISTORY:
 *   Priority can be updated even after initial save by admins via a small edit button on
 *   the SubjectInfoCard. This triggers updateSubject → puts the updated priority on the
 *   existing record and adds a SubjectTimelineItem row documenting the old/new values.
 *
 * SECURITY:
 *   Technicians see priority badges (read-only) but cannot change priority.
 *   Only roles with 'admin' or 'superadmin' claims can call PATCH /api/subjects/[id]/.
 *
 * FILES THAT IMPORT SubjectPriority:
 *   • web/modules/subjects/subject.validation.ts — subjectPrioritySchema enum
 *   • web/components/subjects/SubjectPriorityBadge.tsx — colour mapping
 *   • web/modules/subjects/subject.types.ts (self) — used by SubjectListItem
 *   • web/repositories/subjectRepository.ts — ORDER BY sort map
 *   • web/app/api/subjects/route.ts — query param narrowing
 *
 * @example
 *   const priority: SubjectPriority = 'critical'; // fires push notification to manager
 *   const badge = priority === 'low' ? 'bg-green-100' : 'bg-red-100'; // narrow in switch
 */
export type SubjectPriority = 'critical' | 'high' | 'medium' | 'low';

/**
 * @summary Classification of what kind of work the technician will perform on-site.
 *
 * @description
 * SubjectTypeOfService distinguishes two fundamentally different kinds of job
 * dispatched to a technician. This distinction has cascading effects on which photos
 * are required, how long the job is expected to take, and how the billing is structured.
 *
 * DATABASE STORAGE:
 *   Column: subjects.type_of_service
 *   DB type: text CHECK (type_of_service IN ('installation','service'))
 *   NOT NULL — must be declared at job creation time.
 *
 * VALUE: 'installation'
 *   Meaning: The technician is fitting a new appliance or system.
 *   Context: Could be a new AC unit, new CCTV camera, new solar panel inverter, etc.
 *   Photo requirements are typically higher — site_photo_1/2/3 are almost always
 *   required to document the before/after installation state.
 *   Jobs often take longer (estimated 2–4 hours), so allocated_date planning should
 *   account for a full half-day slot.
 *   Billing: Usually a fixed installation charge (visit_charge often 0, service_charge
 *   covers installation labour) plus any accessories (brackets, pipes, fittings).
 *
 * VALUE: 'service'
 *   Meaning: The technician is repairing, servicing, or maintaining an existing unit.
 *   Context: Breakdown, annual maintenance visit, post-complaint follow-up.
 *   Photo requirements for in-warranty service: serial_number + machine + bill +
 *   job_sheet + defective_part + service_video (6 proofs required).
 *   Jobs range from 30 minutes to 3 hours depending on fault complexity.
 *   Billing: visit_charge (transit) + service_charge (labour) + accessories (spares).
 *
 * UI DISPLAY:
 *   On the SubjectInfoCard: shown as a simple text label "Installation" or "Service".
 *   On the SubjectForm: a segmented toggle control (RadioGroup with two options).
 *   On the technician task card (hitech_technician app): shown as a colour-coded tag.
 *
 * IMPACT ON COMPLETION REQUIREMENTS:
 *   The JobCompletionRequirements struct returned by GET /api/subjects/[id]/workflow
 *   calculates required[] differently based on type_of_service AND warranty_status:
 *     service + warranty_status='active':
 *       required = [serial_number, machine, bill, job_sheet, defective_part, service_video]
 *     service + warranty_status='expired' or null:
 *       required = [serial_number, machine, bill]
 *     installation:
 *       required = [machine, site_photo_1] (minimum — configurable per brand)
 *
 * FILTER IMPACT:
 *   Not currently exposed as a standalone filter in SubjectListFilters.
 *   Admins can use the search bar to find installation-only or service-only jobs
 *   by typing 'installation' or 'service' in the keyword search.
 *
 * FILES THAT IMPORT SubjectTypeOfService:
 *   • web/modules/subjects/subject.types.ts (self) — used by SubjectListItem
 *   • web/modules/subjects/subject.validation.ts — form validation
 *   • web/repositories/subjectRepository.ts — DB insert/update
 *   • web/components/subjects/SubjectInfoCard.tsx — display label
 *   • web/modules/subjects/subject.job-workflow.ts — completion check
 *
 * @example
 *   const type: SubjectTypeOfService = 'installation'; // brand-new window AC unit
 *   const type2: SubjectTypeOfService = 'service';     // broken compressor repair
 */
export type SubjectTypeOfService = 'installation' | 'service';

/**
 * @summary Predefined duration periods used to auto-calculate the warranty expiry date.
 *
 * @description
 * WarrantyPeriod drives the auto-calculation of subjects.warranty_end_date when the
 * admin creates or edits a subject. Instead of requiring the admin to manually count
 * months, selecting a period lets the system compute the end date from purchase_date.
 *
 * DATABASE STORAGE:
 *   Column: subjects.warranty_period  (stores these exact string tokens)
 *   DB type: text  (no CHECK constraint — server validates via Zod before insert)
 *   NULLABLE — warranty_period and warranty_end_date are only populated when the
 *   subject is covered by the manufacturer's warranty. AMC subjects use amc_start/end_date
 *   instead; out-of-warranty subjects have both cols set to NULL.
 *
 * AUTO-CALCULATION LOGIC (in SubjectFormValues → API route):
 *   When the form submits with warranty_period !== 'custom':
 *     warranty_end_date = addMonths(purchase_date, periodToMonths(warranty_period))
 *   Period → months mapping:
 *     '6_months' →  6
 *     '1_year'   → 12
 *     '2_years'  → 24
 *     '3_years'  → 36
 *     '4_years'  → 48
 *     '5_years'  → 60
 *   When warranty_period === 'custom':
 *     The admin must manually enter warranty_end_date in the form.
 *     The system stores warranty_period = 'custom' and the admin-supplied date.
 *     Common use cases for 'custom': brands that offer 18-month or 30-month warranties,
 *     promotions with special terms, extended warranty purchases.
 *
 * WARRANTY STATUS DERIVATION:
 *   subjects.warranty_status is a generated column (computed at query time, not stored):
 *     warranty_status = warranty_end_date IS NOT NULL AND warranty_end_date >= CURRENT_DATE
 *                       ? 'active' : 'expired'
 *   The warranty_status drives the required photo set (see SubjectTypeOfService docs above)
 *   and the service_charge_type displayed on the SubjectInfoCard.
 *
 * UI FLOW:
 *   SubjectForm renders a WarrantyPeriodSelect dropdown with all 7 options.
 *   Selecting 'custom' shows an additional DatePicker for warranty_end_date.
 *   Selecting any other option hides the end-date picker; the date is auto-filled
 *   on the server when the form is submitted.
 *
 * ZERO-PERIOD EDGE CASE:
 *   If purchase_date is not supplied, warranty_period is meaningless even if set.
 *   The Zod superRefine in subject.validation.ts enforces:
 *     if (warranty_period && !purchase_date) → validation error on purchase_date.
 *
 * FILES THAT IMPORT WarrantyPeriod:
 *   • web/modules/subjects/subject.validation.ts — optional enum in subjectFormSchema
 *   • web/components/subjects/SubjectForm.tsx — WarrantyPeriodSelect
 *   • web/repositories/subjectRepository.ts — stored on DB row
 *   • web/modules/subjects/subject.service.ts — addMonths calculation
 *
 * @example
 *   const period: WarrantyPeriod = '2_years';  // Samsung 2-year warranty
 *   const custom: WarrantyPeriod = 'custom';   // 18-month promotional period
 */
export type WarrantyPeriod = '6_months' | '1_year' | '2_years' | '3_years' | '4_years' | '5_years' | 'custom';

/**
 * @summary Enumeration of every category of visual proof a technician can upload.
 *
 * @description
 * PhotoType classifies every image or video file attached to a subject. The classification
 * serves two critical purposes: (1) enforcing completion requirements — the system knows
 * which proofs are missing before the technician can close the job; (2) organising the
 * photo gallery on the Subject Detail page into labelled sections.
 *
 * STORAGE:
 *   Column: subject_photos.photo_type
 *   DB type: text CHECK (photo_type IN ('serial_number','machine','bill','job_sheet',
 *             'defective_part','site_photo_1','site_photo_2','site_photo_3','service_video'))
 *   NOT NULL on insert — the upload API receives photo_type as a form field and rejects
 *   the request if the value is missing or not in the allowed set.
 *
 * ─ VALUE REFERENCE ──────────────────────────────────────────────────────────
 *
 * 'serial_number'
 *   A close-up photo of the product's serial number label/sticker.
 *   Why required: Brands need proof the service was carried out on the registered unit.
 *   Required for: ALL in-warranty and AMC service jobs.
 *   Galaxy of data: Used to cross-check with the brand's warranty registration database.
 *
 * 'machine'
 *   Wide-angle photo showing the complete appliance in situ.
 *   Why required: Establishes the physical condition of the unit before and after work.
 *   Required for: ALL in-warranty, AMC, and out-of-warranty (basic set) jobs.
 *
 * 'bill'
 *   Photo of the original purchase receipt or tax invoice.
 *   Why required: Validates the purchase date that anchors the warranty calculation.
 *   Required for: In-warranty and AMC jobs (where purchase_date matters for eligibility).
 *   Edge case: If customer cannot produce this, admin must mark service as 'expired'
 *   and the photo becomes optional.
 *
 * 'job_sheet'
 *   Photo of the physical job completion sheet signed by both technician and customer.
 *   Why required: Legal compliance — some brand contracts mandate a signed paper trail.
 *   Required for: In-warranty and AMC service jobs only.
 *   Not required for out-of-warranty jobs (no brand reimbursement claim needed).
 *
 * 'defective_part'
 *   Photo of the faulty component that was replaced or repaired.
 *   Why required: Brands require visual evidence before reimbursing spare part cost.
 *   Required for: In-warranty and AMC jobs where a spare part was replaced.
 *   Enforcement: Part of the 6-photo required set for active-warranty subjects.
 *
 * 'site_photo_1' | 'site_photo_2' | 'site_photo_3'
 *   General-purpose site documentation photos (numbered 1–3).
 *   Why: Installation jobs need before/after site records; service jobs may need to
 *   document difficult access areas, unsafe conditions, or specific fault locations.
 *   Required for: Optional — not in the required[] set but always visible in the gallery.
 *   Technician may upload 0, 1, 2, or all 3 as site conditions warrant.
 *   Gallery: Displayed in a 3-column grid under the "Site Photos" heading.
 *
 * 'service_video'
 *   Short video demonstrating the repaired appliance running normally post-fix.
 *   Why required: Brands often require a video proof of successful repair for warranty.
 *   Format: MP4 or MOV, max 50 MB, uploaded to the same Supabase 'subject-photos' bucket.
 *   Rendered: The gallery shows a <video> element (not <img>) for this type.
 *   Required for: In-warranty and AMC service jobs (the 6-proof required set).
 *
 * ─ REQUIRED SETS SUMMARY ────────────────────────────────────────────────────
 *   In-warranty / AMC service (6 required):
 *     [serial_number, machine, bill, job_sheet, defective_part, service_video]
 *   Out-of-warranty service (3 required):
 *     [serial_number, machine, bill]
 *   Installation (varies, minimum 2):
 *     [machine, site_photo_1]
 *
 * HOW COMPLETION IS CHECKED:
 *   GET /api/subjects/[id]/workflow queries subject_photos where is_deleted=false.
 *   It extracts the set of uploaded photo_type values and compares to required[].
 *   Missing = required.filter(r => !uploaded.includes(r))
 *   canComplete = missing.length === 0
 *
 * STORAGE BUCKET DETAILS:
 *   Bucket name: 'subject-photos'
 *   Path pattern: {subject_id}/{photo_type}/{timestamp}-{filename}
 *   Public CDN URL is stored on the row so consumers don't need to call getPublicUrl().
 *   Files are soft-deleted (is_deleted column) rather than actually removed from bucket.
 *
 * FILES THAT IMPORT PhotoType:
 *   • web/modules/subjects/subject.types.ts (self) — SubjectPhoto.photo_type
 *   • web/modules/subjects/subject.job-workflow.ts — required photo calculation
 *   • web/hooks/subjects/use-job-workflow.ts — uploadPhotoMutation formData field
 *   • web/components/subjects/PhotoGallery.tsx — section headings, img vs video render
 *   • web/components/subjects/PhotoUploader.tsx — dropdown selector
 *   • web/app/api/subjects/[id]/photos/route.ts — validation on upload
 *
 * @example
 *   const type: PhotoType = 'serial_number';  // close-up of sticker
 *   const video: PhotoType = 'service_video'; // 30-second MP4 showing AC cooling
 */
export type PhotoType = 'serial_number' | 'machine' | 'bill' | 'job_sheet' | 'defective_part' | 'site_photo_1' | 'site_photo_2' | 'site_photo_3' | 'service_video';

/**
 * @summary The reason a technician selects when they cannot finish the job on the first visit.
 *
 * @description
 * IncompleteReason is a closed enum that categorises WHY a job could not be completed.
 * The technician selects this from a dropdown on the MarkIncomplete screen of the
 * hitech_technician mobile app, or from the admin Subject Detail page.
 * The reason drives conditional UI fields and business-logic downstream.
 *
 * DATABASE STORAGE:
 *   Column: subjects.incomplete_reason
 *   DB type: text CHECK (incomplete_reason IN (
 *     'customer_cannot_afford','power_issue','door_locked',
 *     'spare_parts_not_available','site_not_ready','other'))
 *   NULLABLE — NULL until the job is marked INCOMPLETE. Set to NULL again if the job
 *   is subsequently rescheduled and completed.
 *
 * DOWNSTREAM EFFECTS (per reason):
 *
 * 'customer_cannot_afford'
 *   The customer was quoted the repair cost but declined due to price.
 *   Triggers: No spare parts list required. Admin may mark the job as CANCELLED later.
 *   incomplete_note: Strongly recommended, not required. Admin usually adds the quoted amount.
 *   UI flags: Shows a "Quoted amount" hint in the mark-incomplete modal.
 *   Next step: Admin contacts customer to offer payment plan or lower-cost alternative.
 *
 * 'power_issue'
 *   No electricity at the site — the technician could not power on the unit to diagnose.
 *   Triggers: No spare parts list required. Job is rescheduled once customer confirms power.
 *   incomplete_note: Should describe exact power condition ("main CB tripped", "no grid power").
 *   rescheduled_date: Usually required; captured in the same form submission.
 *
 * 'door_locked'
 *   The technician arrived but the customer's premises were locked / no one was home.
 *   Triggers: Standard rescheduling flow. Technician records arrival time via en_route_at.
 *   incomplete_note: Optional note (e.g., "Called customer twice, no answer").
 *   Business rule: If door-locked happens 3+ times, admin may escalate to 'CANCELLED'.
 *
 * 'spare_parts_not_available'
 *   The technician identified the faulty component but could not source the spare part.
 *   Triggers: CRITICAL — the UI shows an additional "Spare Parts Request" section:
 *     • sparePartsRequested: string  (comma-separated part names)
 *     • sparePartsQuantity:  number  (total parts count)
 *     • sparePartsItems[]: Array<{name, quantity, price}> (itemised list)
 *   Status: Subject moves to AWAITING_PARTS not just INCOMPLETE.
 *   Next step: Admin procures parts from supplier; job rescheduled once parts arrive.
 *   DB columns updated: spare_parts_requested, spare_parts_quantity, spare_parts_items.
 *
 * 'site_not_ready'
 *   The installation site is under construction or the mounting structure is not ready.
 *   Applies to installation jobs more than service jobs.
 *   incomplete_note: Should document what is missing ("false ceiling not done", "no bracket").
 *   rescheduled_date: Usually set to a date 1–2 weeks out.
 *
 * 'other'
 *   Catch-all for any reason not covered by the five specific values above.
 *   MANDATORY CONSTRAINT: incomplete_note MUST be provided (non-empty) when reason='other'.
 *   Enforced in: subject.job-workflow.ts validateMarkIncomplete() and the Zod schema.
 *   UI enforcement: The submit button is disabled until note.length >= 10 when 'other'.
 *   Common uses: unusual safety hazard, technician equipment fault, brand policy issue.
 *
 * STATUS TRANSITIONS WHEN MARKED INCOMPLETE:
 *   Standard: ARRIVED/IN_PROGRESS → INCOMPLETE
 *   spare_parts_not_available: ARRIVED/IN_PROGRESS → AWAITING_PARTS
 *   Timestamp set: subjects.incomplete_at = NOW()
 *   Timeline entry added: event_type = 'STATUS_CHANGED', old='IN_PROGRESS', new='INCOMPLETE'
 *
 * FILES THAT IMPORT IncompleteReason:
 *   • web/modules/subjects/subject.types.ts (self) — SubjectDetail.incomplete_reason
 *   • web/modules/subjects/subject.job-workflow.ts — validateMarkIncomplete()
 *   • web/components/subjects/MarkIncompleteModal.tsx — dropdown options
 *   • web/hooks/subjects/use-job-workflow.ts — markIncompleteMutation payload
 *   • web/repositories/subjectRepository.ts — DB update
 *
 * @example
 *   const r: IncompleteReason = 'spare_parts_not_available'; // needs parts form
 *   const r2: IncompleteReason = 'other'; // note field becomes mandatory
 */
export type IncompleteReason = 'customer_cannot_afford' | 'power_issue' | 'door_locked' | 'spare_parts_not_available' | 'site_not_ready' | 'other';

/**
 * @summary The method by which the technician collects payment from the customer on-site.
 *
 * @description
 * PaymentMode records HOW the technician received money from the customer at the end
 * of the service visit. It is only relevant for subjects where the customer is
 * responsible for the bill (service_charge_type = 'customer'). Brand/dealer-billed
 * jobs use a tax invoice instead of a payment collection slip, so payment_mode is
 * semantically irrelevant for those (stored as NULL).
 *
 * DATABASE STORAGE:
 *   Column: subjects.payment_mode  (also mirrored on subject_bills.payment_mode)
 *   DB type: text CHECK (payment_mode IN ('cash','upi','card','cheque'))
 *   NULLABLE — NULL until the bill is generated and payment is collected.
 *   Also written to subject_bills.payment_mode for historical record.
 *
 * VALUE EXPLANATIONS:
 *
 * 'cash'
 *   Physical banknotes given to the technician.
 *   Most common mode in India's appliance service sector (∼55% of collections).
 *   The technician carries a physical receipt book to issue a handwritten receipt.
 *   No third-party confirmation — the bill PDF serves as the digital receipt.
 *
 * 'upi'
 *   India's Unified Payments Interface (PhonePe, GPay, Paytm, BHIM, etc.).
 *   Technician shows a QR code on the hitech_technician app linked to the company UPI.
 *   Payment confirmation: Customer's bank sends an instant settlement; technician
 *   captures the UPI transaction reference number in the completion notes field.
 *   Recommended: This mode because it eliminates cash-handling risk for the company.
 *
 * 'card'
 *   Debit or credit card via a physical POS machine or UPI-based card swipe device.
 *   Less common in home service; more typical for commercial/office premises.
 *   Slip reference captured in completion_notes.
 *
 * 'cheque'
 *   Paper cheque drawn on the customer's bank account.
 *   Accepted only for institutional / corporate customers where on-the-spot payment
 *   is not possible. The cheque is handed to the technician who delivers it to the
 *   office; payment_collected_at timestamp is set only when the cheque clears.
 *   Risk: Requires a follow-up clearance confirmation step.
 *
 * WHEN payment_mode IS SET:
 *   set at: PATCH /api/subjects/[id]/billing?action=collect_payment
 *   triggers: payment_collected = true, payment_collected_at = NOW(),
 *             billing_status = 'paid' (for full collection)
 *
 * BRAND/DEALER JOBS:
 *   For service_charge_type = 'brand_dealer', the bill is a tax invoice sent to the
 *   brand/dealer for reimbursement. These jobs do NOT collect payment from the customer,
 *   so payment_mode remains NULL and the collect-payment UI section is hidden entirely.
 *
 * FILES THAT IMPORT PaymentMode:
 *   • web/modules/subjects/subject.types.ts (self) — SubjectDetail.payment_mode,
 *     SubjectBill.payment_mode, GenerateBillInput.payment_mode
 *   • web/components/subjects/BillingSection.tsx — payment mode selector
 *   • web/modules/subjects/billing.service.ts — generateBill(), updatePaymentStatus()
 *   • web/repositories/billingRepository.ts — DB column write
 *
 * @example
 *   const mode: PaymentMode = 'upi';    // paid via Google Pay on-site
 *   const mode2: PaymentMode = 'cash';  // Rs. 500 collected in notes
 */
export type PaymentMode = 'cash' | 'upi' | 'card' | 'cheque';

/**
 * @summary Lightweight subject record projected for the paginated list view.
 *
 * @description
 * SubjectListItem is a PROJECTION of the full subjects table — it includes only the
 * ~20 columns needed to render one row in the subject list table. Projecting a subset
 * of columns is critical because the list may display 50–200 rows simultaneously; fetching
 * all 50+ columns per row would waste bandwidth and slow the initial page load.
 *
 * HOW IT IS POPULATED:
 *   The Supabase query in subjectRepository.getSubjects() runs a SELECT with explicit
 *   column names. The assigned_technician_name, assigned_technician_code, and source_name
 *   fields are JOIN-derived (not raw columns on subjects) — they come from:
 *     • profiles.full_name / profiles.technician_code (for technician name/code)
 *     • brands.name or dealers.name (for source_name, depending on source_type)
 *   These joins are performed in the Supabase query using .select() with relationship
 *   syntax so that the API layer never has to do N+1 queries.
 *
 * USE SITES:
 *   • SubjectListPage (/app/dashboard/subjects/page.tsx): renders a table of rows
 *   • TechnicianDashboard: shows today's allocated jobs
 *   • OverdueQueuePage: shows overdue jobs sorted by priority
 *   • BillingQueuePage: shows jobs with billing_status='due'
 *
 * FIELD-BY-FIELD DOCUMENTATION:
 *
 * @field id
 *   UUID primary key from subjects.id.
 *   Used as the :id param in all /api/subjects/[id]/* routes.
 *   Used as the href in the list row click : /dashboard/subjects/{id}
 *   DB: uuid PRIMARY KEY DEFAULT gen_random_uuid()
 *
 * @field subject_number
 *   Human-readable job reference number (e.g. 'HT-2024-001234').
 *   Assigned by the admin at creation time; must be unique across the org.
 *   DB: text NOT NULL UNIQUE
 *   Validation: min 3 chars, max 50 chars, trimmed (see subjectNumberSchema)
 *   Used in: list table first column, search bar fuzzy match
 *
 * @field source_type
 *   See SubjectSourceType documentation above.
 *   Determines whether source_name is a brand name or dealer name.
 *
 * @field source_name
 *   Computed/joined field — NOT a raw subjects column.
 *   When source_type='brand': the join produces brands.name
 *   When source_type='dealer': the join produces dealers.name
 *   Used in: list table "Source" column, detail page header subtitle
 *   Nullability: NOT NULL in practice (brand_id/dealer_id FK is required),
 *   but typed as string to accommodate any edge-case join failure.
 *
 * @field assigned_technician_id
 *   UUID FK referencing profiles(id) for the assigned field technician.
 *   NULL when the job is in PENDING status (not yet dispatched to anyone).
 *   DB: uuid REFERENCES profiles(id) ON DELETE SET NULL
 *   Used in: technician filter, assignment form default value
 *
 * @field assigned_technician_name
 *   Derived from profiles.full_name. NULL when unassigned.
 *   Displayed in the list row and on the detail card.
 *
 * @field assigned_technician_code
 *   Derived from profiles.technician_code (short alphanumeric code like 'T042').
 *   NULL when unassigned or when the technician has no code set.
 *   Used in the list row as a compact identifier in narrow viewports.
 *
 * @field priority
 *   See SubjectPriority documentation. Shown as a colour badge.
 *
 * @field status
 *   Current workflow stage of the job. Valid values (JobWorkflowStatus):
 *     PENDING | ALLOCATED | ACCEPTED | ARRIVED | IN_PROGRESS |
 *     COMPLETED | INCOMPLETE | AWAITING_PARTS | RESCHEDULED | CANCELLED
 *   DB: text NOT NULL DEFAULT 'PENDING'
 *   Typed as plain string here (not JobWorkflowStatus) to avoid import cycle;
 *   the full JobWorkflowStatus union is defined later in this file.
 *
 * @field allocated_date
 *   The date the admin set for the technician visit, in 'YYYY-MM-DD' format.
 *   Used by the overdue queue: if allocated_date < TODAY and job is still active,
 *   the job is flagged as overdue.
 *   DB: date NOT NULL
 *
 * @field technician_allocated_date
 *   The specific date the technician was assigned. May differ from allocated_date
 *   if the admin reassigned on a different day.
 *   NULL until a technician is assigned.
 *   DB: date NULLABLE
 *
 * @field technician_allocated_notes
 *   Free-text notes the admin adds at assignment time (e.g., "Call customer before arrival").
 *   NULL until populated; displayed on the technician task card.
 *   DB: text NULLABLE
 *
 * @field technician_acceptance_status
 *   The technician's response to the job assignment.
 *   'pending'  → technician notified but has not yet responded in the app
 *   'accepted' → technician tapped Accept in hitech_technician app
 *   'rejected' → technician tapped Reject; is_rejected_pending_reschedule becomes true
 *   DB: text NOT NULL DEFAULT 'pending'
 *
 * @field is_rejected_pending_reschedule
 *   TRUE when the current technician rejected the job but the admin has not yet
 *   reassigned it. Displayed as a warning badge on the list row.
 *   DB: boolean NOT NULL DEFAULT FALSE
 *
 * @field customer_name
 *   Full name of the end customer. NULL if not filled at creation.
 *   DB: text NULLABLE
 *
 * @field customer_phone
 *   Indian mobile number (10 digits). NULL if not filled.
 *   DB: text NULLABLE
 *   SECURITY: Displayed only to admin/superadmin roles. Technicians see it only after
 *   accepting the job (enforced at API layer via role check).
 *
 * @field category_name
 *   Joined from service_categories.name. NULL if category not set.
 *   Displayed in the list as the product category (e.g., 'Split AC', 'Refrigerator').
 *
 * @field type_of_service
 *   See SubjectTypeOfService. Shown as a text label in the row.
 *
 * @field service_charge_type
 *   Who pays the bill:
 *   'customer'      → end customer pays out of pocket
 *   'brand_dealer'  → brand/dealer reimburses HiTech (warranty/AMC/contractual)
 *   DB: text NOT NULL DEFAULT 'customer'
 *
 * @field is_amc_service
 *   TRUE when this visit is under an Annual Maintenance Contract.
 *   Affects required photos and billing: AMC visits do not charge the customer.
 *   DB: boolean NOT NULL DEFAULT FALSE
 *
 * @field is_warranty_service
 *   TRUE when the product is under the manufacturer's warranty.
 *   Affects required photos (6-proof set) and billing (no customer charge).
 *   DB: boolean NOT NULL DEFAULT FALSE
 *
 * @field billing_status
 *   Summarises the payment state of the job:
 *   'not_applicable' → brand/dealer billed (never collects from customer)
 *   'due'            → customer-pay bill generated, payment not yet collected
 *   'partially_paid' → partial payment collected (not currently used; reserved)
 *   'paid'           → full payment collected
 *   'waived'         → admin waived the payment (e.g., goodwill gesture)
 *   DB: text NOT NULL DEFAULT 'due'
 *
 * @field created_at
 *   ISO 8601 timestamp when the row was inserted.
 *   DB: timestamptz NOT NULL DEFAULT NOW()
 *   Used for default sort order (newest first) when no other sort is applied.
 *
 * @example
 *   const item: SubjectListItem = {
 *     id: 'uuid-here',
 *     subject_number: 'HT-2024-001500',
 *     source_type: 'brand',
 *     source_name: 'Samsung India',
 *     assigned_technician_id: 'tech-uuid',
 *     assigned_technician_name: 'Ravi Kumar',
 *     assigned_technician_code: 'T042',
 *     priority: 'high',
 *     status: 'ALLOCATED',
 *     allocated_date: '2024-12-15',
 *     technician_allocated_date: '2024-12-15',
 *     technician_allocated_notes: 'Call 30 min before arrival',
 *     technician_acceptance_status: 'accepted',
 *     is_rejected_pending_reschedule: false,
 *     customer_name: 'Anita Sharma',
 *     customer_phone: '9876543210',
 *     category_name: 'Split AC',
 *     type_of_service: 'service',
 *     service_charge_type: 'brand_dealer',
 *     is_amc_service: false,
 *     is_warranty_service: true,
 *     billing_status: 'not_applicable',
 *     created_at: '2024-12-10T09:00:00.000Z',
 *   };
 */
export interface SubjectListItem {
  id: string;
  subject_number: string;
  source_type: SubjectSourceType;
  source_name: string;
  assigned_technician_id: string | null;
  assigned_technician_name: string | null;
  assigned_technician_code: string | null;
  priority: SubjectPriority;
  status: string;
  allocated_date: string;
  technician_allocated_date: string | null;
  technician_allocated_notes: string | null;
  technician_acceptance_status: 'pending' | 'accepted' | 'rejected';
  is_rejected_pending_reschedule: boolean;
  customer_name: string | null;
  customer_phone: string | null;
  category_name: string | null;
  type_of_service: SubjectTypeOfService;
  service_charge_type: 'customer' | 'brand_dealer';
  is_amc_service: boolean;
  is_warranty_service: boolean;
  billing_status: 'not_applicable' | 'due' | 'partially_paid' | 'paid' | 'waived';
  created_at: string;
}

/**
 * @summary Full subject record loaded on the Subject Detail page.
 *
 * @description
 * SubjectDetail extends SubjectListItem with every additional column that is too
 * expensive (or unnecessary) to fetch in the list view. It is populated by a single
 * Supabase query in subjectRepository.getSubjectById() which joins:
 *   • profiles (technician + assigned_by names)
 *   • subject_photos (entire array embedded)
 *   • subject_timeline (entire array embedded)
 *
 * Because this join can return megabytes of data for a heavily-worked job, the detail
 * query is ONLY triggered when the user navigates to /dashboard/subjects/[id] — never
 * in the list view. React Query caches the result under key ['subject', id] with
 * staleTime: 30_000 (30 seconds).
 *
 * FIELD-BY-FIELD DOCUMENTATION
 * (Fields inherited from SubjectListItem are not repeated; see that interface for docs.)
 *
 * @field brand_id
 *   UUID FK → brands.id. Non-null when source_type='brand'; null when source_type='dealer'.
 *   DB: uuid REFERENCES brands(id) ON DELETE SET NULL
 *   Used in: SubjectInfoCard to render brand logo; billing to populate invoice "issued_to".
 *
 * @field dealer_id
 *   UUID FK → dealers.id. Non-null when source_type='dealer'; null when source_type='brand'.
 *   DB: uuid REFERENCES dealers(id) ON DELETE SET NULL
 *
 * @field category_id
 *   UUID FK → service_categories.id.
 *   The actual category record; category_name (from SubjectListItem) is the joined name.
 *   NULL if not yet assigned — allowed at creation for flexibility.
 *   DB: uuid REFERENCES service_categories(id) ON DELETE SET NULL NULLABLE
 *
 * @field priority_reason
 *   Free-text note the admin writes to justify the chosen priority level.
 *   Mandatory — the Zod schema requires at least 1 character.
 *   Example: "VIP customer, hospital HVAC system"
 *   DB: text NOT NULL DEFAULT ''
 *
 * @field customer_address
 *   Full postal address of the service site.
 *   Used: displayed on the bill PDF and shown to technician in the app.
 *   NULL if not supplied at creation.
 *   DB: text NULLABLE
 *   SECURITY: Admin/superadmin only in admin panel. Technician sees it after job acceptance.
 *
 * @field product_name
 *   Brand product model name (e.g., 'Samsung AR18BY5ZBWK').
 *   Not a FK — free text to accommodate product names not in a catalogue.
 *   NULL if not supplied.
 *   DB: text NULLABLE
 *
 * @field serial_number
 *   Appliance serial number from the manufactured label.
 *   Used to verify the serial_number photo upload against the record.
 *   NULL if not available at job creation (can be filled after technician's site visit).
 *   DB: text NULLABLE
 *
 * @field product_description
 *   Additional free-text description of the product or fault.
 *   Example: "1.5 Ton 5-star inverter, reports loud noise during cooling cycle."
 *   DB: text NULLABLE
 *
 * @field purchase_date
 *   ISO date string 'YYYY-MM-DD' of when the customer purchased the appliance.
 *   Used to calculate warranty_end_date (purchase_date + warranty_period_months).
 *   Also displayed on the bill as the purchase reference.
 *   NULL if not supplied (out-of-warranty jobs often omit this).
 *   DB: date NULLABLE
 *
 * @field warranty_period_months
 *   Numeric count of months derived from the WarrantyPeriod enum selection.
 *   E.g. '2_years' → 24. Stored for reference; the end date is the operative value.
 *   NULL if not under warranty.
 *   DB: integer NULLABLE
 *
 * @field warranty_end_date
 *   ISO date string 'YYYY-MM-DD'. The definitive cutoff for warranty coverage.
 *   Compared to CURRENT_DATE to derive warranty_status.
 *   NULL if not under warranty.
 *   DB: date NULLABLE
 *
 * @field warranty_status
 *   Computed at query time (NOT stored in DB):
 *     'active'  → warranty_end_date >= CURRENT_DATE
 *     'expired' → warranty_end_date < CURRENT_DATE
 *     null      → no warranty information available
 *   Drives the required photo set and service_charge_type defaults.
 *
 * @field amc_start_date / amc_end_date
 *   ISO date strings delimiting the AMC coverage window.
 *   Both are NULL unless is_amc_service=true.
 *   AMC validation rule: amc_end_date must be AFTER amc_start_date (Zod superRefine).
 *   DB: date NULLABLE
 *
 * @field technician_rejection_reason
 *   Free text note the technician enters when tapping "Reject" in the mobile app.
 *   NULL until a rejection occurs.
 *   DB: text NULLABLE
 *
 * @field rejected_by_technician_id / rejected_by_technician_name
 *   UUID FK and joined name of the most recent technician who rejected this job.
 *   NULL until a rejection occurs. Useful for admin to avoid re-assigning to the same tech.
 *   DB: uuid NULLABLE / derived join NULLABLE
 *
 * @field en_route_at
 *   ISO 8601 timestamp when the technician tapped "On My Way" in the app.
 *   NULL until triggered. Sets status ALLOCATED → ACCEPTED (via workflow).
 *   DB: timestamptz NULLABLE
 *
 * @field arrived_at
 *   ISO 8601 timestamp when the technician tapped "I've Arrived" in the app.
 *   NULL until triggered. Sets status ACCEPTED → ARRIVED.
 *   DB: timestamptz NULLABLE
 *
 * @field work_started_at
 *   ISO 8601 timestamp when the technician tapped "Start Work" in the app.
 *   NULL until triggered. Sets status ARRIVED → IN_PROGRESS.
 *   DB: timestamptz NULLABLE
 *
 * @field completed_at
 *   ISO 8601 timestamp when the technician tapped "Complete Job" in the app.
 *   NULL until triggered. Sets status IN_PROGRESS → COMPLETED.
 *   DB: timestamptz NULLABLE
 *   Important: This timestamp is used by the billing queue check to find customer-pay
 *   completed jobs awaiting payment collection.
 *
 * @field incomplete_at
 *   ISO 8601 timestamp when the job was marked INCOMPLETE.
 *   NULL until triggered.
 *   DB: timestamptz NULLABLE
 *
 * @field incomplete_reason
 *   See IncompleteReason documentation above.
 *   NULL until job is marked incomplete.
 *
 * @field incomplete_note
 *   Free-text elaboration on incomplete_reason.
 *   NULL unless reason='other' (where it is mandatory) or voluntarily written.
 *   DB: text NULLABLE
 *
 * @field spare_parts_requested
 *   Comma-separated string of spare part names requested by the technician.
 *   NULL unless incomplete_reason='spare_parts_not_available'.
 *   DB: text NULLABLE
 *
 * @field spare_parts_quantity
 *   Total count of spare parts requested across all part types.
 *   NULL unless spare parts were requested.
 *   DB: integer NULLABLE
 *
 * @field completion_proof_uploaded
 *   TRUE when all required PhotoType files have been uploaded.
 *   Derived at query time by comparing subject_photos against the required set.
 *   FALSE means the "Complete Job" button is disabled in the UI.
 *   DB: boolean NOT NULL DEFAULT FALSE (updated by photo upload webhook)
 *
 * @field completion_notes
 *   Free-text note the technician adds when tapping "Complete Job".
 *   Optional. Displayed in the timeline and on the bill PDF.
 *   DB: text NULLABLE
 *
 * @field rescheduled_date
 *   ISO date 'YYYY-MM-DD' for when the job is re-attempted after INCOMPLETE.
 *   NULL unless the job has been rescheduled.
 *   DB: date NULLABLE
 *
 * @field visit_charge / service_charge / accessories_total / grand_total
 *   Billing amounts in INR. Optional on SubjectDetail — present only when a bill
 *   has been generated. `?` (optional) because they may be absent before bill creation.
 *   DB: numeric(10,2) NULLABLE on subject_bills; joined into the subject query.
 *
 * @field payment_mode
 *   See PaymentMode documentation. Optional — set at payment collection time.
 *
 * @field payment_collected
 *   TRUE when the technician has confirmed payment receipt via the app.
 *   DB: boolean NULLABLE DEFAULT FALSE (on subjects table, mirrored from bill)
 *
 * @field payment_collected_at
 *   ISO 8601 timestamp of payment collection. NULL until payment confirmed.
 *
 * @field bill_generated / bill_generated_at / bill_number
 *   Flags and metadata indicating whether a bill PDF has been created.
 *   bill_number: unique reference like 'INV-2024-001500'.
 *   All NULL/FALSE until POST /api/subjects/[id]/billing?action=generate is called.
 *
 * @field photos
 *   Embedded array of SubjectPhoto records (from subject_photos table).
 *   Populated by a single JOIN in getSubjectById() so the detail page never needs
 *   a separate photo fetch. Empty array [] when no photos uploaded yet.
 *
 * @field created_by / assigned_by
 *   UUIDs of the admin users who created and last assigned the job.
 *   NULL if the subject was created via a legacy script without populated audit fields.
 *   DB: uuid REFERENCES profiles(id) ON DELETE SET NULL NULLABLE
 *
 * @field timeline
 *   Embedded ordered array of SubjectTimelineItem records.
 *   Each row in subject_timeline is returned sorted by changed_at ASC.
 *   Used by the TimelineSection component to render the full event history.
 */
export interface SubjectDetail extends SubjectListItem {
  brand_id: string | null;
  dealer_id: string | null;
  category_id: string | null;
  priority_reason: string;
  customer_name: string | null;
  customer_address: string | null;
  product_name: string | null;
  serial_number: string | null;
  product_description: string | null;
  purchase_date: string | null;
  warranty_period_months: number | null;
  warranty_end_date: string | null;
  warranty_status: 'active' | 'expired' | null;
  amc_start_date: string | null;
  amc_end_date: string | null;
  service_charge_type: 'customer' | 'brand_dealer';
  is_amc_service: boolean;
  is_warranty_service: boolean;
  billing_status: 'not_applicable' | 'due' | 'partially_paid' | 'paid' | 'waived';
  technician_rejection_reason: string | null;
  rejected_by_technician_id: string | null;
  rejected_by_technician_name: string | null;
  en_route_at: string | null;
  arrived_at: string | null;
  work_started_at: string | null;
  completed_at: string | null;
  incomplete_at: string | null;
  incomplete_reason: IncompleteReason | null;
  incomplete_note: string | null;
  spare_parts_requested: string | null;
  spare_parts_quantity: number | null;
  completion_proof_uploaded: boolean;
  completion_notes: string | null;
  rescheduled_date: string | null;
  visit_charge?: number | null;
  service_charge?: number | null;
  accessories_total?: number | null;
  grand_total?: number | null;
  payment_mode?: PaymentMode | null;
  payment_collected?: boolean;
  payment_collected_at?: string | null;
  bill_generated?: boolean;
  bill_generated_at?: string | null;
  bill_number?: string | null;
  photos: SubjectPhoto[];
  created_by: string | null;
  assigned_by: string | null;
  timeline: SubjectTimelineItem[];
}

/**
 * @summary A single immutable audit-log entry recording a state change on this subject.
 *
 * @description
 * SubjectTimelineItem models a row in the subject_timeline table — every time the
 * system or a user changes something significant about a subject, a new row is inserted
 * into this table. The rows are NEVER updated or deleted: they form an append-only
 * audit trail that gives administrators a complete history of every action taken.
 *
 * DATABASE STORAGE:
 *   Table: subject_timeline
 *   Primary key: id (UUID)
 *   FK: subject_id → subjects.id ON DELETE CASCADE
 *   Sort order: always fetched ORDER BY changed_at ASC so the timeline renders
 *   chronologically oldest-first.
 *
 * WHEN ROWS ARE INSERTED:
 *   1. Status transitions (PENDING → ALLOCATED, ALLOCATED → ACCEPTED, etc.)
 *      → event_type='STATUS_CHANGED', old_value=prev_status, new_value=new_status
 *   2. Technician assignment changes
 *      → event_type='TECHNICIAN_ASSIGNED', note=tech_name
 *   3. Priority changes
 *      → event_type='PRIORITY_CHANGED', old_value=old_priority, new_value=new_priority
 *   4. Bill generation
 *      → event_type='BILL_GENERATED', note=bill_number
 *   5. Payment collection
 *      → event_type='PAYMENT_COLLECTED', note=payment_mode
 *   6. Manual admin notes
 *      → event_type='NOTE_ADDED', note=freetext
 *   7. Photo uploads
 *      → event_type='PHOTO_UPLOADED', note=photo_type
 *
 * FIELD DOCUMENTATION:
 *
 * @field id
 *   UUID PK of the timeline row. Used as React list key in TimelineSection.
 *
 * @field event_type
 *   A string constant (not a typed union in DB) identifying what kind of change occurred.
 *   The component maps event_type to an icon:
 *     STATUS_CHANGED     → circular arrow icon
 *     TECHNICIAN_ASSIGNED→ user-check icon
 *     BILL_GENERATED     → receipt icon
 *     PAYMENT_COLLECTED  → money icon
 *     PHOTO_UPLOADED     → camera icon
 *     NOTE_ADDED         → pencil icon
 *
 * @field status
 *   The status of the subject AT THE TIME this timeline entry was created.
 *   Allows the timeline to show a status chip alongside the event description.
 *   Example: 'IN_PROGRESS' for a photo upload event that happened mid-work.
 *
 * @field changed_at
 *   ISO 8601 timestamp (with timezone) when the event occurred.
 *   Set by the server via DEFAULT NOW() on the DB row insert.
 *   Displayed in the timeline as a formatted relative time ("3 hours ago").
 *
 * @field note
 *   Optional human-readable description of the change.
 *   Examples: 'Rescheduled to 2024-12-20', 'Technician: Ravi Kumar assigned',
 *             'Payment via UPI collected', 'Bill INV-2024-001500 generated'.
 *   NULL for events where the old/new values speak for themselves.
 *
 * @field old_value / new_value
 *   Machine-readable before/after strings for diffs.
 *   NULL when the event has no meaningful old/new pair (e.g., first assignment).
 *   Examples:
 *     STATUS_CHANGED: old_value='ALLOCATED', new_value='ACCEPTED'
 *     PRIORITY_CHANGED: old_value='medium', new_value='critical'
 *
 * @field changed_by
 *   UUID FK → profiles(id) of the user who triggered this event.
 *   NULL for system-generated events (e.g., auto-status from technician actions).
 *
 * @field changed_by_name
 *   Joined from profiles.full_name. NULL for system events or unknown users.
 *   Displayed in the timeline entry as "by Sunita Patel".
 *
 * SECURITY:
 *   Timeline rows are append-only by DB policy. The service role cannot UPDATE or DELETE.
 *   Technicians can see their own interactions; admins see all entries.
 *
 * FILES THAT IMPORT SubjectTimelineItem:
 *   • web/modules/subjects/subject.types.ts (self) — SubjectDetail.timeline[]
 *   • web/components/subjects/TimelineSection.tsx — renders sorted list
 *   • web/repositories/timelineRepository.ts — addTimelineEntry()
 */
export interface SubjectTimelineItem {
  id: string;
  event_type: string;
  status: string;
  changed_at: string;
  note: string | null;
  old_value: string | null;
  new_value: string | null;
  changed_by: string | null;
  changed_by_name: string | null;
}

/**
 * @summary All filter parameters that can be applied to the subject list query.
 *
 * @description
 * SubjectListFilters is the shape of the filter state passed from the list page URL
 * query parameters through the React Query hook, down to the repository layer, and
 * ultimately into the Supabase .filter()/.eq() chain.
 *
 * FILTER FLOW:
 *   URL params (?search=Samsung&priority=high)
 *     → useSubjects hook destructures into this shape
 *     → passed to getSubjects(filters) in the API route
 *     → validated/sanitised in the API route before forwarding
 *     → subjectRepository.getSubjects(filters) builds the Supabase query
 *
 * ALL FIELDS ARE OPTIONAL: The list works with zero filters (returns all subjects,
 * paginated). Each non-undefined field narrows the result set further.
 *
 * FIELD-BY-FIELD DOCUMENTATION:
 *
 * @field search
 *   Free-text substring search applied to:
 *     subjects.subject_number (exact prefix match)
 *     subjects.customer_name (ilike '%term%')
 *     subjects.customer_phone (ilike '%term%')
 *     brands.name / dealers.name (ilike '%term%', joined)
 *   The Supabase OR filter wraps all these conditions.
 *   Empty string is treated identically to undefined (no search applied).
 *
 * @field source_type
 *   'brand' → only brand-originated subjects
 *   'dealer' → only dealer-originated subjects
 *   'all' or undefined → no filter (all sources shown)
 *   Maps to: .eq('source_type', value) when not 'all'
 *
 * @field priority
 *   One of the four SubjectPriority values, or 'all' for no filter.
 *   Maps to: .eq('priority', value) when not 'all'
 *
 * @field status
 *   One of the JobWorkflowStatus string values, or undefined for no filter.
 *   Used by queue-specific dashboards (e.g., the COMPLETED queue, AWAITING_PARTS queue).
 *   Maps to: .eq('status', value)
 *
 * @field category_id / brand_id / dealer_id
 *   UUID strings for dropdown-based FK filters on the list page.
 *   category_id: filters to subjects of a given service category.
 *   brand_id: filters to subjects from a specific brand (only meaningful for brand subjects).
 *   dealer_id: filters to subjects from a specific dealer.
 *   Maps to: .eq('category_id' | 'brand_id' | 'dealer_id', value)
 *
 * @field from_date / to_date
 *   ISO date strings 'YYYY-MM-DD' delimiting the allocated_date range.
 *   from_date → .gte('allocated_date', from_date)
 *   to_date   → .lte('allocated_date', to_date)
 *   Both optional independently. Commonly used: "show all jobs this week"
 *
 * @field technician_date
 *   ISO date string for the technician_allocated_date column.
 *   Used in the TECHNICIAN role dashboard:
 *     GET /api/subjects?technician_date=2024-12-15&assigned_technician_id={userId}
 *   Returns only jobs where technician_allocated_date = this date.
 *   This is how the app shows "Today's jobs" on the technician home screen.
 *
 * @field assigned_technician_id
 *   UUID of the technician whose jobs to return.
 *   ADMIN use: can filter to any technician's workload.
 *   TECHNICIAN use: always set to their own user ID (enforced in API route by role check).
 *   Maps to: .eq('assigned_technician_id', value)
 *
 * @field technician_pending_only
 *   When TRUE, adds: .not('status', 'in', ['COMPLETED','CANCELLED','INCOMPLETE'])
 *   Used on the technician's active task list (not the history list).
 *
 * @field pending_only
 *   When TRUE, adds:
 *     .is('completed_at', null)  — not yet finished
 *     .not('status', 'in', ['CANCELLED'])
 *   Surfaces all jobs that have work remaining (admin pending queue).
 *
 * @field overdue_only
 *   When TRUE, adds:
 *     .is('completed_at', null)
 *     .not('status', 'in', ['COMPLETED','CANCELLED'])
 *     .lte('allocated_date', today)  — past their due date
 *   Important: also sorts result by priority DESC, allocated_date ASC.
 *
 * @field due_only
 *   When TRUE, adds:
 *     .eq('billing_status', 'due')
 *     .eq('service_charge_type', 'customer')
 *     .not('status', 'in', ['CANCELLED'])
 *   Surfaces the payment collection queue for client-pay jobs.
 *
 * @field page
 *   1-based page number. Default: 1 (applied in repository if not supplied).
 *   Used with page_size to calculate the Supabase .range() offset.
 *
 * @field page_size
 *   Number of rows per page. Default: 20. Maximum: 100 (enforced in repository).
 *   Sent as ?page_size= in the URL for the data table page-size selector.
 *
 * QUEUE MODE MUTUAL EXCLUSIVITY:
 *   pending_only, overdue_only, and due_only are MUTUALLY EXCLUSIVE.
 *   The list page URL router ensures only one is set at a time via the ?queue= param:
 *     ?queue=pending  → pending_only=true
 *     ?queue=overdue  → overdue_only=true
 *     ?queue=due      → due_only=true
 *   If multiple are set (API misuse), the repository applies all filters (AND logic),
 *   potentially returning an empty set.
 *
 * FILES THAT IMPORT SubjectListFilters:
 *   • web/hooks/subjects/useSubjects.ts — hook argument type
 *   • web/app/api/subjects/route.ts — URL param parsing
 *   • web/repositories/subjectRepository.ts — query construction
 *   • web/app/dashboard/subjects/page.tsx — passed to useSubjects
 */
export interface SubjectListFilters {
  search?: string;
  source_type?: SubjectSourceType | 'all';
  priority?: SubjectPriority | 'all';
  status?: string;
  category_id?: string;
  brand_id?: string;
  dealer_id?: string;
  from_date?: string;
  to_date?: string;
  /** Filter by technician_allocated_date (used for technician role to see today's assignments) */
  technician_date?: string;
  /** When set, only return subjects assigned to this technician user ID. */
  assigned_technician_id?: string;
  /** Restrict technician views to active work queue (non-terminal statuses). */
  technician_pending_only?: boolean;
  /** Show unfinished work queue using schema-safe criteria. */
  pending_only?: boolean;
  /** Show only overdue pending technician-assigned subjects. */
  overdue_only?: boolean;
  /** Show customer-chargeable completed subjects that are pending payment collection. */
  due_only?: boolean;
  page?: number;
  page_size?: number;
}

/**
 * @summary Paginated response envelope returned by the GET /api/subjects endpoint.
 *
 * @description
 * SubjectListResponse wraps the array of SubjectListItem records with pagination
 * metadata. This design pattern (an envelope with data + pagination) is used consistently
 * across all list endpoints in the HiTech API.
 *
 * WHY PAGINATION METADATA IS INCLUDED:
 *   The list page needs to know:
 *     • total: for rendering "Showing 21–40 of 150 jobs" and the total page count
 *     • page: to highlight the active page in the pagination control
 *     • page_size: to match the selected "rows per page" dropdown
 *     • total_pages: to render the last-page button and disable "Next" when on last page
 *
 * HOW total_pages IS DERIVED:
 *   total_pages = Math.ceil(total / page_size)
 *   This is computed in the service layer (not the repository) to keep the repository
 *   focused on data retrieval. A page_size of 0 would cause division-by-zero — the
 *   service layer defaults page_size to 20 before computing.
 *
 * SUPABASE COUNT PATTERN:
 *   Supabase.from('subjects').select('*', { count: 'exact' }) returns a count field.
 *   The repository reads this and passes it as total to the service layer.
 *   An exact count (vs. estimated) is used here because the list UI shows the exact
 *   number and relies on it for correct page arithmetic.
 *
 * REACT QUERY INTEGRATION:
 *   useSubjects returns data: SubjectListResponse | undefined.
 *   The list page destructures: const { data, total, total_pages } = data ?? defaults.
 *   On first load (data undefined), the page shows a skeleton.
 *
 * @field data
 *   The array of lightweight SubjectListItem rows for the current page.
 *   Empty array [] on page 1 when there are no matching subjects.
 *
 * @field total
 *   Absolute count of all subjects matching the current filters (across ALL pages).
 *   Not just the count of items in data[].
 *
 * @field page
 *   Which page was returned (mirrors the requested page number).
 *   1-based. Always ≥ 1.
 *
 * @field page_size
 *   How many rows per page were requested and honoured.
 *   Capped at 100 in the service layer regardless of what was requested.
 *
 * @field total_pages
 *   Derived total number of pages at this page_size.
 *   Used to disable "Next" button and to render page number chips.
 *
 * FILES THAT IMPORT SubjectListResponse:
 *   • web/hooks/subjects/useSubjects.ts — return type of getSubjectList()
 *   • web/app/api/subjects/route.ts — what the GET handler returns
 *   • web/app/dashboard/subjects/page.tsx — data destructured in list component
 */
export interface SubjectListResponse {
  data: SubjectListItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

/**
 * @summary Defines the shape of values managed by react-hook-form in SubjectForm.tsx.
 *
 * @description
 * SubjectFormValues is the canonical form state type. It is used in three scenarios:
 *   1. CREATE mode: empty defaults → user fills in → CreateSubjectInput (adds created_by)
 *   2. EDIT mode:   pre-filled from SubjectDetail → user edits → UpdateSubjectInput
 *   3. QUICK-EDIT:  small inline forms (priority change, date change) use a subset
 *
 * CROSS-FIELD VALIDATION RULES (enforced in subjectFormSchema via Zod superRefine):
 *
 *   RULE 1: Source / Brand / Dealer mutual exclusion
 *     IF source_type === 'brand' AND !brand_id → error on brand_id: "Brand is required"
 *     IF source_type === 'dealer' AND !dealer_id → error on dealer_id: "Dealer is required"
 *     Rationale: avoids saving a subject with no linked partner entity.
 *
 *   RULE 2: Warranty date consistency
 *     IF warranty_end_date && !purchase_date → error on purchase_date
 *     IF warranty_end_date && purchase_date && warranty_end_date <= purchase_date
 *       → error on warranty_end_date: "Warranty end must be after purchase date"
 *     Rationale: a warranty that ends before or on the purchase date is logically impossible.
 *
 *   RULE 3: AMC completeness
 *     IF amc_end_date && !amc_start_date → error on amc_start_date: "Start date required"
 *     IF amc_start_date && amc_end_date && amc_end_date <= amc_start_date
 *       → error on amc_end_date: "AMC end must be after start date"
 *     Rationale: an AMC that ends before it starts is invalid.
 *
 *   RULE 4: Technician date dependency
 *     IF assigned_technician_id && !technician_allocated_date (future planned feature)
 *     Currently the form allows saving without technician_allocated_date even when a
 *     technician is assigned — the admin may assign a date later. No enforcement yet.
 *
 * FIELD DOCUMENTATION:
 *
 * @field subject_number
 *   Unique job reference. Validated by subjectNumberSchema: trim, min(3), max(50).
 *   Recommended format: HT-YYYY-NNNNNN (enforced by convention, not the schema).
 *
 * @field source_type
 *   'brand' or 'dealer'. Required. Default: 'brand' in form.
 *   Drives which partner dropdown (brand_id vs dealer_id) is shown.
 *
 * @field brand_id
 *   Optional UUID. Required if source_type='brand'. Shows in BrandSelect dropdown.
 *   Fetched from GET /api/brands (list populated on form mount).
 *
 * @field dealer_id
 *   Optional UUID. Required if source_type='dealer'. Shows in DealerSelect dropdown.
 *   Fetched from GET /api/dealers.
 *
 * @field assigned_technician_id
 *   Optional UUID. The technician pre-assigned at creation time.
 *   Can also be set later via the AssignTechnicianForm on the detail page.
 *   Fetched from GET /api/staff?role=technician.
 *
 * @field priority
 *   Required enum. Default: 'medium'. Shown as a segmented control.
 *
 * @field priority_reason
 *   Free text, required (min 1 char).
 *   The creator justifies why this priority was chosen.
 *
 * @field allocated_date
 *   ISO date 'YYYY-MM-DD'. Required. The management target visit date.
 *   Shown in a DatePicker on the form.
 *
 * @field type_of_service
 *   Required. 'installation' | 'service'. Default: 'service'.
 *
 * @field category_id
 *   UUID. Recommended field — the form shows a warning if omitted.
 *   Loaded from GET /api/service-categories.
 *
 * @field customer_phone / customer_name / customer_address
 *   Optional contact details. customer_phone: no format validation (handles any format).
 *   customer_address: multi-line textarea.
 *
 * @field product_name / serial_number / product_description
 *   Optional product identification fields. serial_number is used to validate
 *   the serial_number photo upload on the job workflow.
 *
 * @field purchase_date
 *   Optional ISO date. Required when warranty_end_date is provided (Rule 2 above).
 *
 * @field warranty_end_date
 *   Optional ISO date. Either calculated from WarrantyPeriod selection or manually entered
 *   (when period='custom'). Must be after purchase_date.
 *
 * @field amc_start_date / amc_end_date
 *   Optional ISO dates. Used when is_amc_service=true. amc_end_date > amc_start_date.
 *
 * @example
 *   const values: SubjectFormValues = {
 *     subject_number: 'HT-2024-001500',
 *     source_type: 'brand',
 *     brand_id: 'samsung-uuid',
 *     priority: 'high',
 *     priority_reason: 'Hospital HVAC system, critical comfort',
 *     allocated_date: '2024-12-15',
 *     type_of_service: 'service',
 *     category_id: 'split-ac-uuid',
 *     customer_name: 'Apollo Hospital',
 *     purchase_date: '2022-06-01',
 *     warranty_end_date: '2024-06-01',
 *   };
 */
export interface SubjectFormValues {
  subject_number: string;
  source_type: SubjectSourceType;
  brand_id?: string;
  dealer_id?: string;
  assigned_technician_id?: string;
  priority: SubjectPriority;
  priority_reason: string;
  allocated_date: string;
  type_of_service: SubjectTypeOfService;
  category_id: string;
  customer_phone?: string;
  customer_name?: string;
  customer_address?: string;
  product_name?: string;
  serial_number?: string;
  product_description?: string;
  purchase_date?: string;
  warranty_end_date?: string;
  amc_start_date?: string;
  amc_end_date?: string;
}

/**
 * @summary Payload for creating a new subject row in the database.
 *
 * @description
 * CreateSubjectInput is the complete payload sent from the POST /api/subjects route
 * handler into the subject service and repository. It extends SubjectFormValues with
 * created_by — the field that records WHICH admin created this job ticket.
 *
 * WHY created_by IS NOT IN SubjectFormValues:
 *   The form never asks the user "who are you?" — it is determined server-side by
 *   reading the authenticated user's JWT. Adding created_by to the form shape would
 *   open up a client-side injection risk where an attacker could forge a different UUID.
 *   Instead, the API route reads the session:
 *     const { data: { user } } = await supabase.auth.getUser();
 *     const payload: CreateSubjectInput = { ...formValues, created_by: user.id };
 *
 * SECURITY NOTE:
 *   created_by must NEVER be taken from the request body — only from the server-side
 *   session. The API route type-checks the body as SubjectFormValues (not CreateSubjectInput)
 *   and adds created_by explicitly. This ensures audit integrity.
 *
 * @field created_by
 *   UUID of the authenticated office staff or admin who submitted the creation form.
 *   References profiles(id). NOT NULL on the DB column.
 *   Used in: subject_timeline rows (changed_by), reports ("created by"), audit queries.
 */
export interface CreateSubjectInput extends SubjectFormValues {
  created_by: string; // UUID of the office staff / admin who raised this ticket
}

/**
 * @summary Payload for updating all editable fields of an existing subject.
 *
 * @description
 * UpdateSubjectInput is a type alias for SubjectFormValues. The shape of the update
 * form is identical to the creation form — all the same fields are editable.
 *
 * WHY AN ALIAS INSTEAD OF A SEPARATE INTERFACE:
 *   An alias communicates intent clearly without duplicating the field definitions.
 *   If SubjectFormValues ever changes (new fields added), UpdateSubjectInput
 *   automatically inherits those changes. There is no divergence risk.
 *   Contrast with CreateSubjectInput which EXTENDS (adds created_by) — that
 *   requires a genuine extension, not just an alias.
 *
 * WHAT IS NOT EDITABLE VIA UpdateSubjectInput:
 *   • subject_number: changing the identifier after creation causes referencing issues.
 *     To change it, an admin must cancel and re-create the job (policy decision).
 *   • created_by: immutable audit field; only set at creation time.
 *   • status, assigned_technician_id: these follow separate workflows
 *     (job workflow route, assign technician form) with their own business rules.
 *
 * API ROUTE: PUT /api/subjects/[id]
 *   Body is typed as SubjectFormValues (which UpdateSubjectInput aliases).
 *   The route adds the row's id and calls subjectRepository.updateSubject(id, payload).
 */
export type UpdateSubjectInput = SubjectFormValues;

/**
 * @summary Payload for the dedicated technician assignment / reassignment operation.
 *
 * @description
 * AssignTechnicianInput encapsulates everything needed to assign (or reassign) a
 * technician to a subject. It is used exclusively by the AssignTechnicianForm
 * component on the Subject Detail page, submitted to:
 *   PATCH /api/subjects/[id]/assign (or PATCH /api/subjects/[id]/billing with action=assign)
 *
 * WHY A SEPARATE TYPE FROM SubjectFormValues:
 *   Assignment is a WORKFLOW OPERATION, not a simple field update. When a technician
 *   is assigned:
 *   1. The subject status changes (PENDING → ALLOCATED or earlier ACCEPTED → ALLOCATED)
 *   2. A timeline entry is inserted documenting the assignment
 *   3. The technician receives a push notification (if configured)
 *   4. Previous rejection flags are cleared (is_rejected_pending_reschedule = false)
 *   5. Previous acceptance status is reset to 'pending'
 *   All of these side effects are triggered by the assignment endpoint and would be
 *   wrong to trigger on a general SubjectFormValues update.
 *
 * UNASSIGNMENT:
 *   Setting technician_id, technician_allocated_date, and technician_allocated_notes
 *   to null removes the technician assignment and resets the status to PENDING.
 *   This is used by the "Remove Technician" button on the detail page.
 *
 * @field subject_id
 *   UUID of the subject being modified. Used to find the target row.
 *   Redundant with the URL :id param but included for service-layer type safety.
 *
 * @field technician_id
 *   UUID FK → profiles.id of the technician to assign.
 *   NULL to unassign the current technician.
 *   The service layer validates that this profile has role='technician'.
 *
 * @field technician_allocated_date
 *   ISO date 'YYYY-MM-DD'. The date the technician is expected on-site.
 *   NULL when unassigning. Used by the technician's app to show "Today's jobs".
 *   Also checked by the overdue queue (lte comparison with CURRENT_DATE).
 *
 * @field technician_allocated_notes
 *   Optional freetext note to the technician (e.g., "Park at the rear", "Call on arrival").
 *   NULL when unassigning.
 *
 * @field assigned_by
 *   UUID of the admin performing the assignment.
 *   Extracted from the server-side session, NOT from the request body (security).
 *   Written to: subjects.assigned_by and the timeline row's changed_by field.
 *
 * SECURITY:
 *   Only admin/superadmin roles may call the assignment endpoint.
 *   The API route verifies the session role before processing.
 *   A technician cannot assign themselves or others via this endpoint.
 *
 * @example
 *   const payload: AssignTechnicianInput = {
 *     subject_id: 'job-uuid',
 *     technician_id: 'tech-uuid',
 *     technician_allocated_date: '2024-12-20',
 *     technician_allocated_notes: 'Access code: 1234',
 *     assigned_by: 'admin-uuid',
 *   };
 */
export interface AssignTechnicianInput {
  subject_id: string;
  technician_id: string | null;
  technician_allocated_date: string | null;  // ISO date string YYYY-MM-DD
  technician_allocated_notes: string | null;
  assigned_by: string;
}

/**
 * @summary A single photo or video file attachment record for a subject.
 *
 * @description
 * SubjectPhoto models a row from the subject_photos table. Every file the technician
 * uploads during a job is tracked here. The actual binary file lives in Supabase Storage;
 * this record holds the metadata and the CDN-accessible URL.
 *
 * DATABASE STORAGE:
 *   Table: subject_photos
 *   PK: id (UUID)
 *   FK: subject_id → subjects(id) ON DELETE CASCADE
 *   Soft-delete: is_deleted boolean (photos are never hard-deleted, just flagged)
 *
 * STORAGE BUCKET:
 *   Bucket name: 'subject-photos'
 *   Bucket policy: PRIVATE (only service role and authenticated users with appropriate
 *   RLS policy can access)
 *   Path pattern: {subject_id}/{photo_type}/{timestamp}_{original_filename}
 *   Example: abc-uuid/serial_number/1702290000000_IMG_001.jpg
 *
 * URL GENERATION:
 *   When a file is uploaded, the API route calls:
 *     supabase.storage.from('subject-photos').getPublicUrl(storage_path)
 *   The resulting public_url is stored in the DB row.
 *   The client renders <img src={photo.public_url} /> without needing storage access.
 *   WHY STORE THE URL: Supabase CDN URL structure is stable; re-fetching getPublicUrl
 *   in the client would add an unnecessary round-trip.
 *
 * MIME TYPE HANDLING:
 *   For regular photos: mime_type = 'image/jpeg' or 'image/png'
 *   For service videos: mime_type = 'video/mp4' or 'video/quicktime'
 *   The photo gallery component uses mime_type to decide <img> vs <video> render.
 *   If mime_type is NULL (legacy uploads), the gallery falls back to checking
 *   whether photo_type === 'service_video'.
 *
 * FILE SIZE:
 *   file_size_bytes is stored for:
 *   1. Admin display ("Photo (2.3 MB)")
 *   2. Future quota enforcement (field-level limits per subject)
 *   NULL on very old uploads that predate this column.
 *   Maximum enforced: 10 MB for images, 50 MB for service_video (enforced by API route).
 *
 * COMPLETION REQUIREMENT LOGIC:
 *   When GET /api/subjects/[id]/workflow runs the completion check:
 *   1. Queries: SELECT photo_type FROM subject_photos WHERE subject_id=? AND is_deleted=false
 *   2. Builds the uploaded[] set from these rows
 *   3. Compares uploaded[] against the required[] set derived from warranty_status + type_of_service
 *   4. Returns canComplete = missing.length === 0
 *
 * SOFT DELETE:
 *   Technicians cannot delete photos via the mobile app.
 *   Admins can flag a photo as deleted via DELETE /api/subjects/[id]/photos/{photoId}.
 *   This sets is_deleted=true and excludes the row from the completion check.
 *   The actual file in Storage is NOT removed — it stays for audit purposes.
 *
 * @field id
 *   UUID PK of the photo record. Used in the gallery as the React key.
 *
 * @field subject_id
 *   UUID FK binding this photo to its parent subject.
 *   ON DELETE CASCADE: when a subject is deleted, all photos are automatically removed.
 *
 * @field photo_type
 *   Which category of proof this file represents. See PhotoType documentation.
 *
 * @field storage_path
 *   The relative path within the 'subject-photos' bucket.
 *   Example: 'abc123-uuid/serial_number/1702290000000_serial.jpg'
 *   Used by the API when performing signed URL generation or deletion.
 *
 * @field public_url
 *   Full CDN URL to the file (generated at upload time, cached in DB).
 *   Example: 'https://xyz.supabase.co/storage/v1/object/public/subject-photos/...'
 *   Rendered directly in <img>/<video> tags without auth headers needed.
 *
 * @field uploaded_by
 *   UUID FK → profiles.id of the user who performed the upload.
 *   NULL for very old uploads made before audit tracking was added.
 *   For technician uploads: the technician's user ID.
 *   For admin uploads: the admin's user ID (admins can upload on behalf of tech).
 *
 * @field uploaded_at
 *   ISO 8601 timestamp of the upload. DEFAULT NOW() on DB insert.
 *   Used to sort photos within a type (multiple attempts → show newest first).
 *
 * @field file_size_bytes
 *   File size in bytes. NULL for legacy rows. Max 10 MB (10_485_760) for images.
 *
 * @field mime_type
 *   MIME type string. NULL for legacy rows. Used for <img> vs <video> rendering.
 */
export interface SubjectPhoto {
  id: string;
  subject_id: string;
  photo_type: PhotoType;
  storage_path: string;
  public_url: string;
  uploaded_by: string | null;
  uploaded_at: string;
  file_size_bytes: number | null;
  mime_type: string | null;
}

/**
 * @summary Transient state tracking the upload progress of a single photo type.
 *
 * @description
 * PhotoUploadProgress is a UI-only type — it is never persisted to the database.
 * It lives as a local state array in the PhotoUploader component and is used to render
 * a per-photo-type progress bar while the file is being sent to:
 *   POST /api/subjects/[id]/photos/upload
 *
 * WHY A PROGRESS BAR PER PHOTO TYPE (not per file):
 *   Each upload slot in the UI corresponds to one PhotoType category. The technician
 *   uploads one file per slot (or replaces an existing one). Tracking by type rather
 *   than by file ID keeps the state simple — there is no concept of a queue of multiple
 *   files mid-upload within one slot.
 *
 * STATE LIFECYCLE:
 *   1. Initial state: [] (empty; no uploads in progress)
 *   2. User selects a file: push { photoType, progress: 0, isUploading: true }
 *   3. As fetch progresses (using ReadableStream / XHR onprogress): update progress 0→100
 *   4. On success: remove the entry (or set isUploading: false, progress: 100)
 *   5. On error: set isUploading: false (show error state in that slot)
 *
 * @field photoType
 *   Identifies which upload slot this progress entry belongs to.
 *
 * @field progress
 *   0–100 integer percentage. 0 means just started; 100 means transfer complete.
 *   Note: The API may not support streaming progress for all file sizes — in that
 *   case progress jumps from 0 → 100 when the response resolves.
 *
 * @field isUploading
 *   TRUE while the fetch is in flight. FALSE either before upload starts or after
 *   completion (success or failure). Controls the disabled state of the file input.
 */
export interface PhotoUploadProgress {
  photoType: PhotoType;
  progress: number; // 0–100 percentage complete
  isUploading: boolean;
}

/**
 * @summary Result of the photo completion gate-check run before job closure.
 *
 * @description
 * JobCompletionRequirements is returned by GET /api/subjects/[id]/workflow and
 * consumed by the use-job-workflow hook. It answers the question:
 *   "Is the technician allowed to press Complete Job right now?"
 *
 * CALCULATION ALGORITHM (in subject.job-workflow.ts):
 *   1. Look up the subject's warranty_status and type_of_service.
 *   2. Derive required[] based on those two fields (see PhotoType docs for the matrix).
 *   3. Fetch all non-deleted photo rows for this subject.
 *   4. Extract the set of uploaded photo_type values.
 *   5. missing = required.filter(t => !uploaded.includes(t))
 *   6. canComplete = missing.length === 0
 *
 * UI USAGE:
 *   The JobWorkflowSection component receives this struct and:
 *   • Disables the "Complete Job" button when canComplete === false
 *   • Renders a checklist showing each required photo with ✓ or ✗
 *   • Highlights missing[] entries in red with an upload shortcut link
 *
 * @field required
 *   The full list of PhotoType values that must be present for this job's configuration.
 *
 * @field uploaded
 *   The PhotoType values for which at least one non-deleted photo row exists.
 *
 * @field missing
 *   The set difference: required minus uploaded. Empty → technician may complete.
 *
 * @field canComplete
 *   Convenience flag = (missing.length === 0). Derived from the other three fields.
 *   The button disabled state reads directly from !canComplete.
 */
export interface JobCompletionRequirements {
  required: PhotoType[];
  uploaded: PhotoType[];
  missing: PhotoType[];
  canComplete: boolean;
}

/**
 * @summary Payload submitted when a technician marks a job as INCOMPLETE.
 *
 * @description
 * IncompleteJobInput is the validated request body shape for the workflow endpoint:
 *   POST /api/subjects/[id]/respond?action=mark_incomplete
 *
 * The camelCase naming here (vs snake_case in the DB) follows the front-end convention:
 * all request bodies use camelCase; the service layer converts to snake_case before
 * writing to Supabase.
 *
 * VALIDATION RULES (enforced in the API route and subject.job-workflow.ts):
 *   1. reason must be a valid IncompleteReason enum value
 *   2. If reason === 'other', note must have length >= 10 (cannot be empty or trivial)
 *   3. If reason === 'spare_parts_not_available':
 *      - sparePartsRequested must be a non-empty string
 *      - sparePartsQuantity must be a positive integer
 *      - sparePartsItems must be a non-empty array (each entry: name, quantity ≥ 1, price ≥ 0)
 *   4. If rescheduledDate provided: must be a valid ISO date in the FUTURE (> today)
 *
 * DATABASE WRITES (on success):
 *   subjects.incomplete_reason = reason
 *   subjects.incomplete_note = note
 *   subjects.incomplete_at = NOW()
 *   subjects.status = 'INCOMPLETE' (or 'AWAITING_PARTS' for spare_parts reason)
 *   subjects.spare_parts_requested = sparePartsRequested (joined string)
 *   subjects.spare_parts_quantity = sparePartsQuantity
 *   subjects.rescheduled_date = rescheduledDate (if provided)
 *   subject_timeline INSERT with event_type='STATUS_CHANGED'
 *
 * @field reason
 *   See IncompleteReason documentation. Required field — must always be provided.
 *
 * @field note
 *   Explains the situation. Required when reason='other' (min 10 chars).
 *   Recommended but not enforced for other reasons.
 *
 * @field sparePartsRequested
 *   Human-readable list of part names, e.g. 'Compressor, Capacitor'.
 *   Required when reason='spare_parts_not_available'.
 *
 * @field sparePartsQuantity
 *   Total numeric count of parts requested (sum of quantities in sparePartsItems).
 *   Required when reason='spare_parts_not_available'.
 *
 * @field sparePartsItems[]
 *   Itemised list of parts: name (string), quantity (int), price (decimal INR).
 *   Used to auto-populate the bill's accessories when parts arrive and are fitted.
 *   Optional — the form may not have prices yet (pending supplier quote).
 *
 * @field rescheduledDate
 *   Optional target date for the next visit. When provided:
 *   - subjects.rescheduled_date is set
 *   - status becomes 'RESCHEDULED' instead of 'INCOMPLETE' (if future date given)
 *   - A RESCHEDULED timeline entry is added
 */
export interface IncompleteJobInput {
  reason: IncompleteReason;
  note: string;
  sparePartsRequested?: string;
  sparePartsQuantity?: number;
  sparePartsItems?: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  rescheduledDate?: string; // ISO date string YYYY-MM-DD
}

/**
 * @summary A single spare-part / material line item added to a subject's bill.
 *
 * @description
 * SubjectAccessory models a row in the subject_accessories table. Accessories
 * represent physical spare parts, materials, or consumables used during the repair
 * that need to be billed to the customer or claimed from the brand.
 *
 * WHY A SEPARATE TABLE (not embedded in subjects):
 *   A single job may require multiple different parts (e.g., compressor + capacitor +
 *   refrigerant gas). Storing them as separate rows enables:
 *   • Individual price and quantity tracking per item
 *   • Easy aggregation (SUM of total_price) for bill generation
 *   • Adding/removing individual items without rewriting the entire bill
 *   • Audit trail (added_by, created_at per line item)
 *
 * RELATIONSHIP TO BILLING:
 *   When generateBill() is called, it sums all SubjectAccessory rows for the subject
 *   into accessories_total. This total flows into the bill grand_total calculation:
 *     grand_total = visit_charge + service_charge + accessories_total (+ GST if applicable)
 *
 * RELATIONSHIP TO INCOMPLETE JOBS:
 *   When a job is marked INCOMPLETE with reason='spare_parts_not_available', the
 *   sparePartsItems array from IncompleteJobInput can be pre-loaded as draft
 *   SubjectAccessory rows (status='pending') — confirmed once parts arrive.
 *   (This is a planned feature; currently parts are added after re-completion.)
 *
 * DATABASE:
 *   Table: subject_accessories
 *   PK: id (UUID)
 *   FK: subject_id → subjects(id) ON DELETE CASCADE
 *   Soft-delete: none — accessories are hard-deleted when removed.
 *
 * @field id
 *   UUID PK. Used as the React key in the accessories list component.
 *   Passed to DELETE /api/subjects/[id]/billing?action=remove_accessory&accessoryId={id}
 *
 * @field subject_id
 *   UUID FK linking this line item to its parent subject.
 *
 * @field item_name
 *   Human-readable part description, e.g. 'Compressor 1.5T R32'.
 *   No catalogue reference — free text entered by admin/technician.
 *   Min: 1 char (validated in AddAccessoryInput).
 *
 * @field quantity
 *   Number of units of this part used. Positive integer, minimum 1.
 *   Example: quantity=2 for two capacitors replaced.
 *
 * @field unit_price
 *   Cost per single unit in INR. Stored as numeric(10,2) in DB.
 *   Input via the AddAccessoryForm as a plain number (decimals allowed).
 *
 * @field total_price
 *   Derived value: quantity * unit_price.
 *   Calculated in the service layer (not the DB) and stored for query performance.
 *   Example: quantity=2, unit_price=150.00 → total_price=300.00
 *
 * @field added_by
 *   UUID FK → profiles.id of the user who added this accessory row.
 *   NULL for legacy rows or rows added via scripts.
 *   Used in: display tooltip ("Added by Rajesh")
 *
 * @field created_at
 *   ISO 8601 timestamp when this accessory was added.
 *   Display: shown in the accessories list as a relative time.
 */
export interface SubjectAccessory {
  id: string;
  subject_id: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  added_by: string | null;
  created_at: string;
}

/**
 * @summary The generated bill record for a service job.
 *
 * @description
 * SubjectBill models a row in the subject_bills table. A bill is created via
 * POST /api/subjects/[id]/billing?action=generate. Only ONE bill can exist per
 * subject (enforced by a UNIQUE constraint on subject_bills.subject_id).
 * Generating a second bill replaces (updates) the existing one rather than
 * inserting a duplicate.
 *
 * BILL TYPES:
 *   'customer_receipt'   → Given to the end customer; shows what they owe.
 *     Applies when: service_charge_type = 'customer'
 *     issued_to = customer_name, issued_to_type = 'customer'
 *
 *   'brand_dealer_invoice' → Sent to the brand/dealer for reimbursement.
 *     Applies when: service_charge_type = 'brand_dealer'
 *     issued_to = brand.name or dealer.name, issued_to_type = 'brand_dealer'
 *
 * BILL NUMBER FORMAT:
 *   Auto-generated server-side: INV-{YYYY}-{zero-padded sequential number}
 *   Example: INV-2024-001500
 *   Unique across the system (sequential counter stored in a DB sequence).
 *   This is the reference number printed on the PDF.
 *
 * GRAND TOTAL CALCULATION:
 *   grand_total = visit_charge + service_charge + accessories_total
 *   If apply_gst=true: grand_total *= 1.18 (18% GST added)
 *   All amounts stored as numeric(10,2) in INR.
 *
 * PDF GENERATION:
 *   The bill PDF is generated on demand by GET /api/subjects/[id]/billing?action=download.
 *   The PDF contains: bill_number, issued_to, line items (visit, service, accessories),
 *   grand_total, payment_mode, payment status, generated_at date.
 *   PDF is generated in memory and streamed as application/pdf response.
 *
 * PAYMENT STATUS TRANSITIONS:
 *   'due'     → bill generated, payment not yet collected
 *   'paid'    → payment confirmed (PATCH billing?action=collect_payment)
 *   'waived'  → admin waived the amount (PATCH billing?action=waive)
 *   There is no 'partially_paid' on the bill; the subjects table has 'partially_paid'
 *   in billing_status as a future extensibility placeholder.
 *
 * @field bill_number
 *   Unique human-readable reference (INV-2024-001500).
 *   Printed on the PDF, referenced in timeline entries.
 *
 * @field bill_type
 *   'customer_receipt' or 'brand_dealer_invoice' — determines PDF template.
 *
 * @field issued_to
 *   The name of the entity the bill is addressed to.
 *   For customer bills: subjects.customer_name
 *   For brand/dealer bills: brands.name or dealers.name
 *
 * @field issued_to_type
 *   'customer' or 'brand_dealer' — used for filtering in reports.
 *
 * @field brand_id / dealer_id
 *   UUID FK pointers. Only one is non-null (mirrors the subject's source_type).
 *   Used in brand/dealer billing reconciliation reports.
 *
 * @field visit_charge / service_charge / accessories_total
 *   Individual line item amounts in INR. All non-negative.
 *
 * @field grand_total
 *   The final payable amount: sum of line items (+ GST if applicable).
 *
 * @field payment_mode
 *   See PaymentMode. NULL until payment is collected.
 *
 * @field payment_status
 *   'paid' | 'due' | 'waived'. Drives the billing_status on the parent subject.
 *
 * @field payment_collected_at
 *   ISO 8601 timestamp of payment collection. NULL until PATCH collect_payment is called.
 *
 * @field generated_by
 *   UUID FK → profiles.id. The admin who called generate. NULL for system-generated bills.
 *
 * @field generated_at
 *   ISO 8601 timestamp when the bill was generated (or last regenerated).
 */
export interface SubjectBill {
  id: string;
  subject_id: string;
  bill_number: string;
  bill_type: 'customer_receipt' | 'brand_dealer_invoice';
  issued_to: string;
  issued_to_type: 'customer' | 'brand_dealer';
  brand_id: string | null;
  dealer_id: string | null;
  visit_charge: number;
  service_charge: number;
  accessories_total: number;
  grand_total: number;
  payment_mode: PaymentMode | null;
  payment_status: 'paid' | 'due' | 'waived';
  payment_collected_at: string | null;
  generated_by: string | null;
  generated_at: string;
}

/**
 * @summary Payload for adding a single spare-part line item to a subject.
 *
 * @description
 * AddAccessoryInput is used in two scenarios:
 *   1. Via the "Add Accessory" modal on the Subject Detail billing section:
 *      POST /api/subjects/[id]/billing?action=add_accessory
 *   2. As part of GenerateBillInput.accessories[] when generating a bill with parts
 *      included in the same operation.
 *
 * SERVER-SIDE PROCESSING:
 *   The billing service's addAccessory() function receives this input, validates it,
 *   then calls createAccessory() in billingRepository:
 *     subject_accessories INSERT:
 *       item_name, quantity, unit_price, total_price = quantity * unit_price
 *
 * VALIDATION (billing.service.ts addAccessory guard chain):
 *   1. item_name must be a non-empty string (after trimming whitespace)
 *   2. quantity must be a positive integer (≥ 1)
 *   3. unit_price must be a non-negative number (≥ 0.00) — zero-price parts allowed
 *      for warranty replacements where the part is brand-supplied at no charge
 *   4. The subject must exist in the DB
 *   5. The subject's status must be IN_PROGRESS (cannot add accessories to completed jobs)
 *
 * @field item_name
 *   Free-text description of the part. Printed on the bill PDF as a line item label.
 *   Examples: 'Compressor 1.5T', 'Gas Filling (R32)', 'PCB Module CH-120'
 *
 * @field quantity
 *   Number of units. Must be ≥ 1. Multiplied by unit_price to get the line item total.
 *
 * @field unit_price
 *   Price per unit in INR. May be 0.00 for brand-covered warranty parts.
 *   Stored as numeric(10,2) — maximum value: 99,999,999.99
 */
export interface AddAccessoryInput {
  item_name: string;
  quantity: number;
  unit_price: number;
}

/**
 * @summary Payload for the generate-bill operation.
 *
 * @description
 * GenerateBillInput is the request body for:
 *   POST /api/subjects/[id]/billing?action=generate
 *
 * All fields are optional because:
 *   • Some jobs have no visit charge (warranty, AMC, or waived transit)
 *   • Some jobs have no accessories
 *   • Payment mode is set later at the PATCH collect_payment call
 *   • GST is not always applicable
 *
 * THE 10-STEP generateBill() FLOW (in billing.service.ts):
 *   1.  Validate subject exists and is in COMPLETED status
 *   2.  Determine bill_type from service_charge_type
 *   3.  Determine issued_to from brand/dealer/customer name
 *   4.  Delete any existing accessories for this subject (fresh recalculation)
 *   5.  Insert new accessory rows for each item in accessories[]
 *   6.  Sum all accessory total_price values (in-memory reduction)
 *   7.  Calculate base grand_total = visit_charge + service_charge + accessories_total
 *   8.  Apply GST: if (apply_gst) grand_total *= 1.18 (rounded to 2dp)
 *   9.  Upsert subject_bills row with all calculated values
 *   10. Update subjects.billing_status = 'due' (or 'not_applicable' for brand/dealer)
 *
 * @field visit_charge
 *   Transit/visit fee in INR. Default 0 if not provided.
 *   Represents the technician's travel cost charged to the customer.
 *
 * @field service_charge
 *   Labour charge in INR for the actual repair/installation work.
 *   Default 0 if not provided.
 *
 * @field accessories
 *   Array of line items (spare parts + materials). Empty array [] is valid.
 *   These are inserted as fresh subject_accessories rows before the bill is generated.
 *   Any pre-existing accessories for this subject are DELETED first (full replacement).
 *
 * @field payment_mode
 *   Optional — can be set at generate time if payment is collected simultaneously.
 *   More commonly set later via the collect_payment PATCH action.
 *
 * @field apply_gst
 *   When true: adds 18% GST on top of the base total.
 *   Default false. Applicable for commercial/GST-registered customers.
 *   The Bill PDF shows the base amount and GST as separate line items.
 */
export interface GenerateBillInput {
  visit_charge?: number;
  service_charge?: number;
  accessories: AddAccessoryInput[];
  payment_mode?: PaymentMode;
  apply_gst?: boolean;
}

/**
 * @summary Payload for editing an already-generated bill.
 *
 * @description
 * EditBillInput is the request body for:
 *   PUT /api/subjects/[id]/billing?action=edit_bill
 *
 * Unlike GenerateBillInput (which does a full replacement), EditBillInput supports
 * PARTIAL modification of an existing bill by:
 *   • Updating the charge amounts (visit_charge, service_charge)
 *   • Toggling GST
 *   • Changing payment mode (if not yet collected)
 *   • Adding NEW accessory rows (accessories_to_add[])
 *   • Removing EXISTING accessory rows by their UUID (accessories_to_remove[])
 *
 * WHY PARTIAL EDIT (vs. re-generate):
 *   Re-generating deletes all accessories and starts fresh. If an admin only needs to
 *   add one more part to an existing multi-item bill, deleting everything and
 *   retyping all items is error-prone and slow. EditBillInput solves this by allowing
 *   targeted additions and removals.
 *
 * GUARD CONDITION:
 *   A bill can only be edited if payment_status='due'. Once 'paid' or 'waived',
 *   the bill is locked (the billing service returns an error if edit is attempted).
 *   This prevents retroactively changing the amount after collection.
 *
 * @field visit_charge / service_charge
 *   Required — the full updated charge amounts (not deltas).
 *   The service layer replaces the bill's existing values entirely.
 *
 * @field apply_gst
 *   Whether the updated bill should include 18% GST.
 *
 * @field payment_mode
 *   Optional override of the payment mode. NULL to clear.
 *
 * @field accessories_to_add
 *   New accessories to INSERT into subject_accessories for this subject.
 *   Processed exactly as AddAccessoryInput[] in addAccessory().
 *
 * @field accessories_to_remove
 *   Array of subject_accessories.id UUIDs to DELETE.
 *   Each UUID is validated to belong to this subject before deletion.
 */
export interface EditBillInput {
  visit_charge: number;
  service_charge: number;
  apply_gst: boolean;
  payment_mode?: PaymentMode | null;
  accessories_to_add?: AddAccessoryInput[];
  accessories_to_remove?: string[];
}

/**
 * @summary Lightweight bill summary shown in the SubjectDetail header section.
 *
 * @description
 * BillSummary is a projection of the SubjectBill interface. It contains only the
 * fields needed to render the billing summary widget on the Subject Detail page
 * without loading the full bill record (which includes brand_id, dealer_id, etc.).
 *
 * WHEN IT IS USED:
 *   A BillSummary may be embedded directly in the SubjectDetail query result via a
 *   JOIN on subject_bills, avoiding a second round-trip to fetch the full bill.
 *   The BillingSection component uses this to show "Bill: INV-2024-001500 | ₹2,500 | Due".
 *
 * @field bill_number    Human-readable reference for display and PDF lookup.
 * @field bill_type      Determines which PDF template to render.
 * @field issued_to      Name printed as the payee on the bill.
 * @field grand_total    The final amount due, in INR.
 * @field payment_status 'paid' | 'due' | 'waived' — drives the status badge colour.
 * @field generated_at   ISO 8601 timestamp for the bill creation date displayed in the UI.
 */
export interface BillSummary {
  bill_number: string;
  bill_type: 'customer_receipt' | 'brand_dealer_invoice';
  issued_to: string;
  grand_total: number;
  payment_status: 'paid' | 'due' | 'waived';
  generated_at: string;
}

/**
 * @summary Exhaustive union of all valid status codes for the job workflow state machine.
 *
 * @description
 * JobWorkflowStatus is the finite set of states a subject can be in throughout its
 * lifecycle. The workflow is a directed acyclic graph (with one backward edge for
 * RESCHEDULED) — every transition is explicit and enforced server-side.
 *
 * DATABASE STORAGE:
 *   Column: subjects.status
 *   DB type: text NOT NULL DEFAULT 'PENDING'
 *   Stored in UPPERCASE to distinguish from column names (lowercase convention).
 *   A DB CHECK constraint (or trigger) ensures only valid status values are written.
 *
 * THE COMPLETE STATE MACHINE:
 *
 *   PENDING
 *     Initial state. Job created by admin, no technician assigned yet.
 *     Entry: subject CREATE operation.
 *     Exit: ALLOCATED (when technician is assigned)
 *
 *   ALLOCATED
 *     Technician has been assigned and notified.
 *     Entry: assignTechnician() sets status=ALLOCATED.
 *     Exit: ACCEPTED (technician taps Accept in app) or back to PENDING (if unassigned).
 *
 *   ACCEPTED
 *     Technician confirmed they will attend. May be en route or preparing.
 *     Entry: Technician presses "Accept Job" in hitech_technician app.
 *     Exit: ARRIVED (technician arrives on site). Also triggers en_route_at timestamp.
 *
 *   ARRIVED
 *     Technician has physically arrived at the customer's premises.
 *     Entry: Technician presses "I've Arrived" in app. Sets arrived_at timestamp.
 *     Exit: IN_PROGRESS (technician starts work).
 *
 *   IN_PROGRESS
 *     Active repair/installation work is underway.
 *     Entry: Technician presses "Start Work" in app. Sets work_started_at timestamp.
 *     Exit:
 *       COMPLETED (job successfully finished)
 *       INCOMPLETE (job cannot be completed this visit)
 *       AWAITING_PARTS (spare parts needed, not currently available)
 *
 *   COMPLETED
 *     Job successfully finished. All required photos uploaded.
 *     Entry: Technician presses "Complete Job" (after canComplete = true).
 *             Sets completed_at timestamp.
 *     Exit: None — COMPLETED is a terminal state (cannot be reversed).
 *     Post-completion: Admin generates bill, collects payment.
 *
 *   INCOMPLETE
 *     Job could not be finished this visit (see IncompleteReason).
 *     Entry: Technician presses "Mark Incomplete" and selects a reason.
 *     Exit: ALLOCATED (when rescheduled and reassigned for a follow-up visit).
 *
 *   AWAITING_PARTS
 *     Job stopped because required spare parts are not available.
 *     Entry: Technician marks incomplete with reason='spare_parts_not_available'.
 *     Exit: ALLOCATED (once parts are procured and the job is reassigned).
 *     This status is treated like INCOMPLETE but with a specific visual distinction.
 *
 *   RESCHEDULED
 *     A follow-up date has been booked after an INCOMPLETE visit.
 *     Entry: Admin sets rescheduled_date and moves status to RESCHEDULED.
 *     Exit: ALLOCATED (when the technician is assigned for the new date).
 *     Note: rescheduled_date < today → job becomes overdue (same logic as ALLOCATED).
 *
 *   CANCELLED
 *     Job will not be executed. Terminal state.
 *     Entry: Admin explicitly cancels the job (e.g., customer withdrew, duplicate entry).
 *     Exit: None — CANCELLED is a terminal state.
 *     Note: A cancelled job still exists in the DB for audit/reporting purposes.
 *
 * TERMINAL STATES: COMPLETED, CANCELLED
 *   The overdue queue, billing queue, and pending queue all explicitly exclude these
 *   two statuses using .not('status', 'in', ['COMPLETED','CANCELLED']).
 *
 * BILLING-ELIGIBLE STATES:
 *   A bill can only be generated when status = 'COMPLETED'.
 *   The billing service returns an error if attempted in any other state.
 *
 * FILES THAT USE JobWorkflowStatus:
 *   • web/modules/subjects/subject.job-workflow.ts — validateStatusTransition()
 *   • web/hooks/subjects/use-job-workflow.ts — updateStatusMutation label mapping
 *   • web/components/subjects/JobWorkflowSection.tsx — status display and controls
 *   • web/repositories/subjectRepository.ts — status filter in getSubjects()
 *   • web/app/api/subjects/[id]/respond/route.ts — transition enforcement
 */
export type JobWorkflowStatus =
  | 'PENDING'
  | 'ALLOCATED'
  | 'ACCEPTED'
  | 'ARRIVED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'INCOMPLETE'
  | 'AWAITING_PARTS'
  | 'RESCHEDULED'
  | 'CANCELLED';

/**
 * @summary Service-layer input for the mark-incomplete workflow action (snake_case variant).
 *
 * @description
 * MarkIncompleteInput is the internal service-layer type (snake_case field names)
 * used after the API route has parsed and converted the camelCase IncompleteJobInput
 * from the request body. This separation maintains the convention:
 *   • API request bodies use camelCase (JS/TS standard)
 *   • Service/repository internals use snake_case (mirrors DB columns)
 *
 * The API route (respond/route.ts) maps IncompleteJobInput → MarkIncompleteInput
 * before calling subjectJobWorkflow.markIncomplete(subjectId, input).
 *
 * @field reason         Required IncompleteReason value.
 * @field note           Optional elaboration note.
 * @field spare_parts_requested  Joined string of part names (when parts unavailable).
 * @field spare_parts_quantity   Total parts count.
 * @field rescheduled_date       ISO date for follow-up visit.
 */
export interface MarkIncompleteInput {
  reason: IncompleteReason;
  note?: string;
  spare_parts_requested?: string;
  spare_parts_quantity?: number;
  rescheduled_date?: string;
}

/**
 * @summary Service-layer input for the complete-job workflow action.
 *
 * @description
 * CompleteJobInput is submitted by the technician when pressing "Complete Job".
 * It is intentionally minimal — the only optional field is a completion note.
 *
 * ALL COMPLETION PREREQUISITES ARE CHECKED SEPARATELY:
 *   Before accepting this submission, the server runs the JobCompletionRequirements
 *   check (canComplete === true). If any required photos are missing, the server
 *   returns HTTP 422 with the list of missing types. CompleteJobInput is only
 *   processed when all prerequisites are satisfied.
 *
 * DATABASE WRITES ON COMPLETION:
 *   subjects.status = 'COMPLETED'
 *   subjects.completed_at = NOW()
 *   subjects.completion_proof_uploaded = true
 *   subjects.completion_notes = completion_notes (if provided)
 *   Subject timeline INSERT: event_type='STATUS_CHANGED', new_value='COMPLETED'
 *
 * @field completion_notes
 *   Optional summary written by the technician describing what was done.
 *   Example: "Replaced compressor, recharged R32 gas, tested cooling at 18°C."
 *   Displayed on the bill PDF and in the timeline.
 */
export interface CompleteJobInput {
  completion_notes?: string;
}

/**
 * @summary Result record returned after a successful photo upload operation.
 *
 * @description
 * PhotoUploadResult is the response body shape returned by
 *   POST /api/subjects/[id]/photos/upload
 * after the file has been written to Supabase Storage and a subject_photos row inserted.
 *
 * The client (use-job-workflow uploadPhotoMutation) receives this object and can:
 *   • Display a success toast ("Photo uploaded: Serial Number")
 *   • Refresh the photo gallery (React Query invalidate ['subject', id])
 *   • Update the completion requirements check (invalidate ['workflow', id])
 *
 * @field storage_path  Relative path in the 'subject-photos' Storage bucket.
 * @field public_url    CDN URL for immediate display in the gallery <img> tag.
 * @field photo_type    Which proof type this file satisfies.
 * @field file_size_bytes  Actual size of the uploaded file in bytes.
 */
export interface PhotoUploadResult {
  storage_path: string;
  public_url: string;
  photo_type: PhotoType;
  file_size_bytes: number;
}

/**
 * @summary Snake_case variant of the completion requirements check result.
 *
 * @description
 * RequiredPhotosCheck is the internal service-layer version of JobCompletionRequirements.
 * The same distinction as MarkIncompleteInput vs IncompleteJobInput applies:
 *   • API responses use camelCase → JobCompletionRequirements (can_complete → canComplete)
 *   • Service internals use snake_case → RequiredPhotosCheck (can_complete)
 *
 * Returned by subject.job-workflow.ts getRequiredPhotos() before being serialised
 * to camelCase in the API route response.
 *
 * @field required    Full set of required PhotoType values for this job.
 * @field uploaded    PhotoType values already satisfied by uploaded photos.
 * @field missing     required minus uploaded — what still needs to be uploaded.
 * @field can_complete  True when missing is empty — the job can be marked COMPLETED.
 */
export interface RequiredPhotosCheck {
  required: PhotoType[];
  uploaded: PhotoType[];
  missing: PhotoType[];
  can_complete: boolean;
}

