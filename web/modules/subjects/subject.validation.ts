// ═════════════════════════════════════════════════════════════════════════════
// subject.validation.ts
//
// ──────────────────────────────────────────────────────────────────────────────
// PURPOSE AND SCOPE
// ──────────────────────────────────────────────────────────────────────────────
// This file defines every Zod validation schema used by the Subject domain.
// Schemas serve as the FIRST LINE OF DEFENCE before any data reaches the
// Supabase database. They run exclusively on the server side (API routes and
// the service layer) via Zod's safeParse() method, which returns a discriminated
// union:
//   { success: true,  data: ParsedType }          → proceed with DB write
//   { success: false, error: ZodError }            → return 400 to client
//
// WHY SERVER-SIDE VALIDATION (not just client-side)?
// ──────────────────────────────────────────────────────────────────────────────
// Client-side validation (react-hook-form + zodResolver) is UX sugar — it gives
// instant feedback in the form before the request is sent. But:
//   1. Any HTTP client (curl, Postman, malicious script) can bypass browser checks.
//   2. Race conditions can put stale form state into a submission.
//   3. The form schema may diverge from the server schema if not shared.
// Running safeParse() server-side guarantees data integrity regardless of how
// the request was constructed. The server NEVER trusts the client.
//
// SCHEMA ARCHITECTURE
// ──────────────────────────────────────────────────────────────────────────────
// The schemas are layered:
//   subjectNumberSchema    — reusable atomic validator for the ticket number
//   subjectPrioritySchema  — reusable enum validator for priority
//   subjectFormSchema      — core schema for create/edit form data (20 fields)
//     └─ superRefine()     — 4 cross-field business rules added here
//   createSubjectSchema    — extends subjectFormSchema with created_by
//   updateSubjectSchema    — alias of subjectFormSchema (no extra fields)
//
// HOW ERRORS REACH THE UI
// ──────────────────────────────────────────────────────────────────────────────
// When safeParse() fails:
//   1. The API route extracts error.flatten() into field-keyed error messages.
//   2. Returns HTTP 400: { error: 'Validation failed', details: fieldErrors }
//   3. The React Query mutation's onError handler receives this payload.
//   4. Field errors are set on react-hook-form: form.setError('brand_id', { message })
//   5. The error appears inline next to the relevant form input.
//
// WHY ZOD (not Yup, joi, or custom validators)?
// ──────────────────────────────────────────────────────────────────────────────
//   • TypeScript-first: z.infer<typeof schema> gives the parsed type automatically.
//   • No runtime overhead from type stripping — Zod is the type system at runtime.
//   • safeParse() is exception-free; it never throws, making error handling predictable.
//   • superRefine() gives the most powerful cross-field validation with path-targeted
//     issues that map cleanly to react-hook-form's path-based error model.
//
// IMPORT MAP
// ──────────────────────────────────────────────────────────────────────────────
// These schemas are imported by:
//   • web/app/api/subjects/route.ts (POST handler — createSubjectSchema)
//   • web/app/api/subjects/[id]/route.ts (PUT handler — updateSubjectSchema)
//   • web/modules/subjects/subject.service.ts (called from route handlers)
//   • web/modules/subjects/subject.validation.test.ts (unit tests)
//
// ═════════════════════════════════════════════════════════════════════════════
import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// ATOMIC SCHEMAS
// Small, reusable validators for individual field types.
// Imported independently when a field needs bespoke validation outside the form.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @summary Validates the human-readable job reference number.
 *
 * @description
 * subjectNumberSchema is a standalone atomic schema that can be imported and
 * reused anywhere a subject number needs to be validated independently of the
 * full form (e.g., in a search-by-number lookup API that accepts a number param).
 *
 * CONSTRAINT RATIONALE:
 *
 * .trim()
 *   Applied FIRST so that subsequent length checks measure the meaningful content,
 *   not accidental leading/trailing whitespace that a user might paste from a
 *   spreadsheet or WhatsApp message. A subject number of '  HT-001  ' is valid
 *   after trimming; without trim() it would store whitespace in the DB.
 *   DB column: subjects.subject_number — stored after trimming (NOT NULL).
 *
 * .min(3, 'Subject number is required')
 *   Why 3 characters minimum?
 *     \u2022 Prevents single-character or two-character \"accidental\" entries.
 *     \u2022 Any real job number format (HT-001, JB-001, SVC-1) is at least 3 chars.
 *     \u2022 The error message 'Subject number is required' intentionally reads as a
 *       presence check (empty string → fails min(3)) rather than a format check,
 *       because the field is logically required even though Zod uses min() not .nonempty().
 *     \u2022 min(1) would let 'a' through; min(3) provides a practical floor without
 *       imposing a rigid format (some clients use different numbering conventions).
 *
 * .max(50, 'Subject number is too long')
 *   Why 50 characters maximum?
 *     \u2022 The subjects.subject_number column is defined as VARCHAR(50) in the DB schema.
 *     \u2022 If the server allowed longer values, the INSERT would raise a DB truncation error.\
 *       It is far better to give the user a clear validation message than a cryptic DB error.
 *     \u2022 50 chars accommodates even verbose formats: 'DEALER-SAMSUNG-2024-DEC-001500' (30 chars).
 *
 * WHAT IT DOES NOT VALIDATE:
 *   \u2022 Format/pattern (HT-YYYY-NNNNNN) — that is a convention, not a schema requirement.
 *     Different org units or legacy data may use different number formats.
 *   \u2022 Uniqueness — uniqueness is enforced at the DB level (UNIQUE constraint) and
 *     will surface as an error from Supabase if a duplicate is submitted.
 *
 * @example
 *   subjectNumberSchema.parse('HT-2024-001500')  // \u2713 passes, returns 'HT-2024-001500'
 *   subjectNumberSchema.parse('  HT-001  ')      // \u2713 passes, returns 'HT-001' (trimmed)
 *   subjectNumberSchema.parse('AB')              // \u2717 throws: 'Subject number is required'
 *   subjectNumberSchema.parse('x'.repeat(51))    // \u2717 throws: 'Subject number is too long'
 *   subjectNumberSchema.parse('')                // \u2717 throws: 'Subject number is required'
 */
