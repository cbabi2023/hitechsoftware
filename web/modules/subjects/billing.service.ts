// ═════════════════════════════════════════════════════════════════════════════
// billing.service.ts
//
// ──────────────────────────────────────────────────────────────────────────────
// PURPOSE AND SCOPE
// ──────────────────────────────────────────────────────────────────────────────
// This file is the BUSINESS LOGIC layer for all accessory and billing operations
// on a service job (Subject). It sits between:
//
//   React Query hook (useBilling.ts)
//     └─▶ billing.service.ts   ← YOU ARE HERE
//           └─▶ accessory.repository  (raw DB CRUD for subject_accessories)
//           └─▶ bill.repository       (raw DB CRUD for subject_bills)
//           └─▶ subject.service       (read subject details for guards)
//           └─▶ subject.job-workflow  (photo completion check)
//           └─▶ supabase client       (generate_bill_number RPC + inline queries)
//
// WHY A SERVICE LAYER (not just call the repository from the hook)?
// ──────────────────────────────────────────────────────────────────────────────
// A repository performs raw database operations with no business logic.
// The service layer is where rules like these live:
//   • "Accessories can only be added while the job is IN_PROGRESS."
//   • "A bill can only be generated once (no duplicate bills)."
//   • "Required photos must be uploaded before a bill can be generated."
//   • "Customer-pay bills require payment_mode; brand-dealer bills do not."
// Putting these rules in the repository would couple business logic to SQL
// concerns, making the repository untestable in isolation. Putting them in
// the hook would couple business logic to React lifecycle, making server-side
// re-use impossible.
//
// AUTHENTICATION MODEL
// ──────────────────────────────────────────────────────────────────────────────
// The service functions receive technicianId (or officeStaffId) as explicit
// parameters — they do NOT read from the Supabase session themselves.
// The caller (React Query hook or API route) is responsible for:
//   1. Reading the current user from the session.
//   2. Passing the user's ID to the service function.
// This keeps the service layer testable (no auth mocking required in unit tests)
// and usable from both client-side hooks AND server-side API routes.
//
// ERROR HANDLING CONVENTION
// ──────────────────────────────────────────────────────────────────────────────
// Every exported function returns ServiceResult<T>:
//   { ok: true, data: T }              → success; caller uses data
//   { ok: false, error: { message } }  → failure; caller surfaces message to user
//
// Functions NEVER throw. All errors from Supabase, repositories, or business
// rule violations are caught and converted into the { ok: false } branch.
// This eliminates try/catch boilerplate in every hook and keeps error handling
// centrally consistent.
//
// TRANSACTION SAFETY
// ──────────────────────────────────────────────────────────────────────────────
// Supabase's JavaScript client does not support multi-statement DB transactions
// directly. generateBill() performs multiple sequential inserts/updates:
//   INSERT subject_accessories → INSERT subject_bills → UPDATE subjects
// If the bill INSERT succeeds but the subjects UPDATE fails, the bill row
// exists without the subject reflecting it. This is an acknowledged edge case.
// Mitigation: the re-entrant guard (existingBill check at step 2) means that
// a partial failure can be recovered by retrying — subsequent attempts see the
// existing bill and return an error rather than double-creating.
//
// For true ACID transactions, these operations should be moved into a
// Supabase Database Function (RPC) called as a single atomic operation.
// This is logged as a future improvement.
//
// SUPABASE CLIENT
// ──────────────────────────────────────────────────────────────────────────────
// This module uses the BROWSER client (createClient) for inline queries because
// the billing service is called from React hooks (client-side context).
// The browser client enforces RLS (Row Level Security) — the technician can only
// see and modify subjects assigned to them (enforced at DB level in addition to
// the explicit assigned_technician_id check in each function).
// When called from an API route (server-side), the pattern is identical because
// the API route passes the user ID explicitly and the browser client is not
// invoked server-side — server routes use createAdminClient().
//
// EXPORTS
// ──────────────────────────────────────────────────────────────────────────────
//   addAccessory(subjectId, technicianId, input)         → adds one accessory
//   removeAccessory(accessoryId, technicianId)           → hard-deletes one accessory
//   getAccessoriesBySubject(subjectId)                   → fetches all + computes total
//   generateBill(subjectId, technicianId, input)         → full 10-step bill generation
//   getBillBySubject(subjectId)                          → fetches existing bill
//   updateBillPaymentStatus(billId, status, staffId)     → payment status update
//
// ═════════════════════════════════════════════════════════════════════════════
import { createClient } from '@/lib/supabase/client';
import type { ServiceResult } from '@/types/common.types';
import type {
  AddAccessoryInput,
  GenerateBillInput,
  SubjectAccessory,
  SubjectBill,
} from '@/modules/subjects/subject.types';
import {
  calculateAccessoriesTotal,
  createAccessory,
  createManyAccessories,
  findBySubjectId as findAccessoriesBySubjectId,
} from '@/repositories/accessory.repository';
import {
  createBill,
  findBySubjectId as findBillBySubjectId,
  updatePaymentStatus,
} from '@/repositories/bill.repository';
import { checkCompletionRequirements } from '@/modules/subjects/subject.job-workflow';
import { getSubjectDetails } from '@/modules/subjects/subject.service';

