import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { GenerateBillInput, AddAccessoryInput } from '@/modules/subjects/subject.types';

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

  // ──────────────────────────────────────────────────────────────────────────
  // Step 2: Authenticate user
  // ──────────────────────────────────────────────────────────────────────────
  const supabase = await createServerClient();
  const authState = await supabase.auth.getUser();

  if (authState.error || !authState.data.user) {
    const error: ErrorResponse = {
      step: '2. Authentication',
      code: 'UNAUTHORIZED',
      message: 'No authenticated user found',
      userMessage: 'You must be logged in',
    };
    console.log(`[${timestamp}] ✗ Step 2 failed:`, error.code);
    return NextResponse.json({ ok: false, error }, { status: 401 });
  }

  const userId = authState.data.user.id;
  console.log(`[${timestamp}] ✓ Step 2 passed: User ${userId} authenticated`);

  // ──────────────────────────────────────────────────────────────────────────
  // Step 3: Verify technician role
  // ──────────────────────────────────────────────────────────────────────────
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
    console.log(`[${timestamp}] ✗ Step 3 failed:`, error.code);
    return NextResponse.json({ ok: false, error }, { status: 400 });
  }

  if (profileResult.data.role !== 'technician') {
    const error: ErrorResponse = {
      step: '3. Verify Role',
      code: 'INVALID_ROLE',
      message: `User role is '${profileResult.data.role}', expected 'technician'`,
      userMessage: 'Only technicians can manage billing',
    };
    console.log(`[${timestamp}] ✗ Step 3 failed:`, error.code);
    return NextResponse.json({ ok: false, error }, { status: 403 });
  }

  console.log(`[${timestamp}] ✓ Step 3 passed: User is technician`);

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
  // Step 5: Verify subject exists and technician is assigned
  // ──────────────────────────────────────────────────────────────────────────
  const admin = await createAdminClient();
  const subjectResult = await admin
    .from('subjects')
    .select(
      'id,source_type,assigned_technician_id,status,brand_id,dealer_id,is_warranty_service,is_amc_service,customer_name,service_charge_type,brands:brand_id(name),dealers:dealer_id(name)',
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
        unit_price: toNumber(input.unit_price),
      })
      .select('id,subject_id,item_name,quantity,unit_price')
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
        unit_price: accessoryResult.data.unit_price,
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
    const grand_total = visit_charge + service_charge + accessories_total;

    const isBrandDealerBill = subject.is_warranty_service || subject.is_amc_service;

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
      await admin.from('subject_bills').update({ is_deleted: true }).eq('id', billResult.data.id);

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

  let body: { action?: string; billId?: string; paymentStatus?: 'paid' | 'due' | 'waived' };
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

  const billUpdate = await auth.admin
    .from('subject_bills')
    .update({
      payment_status: body.paymentStatus,
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