export const subjectNumberSchema = z
  .string()
  .trim()
  .min(3, 'Subject number is required')
  .max(50, 'Subject number is too long');

/**
 * @summary Validates the priority field against the four allowed enum values.
 *
 * @description
 * subjectPrioritySchema is a z.enum() rather than z.string() so that TypeScript
 * narrows the parsed value to the SubjectPriority union type automatically.
 *
 * WHY z.enum() INSTEAD OF z.string().min(1):
 *   \u2022 z.string() would accept ANY non-empty string ('ultra-critical', 'HIGH', 'p1').
 *     This would cause a DB CHECK violation when Supabase attempts the INSERT.
 *   \u2022 z.enum(['critical','high','medium','low']) fails immediately with a clear message
 *     if an unexpected value arrives, making the error user-facing and descriptive.
 *   \u2022 The enum values here MIRROR the DB CHECK constraint:
 *       CHECK (priority IN ('critical', 'high', 'medium', 'low'))
 *     If a new priority level is added to the DB, it must be added here too \u2014 the
 *     TypeScript compiler will surface any type incompatibilities in all call sites.
 *
 * CASE SENSITIVITY:
 *   Values are lowercase ('critical', not 'CRITICAL'). The DB stores lowercase.
 *   If the client accidentally sends 'Critical', this schema will reject it.
 *   The UI always sends lowercase values (the SubjectPriority type enforces this).
 *
 * @example
 *   subjectPrioritySchema.parse('high')      // \u2713 passes, returns 'high'
 *   subjectPrioritySchema.parse('critical')  // \u2713 passes, returns 'critical'
 *   subjectPrioritySchema.parse('HIGH')      // \u2717 throws: Invalid enum value
 *   subjectPrioritySchema.parse('p1')        // \u2717 throws: Invalid enum value
 *   subjectPrioritySchema.parse(undefined)   // \u2717 throws: Required
 */
