// ─────────────────────────────────────────────────────────────────────────────
// /api/subjects/[id]/billing — Billing API route
//
// PURPOSE:
//   Server-side Next.js App Router route handler for all billing operations
//   on a specific subject. Every operation here writes to the database using
//   the admin Supabase client (service-role key) to bypass RLS for verified
//   operations, while still validating auth and role server-side first.
//
// HTTP METHOD → ACTION MAPPING:
//   POST   action='add_accessory'         — Add a spare-part line item (technician)
//   POST   action='generate_bill'         — Generate final bill + complete the job
//   DELETE action='remove_accessory'      — Remove a spare-part line item (technician)
//   PATCH  action='update_payment_status' — Mark paid/due/waived (office staff/admin)
//   PUT    (no action field, body=EditBillInput) — Edit existing bill charges (super_admin)
//
// WHY ALL HANDLERS USE THE ADMIN CLIENT:
//   The admin Supabase client uses the SUPABASE_SERVICE_ROLE_KEY which bypasses
//   Row-Level Security. This is intentional here because:
//   1. Technicians are writing to subject_bills and subjects (tables where RLS
//      policies only allow reads by the assigned technician, not writes).
//   2. The ownership check (assigned_technician_id === userId) is performed
//      explicitly in the route code, providing equivalent security to what RLS
//      would enforce, but WITH the ability to also write billing records.
//   3. The admin client is only used AFTER authentication and authorization
//      are confirmed so we don't open a blanket bypass.
//
// ERROR RESPONSE CONVENTION:
//   All error responses use the ErrorResponse shape:
//     { step, code, message, userMessage, details? }
//   - step:        where in the processing pipeline the error occurred
//   - code:        machine-readable error identifier (for logging/debugging)
//   - message:     technical description (safe to log)
//   - userMessage: human-readable string shown in the UI via toast.error()
//   - details:     only included in development mode (NODE_ENV='development')
//                  to prevent internal DB errors from leaking to production clients
//
// SHARED HELPER: authenticateBillingRequest(subjectId)
//   Used by DELETE and PATCH to avoid duplicating the 5-step auth sequence:
//   1. Validate subjectId
//   2. Get current session user
//   3. Load profile.role from DB
//   4. Create admin client
//   5. Load subject with assignment + bill_generated fields
//   Returns: { ok: true, userId, role, admin, subject } or { ok: false, error, status }
//
// STEP NUMBERING IN CONSOLE LOGS:
//   Each handler logs ✓ for success and ✗ for failure at each step.
//   Steps 1-5 are standard (validate, authenticate, role, admin, subject).
//   Step 6+ are action-specific (validate input, execute DB write).
//
// COMMON GUARDS APPLIED (per relevant action):
//   \u2022 subject.assigned_technician_id === userId (technician owns the job)
//   \u2022 subject.status === 'IN_PROGRESS' (job must be active for write ops)
//   \u2022 !subject.bill_generated (bill must not exist for add/remove accessories)
//   \u2022 role in ['office_staff', 'super_admin'] (for PATCH payment status)
//   \u2022 role === 'super_admin' (for PUT bill edit)
//
// GST CALCULATION (in POST generate_bill and PUT edit bill):
//   If apply_gst=true: grand_total = (visit + service + accessories) * 1.18
//   GST rate is hardcoded to 18% (standard Indian GST for appliance services).
//
// BILL NUMBER GENERATION:
//   The POST generate_bill action calls Supabase RPC 'generate_bill_number'
//   which is a PostgreSQL function using a sequence (prevents duplicate numbers
//   even under concurrent bill generation by multiple technicians).
//
// FULL vs SYNC (DENORMALISED FIELDS):
//   Several subject fields duplicate bill data: visit_charge, service_charge,
//   grand_total, accessories_total, billing_status, payment_mode, bill_number.
//   These are duplicated on the subjects row for list-page display performance
//   (avoids a JOIN to subject_bills for every row in the list).
//   After every bill write, these are synced via a separate subjects UPDATE.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/api/with-auth';
import type { GenerateBillInput, AddAccessoryInput, EditBillInput, SubjectBill } from '@/modules/subjects/subject.types';

interface ErrorResponse {
  step: string;
  code: string;
  message: string;
  userMessage: string;
  details?: Record<string, unknown>;
}

const isDev = process.env.NODE_ENV === 'development';