// Browser-scoped Supabase client used for accessory read/delete queries
// (write mutations go through the API route for technician ownership checks).
const supabase = createClient();

/**
 * @summary Safe numeric coercion helper used throughout billing calculations.
 *
 * @description
 * toNumber() converts any unknown value to a reliable JavaScript number suitable
 * for billing arithmetic. Billing amounts in this system flow through several
 * transformations where the type can drift from number:
 *
 * WHY POSTGRES RETURNS STRINGS FOR AGGREGATE RESULTS:
 *   When Supabase returns the result of a SQL SUM() or aggregate query,
 *   numeric columns may come back as strings in JSON:
 *     { total_price: '1250.00' }  ← string, not number
 *   This is because JavaScript cannot represent 64-bit SQL decimals exactly,
 *   so Supabase's PostgREST serialises them as strings to preserve precision.
 *   If we do arithmetic on these strings directly (e.g., sum + row.total_price),
 *   JavaScript silently coerces to NaN and the billing total becomes wrong.
 *
 * WHY Number() INSTEAD OF parseFloat() or parseInt():
 *   • parseInt('1250.50')  → 1250  (truncates fractional part — WRONG for prices)
 *   • parseFloat('1250.50') → 1250.5 (correct, but also accepts '1250.50abc')
 *   • Number('1250.50')    → 1250.5 (strict — '1250.50abc' → NaN, caught by isFinite)
 *   Number() is the strictest converter: it returns NaN for any non-numeric string,
 *   making the Number.isFinite() guard below maximally effective.
 *
 * WHY ?? 0 ON THE INCOMING VALUE:
 *   The expression Number(value ?? 0) coerces null and undefined to 0 BEFORE
 *   passing to Number(). Without this:
 *     Number(null)      → 0  (this one happens to be correct, but relying on it is fragile)
 *     Number(undefined) → NaN (would fail the isFinite check and return 0 anyway,
 *                              but explicitly using ?? 0 documents intent clearly)
 *
 * WHY Number.isFinite() INSTEAD OF isNaN():
 *   • isNaN(Infinity)   → false  (Infinity passes isNaN but should not be a price)
 *   • isFinite(Infinity) → false (correctly rejects Infinity)
 *   Number.isFinite() is also stricter than the global isFinite() because it does
 *   not coerce its argument (global isFinite('5') → true; Number.isFinite('5') → false).
 *
 * GUARANTEED RETURN:
 *   Always returns a finite JavaScript number (never NaN, Infinity, or -Infinity).
 *   The worst case is 0, which is safe for summation (adds nothing to the total).
 *
 * USAGE SITES:
 *   • getAccessoriesBySubject() — summing total_price across accessory rows
 *   • generateBill() — summing accessories from aggregate query result
 *   • visit_charge / service_charge coercions in generateBill()
 *
 * @param value - Any value from a DB column or API response that should be numeric.
 * @returns A finite JavaScript number; 0 if input cannot be converted.
 *
 * @example
 *   toNumber('1250.50')  // → 1250.5
 *   toNumber(750)        // → 750
 *   toNumber(null)       // → 0
 *   toNumber(undefined)  // → 0
 *   toNumber('abc')      // → 0
 *   toNumber(Infinity)   // → 0
 *   toNumber(NaN)        // → 0
 */