export const subjectPrioritySchema = z.enum(['critical', 'high', 'medium', 'low']);

/**
 * @summary Core Zod schema shared by both create and update subject operations.
 *
 * @description
 * subjectFormSchema is the most important schema in this file — it validates the
 * entire serialised shape of the SubjectFormValues interface sent from the
 * SubjectForm React component to the API.
 *
 * STRUCTURE:
 *   The schema is built in two stages:
 *   1. z.object({...}) — defines individual field validators (20 fields)
 *   2. .superRefine(fn) — adds 4 cross-field business rules evaluated after
 *      individual field validation passes
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * FIELD-BY-FIELD VALIDATION RATIONALE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * subject_number
 *   Uses subjectNumberSchema (see above) — trim + min(3) + max(50).
 *
 * source_type
 *   z.enum(['brand', 'dealer']) — required, no default. The form pre-selects
 *   'brand' as the UI default but the schema demands an explicit value.
 *   Only these two values are valid (DB CHECK constraint).
 *
 * brand_id / dealer_id
 *   z.string().uuid().optional().or(z.literal(''))
 *   Why: HTML <select> elements return empty string '' when deselected.
 *        Zod's .optional() only accepts undefined, not ''. The .or(z.literal(''))
 *        union allows BOTH undefined AND '' to pass through \u2014 the service layer
 *        then normalises '' → null (or undefined) before the DB write.
 *        uuid() ensures the value is a valid UUID v4 if provided (prevents injection
 *        of arbitrary FK values that would fail at the DB level with a confusing error).
 *   Cross-field: see superRefine Rules 1 & 2.
 *
 * assigned_technician_id
 *   Same uuid().optional().or(z.literal('')) pattern as brand_id.
 *   Assignment is optional at creation time; technicians can be assigned later.
 *
 * priority
 *   Uses subjectPrioritySchema (enum with 4 values). Required.
 *
 * priority_reason
 *   z.string().trim().min(5).max(1000)
 *   Why min(5)? A one-word reason like 'VIP' (3 chars) is insufficient context;
 *   the admin must write at least a short phrase.
 *   Why max(1000)? Prevents textarea abuse; DB column is text (unbounded) but
 *   1000 chars is more than enough for any real reason.
 *
 * allocated_date
 *   z.string().min(10, 'Allocated date is required')
 *   Why min(10)? ISO date strings are exactly 10 chars ('YYYY-MM-DD'). This check
 *   doubles as a presence check — an empty string fails min(10) with the
 *   'required' message. Not using z.string().datetime() because the form sends
 *   only the date part (no time), and datetime() expects a full ISO 8601 timestamp.
 *
 * type_of_service
 *   z.enum(['installation', 'service']) — required. Two valid work types.
 *
 * category_id
 *   z.string().uuid('Category is required')
 *   The error message 'Category is required' reads like a presence check because
 *   that's the intent — not selecting a category leaves an empty string that fails uuid().
 *   Why not .optional()? Category is the only non-optional FK on the form; every
 *   job must be classified under a service category for reporting purposes.
 *
 * customer_phone
 *   z.string().trim().max(20).optional().or(z.literal(''))
 *   Why max(20)? Indian mobile numbers are 10 digits; international numbers with
 *   country code (+91 9876543210) are 15 chars. 20 provides a comfortable margin.
 *   No regex pattern: avoids blocking valid formats (spaces, hyphens, country codes).
 *   NOT validated as a phone number pattern because different customers write their
 *   numbers differently and the field is informational, not verification-critical.
 *
 * customer_name / product_name / serial_number
 *   z.string().trim().max(255).optional().or(z.literal(''))
 *   Why max(255)? Standard VARCHAR(255) DB column limit.
 *   All optional — some subjects are raised before customer details are available.
 *
 * customer_address / product_description
 *   z.string().trim().max(2000).optional().or(z.literal(''))
 *   Why max(2000)? Multi-line fields; 2000 chars covers any realistic address or description.
 *
 * purchase_date / warranty_end_date / amc_start_date / amc_end_date
 *   z.string().optional().or(z.literal(''))
 *   Note: NO trim() here because ISO date strings have no whitespace.
 *   No length/format validation (not using z.string().date()) because date strings
 *   from <input type=\"date\"> are always YYYY-MM-DD format if parseable by the browser.
 *   Out-of-range dates (e.g., warranty_end_date before purchase_date) are caught
 *   by superRefine Rules 3 & 5.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SUPER-REFINE CROSS-FIELD RULES
 * ─────────────────────────────────────────────────────────────────────────────
 * superRefine() is called AFTER all individual field validators pass. If any field
 * fails its individual validator, superRefine does NOT run (early exit). This means
 * superRefine issues are additive — they appear alongside individual field errors,
 * not instead of them.
 *
 * The ctx.addIssue() call with a specific path (e.g., ['brand_id']) causes the error
 * to appear inline next to that field in the SubjectForm, not as a generic form error.
 * This is the key advantage of superRefine over form-level .refine().
 *
 * RULE 1 & 2: Source / Partner FK Mutual Exclusion
 *   Business requirement: every subject MUST be linked to exactly one partner entity.
 *     If source_type = 'brand'  → brand_id must be provided (non-empty)
 *     If source_type = 'dealer' → dealer_id must be provided (non-empty)
 *   Why not required at field level?
 *     brand_id is defined as .optional() because it IS optional when source_type='dealer'.
 *     The field-level schema cannot know which case applies; only superRefine has access
 *     to the sibling source_type value.
 *   Error target: ctx.addIssue with path=['brand_id'] or path=['dealer_id'] so the
 *     error appears inline beside the dropdown, not at the top of the form.
 *   UI enforcement: The form also physically hides the irrelevant dropdown (shows brand_id
 *     select when source_type='brand', dealer_id select when source_type='dealer'), but the
 *     validation rule provides server-side safety if this UI logic is bypassed.
 *
 * RULE 3: Warranty End Date vs Purchase Date Temporal Ordering
 *   Business requirement: a warranty cannot expire before the product was purchased.
 *   ISO date string comparison: 'YYYY-MM-DD' strings compare correctly with < / > because
 *     they are zero-padded and lexicographically ordered. No Date() parsing needed.

 *   Guard: only checks if BOTH values are provided (truthy). If either is absent, the
 *     superRefine does nothing — absence is handled by the individual field's .optional().
 *   Edge case: warranty_end_date === purchase_date (same day) is technically invalid
 *     (zero-day warranty) but the current check uses strict < (less than), so equal
 *     dates pass. This is an acceptable simplification.
 *   Error message: 'Warranty end date cannot be before purchase date.' is specific enough
 *     to tell the admin which field to correct without specifying both dates.
 *
 * RULE 4: AMC Start Date Required When AMC End Date Is Provided
 *   Business requirement: an AMC coverage period has a defined start and end; you cannot
 *     have an end date without knowing when the contract began.
 *   Scenario caught: Admin fills amc_end_date (perhaps copy-pasted) but forgets amc_start_date.
 *     The system rejects with an error on amc_start_date rather than storing a
 *     logically incomplete AMC record in the DB.
 *   Why not also validate amc_start_date requires amc_end_date?
 *     An AMC with a start date but no end date might be intentional (indefinite contract)
 *     or the admin may add the end date later. The reverse (end without start) is always
 *     logically broken, so only that direction is enforced.
 *
 * RULE 5: AMC End Date vs AMC Start Date Temporal Ordering
 *   Same pattern as Rule 3 but applied to the AMC dates.
 *   Protects against typos like amc_start_date='2025-01-01', amc_end_date='2024-01-01'.
 */