function toNumber(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/** Returns today's date as YYYY-MM-DD for warranty date comparison. */
function getTodayIsoDate() {
  return new Date().toISOString().split('T')[0];
}

/**
 * @summary Shared auth helper that validates session + profile + subject for billing ops.
 *
 * @description
 * authenticateBillingRequest() is called by DELETE and PATCH handlers to avoid
 * duplicating the 5-step auth + subject-load sequence. It performs:
 *
 *   STEP 1: Create the RLS-enforced Supabase client and get the current user.
 *           If no session exists (expired or not logged in): returns 401.
 *
 *   STEP 2: Query profiles.role for the authenticated user.
 *           Uses the RLS Supabase client (standard — users can read their own profile).
 *           If profile not found: returns 400 (data integrity issue).
 *
 *   STEP 3: Create the admin Supabase client (service-role, no RLS).
 *           Needed to load the subject row regardless of RLS policies.
 *
 *   STEP 4: Query subjects with assignment + billing fields:
 *           id, assigned_technician_id, status, bill_generated
 *           Filters: subject_id = subjectId AND is_deleted = false
 *           If DB error: returns 500. If no row: returns 404.
 *
 * ON SUCCESS:
 *   Returns { ok: true, userId, role, admin, subject } with all values the
 *   calling handler needs without having to re-fetch any of them.
 *
 * NOTE ON ROLE VERIFICATION:
 *   The function does NOT verify which role is required — it just loads the role.
 *   Each handler that calls this function performs its own role check after
 *   receiving the auth result. This keeps authenticateBillingRequest generic.
 *
 * @param subjectId  UUID of the subject to load. Already validated by the caller.
 * @returns { ok: true, ...auth } on success, { ok: false, error, status } on failure.
 */
async function authenticateBillingRequest(subjectId: string) {
  const supabase = await createServerClient();
  const authState = await supabase.auth.getUser();

  if (authState.error || !authState.data.user) {
    const error: ErrorResponse = {
      step: '2. Authentication',
      code: 'UNAUTHORIZED',
      message: 'No authenticated user found',
      userMessage: 'You must be logged in',
    };
    return { ok: false as const, status: 401, error };
  }

  const userId = authState.data.user.id;

  const profileResult = await supabase
    .from('profiles')
    .select('id,role')
    .eq('id', userId)
    .maybeSingle<{ id: string; role: string }>();

  if (profileResult.error || !profileResult.data) {
    const error: ErrorResponse = {
      step: '3. Load Profile',
      code: 'PROFILE_NOT_FOUND',
      message: 'User profile missing',
      userMessage: 'Your profile could not be found. Please log out and log back in.',
    };
    return { ok: false as const, status: 400, error };
  }

  const admin = await createAdminClient();
  const subjectResult = await admin
    .from('subjects')
    .select('id,assigned_technician_id,status,bill_generated')
    .eq('id', subjectId)
    .eq('is_deleted', false)
    .maybeSingle<{
      id: string;
      assigned_technician_id: string | null;
      status: string;
      bill_generated: boolean;
    }>();

  if (subjectResult.error) {
    const error: ErrorResponse = {
      step: '5. Load Subject',
      code: 'SUBJECT_QUERY_ERROR',
      message: `Subject query failed: ${subjectResult.error.message}`,
      userMessage: 'Failed to load subject details. Please try again.',
      details: isDev ? { dbError: subjectResult.error.message } : undefined,
    };
    return { ok: false as const, status: 500, error };
  }

  if (!subjectResult.data) {
    const error: ErrorResponse = {
      step: '5. Load Subject',
      code: 'SUBJECT_NOT_FOUND',
      message: `Subject ${subjectId} does not exist or is deleted`,
      userMessage: 'This subject could not be found',
    };
    return { ok: false as const, status: 404, error };
  }

  return {
    ok: true as const,
    userId,
    role: profileResult.data.role,
    admin,
    subject: subjectResult.data,
  };
}

/**
 * @summary POST /api/subjects/[id]/billing — Add accessory or generate bill.
 *
 * @description
 * The POST handler dispatches to one of two actions based on body.action:
 *
 *   'add_accessory' flow:
 *     Step 1: Validate subjectId string.
 *     Step 2-3: requireAuth({ roles: ['technician'] }) — ensures the caller is a technician.
 *     Step 4: Parse body.action + input fields.
 *     Step 5: Load full subject (with brand/dealer join for sourceName).
 *     Step 6a: Validate item_name is not empty.
 *     Step 6b: Ensure status===IN_PROGRESS (no accessories after job completes).
 *     Step 6c: INSERT into subject_accessories. Return the new row.
 *
 *   'generate_bill' flow:
 *     Step 1-4: Same as add_accessory.
 *     Step 5: Load subject. Verify technician. Verify IN_PROGRESS.
 *     Step 6a: Check bill doesn't already exist (idempotency guard).
 *     Step 6b: Verify at least 1 photo uploaded (photosCountResult.count >= 1).
 *     Step 6c: Sum accessory total from DB (not in-memory for accuracy).
 *     Step 6d: Compute visit + service + accessories + optional 18% GST.
 *     Step 6e: Validate warranty state (must have warranty_end_date or is_amc_service).
 *     Step 6f: Determine bill type: amc/in_warranty=brand_dealer_invoice, else customer_receipt.
 *     Step 6g: Generate bill_number via RPC 'generate_bill_number'.
 *     Step 6h: INSERT into subject_bills with all fields.
 *     Step 6i: UPDATE subjects with billing fields + status='COMPLETED'.
 *     Step 6j: If Update fails: DELETE the bill (manual rollback) and return error.
 *
 *   Unknown action: return 400 UNKNOWN_ACTION.
 *
 * WHY requireAuth (NOT authenticateBillingRequest) FOR POST:
 *   requireAuth is used for POST because it loads a minimal auth context
 *   and the POST handler then loads a MORE DETAILED subject (with brand/dealer joins)
 *   than authenticateBillingRequest does. Using authenticateBillingRequest would
 *   require a second subject query to get the join data, wasting a round-trip.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: subjectId } = await params;
  const timestamp = new Date().toISOString();

  console.log(`[${timestamp}] ✓ Billing API: Starting for subject ${subjectId}`);

  // ──────────────────────────────────────────────────────────────────────────
  // Step 1: Validate subject ID
  // ──────────────────────────────────────────────────────────────────────────
  if (!subjectId || typeof subjectId !== 'string' || subjectId.trim() === '') {
    const error: ErrorResponse = {
      step: '1. Validate Subject ID',
      code: 'INVALID_SUBJECT_ID',
      message: 'Subject ID is required',
      userMessage: 'Invalid subject ID',
    };
    console.log(`[${timestamp}] ✗ Step 1 failed:`, error.code);
    return NextResponse.json({ ok: false, error }, { status: 400 });
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Steps 2–3: Authenticate user and verify technician role
  // ────────────────────────────────────────────────────────────────────────────
  const auth = await requireAuth(request, { roles: ['technician'] });
  if (!auth.ok) {
    console.log(`[${timestamp}] ✗ Auth failed`);
    return auth.response;
  }
  const { userId, admin } = auth;
  console.log(`[${timestamp}] ✓ Auth passed: User ${userId} authenticated as technician`);

  // ──────────────────────────────────────────────────────────────────────────
  // Step 4: Parse request body
  // ──────────────────────────────────────────────────────────────────────────
  let body: { action: string; [key: string]: unknown };

  try {
    body = await request.json();
  } catch (err) {
    const error: ErrorResponse = {
      step: '4. Parse Request',
      code: 'INVALID_JSON',
      message: err instanceof Error ? err.message : 'Invalid JSON',
      userMessage: 'Request body must be valid JSON',
    };
    console.log(`[${timestamp}] ✗ Step 4 failed:`, error.code);
    return NextResponse.json({ ok: false, error }, { status: 400 });
  }

  console.log(`[${timestamp}] ✓ Step 4 passed: Request parsed, action=${body.action}`);

  // ──────────────────────────────────────────────────────────────────────────
  // Step 4: Verify subject exists and technician is assigned
  // ──────────────────────────────────────────────────────────────────────────
  const subjectResult = await admin
    .from('subjects')
    .select(
      'id,source_type,assigned_technician_id,status,brand_id,dealer_id,is_warranty_service,is_amc_service,warranty_end_date,customer_name,service_charge_type,brands:brand_id(name),dealers:dealer_id(name)',
    )
    .eq('id', subjectId)
    .eq('is_deleted', false)
    .maybeSingle<{
      id: string;
      source_type: 'brand' | 'dealer';
      assigned_technician_id: string | null;
      status: string;
      brand_id: string | null;
      dealer_id: string | null;
      is_warranty_service: boolean;
      is_amc_service: boolean;
      warranty_end_date: string | null;
      customer_name: string | null;
      service_charge_type: string;
      brands?: { name?: string | null } | null;
      dealers?: { name?: string | null } | null;
    }>();

  if (subjectResult.error) {
    const error: ErrorResponse = {
      step: '5. Load Subject',
      code: 'SUBJECT_QUERY_ERROR',
      message: `Subject query failed: ${subjectResult.error.message}`,
      userMessage: 'Failed to load subject details. Please try again.',
      details: isDev ? { dbError: subjectResult.error.message } : undefined,
    };
    console.log(`[${timestamp}] ✗ Step 5 failed (database error):`, error.code, subjectResult.error.message);
    return NextResponse.json({ ok: false, error }, { status: 500 });
  }

  if (!subjectResult.data) {
    const error: ErrorResponse = {
      step: '5. Load Subject',
      code: 'SUBJECT_NOT_FOUND',
      message: `Subject ${subjectId} does not exist or is deleted`,
      userMessage: 'This subject could not be found',
    };
    console.log(`[${timestamp}] ✗ Step 5 failed (not found):`, error.code);
    return NextResponse.json({ ok: false, error }, { status: 404 });
  }

  const subject = subjectResult.data;

  if (subject.assigned_technician_id !== userId) {
    const error: ErrorResponse = {
      step: '5. Verify Assignment',
      code: 'NOT_ASSIGNED_TO_SUBJECT',
      message: `Not assigned to subject ${subjectId}. Assigned to: ${subject.assigned_technician_id ?? 'no one'}`,
      userMessage: 'You can only manage billing for subjects assigned to you',
    };
    console.log(`[${timestamp}] ✗ Step 5 failed:`, error.code);
    return NextResponse.json({ ok: false, error }, { status: 403 });
  }

  console.log(`[${timestamp}] ✓ Step 5 passed: Subject verified, status=${subject.status}`);

  const sourceName = subject.source_type === 'brand'
    ? (subject.brands?.name ?? 'Brand')
    : (subject.dealers?.name ?? 'Dealer');

  // ──────────────────────────────────────────────────────────────────────────
  // ROUTE: add_accessory
  // ──────────────────────────────────────────────────────────────────────────
  if (body.action === 'add_accessory') {
    const input = body as unknown as AddAccessoryInput & { action: string };

    if (!input.item_name?.trim()) {
      const error: ErrorResponse = {
        step: '6. Validate Accessory',
        code: 'MISSING_ITEM_NAME',
        message: 'Item name is required',
        userMessage: 'Please enter an item name',
      };
      console.log(`[${timestamp}] ✗ Failed:`, error.code);
      return NextResponse.json({ ok: false, error }, { status: 400 });
    }

    if (subject.status !== 'IN_PROGRESS') {
      const error: ErrorResponse = {
        step: '6. Check Status',
        code: 'INVALID_STATUS',
        message: `Cannot add accessories when status is ${subject.status}`,
        userMessage: 'Accessories can only be added while job is in progress',
      };
      console.log(`[${timestamp}] ✗ Failed:`, error.code);
      return NextResponse.json({ ok: false, error }, { status: 400 });
    }

    console.log(`[${timestamp}] ⊘ Processing: add_accessory "${input.item_name}"`);

    const accessoryResult = await admin
      .from('subject_accessories')
      .insert({
        subject_id: subjectId,
        item_name: input.item_name.trim(),
        quantity: toNumber(input.quantity),
        mrp: toNumber(input.mrp),
        discount_type: input.discount_type ?? 'percentage',
        discount_value: toNumber(input.discount_value ?? 0),
      })
      .select('id,subject_id,item_name,quantity,mrp')
      .single();

    if (accessoryResult.error) {
      const error: ErrorResponse = {
        step: '6. Create Accessory',
        code: 'ACCESSORY_CREATE_FAILED',
        message: accessoryResult.error.message,
        userMessage: 'Failed to add accessory. Please try again.',
        details: isDev ? { dbError: accessoryResult.error.message } : undefined,
      };
      console.log(`[${timestamp}] ✗ Failed:`, error.code);
      return NextResponse.json({ ok: false, error }, { status: 400 });
    }

    console.log(`[${timestamp}] ✓✓✓ Accessory added successfully`);
    return NextResponse.json({
      ok: true,
      data: {
        id: accessoryResult.data.id,
        item_name: accessoryResult.data.item_name,
        quantity: accessoryResult.data.quantity,
        mrp: accessoryResult.data.mrp,
      },
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // ROUTE: generate_bill
  // ──────────────────────────────────────────────────────────────────────────
  if (body.action === 'generate_bill') {
    const billInput = body as unknown as GenerateBillInput & { action: string };

    if (subject.status !== 'IN_PROGRESS') {
      const error: ErrorResponse = {
        step: '6. Check Status',
        code: 'INVALID_STATUS',
        message: `Cannot generate bill when status is ${subject.status}`,
        userMessage: 'Bill can only be generated when subject is in progress',
      };
      console.log(`[${timestamp}] ✗ Failed:`, error.code);
      return NextResponse.json({ ok: false, error }, { status: 400 });
    }

    console.log(`[${timestamp}] ⊘ Processing: generate_bill`);

    // Check if bill already exists
    const existingBill = await admin
      .from('subject_bills')
      .select('id')
      .eq('subject_id', subjectId)
      .maybeSingle();

    if (existingBill.data) {
      const error: ErrorResponse = {
        step: '6. Check Existing Bill',
        code: 'BILL_ALREADY_EXISTS',
        message: 'Bill already generated for this subject',
        userMessage: 'A bill has already been generated for this subject',
      };
      console.log(`[${timestamp}] ✗ Failed:`, error.code);
      return NextResponse.json({ ok: false, error }, { status: 400 });
    }

    const photosCountResult = await admin
      .from('subject_photos')
      .select('id', { count: 'exact', head: true })
      .eq('subject_id', subjectId)
      .eq('is_deleted', false);

    if (photosCountResult.error) {
      const error: ErrorResponse = {
        step: '6. Validate Uploads',
        code: 'UPLOAD_COUNT_CHECK_FAILED',
        message: photosCountResult.error.message,
        userMessage: 'Could not verify uploads. Please try again.',
        details: isDev ? { dbError: photosCountResult.error.message } : undefined,
      };
      console.log(`[${timestamp}] ✗ Failed:`, error.code);
      return NextResponse.json({ ok: false, error }, { status: 400 });
    }

    if ((photosCountResult.count ?? 0) < 1) {
      const error: ErrorResponse = {
        step: '6. Validate Uploads',
        code: 'NO_UPLOADS',
        message: 'At least one upload is required before billing',
        userMessage: 'Upload at least one photo or video before generating bill',
      };
      console.log(`[${timestamp}] ✗ Failed:`, error.code);
      return NextResponse.json({ ok: false, error }, { status: 400 });
    }

    // Get accessories total
    const accessoriesResult = await admin
      .from('subject_accessories')
      .select('total_price')
      .eq('subject_id', subjectId);

    const accessories_total = (accessoriesResult.data ?? []).reduce(
      (sum, row) => sum + toNumber((row as { total_price: number }).total_price),
      0,
    );

    const visit_charge = toNumber(billInput.visit_charge);
    const service_charge = toNumber(billInput.service_charge);
    const subtotal = visit_charge + service_charge + accessories_total;
    const applyGst = Boolean(billInput.apply_gst);
    const gstAmount = applyGst ? subtotal * 0.18 : 0;
    const grand_total = subtotal + gstAmount;

    const todayIso = getTodayIsoDate();
    const warrantyNotNoted = !subject.is_amc_service && !subject.warranty_end_date;

    if (warrantyNotNoted) {
      const error: ErrorResponse = {
        step: '6. Validate Warranty State',
        code: 'WARRANTY_DATE_NOT_NOTED',
        message: `warranty_end_date is missing for subject ${subjectId}`,
        userMessage: 'Warranty date is not noted. Please update warranty end date before generating bill.',
      };
      console.log(`[${timestamp}] ✗ Failed:`, error.code);
      return NextResponse.json({ ok: false, error }, { status: 400 });
    }

    // Determine warranty state at bill generation time (not at subject creation)
    // because the job may have started in-warranty but the user is generating
    // the bill after the warranty actually expired.
    const isWarrantyActive = Boolean(subject.warranty_end_date && subject.warranty_end_date >= todayIso);
    const warrantyState = subject.is_amc_service
      ? 'amc'
      : (isWarrantyActive ? 'in_warranty' : 'warranty_out');
    // Brand-dealer bills (warranty/AMC) are invoiced to the manufacturer/dealer;
    // customer bills require payment collection from the end user on-site.
    const isBrandDealerBill = warrantyState === 'amc' || warrantyState === 'in_warranty';

    const hasPaymentMode = Boolean(billInput.payment_mode);
    const customerPaymentStatus = hasPaymentMode ? 'paid' : 'due';

    // Generate bill number
    const billNumberResult = await admin.rpc('generate_bill_number');
    if (billNumberResult.error || !billNumberResult.data) {
      const error: ErrorResponse = {
        step: '6. Generate Bill Number',
        code: 'BILL_NUMBER_GENERATION_FAILED',
        message: billNumberResult.error?.message ?? 'Failed to generate bill number',
        userMessage: 'Failed to generate bill number. Please try again.',
        details: isDev ? { dbError: billNumberResult.error?.message } : undefined,
      };
      console.log(`[${timestamp}] ✗ Failed:`, error.code);
      return NextResponse.json({ ok: false, error }, { status: 400 });
    }

    const bill_number = billNumberResult.data as string;

    // Create bill
    const billResult = await admin
      .from('subject_bills')
      .insert({
        subject_id: subjectId,
        bill_number,
        bill_type: isBrandDealerBill ? 'brand_dealer_invoice' : 'customer_receipt',
        issued_to: isBrandDealerBill ? sourceName : (subject.customer_name ?? 'Customer'),
        issued_to_type: isBrandDealerBill ? 'brand_dealer' : 'customer',
        brand_id: subject.brand_id ?? null,
        dealer_id: subject.dealer_id ?? null,
        visit_charge,
        service_charge,
        accessories_total,
        grand_total,
        payment_mode: isBrandDealerBill ? null : (billInput.payment_mode ?? null),
        payment_status: isBrandDealerBill ? 'due' : customerPaymentStatus,
        payment_collected_at: isBrandDealerBill
          ? null
          : (hasPaymentMode ? new Date().toISOString() : null),
        generated_by: userId,
      })
      .select('id,bill_number,grand_total,bill_type')
      .single();

    if (billResult.error) {
      const error: ErrorResponse = {
        step: '6. Create Bill',
        code: 'BILL_CREATE_FAILED',
        message: billResult.error.message,
        userMessage: 'Failed to create bill. Please try again.',
        details: isDev ? { dbError: billResult.error.message } : undefined,
      };
      console.log(`[${timestamp}] ✗ Failed:`, error.code);
      return NextResponse.json({ ok: false, error }, { status: 400 });
    }

    const subjectUpdateResult = await admin
      .from('subjects')
      .update({
        visit_charge,
        service_charge,
        accessories_total,
        grand_total,
        is_warranty_service: warrantyState === 'in_warranty',
        service_charge_type: isBrandDealerBill ? 'brand_dealer' : 'customer',
        payment_mode: isBrandDealerBill ? null : (billInput.payment_mode ?? null),
        payment_collected: isBrandDealerBill ? false : hasPaymentMode,
        payment_collected_at: isBrandDealerBill
          ? null
          : (hasPaymentMode ? new Date().toISOString() : null),
        billing_status: isBrandDealerBill ? 'due' : customerPaymentStatus,
        bill_generated: true,
        bill_generated_at: new Date().toISOString(),
        bill_number,
        status: 'COMPLETED',
        completed_at: new Date().toISOString(),
        completion_proof_uploaded: true,
        status_changed_by_id: userId,
      })
      .eq('id', subjectId)
      .eq('is_deleted', false)
      .select('id')
      .single();

    if (subjectUpdateResult.error) {
      // Roll back the bill insert to keep the DB consistent:
      // if the subject update fails the bill would exist without the subject
      // being marked completed, blocking any future billing attempt.
      await admin.from('subject_bills').delete().eq('id', billResult.data.id);

      const error: ErrorResponse = {
        step: '6. Complete Subject',
        code: 'SUBJECT_COMPLETE_FAILED',
        message: subjectUpdateResult.error.message,
        userMessage: 'Bill was created but the job could not be completed. Please try again.',
        details: isDev ? { dbError: subjectUpdateResult.error.message, billId: billResult.data.id } : undefined,
      };
      console.log(`[${timestamp}] ✗ Failed:`, error.code);
      return NextResponse.json({ ok: false, error }, { status: 400 });
    }

    console.log(`[${timestamp}] ✓✓✓ Bill generated and subject completed successfully: ${bill_number}`);
    return NextResponse.json({
      ok: true,
      data: {
        id: billResult.data.id,
        bill_number: billResult.data.bill_number,
        bill_type: billResult.data.bill_type,
        grand_total: billResult.data.grand_total,
      },
    });
  }

  const error: ErrorResponse = {
    step: '5. Validate Action',
    code: 'UNKNOWN_ACTION',
    message: `Unknown action: '${body.action}'`,
    userMessage: `Action '${body.action}' is not supported`,
  };
  console.log(`[${timestamp}] ✗ Failed:`, error.code);
  return NextResponse.json({ ok: false, error }, { status: 400 });
}

/**
 * @summary DELETE /api/subjects/[id]/billing — Remove a spare-part accessory.
 *
 * @description
 * The DELETE handler only supports action='remove_accessory'.
 *
 * FULL FLOW:
 *   Step 1: Validate subjectId.
 *   Step 2-3: Parse + validate body: must have action='remove_accessory' and accessoryId.
 *   Step 4: authenticateBillingRequest(subjectId) — auth + role + subject load.
 *   Step 5: Role check: must be 'technician' (office staff cannot remove accessories).
 *   Step 6: Assignment check: assigned_technician_id === userId.
 *   Step 7: Status check: status='IN_PROGRESS' AND bill_generated=false.
 *           Cannot remove accessories if the bill is already locked.
 *   Step 8: Load existing accessory (verify it belongs to this subject).
 *           Returns 404 if not found or belongs to a different subject.
 *   Step 9: Hard DELETE the row from subject_accessories.
 *           Returns { ok: true, data: { id } } on success.
 *
 * WHY HARD DELETE:
 *   Accessory rows have no downstream relationships (no other table references
 *   subject_accessories.id as a foreign key). A soft-delete would complicate
 *   every SUM query on accessories_total. The bill history (once generated)
 *   preserves the accessories_total value, so hard-deleting the row is safe
 *   as long as deletion happens before bill generation.
 *
 * GUARD: bill_generated=false
 *   Once a bill is generated, the accessories list is "frozen" in the bill.
 *   Allowing deletion after billing would create a discrepancy between
 *   subject_bills.accessories_total and the actual row sum. The edit-bill
 *   (PUT) flow is the correct path for post-billing changes (admin only).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: subjectId } = await params;
  const timestamp = new Date().toISOString();

  if (!subjectId || typeof subjectId !== 'string' || subjectId.trim() === '') {
    const error: ErrorResponse = {
      step: '1. Validate Subject ID',
      code: 'INVALID_SUBJECT_ID',
      message: 'Subject ID is required',
      userMessage: 'Invalid subject ID',
    };
    return NextResponse.json({ ok: false, error }, { status: 400 });
  }

  let body: { action?: string; accessoryId?: string };
  try {
    body = await request.json();
  } catch (err) {
    const error: ErrorResponse = {
      step: '4. Parse Request',
      code: 'INVALID_JSON',
      message: err instanceof Error ? err.message : 'Invalid JSON',
      userMessage: 'Request body must be valid JSON',
    };
    return NextResponse.json({ ok: false, error }, { status: 400 });
  }

  if (body.action !== 'remove_accessory') {
    const error: ErrorResponse = {
      step: '5. Validate Action',
      code: 'UNKNOWN_ACTION',
      message: `Unknown action: '${body.action ?? ''}'`,
      userMessage: `Action '${body.action ?? ''}' is not supported`,
    };
    return NextResponse.json({ ok: false, error }, { status: 400 });
  }

  if (!body.accessoryId || typeof body.accessoryId !== 'string') {
    const error: ErrorResponse = {
      step: '6. Validate Accessory',
      code: 'MISSING_ACCESSORY_ID',
      message: 'accessoryId is required',
      userMessage: 'Accessory ID is required',
    };
    return NextResponse.json({ ok: false, error }, { status: 400 });
  }

  const auth = await authenticateBillingRequest(subjectId);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  if (auth.role !== 'technician') {
    const error: ErrorResponse = {
      step: '3. Verify Role',
      code: 'INVALID_ROLE',
      message: `User role is '${auth.role}', expected 'technician'`,
      userMessage: 'Only technicians can remove accessories',
    };
    return NextResponse.json({ ok: false, error }, { status: 403 });
  }

  if (auth.subject.assigned_technician_id !== auth.userId) {
    const error: ErrorResponse = {
      step: '5. Verify Assignment',
      code: 'NOT_ASSIGNED_TO_SUBJECT',
      message: `Not assigned to subject ${subjectId}`,
      userMessage: 'You can only manage accessories for subjects assigned to you',
    };
    return NextResponse.json({ ok: false, error }, { status: 403 });
  }

  if (auth.subject.status !== 'IN_PROGRESS' || auth.subject.bill_generated) {
    const error: ErrorResponse = {
      step: '6. Check Status',
      code: 'INVALID_STATUS',
      message: `Cannot remove accessories when status is ${auth.subject.status}`,
      userMessage: 'Accessories can only be removed while job is in progress before billing',
    };
    return NextResponse.json({ ok: false, error }, { status: 400 });
  }

  const existingAccessory = await auth.admin
    .from('subject_accessories')
    .select('id')
    .eq('id', body.accessoryId)
    .eq('subject_id', subjectId)
    .maybeSingle<{ id: string }>();

  if (existingAccessory.error) {
    const error: ErrorResponse = {
      step: '6. Load Accessory',
      code: 'ACCESSORY_QUERY_FAILED',
      message: existingAccessory.error.message,
      userMessage: 'Failed to load accessory item. Please try again.',
      details: isDev ? { dbError: existingAccessory.error.message } : undefined,
    };
    return NextResponse.json({ ok: false, error }, { status: 400 });
  }

  if (!existingAccessory.data) {
    const error: ErrorResponse = {
      step: '6. Load Accessory',
      code: 'ACCESSORY_NOT_FOUND',
      message: `Accessory ${body.accessoryId} not found for subject ${subjectId}`,
      userMessage: 'Accessory item was not found',
    };
    return NextResponse.json({ ok: false, error }, { status: 404 });
  }

  const removeResult = await auth.admin
    .from('subject_accessories')
    .delete()
    .eq('id', body.accessoryId)
    .eq('subject_id', subjectId);

  if (removeResult.error) {
    const error: ErrorResponse = {
      step: '6. Remove Accessory',
      code: 'ACCESSORY_REMOVE_FAILED',
      message: removeResult.error.message,
      userMessage: 'Failed to remove accessory. Please try again.',
      details: isDev ? { dbError: removeResult.error.message } : undefined,
    };
    console.log(`[${timestamp}] ✗ Failed:`, error.code);
    return NextResponse.json({ ok: false, error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, data: { id: body.accessoryId } });
}

/**
 * @summary PATCH /api/subjects/[id]/billing — Update payment status (admin/office staff).
 *
 * @description
 * The PATCH handler only supports action='update_payment_status'.
 * Used by office staff and super_admin to record that a bill has been paid,
 * reset it to due, or waive the charge.
 *
 * FULL FLOW:
 *   Step 1: Validate subjectId.
 *   Step 2: Parse body: must have action='update_payment_status', billId, valid paymentStatus.
 *   Step 3: If paymentStatus='paid': paymentMode is also required (which method was used).
 *           Prevents creating a 'paid' record without recording collection method.
 *   Step 4: authenticateBillingRequest(subjectId) — auth + role + subject load.
 *   Step 5: Role check: only 'office_staff' or 'super_admin' allowed.
 *           Technicians cannot change payment status via this route — they
 *           record payment mode during bill generation (generate_bill action).
 *   Step 6: UPDATE subject_bills SET payment_status, payment_mode, payment_collected_at.
 *           Returns the updated { id, payment_status }.
 *   Step 7: Sync subjects row (billing_status, payment_mode, payment_collected,
 *           payment_collected_at) to keep the denormalised subject fields in sync.
 *           This second UPDATE is not critical (the bill record is source of truth)
 *           but prevents stale data in the subject list view.
 *
 * paymentCollectedAt:
 *   Set to NOW() when paymentStatus='paid', null otherwise.
 *   This records the exact timestamp the admin marked the bill as paid.
 *
 * normalizedPaymentMode:
 *   Only set when paymentStatus='paid'; null for 'due' and 'waived'.
 *   Prevents phantom paymentMode values when reverting from 'paid' to 'due'.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: subjectId } = await params;

  if (!subjectId || typeof subjectId !== 'string' || subjectId.trim() === '') {
    const error: ErrorResponse = {
      step: '1. Validate Subject ID',
      code: 'INVALID_SUBJECT_ID',
      message: 'Subject ID is required',
      userMessage: 'Invalid subject ID',
    };
    return NextResponse.json({ ok: false, error }, { status: 400 });
  }

  let body: { action?: string; billId?: string; paymentStatus?: 'paid' | 'due' | 'waived'; paymentMode?: 'cash' | 'upi' | 'card' | 'cheque' };
  try {
    body = await request.json();
  } catch (err) {
    const error: ErrorResponse = {
      step: '4. Parse Request',
      code: 'INVALID_JSON',
      message: err instanceof Error ? err.message : 'Invalid JSON',
      userMessage: 'Request body must be valid JSON',
    };
    return NextResponse.json({ ok: false, error }, { status: 400 });
  }

  if (body.action !== 'update_payment_status') {
    const error: ErrorResponse = {
      step: '5. Validate Action',
      code: 'UNKNOWN_ACTION',
      message: `Unknown action: '${body.action ?? ''}'`,
      userMessage: `Action '${body.action ?? ''}' is not supported`,
    };
    return NextResponse.json({ ok: false, error }, { status: 400 });
  }

  if (!body.billId || !body.paymentStatus || !['paid', 'due', 'waived'].includes(body.paymentStatus)) {
    const error: ErrorResponse = {
      step: '6. Validate Payment Update',
      code: 'INVALID_PAYMENT_UPDATE',
      message: 'billId and valid paymentStatus are required',
      userMessage: 'Please provide a valid bill and payment status',
    };
    return NextResponse.json({ ok: false, error }, { status: 400 });
  }

  if (body.paymentStatus === 'paid' && (!body.paymentMode || !['cash', 'upi', 'card', 'cheque'].includes(body.paymentMode))) {
    const error: ErrorResponse = {
      step: '6. Validate Payment Update',
      code: 'PAYMENT_MODE_REQUIRED',
      message: 'paymentMode is required when marking bill as paid',
      userMessage: 'Select payment mode before collecting payment',
    };
    return NextResponse.json({ ok: false, error }, { status: 400 });
  }

  const auth = await authenticateBillingRequest(subjectId);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  if (!['office_staff', 'super_admin'].includes(auth.role)) {
    const error: ErrorResponse = {
      step: '3. Verify Role',
      code: 'INVALID_ROLE',
      message: `User role is '${auth.role}', expected office_staff or super_admin`,
      userMessage: 'Only office staff or super admin can update payment status',
    };
    return NextResponse.json({ ok: false, error }, { status: 403 });
  }

  const nowIso = new Date().toISOString();
  const paymentCollectedAt = body.paymentStatus === 'paid' ? nowIso : null;
  const normalizedPaymentMode = body.paymentStatus === 'paid' ? body.paymentMode ?? null : null;

  const billUpdate = await auth.admin
    .from('subject_bills')
    .update({
      payment_status: body.paymentStatus,
      payment_mode: normalizedPaymentMode,
      payment_collected_at: paymentCollectedAt,
    })
    .eq('id', body.billId)
    .eq('subject_id', subjectId)
    .select('id,payment_status')
    .single();

  if (billUpdate.error) {
    const error: ErrorResponse = {
      step: '6. Update Bill Payment',
      code: 'PAYMENT_UPDATE_FAILED',
      message: billUpdate.error.message,
      userMessage: 'Failed to update payment status',
      details: isDev ? { dbError: billUpdate.error.message } : undefined,
    };
    return NextResponse.json({ ok: false, error }, { status: 400 });
  }

  await auth.admin
    .from('subjects')
    .update({
      billing_status: body.paymentStatus,
      payment_mode: normalizedPaymentMode,
      payment_collected: body.paymentStatus === 'paid',
      payment_collected_at: paymentCollectedAt,
    })
    .eq('id', subjectId)
    .eq('is_deleted', false);

  return NextResponse.json({
    ok: true,
    data: {
      id: billUpdate.data.id,
      payment_status: billUpdate.data.payment_status,
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/subjects/[id]/billing — Super admin edits charges on an existing bill
//
// PURPOSE:
//   Allows a super_admin to correct the financial fields of an already-generated
//   bill. This is an exceptional operation (bills should ideally be final),
//   but corrections are needed when technicians enter wrong charges.
//
// AUTHORIZATION: super_admin ONLY
//   Not even office_staff can edit bills — only super_admin.
//   This restriction is intentional: bill edits change financial audit records
//   and require the highest trust level.
//
// ACCESSORY MANAGEMENT (two-step replace):
//   body.accessories_to_remove: UUID[] — existing accessory IDs to hard-delete
//   body.accessories_to_add: []{item_name, quantity, unit_price} — new rows to insert
//   This split allows surgical edits (remove one, add another) rather than
//   forcing a full replacement which would lose existing ID references.
//
// TOTAL RECALCULATION:
//   After removing and adding accessories, the route recalculates accessories_total
//   from the DB (SELECT SUM) to ensure accuracy. Then recomputes grand_total:
//     grand_total = (visit + service + accessories) * (1.18 if apply_gst else 1.0)
//
// PAYMENT MODE PERSISTENCE:
//   For brand_dealer_invoice bills: payment_mode is always null (no on-site collection).
//   For customer_receipt bills: new payment_mode from body is used if provided;
//   otherwise the existing payment_mode is kept (no accidental clearing of payment method).
//
// DUAL-WRITE PATTERN:
//   After updating subject_bills, the route also updates the subjects row's
//   denormalised fields (visit_charge, service_charge, grand_total, etc.).
//   This keeps the list view in sync without requiring a JOIN every time.
// ─────────────────────────────────────────────────────────────────────────────
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: subjectId } = await params;
  const timestamp = new Date().toISOString();

  if (!subjectId || typeof subjectId !== 'string' || subjectId.trim() === '') {
    const error: ErrorResponse = {
      step: '1. Validate Subject ID',
      code: 'INVALID_SUBJECT_ID',
      message: 'Subject ID is required',
      userMessage: 'Invalid subject ID',
    };
    return NextResponse.json({ ok: false, error }, { status: 400 });
  }

  // ── Auth: super_admin only ──────────────────────────────────────────────
  const supabase = await createServerClient();
  const authState = await supabase.auth.getUser();

  if (authState.error || !authState.data.user) {
    const error: ErrorResponse = {
      step: '2. Authentication',
      code: 'UNAUTHORIZED',
      message: 'No authenticated user found',
      userMessage: 'You must be logged in',
    };
    return NextResponse.json({ ok: false, error }, { status: 401 });
  }

  const userId = authState.data.user.id;
  const admin = await createAdminClient();

  const profileResult = await admin
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle<{ role: string }>();

  if (!profileResult.data || profileResult.data.role !== 'super_admin') {
    const error: ErrorResponse = {
      step: '3. Verify Role',
      code: 'FORBIDDEN',
      message: 'Only super_admin can edit bills',
      userMessage: 'Only super admin can edit an existing bill',
    };
    return NextResponse.json({ ok: false, error }, { status: 403 });
  }

  console.log(`[${timestamp}] ✓ Edit Bill: super_admin ${userId} for subject ${subjectId}`);

  // ── Parse body ───────────────────────────────────────────────────────────
  let body: EditBillInput;
  try {
    body = await request.json() as EditBillInput;
  } catch (err) {
    const error: ErrorResponse = {
      step: '4. Parse Request',
      code: 'INVALID_JSON',
      message: err instanceof Error ? err.message : 'Invalid JSON',
      userMessage: 'Request body must be valid JSON',
    };
    return NextResponse.json({ ok: false, error }, { status: 400 });
  }

  // ── Load subject (must already have a bill) ──────────────────────────────
  const subjectResult = await admin
    .from('subjects')
    .select('id,bill_generated,is_amc_service,warranty_end_date,service_charge_type')
    .eq('id', subjectId)
    .eq('is_deleted', false)
    .maybeSingle<{
      id: string;
      bill_generated: boolean;
      is_amc_service: boolean;
      warranty_end_date: string | null;
      service_charge_type: string;
    }>();

  if (subjectResult.error) {
    const error: ErrorResponse = {
      step: '5. Load Subject',
      code: 'SUBJECT_QUERY_ERROR',
      message: subjectResult.error.message,
      userMessage: 'Failed to load subject details.',
      details: isDev ? { dbError: subjectResult.error.message } : undefined,
    };
    return NextResponse.json({ ok: false, error }, { status: 500 });
  }

  if (!subjectResult.data) {
    const error: ErrorResponse = {
      step: '5. Load Subject',
      code: 'SUBJECT_NOT_FOUND',
      message: `Subject ${subjectId} not found`,
      userMessage: 'This subject could not be found',
    };
    return NextResponse.json({ ok: false, error }, { status: 404 });
  }

  if (!subjectResult.data.bill_generated) {
    const error: ErrorResponse = {
      step: '5. Verify Bill',
      code: 'NO_BILL',
      message: 'Subject has no generated bill',
      userMessage: 'No bill exists for this subject. Generate the bill first.',
    };
    return NextResponse.json({ ok: false, error }, { status: 400 });
  }

  // ── Load existing bill ────────────────────────────────────────────────────
  const billResult = await admin
    .from('subject_bills')
    .select('id,payment_mode,payment_status,bill_type')
    .eq('subject_id', subjectId)
    .single<Pick<SubjectBill, 'id' | 'payment_mode' | 'payment_status' | 'bill_type'>>();

  if (billResult.error || !billResult.data) {
    const error: ErrorResponse = {
      step: '5. Load Bill',
      code: 'BILL_NOT_FOUND',
      message: 'Bill record not found in database',
      userMessage: 'Could not find the bill record. Please try again.',
      details: isDev ? { dbError: billResult.error?.message } : undefined,
    };
    return NextResponse.json({ ok: false, error }, { status: 404 });
  }

  const existingBill = billResult.data;

  // ── Remove accessories ────────────────────────────────────────────────────
  if (body.accessories_to_remove?.length) {
    const removeResult = await admin
      .from('subject_accessories')
      .delete()
      .in('id', body.accessories_to_remove)
      .eq('subject_id', subjectId);

    if (removeResult.error) {
      const error: ErrorResponse = {
        step: '6. Remove Accessories',
        code: 'ACCESSORY_REMOVE_FAILED',
        message: removeResult.error.message,
        userMessage: 'Failed to remove accessories. Please try again.',
        details: isDev ? { dbError: removeResult.error.message } : undefined,
      };
      return NextResponse.json({ ok: false, error }, { status: 500 });
    }
  }

  // ── Add new accessories ───────────────────────────────────────────────────
  if (body.accessories_to_add?.length) {
    const newRows = body.accessories_to_add
      .filter((acc) => acc.item_name?.trim())
      .map((acc) => ({
        subject_id: subjectId,
        item_name: acc.item_name.trim(),
        quantity: Math.max(1, Math.floor(toNumber(acc.quantity))),
        mrp: Math.max(0, toNumber(acc.mrp)),
        discount_type: acc.discount_type ?? 'percentage',
        discount_value: Math.max(0, toNumber(acc.discount_value ?? 0)),
        added_by: userId,
      }));

    if (newRows.length > 0) {
      const addResult = await admin.from('subject_accessories').insert(newRows);
      if (addResult.error) {
        const error: ErrorResponse = {
          step: '6. Add Accessories',
          code: 'ACCESSORY_ADD_FAILED',
          message: addResult.error.message,
          userMessage: 'Failed to add new accessories. Please try again.',
          details: isDev ? { dbError: addResult.error.message } : undefined,
        };
        return NextResponse.json({ ok: false, error }, { status: 500 });
      }
    }
  }

  // ── Recalculate totals ────────────────────────────────────────────────────
  const accessoriesResult = await admin
    .from('subject_accessories')
    .select('line_total,line_base_total,line_gst_total,discount_amount,quantity')
    .eq('subject_id', subjectId);

  const accessories_total = (accessoriesResult.data ?? []).reduce(
    (sum, row) => sum + toNumber((row as { line_total: number }).line_total),
    0,
  );

  const total_base_amount = (accessoriesResult.data ?? []).reduce(
    (sum, row) => sum + toNumber((row as { line_base_total: number }).line_base_total),
    0,
  );

  const total_gst_amount = (accessoriesResult.data ?? []).reduce(
    (sum, row) => sum + toNumber((row as { line_gst_total: number }).line_gst_total),
    0,
  );

  const total_discount = (accessoriesResult.data ?? []).reduce(
    (sum, row) => {
      const r = row as { discount_amount: number; quantity: number };
      return sum + toNumber(r.discount_amount) * toNumber(r.quantity);
    },
    0,
  );

  const visit_charge = Math.max(0, toNumber(body.visit_charge));
  const service_charge = Math.max(0, toNumber(body.service_charge));
  const subtotal = visit_charge + service_charge + accessories_total;
  const gstAmount = body.apply_gst ? subtotal * 0.18 : 0;
  const grand_total = subtotal + gstAmount;

  // ── Determine payment_mode: use new value, or keep existing ─────────────
  const isBrandDealerBill = existingBill.bill_type === 'brand_dealer_invoice';
  const updatedPaymentMode = isBrandDealerBill
    ? null
    : (body.payment_mode ?? existingBill.payment_mode);

  // ── Update bill record ────────────────────────────────────────────────────
  const billUpdateResult = await admin
    .from('subject_bills')
    .update({
      visit_charge,
      service_charge,
      accessories_total,
      grand_total,
      total_base_amount,
      total_gst_amount,
      total_discount,
      payment_mode: updatedPaymentMode,
    })
    .eq('id', existingBill.id)
    .select('id,grand_total')
    .single();

  if (billUpdateResult.error) {
    const error: ErrorResponse = {
      step: '7. Update Bill',
      code: 'BILL_UPDATE_FAILED',
      message: billUpdateResult.error.message,
      userMessage: 'Failed to update the bill. Please try again.',
      details: isDev ? { dbError: billUpdateResult.error.message } : undefined,
    };
    return NextResponse.json({ ok: false, error }, { status: 500 });
  }

  // ── Sync denormalised columns on subjects ─────────────────────────────────
  await admin
    .from('subjects')
    .update({
      visit_charge,
      service_charge,
      accessories_total,
      grand_total,
      payment_mode: updatedPaymentMode,
    })
    .eq('id', subjectId)
    .eq('is_deleted', false);

  console.log(`[${timestamp}] ✓✓✓ Bill edited successfully for subject ${subjectId}; new grand_total=${grand_total}`);

  return NextResponse.json({
    ok: true,
    data: {
      id: existingBill.id,
      grand_total,
      accessories_total,
      visit_charge,
      service_charge,
    },
  });
}