function toNumber(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/**
 * @summary Adds a single spare part / accessory line item to a subject.
 *
 * @description
 * addAccessory() is the gated entry point for creating one subject_accessories row.
 * It enforces a guard chain of 5 conditions before delegating to the repository.
 * Any guard failure returns immediately with an { ok: false } result — subsequent
 * guards in the chain do NOT run (short-circuit evaluation).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE 5-GUARD CHAIN (in order)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * GUARD 1: item_name non-empty (after trimming)
 *   Why: A nameless line item cannot appear on a bill PDF and has no meaning.
 *   What fails: empty string (''), whitespace-only ('   ').
 *   Error: 'Item name is required'
 *   This check runs BEFORE any network call — fast-fail without Supabase round-trip.
 *
 * GUARD 2: quantity ≥ 1
 *   Why: You cannot use zero or negative units of a physical part.
 *   Business rule: if the technician removed 2 of something, that's a quantity of 2
 *   on a removal note — not a negative quantity on an addition.
 *   Error: 'Quantity must be at least 1'
 *   In-memory check; no network call.
 *
 * GUARD 3: unit_price ≥ 0
 *   Why: Negative prices would reduce the bill total — not physically meaningful.
 *   Zero IS allowed: some brand-covered warranty parts cost the customer nothing;
 *   recording them at price=0 still documents the part usage for brand claims.
 *   Error: 'Unit price must be at least 0'
 *   In-memory check; no network call.
 *
 * GUARD 4: subject exists and is not soft-deleted
 *   Fetches only assigned_technician_id and status from subjects (2 columns).
 *   Why not fetch the full subject? Performance — we only need these two values.
 *   .maybeSingle() returns null data (not an error) when no row matches.
 *   Error: 'Subject not found' — covers both deleted subjects and invalid UUIDs.
 *
 * GUARD 5: calling technician is the assigned technician
 *   Why: Only the assigned technician should be able to add parts to a job.
 *   Prevents technician A from modifying technician B's active job.
 *   This is a defence-in-depth check — Supabase RLS also enforces this at DB level,
 *   but the explicit ID comparison catches misconfigured RLS and gives a
 *   clear human-readable error instead of a generic Postgres permission error.
 *   Error: 'You are not assigned to this subject'
 *
 * GUARD 6 (implicit in status check): status === 'IN_PROGRESS'
 *   Why IN_PROGRESS only? The accessory list directly affects the bill total.
 *   Allowing additions after the bill is generated (status=COMPLETED) would create
 *   inconsistency between the bill total and the actual accessories.
 *   If a part needs to be added after completion, the admin uses editBill() instead.
 *   Error: 'Accessories can be edited only while job is in progress'
 *
 * AFTER THE GUARDS PASS:
 *   createAccessory() is called in the accessory.repository.
 *   It INSERTs a subject_accessories row with:
 *     subject_id, added_by=technicianId,
 *     item_name=trimmed_name, quantity, unit_price,
 *     total_price = quantity * unit_price   (calculated in the repository)
 *   Returns the full inserted row as SubjectAccessory.
 *
 * IDEMPOTENCY:
 *   This function is NOT idempotent. Calling it twice with the same arguments
 *   creates two separate accessory rows. The UI prevents double-submission via
 *   mutation.isPending state in the useAddAccessory hook.
 *
 * @param subjectId    UUID of the subject to add the accessory to.
 * @param technicianId UUID of the technician performing the action (checked against assignment).
 * @param input        The accessory details (item_name, quantity, unit_price).
 * @returns ServiceResult<SubjectAccessory> — the created row on success.
 *
 * @example
 *   const result = await addAccessory('job-uuid', 'tech-uuid', {
 *     item_name: 'Compressor 1.5T R32',
 *     quantity: 1,
 *     unit_price: 3500,
 *   });
 *   if (result.ok) console.log(result.data.id);  // UUID of new row
 *   else console.error(result.error.message);     // e.g., 'Subject not found'
 */
export async function addAccessory(
  subjectId: string,
  technicianId: string,
  input: AddAccessoryInput,
): Promise<ServiceResult<SubjectAccessory>> {
  if (!input.item_name?.trim()) {
    return { ok: false, error: { message: 'Item name is required' } };
  }
  if (input.quantity < 1) {
    return { ok: false, error: { message: 'Quantity must be at least 1' } };
  }
  if (input.unit_price < 0) {
    return { ok: false, error: { message: 'Unit price must be at least 0' } };
  }

  const subjectCheck = await supabase
    .from('subjects')
    .select('assigned_technician_id,status')
    .eq('id', subjectId)
    .eq('is_deleted', false)
    .maybeSingle<{ assigned_technician_id: string | null; status: string }>();

  if (subjectCheck.error || !subjectCheck.data) {
    return { ok: false, error: { message: 'Subject not found' } };
  }

  if (subjectCheck.data.assigned_technician_id !== technicianId) {
    return { ok: false, error: { message: 'You are not assigned to this subject' } };
  }

  if (subjectCheck.data.status !== 'IN_PROGRESS') {
    return { ok: false, error: { message: 'Accessories can be edited only while job is in progress' } };
  }

  const result = await createAccessory(subjectId, technicianId, {
    item_name: input.item_name.trim(),
    quantity: input.quantity,
    unit_price: input.unit_price,
  });

  if (result.error || !result.data) {
    return { ok: false, error: { message: result.error?.message ?? 'Failed to add accessory' } };
  }

  return { ok: true, data: result.data as SubjectAccessory };
}

/**
 * @summary Hard-deletes a single accessory row after validating technician ownership
 *          and job status.
 *
 * @description
 * removeAccessory() uses a TWO-FETCH PATTERN to safely validate all conditions
 * before executing the DELETE. Understanding why two fetches are needed (rather
 * than one) is key to understanding this function's design.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY TWO FETCHES (not one JOIN query)?
 * ─────────────────────────────────────────────────────────────────────────────
 * The caller knows only the accessoryId (UUID). To validate the technician
 * assignment and job status, we need the subject's data. Only the accessory row
 * contains the subject_id FK that links us to the subject.
 *
 * We COULD write a single query using a JOIN:
 *   SELECT sa.id, sa.subject_id, s.assigned_technician_id, s.status
 *   FROM subject_accessories sa
 *   JOIN subjects s ON sa.subject_id = s.id
 *   WHERE sa.id = accessoryId AND s.is_deleted = false
 * But Supabase's JavaScript client doesn't support raw SQL JOINs this way —
 * it uses a PostgREST-based relational query syntax that returns nested objects.
 * The two-fetch approach is simpler and the performance difference is negligible
 * (both queries are single-row point lookups on indexed PKs/FKs).
 *
 * FETCH 1: Get the accessory row → extract subject_id
 *   .from('subject_accessories').select('id,subject_id').eq('id', accessoryId)
 *   Fails: if the accessory doesn't exist (was already deleted or wrong UUID).
 *   Error: 'Accessory not found'
 *
 * FETCH 2: Get the subject row → extract assigned_technician_id and status
 *   .from('subjects').select('assigned_technician_id,status')
 *   .eq('id', row.data.subject_id).eq('is_deleted', false)
 *   Fails: if subject was deleted between the two fetches (edge case — ON DELETE CASCADE
 *   on subject_accessories means the accessory would also be gone, so Fetch 1 would
 *   have already failed in that case).
 *   Error: 'Subject not found'
 *
 * GUARD: Technician ownership
 *   assigned_technician_id !== technicianId → 'You are not assigned to this subject'
 *   Same rationale as in addAccessory() — defence in depth against RLS misconfiguration.
 *
 * GUARD: Status = IN_PROGRESS
 *   Same reason as addAccessory(): removing accessories after bill generation
 *   would invalidate the already-calculated bill total.
 *   Admins who need to remove an accessory from a completed job use editBill() instead.
 *
 * DELETE OPERATION:
 *   .from('subject_accessories').delete().eq('id', accessoryId)
 *   This is a HARD DELETE — the row is permanently removed. No soft-delete column
 *   exists on subject_accessories because accessories have no audit trail requirement
 *   beyond the bill PDF (which is immutable once generated).
 *
 * IDEMPOTENCY:
 *   NOT idempotent. A second call with the same accessoryId will fail at Fetch 1
 *   (row already gone) and return 'Accessory not found'.
 *
 * @param accessoryId   UUID of the subject_accessories row to delete.
 * @param technicianId  UUID of the technician requesting deletion (validated against assignment).
 * @returns ServiceResult<{ id: string }> — the deleted accessory's ID on success.
 *
 * @example
 *   const result = await removeAccessory('accessory-uuid', 'tech-uuid');
 *   if (result.ok) {
 *     console.log('Deleted:', result.data.id);
 *   } else {
 *     toast.error(result.error.message); // e.g., 'Accessories can only be edited...'
 *   }
 */
export async function removeAccessory(
  accessoryId: string,
  technicianId: string,
): Promise<ServiceResult<{ id: string }>> {
  const row = await supabase
    .from('subject_accessories')
    .select('id,subject_id')
    .eq('id', accessoryId)
    .maybeSingle<{ id: string; subject_id: string }>();

  if (row.error || !row.data) {
    return { ok: false, error: { message: 'Accessory not found' } };
  }

  const subjectCheck = await supabase
    .from('subjects')
    .select('assigned_technician_id,status')
    .eq('id', row.data.subject_id)
    .eq('is_deleted', false)
    .maybeSingle<{ assigned_technician_id: string | null; status: string }>();

  if (subjectCheck.error || !subjectCheck.data) {
    return { ok: false, error: { message: 'Subject not found' } };
  }

  if (subjectCheck.data.assigned_technician_id !== technicianId) {
    return { ok: false, error: { message: 'You are not assigned to this subject' } };
  }

  if (subjectCheck.data.status !== 'IN_PROGRESS') {
    return { ok: false, error: { message: 'Accessories can be edited only while job is in progress' } };
  }

  const del = await supabase.from('subject_accessories').delete().eq('id', accessoryId);
  if (del.error) {
    return { ok: false, error: { message: del.error.message } };
  }

  return { ok: true, data: { id: accessoryId } };
}

/**
 * @summary Retrieves all accessories for a subject and computes the running total.
 *
 * @description
 * getAccessoriesBySubject() is a read-only operation that fetches every row
 * from subject_accessories for a given subject and derives the accessories_total
 * by reducing the individual total_price values IN-MEMORY.
 *
 * IN-MEMORY TOTAL CALCULATION (vs. DB SUM):
 *
 * An alternative implementation would use SQL:
 *   SELECT SUM(total_price) FROM subject_accessories WHERE subject_id = ?
 * The current design avoids this and instead calculates the total in JavaScript
 * from the already-fetched row data. Reasons:
 *
 *   1. The caller always needs the full item list (to render the accessories table
 *      in the UI). If we used a separate SUM query, that would be a redundant
 *      second round-trip for data we could compute from what we already have.
 *
 *   2. JS floating-point arithmetic for totals is "good enough" for the precision
 *      used in Indian appliance service billing (amounts up to 5 digits, 2 decimals).
 *      The toNumber() helper ensures no NaN or Infinity contaminates the sum.
 *
 *   3. Server-side SUM() is used by calculateAccessoriesTotal() in the repository —
 *      that function is called during bill generation to get a definitive DB-computed
 *      total before writing to subject_bills.accessories_total. This function is for
 *      the real-time display total while the technician is still working.
 *
 * ERROR HANDLING:
 *   findAccessoriesBySubjectId() returns { data: row[], error: Error? }.
 *   If error is set (network failure, Supabase error), we return early with ok=false.
 *   If data is null (no rows matching), we treat this as an empty array (not an error).
 *   ?? [] handles the null-vs-empty-array case consistently.
 *
 * TOTAL ACCUMULATION PATTERN:
 *   items.reduce((sum, item) => sum + toNumber(item.total_price), 0)
 *   • starts with 0 (correct empty-array total)
 *   • toNumber() guards each individual total_price against string coercion
 *   • Result is a JavaScript number with standard IEEE-754 floating-point
 *
 * WHY BOTH items AND total ARE RETURNED:
 *   Returning both together avoids the consumer needing to perform their own reduce.
 *   The AccessoriesSection component needs items[] (for the table) and total (for the
 *   summary line). Returning both from one call keeps the component stateless.
 *
 * @param subjectId  UUID of the subject whose accessories to fetch.
 * @returns ServiceResult with { items: SubjectAccessory[], total: number } on success.
 *
 * @example
 *   const result = await getAccessoriesBySubject('job-uuid');
 *   if (result.ok) {
 *     const { items, total } = result.data;
 *     // items = [{ item_name: 'Compressor', quantity: 1, unit_price: 3500, total_price: 3500 }, ...]
 *     // total = 3500  (= sum of all total_price values)
 *   }
 */
export async function getAccessoriesBySubject(
  subjectId: string,
): Promise<ServiceResult<{ items: SubjectAccessory[]; total: number }>> {
  const rows = await findAccessoriesBySubjectId(subjectId);
  if (rows.error) {
    return { ok: false, error: { message: rows.error.message } };
  }

  const items = (rows.data ?? []) as SubjectAccessory[];
  const total = items.reduce((sum, item) => sum + toNumber(item.total_price), 0);

  return { ok: true, data: { items, total } };
}

/**
 * @summary Generates the bill for a completed service job via a 10-step flow.
 *
 * @description
 * generateBill() is the most complex operation in the billing service. It
 * orchestrates multiple validation gates, data lookups, inserts, and updates
 * that collectively produce a locked, non-editable bill record.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE 10-STEP GENERATION FLOW
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * STEP 1: Load subject details and validate technician + status
 *   getSubjectDetails(subjectId) returns the full SubjectDetail.
 *   Guard: assigned_technician_id === technicianId (else 403-equivalent)
 *   Guard: status === 'IN_PROGRESS' (billing only works mid-job)
 *   Why IN_PROGRESS (not COMPLETED)? The "generate bill" action is the FINAL step
 *   that transitions the job to COMPLETED (Step 10). Before the bill is generated,
 *   the job is still IN_PROGRESS. After generation, status = 'COMPLETED' is set
 *   as part of the same operation. This is a deliberate coupling — billing and
 *   job completion are atomic from the admin/technician's perspective.
 *
 * STEP 2: Idempotency guard — check if a bill already exists
 *   findBillBySubjectId(subjectId) queries subject_bills.
 *   If a bill row already exists: return 'Bill already generated' error.
 *   Why not just update the existing bill?
 *   Once generated, the bill is considered a locked financial document. Regenerating
 *   it would change the bill_number and invalidate any physical copies the customer
 *   already received. To correct a generated bill, admins use editBill().
 *
 * STEP 3: Photo completion gate
 *   checkCompletionRequirements(subjectId) returns { canComplete, missing[] }.
 *   If !canComplete: list the missing photo types in the error message.
 *   Why block billing on missing photos?
 *   The brand warranty reimbursement process requires all proof photos to be present
 *   before the bill is submitted to the brand's claims portal. Allowing bill generation
 *   without photos would produce an unclaimable warranty invoice.
 *
 * STEP 4: Validate accessory items provided inline with the bill request
 *   accessoryItems = input.accessories ?? [] (empty array is valid)
 *   For each item: item_name non-empty, quantity >= 1, unit_price >= 0.
 *   This validates items that are being added at bill-generation time (not yet in DB).
 *   Already-existing accessories (added earlier via addAccessory) are not re-validated
 *   here — they were validated when added.
 *
 * STEP 5: Insert inline accessories if none already exist
 *   If accessoryItems.length > 0:
 *     Fetch existing accessories for this subject.
 *     If zero existing accessories: insert new ones via createManyAccessories().
 *     If existing accessories found: SKIP insertion (assume they were already added).
 *   Why skip if accessories already exist?
 *   The technician may have added accessories individually throughout the job
 *   using addAccessory(). The bill generation form then shows those accessories
 *   pre-populated. If the technician still lists items in the bill form,
 *   we assume it's a UI display artefact and skip re-insertion to prevent duplicates.
 *   This is a UX trade-off; the admin can always add more via editBill().
 *
 * STEP 6: Calculate accessories total via DB aggregate
 *   calculateAccessoriesTotal(subjectId) runs:
 *     SELECT SUM(total_price) FROM subject_accessories WHERE subject_id = ?
 *   This is a definitive DB-side calculation (not in-memory) used because
 *   we want the bill to record the exact DB sum, not a JS floating-point approximation.
 *   Reduces the SUM result through toNumber() in case it comes back as string.
 *
 * STEP 7: Compute the grand total in memory
 *   visit_charge = toNumber(input.visit_charge)  → 0 if not provided
 *   service_charge = toNumber(input.service_charge) → 0 if not provided
 *   grand_total = visit_charge + service_charge + accessories_total
 *   Note: GST (apply_gst flag) would multiply grand_total by 1.18 here.
 *   (GST logic is present in EditBillInput but not yet in GenerateBillInput — planned.)
 *
 * STEP 8: Determine bill classification (brand-dealer vs customer bill)
 *   isBrandDealerBill = subject.is_warranty_service || subject.is_amc_service
 *   IF is_warranty_service OR is_amc_service:
 *     bill_type = 'brand_dealer_invoice'
 *     issued_to = subject.source_name (brand or dealer company name)
 *     issued_to_type = 'brand_dealer'
 *     payment_status = 'due' (pending brand/dealer reimbursement)
 *     payment_mode = null (no on-site payment collection)
 *     payment_collected = false
 *   ELSE (out-of-warranty, customer pays):
 *     bill_type = 'customer_receipt'
 *     issued_to = subject.customer_name ?? 'Customer'
 *     issued_to_type = 'customer'
 *     payment_status = 'paid' (collected on-site at generation time)
 *     payment_mode = input.payment_mode (REQUIRED — guard below enforces this)
 *     payment_collected = true, payment_collected_at = NOW()
 *
 * STEP 8a: Payment mode guard for customer bills
 *   If !isBrandDealerBill && !input.payment_mode:
 *     Return error: 'Payment mode is required for out-of-warranty jobs'
 *   Rationale: For customer bills, the technician collects payment on-site
 *   immediately. Not recording how payment was made is a financial audit failure.
 *
 * STEP 9: Generate a unique bill number via Supabase RPC
 *   supabase.rpc('generate_bill_number') calls a PostgreSQL function:
 *     CREATE OR REPLACE FUNCTION generate_bill_number() RETURNS text AS $$
 *       SELECT 'INV-' || TO_CHAR(NOW(), 'YYYY') || '-' ||
 *              LPAD(nextval('bill_number_seq')::text, 6, '0');
 *     $$ LANGUAGE sql;
 *   The DB sequence ensures atomicity — no two concurrent calls can get the same number.
 *   result: e.g. 'INV-2024-001500'
 *   If the RPC fails (network error, DB error): propagate error and abort.
 *
 * STEP 10: Insert bill row + update subject
 *   createBill() → INSERT INTO subject_bills (...)
 *     with all computed values including bill_number, grand_total, payment_status
 *   If INSERT fails: propagate error.
 *   Then UPDATE subjects SET:
 *     visit_charge, service_charge, accessories_total, grand_total,
 *     payment_mode (if customer bill), payment_collected, payment_collected_at,
 *     billing_status ('due' for brand-dealer, 'paid' for customer),
 *     bill_generated=true, bill_generated_at=NOW(), bill_number,
 *     status='COMPLETED', completed_at=NOW(), completion_proof_uploaded=true
 *   This is the atomic transition from IN_PROGRESS to COMPLETED.
 *   If UPDATE fails: the bill row exists but the subject row is stale.
 *   The idempotency guard (Step 2) prevents a re-run from inserting a second bill;
 *   the admin must manually update the subject or contact support for this edge case.
 *
 * @param subjectId    UUID of the subject to generate the bill for.
 * @param technicianId UUID of the technician requesting bill generation.
 * @param input        GenerateBillInput with charges and optional accessories.
 * @returns ServiceResult<SubjectBill> — the newly inserted bill row on success.
 */
export async function generateBill(
  subjectId: string,
  technicianId: string,
  input: GenerateBillInput,
): Promise<ServiceResult<SubjectBill>> {
  const subjectResult = await getSubjectDetails(subjectId);
  if (!subjectResult.ok) {
    return subjectResult as ServiceResult<SubjectBill>;
  }

  const subject = subjectResult.data;

  if (subject.assigned_technician_id !== technicianId) {
    return { ok: false, error: { message: 'You are not assigned to this subject' } };
  }

  if (subject.status !== 'IN_PROGRESS') {
    return { ok: false, error: { message: 'Bill can only be generated when subject is in progress' } };
  }

  const existingBill = await findBillBySubjectId(subjectId);
  if (existingBill.error) {
    return { ok: false, error: { message: existingBill.error.message } };
  }
  if (existingBill.data) {
    return { ok: false, error: { message: 'Bill already generated for this subject' } };
  }

  const completionCheck = await checkCompletionRequirements(subjectId);
  if (!completionCheck.ok) {
    return completionCheck as ServiceResult<SubjectBill>;
  }

  if (!completionCheck.data.canComplete) {
    return {
      ok: false,
      error: { message: `Missing required photos: ${completionCheck.data.missing.join(', ')}` },
    };
  }

  const accessoryItems = input.accessories ?? [];
  for (const item of accessoryItems) {
    if (!item.item_name?.trim()) {
      return { ok: false, error: { message: 'Accessory item name is required' } };
    }
    if (item.quantity < 1) {
      return { ok: false, error: { message: 'Accessory quantity must be at least 1' } };
    }
    if (item.unit_price < 0) {
      return { ok: false, error: { message: 'Accessory unit price must be at least 0' } };
    }
  }

  if (accessoryItems.length > 0) {
    const existingAccessories = await findAccessoriesBySubjectId(subjectId);
    if (existingAccessories.error) {
      return { ok: false, error: { message: existingAccessories.error.message } };
    }

    if ((existingAccessories.data ?? []).length === 0) {
      const inserted = await createManyAccessories(subjectId, technicianId, accessoryItems);
      if (inserted.error) {
        return { ok: false, error: { message: inserted.error.message } };
      }
    }
  }

  const accessoriesTotalResult = await calculateAccessoriesTotal(subjectId);
  if (accessoriesTotalResult.error) {
    return { ok: false, error: { message: accessoriesTotalResult.error.message } };
  }

  const accessories_total = (accessoriesTotalResult.data ?? []).reduce(
    (sum, row) => sum + toNumber((row as { total_price: number }).total_price),
    0,
  );

  const visit_charge = toNumber(input.visit_charge);
  const service_charge = toNumber(input.service_charge);
  const grand_total = visit_charge + service_charge + accessories_total;

  // Determine bill classification:
  // Brand-dealer bills (warranty / AMC) are invoiced to the manufacturer/dealer;
  // they do NOT collect payment at the time of job completion.
  // Customer bills require payment_mode because the technician collects on-site.
  const isBrandDealerBill = subject.is_warranty_service || subject.is_amc_service;

  if (!isBrandDealerBill && !input.payment_mode) {
    return { ok: false, error: { message: 'Payment mode is required for out-of-warranty jobs' } };
  }

  const billNumberResult = await supabase.rpc('generate_bill_number');
  if (billNumberResult.error || !billNumberResult.data) {
    return { ok: false, error: { message: billNumberResult.error?.message ?? 'Failed to generate bill number' } };
  }

  const bill_number = billNumberResult.data as string;

  const billInsert = await createBill({
    subject_id: subject.id,
    bill_number,
    bill_type: isBrandDealerBill ? 'brand_dealer_invoice' : 'customer_receipt',
    issued_to: isBrandDealerBill ? subject.source_name : (subject.customer_name ?? 'Customer'),
    issued_to_type: isBrandDealerBill ? 'brand_dealer' : 'customer',
    brand_id: subject.brand_id ?? null,
    dealer_id: subject.dealer_id ?? null,
    visit_charge,
    service_charge,
    accessories_total,
    grand_total,
    payment_mode: isBrandDealerBill ? null : (input.payment_mode ?? null),
    payment_status: isBrandDealerBill ? 'due' : 'paid',
    payment_collected_at: isBrandDealerBill ? null : new Date().toISOString(),
    generated_by: technicianId,
  });

  if (billInsert.error || !billInsert.data) {
    return { ok: false, error: { message: billInsert.error?.message ?? 'Failed to create bill' } };
  }

  const subjectUpdate = await supabase
    .from('subjects')
    .update({
      visit_charge,
      service_charge,
      accessories_total,
      grand_total,
      payment_mode: isBrandDealerBill ? null : (input.payment_mode ?? null),
      payment_collected: !isBrandDealerBill,
      payment_collected_at: !isBrandDealerBill ? new Date().toISOString() : null,
      billing_status: isBrandDealerBill ? 'due' : 'paid',
      bill_generated: true,
      bill_generated_at: new Date().toISOString(),
      bill_number,
      status: 'COMPLETED',
      completed_at: new Date().toISOString(),
      completion_proof_uploaded: true,
    })
    .eq('id', subjectId);

  if (subjectUpdate.error) {
    return { ok: false, error: { message: subjectUpdate.error.message } };
  }

  return { ok: true, data: billInsert.data as SubjectBill };
}

/**
 * @summary Read-only fetch of the existing bill for a subject.
 *
 * @description
 * getBillBySubject() is a thin wrapper around findBillBySubjectId() that converts
 * the "not found" case from { data: null } (a successful query with no result)
 * into a ServiceResult error (normalising the absence into an error branch).
 *
 * WHY NOT JUST CALL findBillBySubjectId DIRECTLY IN THE HOOK:
 *   The hook (useSubjectBill in useBilling.ts) expects a ServiceResult<SubjectBill>.
 *   The repository returns { data: SubjectBill | null, error: ... }. The service
 *   wrapper translates between these two response shapes.
 *   This keeps repository and hook interfaces decoupled.
 *
 * NULL VS ERROR DISTINCTION:
 *   When findBillBySubjectId returns data=null, it means no bill has been generated
 *   yet for this subject. This is NOT a system error — it's an expected state
 *   before the technician generates the bill. The service converts this to
 *   { ok: false, error: { message: 'Bill not found for subject' } } which
 *   the hook handles by rendering a "No bill yet" placeholder.
 *
 * @param subjectId  UUID of the subject to look up the bill for.
 * @returns ServiceResult<SubjectBill> — the bill on success, error if not found.
 */
export async function getBillBySubject(subjectId: string): Promise<ServiceResult<SubjectBill>> {
  const bill = await findBillBySubjectId(subjectId);
  if (bill.error) {
    return { ok: false, error: { message: bill.error.message } };
  }

  if (!bill.data) {
    return { ok: false, error: { message: 'Bill not found for subject' } };
  }

  return { ok: true, data: bill.data };
}

/**
 * @summary Updates the payment status of a generated bill (paid/due/waived).
 *
 * @description
 * updateBillPaymentStatus() is an ADMIN-ONLY operation that changes the
 * payment_status flag on an existing bill. It enforces role-level authorisation
 * explicitly (reading the caller's role from the DB) before delegating to
 * the repository.
 *
 * AUTHORISATION MODEL:
 *   The function receives officeStaffId which is the UUID of the user requesting
 *   the change. It then queries profiles.role for that user and checks:
 *     allowed roles: ['office_staff', 'super_admin']
 *   Only these roles may change payment status.
 *   Technicians: NOT allowed (they record payment via the generateBill flow).
 *   This is defence-in-depth — the API route also checks the session role,
 *   but the service re-validates in case the service is called from other contexts.
 *
 * USE CASES PER STATUS:
 *   'paid'   → Admin confirms the technician collected payment (back-fill).
 *              Or: a cheque clears, or a UPI transfer is confirmed after the job.
 *   'due'    → Admin resets a mistakenly marked bill (or reverses a premature "paid").
 *              Rare, but possible for data correction.
 *   'waived' → Admin decides not to charge the customer (goodwill gesture, error
 *              correction, promotion). The bill still exists for audit purposes.
 *
 * DOWNSTREAM EFFECTS:
 *   updatePaymentStatus() in the repository also updates:
 *     subjects.billing_status to match the new payment_status
 *     subjects.payment_collected = (paymentStatus === 'paid')
 *     subjects.payment_collected_at = (paymentStatus === 'paid') ? NOW() : null
 *
 * SECURITY:
 *   officeStaffId must be the caller's actual session user ID (enforced in API route).
 *   A technician passing their own UUID would fail the role check (role='technician'
 *   is not in ['office_staff', 'super_admin']).
 *
 * @param billId         UUID of the subject_bills row to update.
 * @param paymentStatus  The new payment status to set.
 * @param officeStaffId  UUID of the admin/staff requesting the change (role-checked).
 * @returns ServiceResult<SubjectBill> — the updated bill row on success.
 */
export async function updateBillPaymentStatus(
  billId: string,
  paymentStatus: 'paid' | 'due' | 'waived',
  officeStaffId: string,
): Promise<ServiceResult<SubjectBill>> {
  const profile = await supabase
    .from('profiles')
    .select('role')
    .eq('id', officeStaffId)
    .maybeSingle<{ role: string }>();

  if (profile.error || !profile.data) {
    return { ok: false, error: { message: 'User profile not found' } };
  }

  if (!['office_staff', 'super_admin'].includes(profile.data.role)) {
    return { ok: false, error: { message: 'Only office staff or super admin can update payment status' } };
  }

  const updated = await updatePaymentStatus(billId, paymentStatus);
  if (updated.error || !updated.data) {
    return { ok: false, error: { message: updated.error?.message ?? 'Failed to update payment status' } };
  }

  return { ok: true, data: updated.data };
}