export const subjectFormSchema = z
  .object({
    subject_number: subjectNumberSchema,
    source_type: z.enum(['brand', 'dealer']),
    brand_id: z.string().uuid('Invalid brand id').optional().or(z.literal('')),
    dealer_id: z.string().uuid('Invalid dealer id').optional().or(z.literal('')),
    assigned_technician_id: z.string().uuid('Invalid technician id').optional().or(z.literal('')),
    priority: subjectPrioritySchema,
    priority_reason: z.string().trim().min(5, 'Priority reason is required').max(1000, 'Reason is too long'),
    allocated_date: z.string().min(10, 'Allocated date is required'),
    type_of_service: z.enum(['installation', 'service']),
    category_id: z.string().uuid('Category is required'),
    customer_phone: z.string().trim().max(20).optional().or(z.literal('')),
    customer_name: z.string().trim().max(255).optional().or(z.literal('')),
    customer_address: z.string().trim().max(2000).optional().or(z.literal('')),
    product_name: z.string().trim().max(255).optional().or(z.literal('')),
    serial_number: z.string().trim().max(255).optional().or(z.literal('')),
    product_description: z.string().trim().max(2000).optional().or(z.literal('')),
    purchase_date: z.string().optional().or(z.literal('')),
    warranty_end_date: z.string().optional().or(z.literal('')),
    amc_start_date: z.string().optional().or(z.literal('')),
    amc_end_date: z.string().optional().or(z.literal('')),
  })
  .superRefine((value, ctx) => {
    // ── RULE 1: Brand FK required for brand-sourced subjects ───────────────────
    // A subject with source_type='brand' MUST identify which brand raised the complaint.
    // Without brand_id we cannot generate a brand invoice, run brand-specific reports,
    // or look up warranty data from the brand's product registry.
    // The form hides this field when source_type='dealer' so under normal UI flow
    // this error only fires if an admin somehow submits without selecting a brand.
    if (value.source_type === 'brand' && !value.brand_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['brand_id'],
        message: 'Brand is required when source is brand.',
      });
    }

    // ── RULE 2: Dealer FK required for dealer-sourced subjects ─────────────────
    // Mirror of Rule 1 for the dealer side. When source_type='dealer', brand_id
    // is expected to be absent (the form hides it), so we check dealer_id instead.
    // Error path targets ['dealer_id'] so react-hook-form shows the error inline
    // next to the Dealer dropdown, not as a generic form-level error.
    if (value.source_type === 'dealer' && !value.dealer_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['dealer_id'],
        message: 'Dealer is required when source is dealer.',
      });
    }

    // ── RULE 3: Warranty end date must not precede purchase date ───────────────
    // ISO date strings are YYYY-MM-DD. Because they are zero-padded and sort
    // lexicographically, a simple string comparison '<' correctly identifies
    // temporal ordering without any Date() parsing or timezone concerns.
    // Both values must be present (truthy) for this check to apply — if either
    // is empty/undefined, the individual .optional() field validator handles it.
    // Edge case documented: equal dates (zero-day warranty) currently pass.
    if (value.purchase_date && value.warranty_end_date && value.warranty_end_date < value.purchase_date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['warranty_end_date'],
        message: 'Warranty end date cannot be before purchase date.',
      });
    }

    // ── RULE 4: AMC start date required when AMC end date is set ──────────────
    // The AMC coverage period is meaningless without both boundaries. An end date
    // without a start date makes it impossible to calculate whether the contract
    // is active (amc_start_date <= TODAY <= amc_end_date check would fail silently).
    // Note: amc_start_date without amc_end_date is intentionally NOT flagged here
    // (see full rationale above in the schema-level JSDoc).
    if (value.amc_end_date && !value.amc_start_date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['amc_start_date'],
        message: 'AMC purchase/start date is required when AMC end date is set.',
      });
    }

    // ── RULE 5: AMC end date must not precede AMC start date ──────────────────
    // Same temporal ordering check as Rule 3 applied to the AMC dates.
    // Both must be present (truthy) for the comparison to run.
    // Example of what this catches: amc_start_date='2025-12-01', amc_end_date='2024-01-01'
    // (likely a data-entry typo where year digits were swapped).
    if (value.amc_start_date && value.amc_end_date && value.amc_end_date < value.amc_start_date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['amc_end_date'],
        message: 'AMC end date cannot be before AMC start date.',
      });
    }
  });

/**
 * @summary Schema for the subject creation API endpoint.
 *
 * @description
 * createSubjectSchema extends subjectFormSchema with a single additional required
 * field: created_by. This field is the UUID of the authenticated admin user who
 * raised the ticket.
 *
 * WHY EXTEND RATHER THAN DUPLICATE:
 *   Duplication would mean two copies of 20 field definitions to keep in sync.
 *   .extend() provides surgical addition of the created_by field on top of the
 *   fully validated subjectFormSchema. If subjectFormSchema changes, createSubjectSchema
 *   automatically inherits everything.
 *
 * SECURITY — WHY created_by IS SERVER-SIDE ONLY:
 *   The API route for POST /api/subjects:
 *     1. Parses the request body against subjectFormSchema (NOT createSubjectSchema).
 *     2. Reads the authenticated user from the Supabase session (getUser()).
 *     3. Adds created_by: user.id to the parsed payload.
 *     4. Validates the combined payload against createSubjectSchema.
 *   This ensures created_by is NEVER a client-controlled value — an attacker cannot
 *   forge a different UUID in the request body because the body is validated FIRST
 *   against subjectFormSchema which has no created_by field, and the server-side
 *   session UUID is appended AFTERWARDS before the final validation.
 *
 * @field created_by
 *   z.string().uuid('Invalid creator id')
 *   Must be a valid UUID v4. Will always be the authenticated user's ID.
 *   Written to subjects.created_by (NOT NULL FK → profiles.id).
 *
 * @example
 *   const result = createSubjectSchema.safeParse({
 *     ...formValues,          // from client body
 *     created_by: user.id,   // from server session
 *   });
 */
export const createSubjectSchema = subjectFormSchema.extend({
  created_by: z.string().uuid('Invalid creator id'),
});

/**
 * @summary Schema for the subject update (edit) API endpoint.
 *
 * @description
 * updateSubjectSchema is a direct alias of subjectFormSchema. The update operation
 * edits the same fields as the create operation — all 20 form fields.
 *
 * WHY NO ADDITIONAL FIELDS:
 *   Unlike creation, update does NOT need created_by (the creator is already recorded
 *   and must not change). Updated_by / updated_at are added by the repository layer via
 *   the DB's DEFAULT triggers (or explicitly set to auth.uid() / NOW() in the UPDATE query).
 *
 * WHY AN ALIAS RATHER THAN INLINE subjectFormSchema:
 *   Naming this alias gives the concept a distinct name for clarity when reading the
 *   API route handler. The developer reading the PUT handler code sees
 *   `updateSubjectSchema.safeParse(body)` rather than `subjectFormSchema.safeParse(body)`,
 *   which immediately communicates intent.
 *
 * USAGE:
 *   In PUT /api/subjects/[id]/route.ts:
 *     const result = updateSubjectSchema.safeParse(await req.json());
 *     if (!result.success) return NextResponse.json({ error: ... }, { status: 400 });
 *     await subjectService.updateSubject(params.id, result.data, user.id);
 *
 * INFERRED TYPE:
 *   z.infer<typeof updateSubjectSchema> === SubjectFormValues
 *   These are kept in sync; when SubjectFormValues changes, the schema must change too.
 */
export const updateSubjectSchema = subjectFormSchema;
