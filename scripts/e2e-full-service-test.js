/**
 * COMPREHENSIVE END-TO-END SERVICE WORKFLOW TEST
 * ─────────────────────────────────────────────────────────────────────────
 * Tests all scenarios for the HiTech service job lifecycle:
 *
 *  Scenario A — Full Happy Path (with service charge, accessories, bill, complete)
 *  Scenario B — No Service Charge / AMC (warranty bill to brand)
 *  Scenario C — Technician Rejects Assignment
 *  Scenario D — Mark Incomplete (spare parts needed)
 *  Scenario E — Cancel Service (admin deletes subject)
 *
 * Runs against: http://localhost:3000 (Next.js dev server)
 * Auth:
 *   SuperAdmin  → Varghesejoby2003@gmail.com / admin123
 *   Technician  → ramu@gmail.com / ramutech123
 */

const { createClient } = require('@supabase/supabase-js');

// ──────────────────────────────────────────── CONFIG ──────────────────────
const SUPABASE_URL    = 'https://otmnfcuuqlbeowphxagf.supabase.co';
const ANON_KEY        = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im90bW5mY3V1cWxiZW93cGh4YWdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMzM5MzYsImV4cCI6MjA4ODcwOTkzNn0.WKfUF4YYGoI-XSAkFf_-wSB47RCcOs7wHsV5uxHtOKw';
const SERVICE_KEY     = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im90bW5mY3V1cWxiZW93cGh4YWdmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzEzMzkzNiwiZXhwIjoyMDg4NzA5OTM2fQ.mvNJvFj6Gd5f2MDHURuxrFeCycv1fzHoDuFCGz-W02o';
const DEV_URL         = 'http://localhost:3000';
const ADMIN_EMAIL     = 'Varghesejoby2003@gmail.com';
const ADMIN_PASS      = 'admin123';
const TECH_EMAIL      = 'ramu@gmail.com';
const TECH_PASS       = 'ramutech123';
const TODAY           = new Date().toISOString().split('T')[0];

// ──────────────────────────────────────────── CLIENTS ─────────────────────
const adminDb = createClient(SUPABASE_URL, SERVICE_KEY);   // service_role — bypasses RLS
const anonClient = createClient(SUPABASE_URL, ANON_KEY);   // for auth login

// ──────────────────────────────────────────── TRACKING ────────────────────
let passed = 0; let failed = 0;
const issues = [];
const createdSubjectIds = [];

function p(msg)   { console.log(`  ✅ ${msg}`); passed++; }
function f(msg, detail) {
  console.log(`  ❌ ${msg}`);
  if (detail) console.log(`     → ${String(detail).slice(0, 300)}`);
  failed++;
  issues.push({ msg, detail });
}
function sec(title) { console.log(`\n${'━'.repeat(60)}\n  ${title}\n${'━'.repeat(60)}`); }
function info(msg)  { console.log(`  ℹ️  ${msg}`); }

// ──────────────────────────────────────────── HTTP HELPER ─────────────────
async function api(path, opts = {}, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    headers['Cookie'] = buildCookie(token, opts._session);
  }
  const res = await fetch(`${DEV_URL}${path}`, {
    method: opts.method || 'GET',
    headers: { ...headers, ...(opts.headers || {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  let body;
  try   { body = await res.json(); }
  catch { body = await res.text().catch(() => null); }
  return { status: res.status, body };
}

function buildCookie(accessToken, session) {
  if (!session) return '';
  // Build the supabase SSR cookie format that next/server reads
  const sessionJson = JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
    user: session.user,
    token_type: 'bearer',
  });
  // The @supabase/ssr package reads from `sb-<ref>-auth-token` cookie
  const key = `sb-otmnfcuuqlbeowphxagf-auth-token`;
  const encoded = encodeURIComponent(sessionJson);
  return `${key}=${encoded}`;
}

// ──────────────────────────────────────────── INJECT FAKE PHOTOS ──────────
// Injects all required photo types for mark_complete to succeed.
// Customer receipt: serial_number, bill
// Brand/dealer invoice: serial_number, bill, job_sheet, defective_part, service_video
async function injectRequiredPhotos(subjectId, uploadedBy, billType = 'customer_receipt') {
  const baseTypes = ['machine', 'serial_number', 'bill'];
  const warrantyExtra = ['job_sheet', 'defective_part', 'service_video'];
  const types = billType === 'brand_dealer_invoice'
    ? [...baseTypes, ...warrantyExtra]
    : baseTypes;

  const rows = types.map((photo_type, i) => ({
    subject_id: subjectId,
    photo_type,
    storage_path: `test/fake-${subjectId}-${photo_type}.jpg`,
    public_url: 'https://picsum.photos/200',
    uploaded_by: uploadedBy,
    file_size_bytes: 50000,
    mime_type: 'image/jpeg',
  }));

  const { error } = await adminDb.from('subject_photos').insert(rows);
  if (error) throw new Error(`Fake photos inject failed: ${error.message}`);
}

// Legacy single-photo inject (kept for scenarios that don't need mark_complete)
async function injectFakePhoto(subjectId, uploadedBy) {
  const { data, error } = await adminDb
    .from('subject_photos')
    .insert({
      subject_id: subjectId,
      photo_type: 'machine',
      storage_path: `test/fake-${subjectId}.jpg`,
      public_url: 'https://picsum.photos/200',
      uploaded_by: uploadedBy,
      file_size_bytes: 50000,
      mime_type: 'image/jpeg',
    })
    .select('id')
    .single();
  if (error) throw new Error(`Fake photo inject failed: ${error.message}`);
  return data.id;
}

// ──────────────────────────────────────────── CREATE SUBJECT ──────────────
async function createSubject(adminUserId, technicianId, overrides = {}) {
  // Pick an existing brand if available, else use brand-less dealer approach
  const { data: brands } = await adminDb.from('brands').select('id,name').limit(1);
  const { data: cats }   = await adminDb.from('service_categories').select('id,name').limit(1);

  const brandId = brands?.[0]?.id ?? null;
  const catId   = cats?.[0]?.id ?? '';

  const subjectNum = `TEST-${Date.now()}`;

  const payload = {
    subject_number: subjectNum,
    source_type: brandId ? 'brand' : 'dealer',
    brand_id: brandId,
    dealer_id: null,
    assigned_technician_id: technicianId,
    priority: 'medium',
    priority_reason: 'Standard test service',
    allocated_date: TODAY,
    technician_allocated_date: TODAY,
    technician_allocated_notes: 'e2e test assignment',
    type_of_service: 'service',
    category_id: catId,
    customer_name: 'Test Customer',
    customer_phone: '9999999999',
    customer_address: 'Test Address, City',
    description: 'AC not cooling properly — e2e test complaint',
    product_name: 'Test Air Conditioner',
    serial_number: `SN-${Date.now()}`,
    product_description: 'e2e test product',
    purchase_date: '2023-01-01',
    warranty_end_date: overrides.warranty_end_date ?? '2030-12-31',
    is_warranty_service: overrides.is_warranty_service ?? false,
    is_amc_service: overrides.is_amc_service ?? false,
    service_charge_type: overrides.service_charge_type ?? 'customer',
    job_type: overrides.is_amc_service ? 'AMC' : (overrides.is_warranty_service ? 'IN_WARRANTY' : 'OUT_OF_WARRANTY'),
    status: 'ALLOCATED',
    technician_acceptance_status: 'pending',
    billing_status: 'not_applicable',
    created_by: adminUserId,
    assigned_by: adminUserId,
    ...overrides,
  };

  const { data, error } = await adminDb.from('subjects').insert(payload).select('id,subject_number').single();
  if (error) throw new Error(`Create subject failed: ${error.message}`);
  createdSubjectIds.push(data.id);
  return data;
}

// ──────────────────────────────────────────── DELETE SUBJECT (cleanup) ────
async function deleteSubject(subjectId) {
  // soft-delete
  await adminDb.from('subjects').update({ is_deleted: true }).eq('id', subjectId);
}

// ─────────────────────────────────────────────────────────────────────────
//  MAIN
// ─────────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n' + '═'.repeat(60));
  console.log('  HITECH SERVICE WORKFLOW — E2E TEST SUITE');
  console.log(`  Date: ${TODAY}`);
  console.log('  SuperAdmin: Varghesejoby2003@gmail.com');
  console.log('  Technician: ramu@gmail.com');
  console.log('═'.repeat(60));

  // ── AUTH ────────────────────────────────────────────────────────────────
  sec('PHASE 0 — Authentication');

  // SuperAdmin login
  info('Logging in as SuperAdmin...');
  const { data: adminAuth, error: adminAuthErr } = await anonClient.auth.signInWithPassword({
    email: ADMIN_EMAIL, password: ADMIN_PASS,
  });
  if (adminAuthErr || !adminAuth?.session) { f('SuperAdmin login', adminAuthErr?.message); process.exit(1); }
  const adminToken   = adminAuth.session.access_token;
  const adminSession = adminAuth.session;
  const adminUserId  = adminAuth.user.id;
  p(`SuperAdmin login — userId: ${adminUserId}`);

  // Ramu login
  info('Logging in as Technician Ramu...');
  const techClient = createClient(SUPABASE_URL, ANON_KEY);
  const { data: techAuth, error: techAuthErr } = await techClient.auth.signInWithPassword({
    email: TECH_EMAIL, password: TECH_PASS,
  });
  if (techAuthErr || !techAuth?.session) { f('Technician login', techAuthErr?.message); process.exit(1); }
  const techToken   = techAuth.session.access_token;
  const techSession = techAuth.session;
  const techUserId  = techAuth.user.id;
  p(`Technician login — userId: ${techUserId}`);

  // Verify Ramu's profile
  const { data: techProfile } = await adminDb.from('profiles').select('id,role,display_name,is_active').eq('id', techUserId).single();
  if (!techProfile) { f('Ramu profile not found in profiles table'); }
  else if (techProfile.role !== 'technician') { f(`Ramu role is '${techProfile.role}', expected 'technician'`); }
  else if (!techProfile.is_active) { f('Ramu is_active=false — blocked from assignments'); }
  else p(`Ramu profile verified — role: ${techProfile.role}, name: ${techProfile.display_name}`);

  // Verify Ramu's technician record (technicians.id is the auth user UUID)
  const { data: techRecord } = await adminDb.from('technicians').select('id,technician_code,is_active').eq('id', techUserId).maybeSingle();
  if (!techRecord) { f('Ramu has no record in technicians table — assignments may fail'); }
  else p(`Ramu technician record — code: ${techRecord.technician_code}, active: ${techRecord.is_active}`);

  // ─────────────────────────────────────────────────────────────────────────
  //  SCENARIO A — Full Happy Path
  //  ALLOCATED → accept → EN_ROUTE → ARRIVED → IN_PROGRESS
  //  → add 2 accessories → generate bill (with service charge) → complete
  // ─────────────────────────────────────────────────────────────────────────
  sec('SCENARIO A — Full Happy Path (accept → in_progress → accessories → bill → complete)');

  let subA;
  try {
    subA = await createSubject(adminUserId, techUserId, {
      warranty_end_date: '2025-01-01',  // expired warranty → customer pays
      is_warranty_service: false,
      is_amc_service: false,
      service_charge_type: 'customer',
    });
    p(`Created subject ${subA.subject_number} (id: ${subA.id})`);
  } catch (e) { f('Create subject A', e.message); return summary(); }

  // A1: Technician accepts
  info('A1: Technician accepts the assignment...');
  const r_accept = await api(`/api/subjects/${subA.id}/respond`, {
    method: 'POST',
    body: { action: 'accept', visit_date: TODAY, visit_time: '10:00' },
    _session: techSession,
  }, techToken);
  if (r_accept.body?.ok) p('A1: Accepted assignment');
  else f('A1: Accept assignment', JSON.stringify(r_accept.body?.error));

  // A2: Technician marks ARRIVED (EN_ROUTE removed from workflow — ACCEPTED → ARRIVED directly)
  info('A2: Technician marks ARRIVED...');
  const r_arrived = await api(`/api/subjects/${subA.id}/workflow`, {
    method: 'POST',
    body: { action: 'update_status', status: 'ARRIVED' },
    _session: techSession,
  }, techToken);
  if (r_arrived.body?.ok) p('A2: Status → ARRIVED');
  else f('A2: ARRIVED', JSON.stringify(r_arrived.body?.error));

  // A3: In Progress
  info('A3: Technician starts work (IN_PROGRESS)...');
  const r_inprog = await api(`/api/subjects/${subA.id}/workflow`, {
    method: 'POST',
    body: { action: 'update_status', status: 'IN_PROGRESS' },
    _session: techSession,
  }, techToken);
  if (r_inprog.body?.ok) p('A3: Status → IN_PROGRESS');
  else f('A3: IN_PROGRESS', JSON.stringify(r_inprog.body?.error));

  // A4: Add accessories
  info('A4: Adding accessories (manual parts)...');
  const r_acc1 = await api(`/api/subjects/${subA.id}/billing`, {
    method: 'POST',
    body: { action: 'add_accessory', item_name: 'Filter Replacement', quantity: 2, unit_price: 450 },
    _session: techSession,
  }, techToken);
  if (r_acc1.body?.ok) p(`A4a: Accessory added — ${r_acc1.body.data?.item_name}`);
  else f('A4a: Add accessory 1', JSON.stringify(r_acc1.body?.error));

  const r_acc2 = await api(`/api/subjects/${subA.id}/billing`, {
    method: 'POST',
    body: { action: 'add_accessory', item_name: 'Gas Refill', quantity: 1, unit_price: 1800 },
    _session: techSession,
  }, techToken);
  if (r_acc2.body?.ok) p(`A4b: Accessory added — ${r_acc2.body.data?.item_name}`);
  else f('A4b: Add accessory 2', JSON.stringify(r_acc2.body?.error));

  // A5: Inject all required photos (machine + serial_number + bill for customer_receipt)
  info('A5: Injecting required photo records (machine, serial_number, bill)...');
  try {
    await injectRequiredPhotos(subA.id, techUserId, 'customer_receipt');
    p('A5: Required photos injected (machine, serial_number, bill)');
  } catch (e) { f('A5: Inject photos', e.message); }

  // A6: Generate bill (with service charge + no GST, cash payment)
  info('A6: Generating bill (visit: ₹200, service: ₹500, no GST, cash)...');
  const r_bill = await api(`/api/subjects/${subA.id}/billing`, {
    method: 'POST',
    body: {
      action: 'generate_bill',
      visit_charge: 200,
      service_charge: 500,
      apply_gst: false,
      payment_mode: 'cash',
    },
    _session: techSession,
  }, techToken);
  if (r_bill.body?.ok) {
    const d = r_bill.body.data;
    p(`A6: Bill generated — #${d?.bill_number}, grand_total: ₹${d?.grand_total ?? '?'}`);
  } else {
    f('A6: Generate bill', JSON.stringify(r_bill.body?.error));
  }

  // A7: Mark complete
  info('A7: Marking job as COMPLETE...');
  const r_complete = await api(`/api/subjects/${subA.id}/workflow`, {
    method: 'POST',
    body: { action: 'mark_complete', notes: 'Service completed successfully. AC is working.' },
    _session: techSession,
  }, techToken);
  if (r_complete.body?.ok) p('A7: Job marked COMPLETE ✓✓✓');
  else f('A7: Mark complete', JSON.stringify(r_complete.body?.error));

  // ─────────────────────────────────────────────────────────────────────────
  //  SCENARIO B — No Service Charge (AMC/warranty — bill goes to brand/dealer)
  // ─────────────────────────────────────────────────────────────────────────
  sec('SCENARIO B — No Service Charge / AMC (bill to brand, ₹0 from customer)');

  let subB;
  try {
    subB = await createSubject(adminUserId, techUserId, {
      warranty_end_date: '2030-12-31',  // active warranty
      is_warranty_service: true,
      is_amc_service: false,
      service_charge_type: 'brand_dealer',
    });
    p(`Created subject ${subB.subject_number} (id: ${subB.id})`);
  } catch (e) { f('Create subject B', e.message); return summary(); }

  // Quick path: accept → EN_ROUTE → ARRIVED → IN_PROGRESS
  for (const [label, body] of [
    ['B1: Accept', { action: 'accept', visit_date: TODAY, visit_time: '11:00' }],
  ]) {
    const r = await api(`/api/subjects/${subB.id}/respond`, { method: 'POST', body, _session: techSession }, techToken);
    if (r.body?.ok) p(label);
    else f(label, JSON.stringify(r.body?.error));
  }

  // EN_ROUTE removed — ACCEPTED → ARRIVED directly
  for (const [label, status] of [['B2: ARRIVED', 'ARRIVED'], ['B3: IN_PROGRESS', 'IN_PROGRESS']]) {
    const r = await api(`/api/subjects/${subB.id}/workflow`, {
      method: 'POST', body: { action: 'update_status', status }, _session: techSession,
    }, techToken);
    if (r.body?.ok) p(label);
    else f(label, JSON.stringify(r.body?.error));
  }

  // Inject all required photos for brand_dealer_invoice (serial_number, bill, job_sheet, defective_part, service_video)
  try { await injectRequiredPhotos(subB.id, techUserId, 'brand_dealer_invoice'); p('B4: Required photos injected (all 6 types)'); }
  catch (e) { f('B4: Inject photos', e.message); }

  // Generate bill — ₹0 customer charges (brand pays under warranty)
  info('B5: Generating warranty bill (₹0 customer charge, brand invoice)...');
  const r_billB = await api(`/api/subjects/${subB.id}/billing`, {
    method: 'POST',
    body: {
      action: 'generate_bill',
      visit_charge: 0,
      service_charge: 0,
      apply_gst: false,
      payment_mode: null,
    },
    _session: techSession,
  }, techToken);
  if (r_billB.body?.ok) {
    const d = r_billB.body.data;
    p(`B5: Warranty bill generated — #${d?.bill_number}, type: ${d?.bill_type}, grand_total: ₹${d?.grand_total ?? 0}`);
  } else {
    f('B5: Generate warranty bill', JSON.stringify(r_billB.body?.error));
  }

  // Mark complete
  const r_completeB = await api(`/api/subjects/${subB.id}/workflow`, {
    method: 'POST',
    body: { action: 'mark_complete', notes: 'Warranty service done.' },
    _session: techSession,
  }, techToken);
  if (r_completeB.body?.ok) p('B6: Warranty job COMPLETE ✓✓✓');
  else f('B6: Mark complete B', JSON.stringify(r_completeB.body?.error));

  // ─────────────────────────────────────────────────────────────────────────
  //  SCENARIO C — Technician Rejects Assignment
  // ─────────────────────────────────────────────────────────────────────────
  sec('SCENARIO C — Technician Rejects Assignment → RESCHEDULED');

  let subC;
  try {
    subC = await createSubject(adminUserId, techUserId, { warranty_end_date: '2030-12-31' });
    p(`Created subject ${subC.subject_number} (id: ${subC.id})`);
  } catch (e) { f('Create subject C', e.message); return summary(); }

  info('C1: Technician rejects assignment (door locked scenario)...');
  const r_reject = await api(`/api/subjects/${subC.id}/respond`, {
    method: 'POST',
    body: { action: 'reject', rejection_reason: 'Customer not reachable and door was locked' },
    _session: techSession,
  }, techToken);
  if (r_reject.body?.ok) p('C1: Assignment rejected → status: RESCHEDULED');
  else f('C1: Reject assignment', JSON.stringify(r_reject.body?.error));

  // Verify state in DB
  const { data: subCDb } = await adminDb.from('subjects').select('status,technician_acceptance_status,is_rejected_pending_reschedule').eq('id', subC.id).single();
  if (subCDb) {
    if (subCDb.status === 'RESCHEDULED') p(`C2: DB status = RESCHEDULED ✓`);
    else f(`C2: Expected RESCHEDULED, got ${subCDb.status}`);
    if (subCDb.is_rejected_pending_reschedule) p('C3: is_rejected_pending_reschedule = true ✓');
    else f('C3: is_rejected_pending_reschedule should be true');
  }

  info('C4: Trying to reject again (should fail — already rejected)...');
  const r_reject2 = await api(`/api/subjects/${subC.id}/respond`, {
    method: 'POST',
    body: { action: 'reject', rejection_reason: 'Trying again — should fail' },
    _session: techSession,
  }, techToken);
  if (!r_reject2.body?.ok) p(`C4: Double-reject correctly blocked — ${r_reject2.body?.error?.message}`);
  else f('C4: Double-reject should have been blocked but succeeded');

  // ─────────────────────────────────────────────────────────────────────────
  //  SCENARIO D — Mark Incomplete (spare parts not available)
  // ─────────────────────────────────────────────────────────────────────────
  sec('SCENARIO D — Mark Incomplete (spare parts not available → INCOMPLETE)');

  let subD;
  try {
    subD = await createSubject(adminUserId, techUserId, { warranty_end_date: '2025-06-01' });
    p(`Created subject ${subD.subject_number} (id: ${subD.id})`);
  } catch (e) { f('Create subject D', e.message); return summary(); }

  // accept → ARRIVED → IN_PROGRESS (EN_ROUTE removed from workflow)
  await api(`/api/subjects/${subD.id}/respond`, { method: 'POST', body: { action: 'accept', visit_date: TODAY, visit_time: '14:00' }, _session: techSession }, techToken);
  for (const status of ['ARRIVED', 'IN_PROGRESS']) {
    const r = await api(`/api/subjects/${subD.id}/workflow`, { method: 'POST', body: { action: 'update_status', status }, _session: techSession }, techToken);
    if (!r.body?.ok) { f(`D: ${status}`, JSON.stringify(r.body?.error)); }
  }
  p('D1: Accept → EN_ROUTE → ARRIVED → IN_PROGRESS done');

  // Mark incomplete — spare parts not available
  info('D2: Marking job INCOMPLETE (spare_parts_not_available)...');
  const r_incomplete = await api(`/api/subjects/${subD.id}/workflow`, {
    method: 'POST',
    body: {
      action: 'mark_incomplete',
      reason: 'spare_parts_not_available',
      note: 'Compressor board needs replacement — not in stock.',
      sparePartsRequested: 'Compressor Board PCB Model XR-202',
      sparePartsQuantity: 1,
      rescheduledDate: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
    },
    _session: techSession,
  }, techToken);
  if (r_incomplete.body?.ok) p('D2: Job marked INCOMPLETE (spare_parts_not_available) ✓');
  else f('D2: Mark incomplete', JSON.stringify(r_incomplete.body?.error));

  // Verify state
  const { data: subDDb } = await adminDb.from('subjects').select('status,incomplete_reason,spare_parts_requested').eq('id', subD.id).single();
  if (subDDb) {
    if (subDDb.status === 'INCOMPLETE') p(`D3: DB status = INCOMPLETE ✓`);
    else f(`D3: Expected INCOMPLETE, got ${subDDb.status}`);
    p(`D4: incomplete_reason = ${subDDb.incomplete_reason}, parts = ${subDDb.spare_parts_requested}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  SCENARIO E — Cancel Service (Admin deletes / soft-deletes subject)
  // ─────────────────────────────────────────────────────────────────────────
  sec('SCENARIO E — Cancel Service (SuperAdmin deletes subject while ALLOCATED)');

  let subE;
  try {
    subE = await createSubject(adminUserId, techUserId, { warranty_end_date: '2030-12-31' });
    p(`Created subject ${subE.subject_number} (id: ${subE.id})`);
  } catch (e) { f('Create subject E', e.message); return summary(); }

  // Admin deletes the subject
  info('E1: SuperAdmin cancels/deletes the subject...');
  const { error: delErr } = await adminDb
    .from('subjects')
    .update({ is_deleted: true })
    .eq('id', subE.id);
  if (!delErr) p('E1: Subject soft-deleted by admin (cancelled)');
  else f('E1: Delete failed', delErr.message);

  // Verify technician cannot access it
  info('E2: Verifying technician cannot perform workflow on cancelled subject...');
  const r_cancelled = await api(`/api/subjects/${subE.id}/workflow`, {
    method: 'POST',
    body: { action: 'update_status', status: 'EN_ROUTE' },
    _session: techSession,
  }, techToken);
  if (!r_cancelled.body?.ok) p(`E2: Workflow on cancelled subject blocked — ${r_cancelled.body?.error?.code}`);
  else f('E2: Workflow on cancelled subject should have been blocked');

  // ─────────────────────────────────────────────────────────────────────────
  //  SCENARIO F — Generate Bill WITHOUT Service Charge (GST included)
  // ─────────────────────────────────────────────────────────────────────────
  sec('SCENARIO F — Bill with GST (visit charge only, 18% GST)');

  let subF;
  try {
    subF = await createSubject(adminUserId, techUserId, {
      warranty_end_date: '2025-01-01',  // expired
      service_charge_type: 'customer',
    });
    p(`Created subject ${subF.subject_number} (id: ${subF.id})`);
  } catch (e) { f('Create subject F', e.message); return summary(); }

  // Fast-forward to IN_PROGRESS via DB
  await adminDb.from('subjects').update({ status: 'IN_PROGRESS', technician_acceptance_status: 'accepted' }).eq('id', subF.id);
  p('F1: Fast-forwarded to IN_PROGRESS via DB');

  // Inject required photos for customer_receipt (machine, serial_number, bill)
  try { await injectRequiredPhotos(subF.id, techUserId, 'customer_receipt'); p('F2: Required photos injected (machine, serial_number, bill)'); }
  catch (e) { f('F2: Inject photos', e.message); }

  // Generate bill — visit charge ₹300 only, with 18% GST
  info('F3: Generate bill — visit: ₹300, service: ₹0, GST 18%, UPI payment...');
  const r_billF = await api(`/api/subjects/${subF.id}/billing`, {
    method: 'POST',
    body: {
      action: 'generate_bill',
      visit_charge: 300,
      service_charge: 0,
      apply_gst: true,
      payment_mode: 'upi',
    },
    _session: techSession,
  }, techToken);
  if (r_billF.body?.ok) {
    const d = r_billF.body.data;
    const expected = (300 * 1.18).toFixed(2);
    p(`F3: Bill with GST — #${d?.bill_number}, grand_total: ₹${d?.grand_total} (expected ~₹${expected})`);
  } else {
    f('F3: Generate bill with GST', JSON.stringify(r_billF.body?.error));
  }

  const r_completeF = await api(`/api/subjects/${subF.id}/workflow`, {
    method: 'POST',
    body: { action: 'mark_complete' },
    _session: techSession,
  }, techToken);
  if (r_completeF.body?.ok) p('F4: Job COMPLETE ✓');
  else f('F4: Mark complete F', JSON.stringify(r_completeF.body?.error));

  // ─────────────────────────────────────────────────────────────────────────
  //  SCENARIO G — Edge Cases / Validation Errors
  // ─────────────────────────────────────────────────────────────────────────
  sec('SCENARIO G — Edge Cases & Validation');

  let subG;
  try {
    subG = await createSubject(adminUserId, techUserId, { warranty_end_date: '2030-12-31' });
    p(`Created subject ${subG.subject_number} (id: ${subG.id})`);
  } catch (e) { f('Create subject G', e.message); return summary(); }

  // G1: Reject without reason (should fail)
  info('G1: Reject without reason (should fail)...');
  const r_rej_no_reason = await api(`/api/subjects/${subG.id}/respond`, {
    method: 'POST', body: { action: 'reject', rejection_reason: '' }, _session: techSession,
  }, techToken);
  if (!r_rej_no_reason.body?.ok) p(`G1: Reject without reason blocked ✓ — ${r_rej_no_reason.body?.error?.message}`);
  else f('G1: Should have required reason');

  // G2: Try to add accessory when NOT in_progress
  info('G2: Add accessory when status=ALLOCATED (should fail)...');
  const r_acc_bad = await api(`/api/subjects/${subG.id}/billing`, {
    method: 'POST',
    body: { action: 'add_accessory', item_name: 'Wrong Part', quantity: 1, unit_price: 100 },
    _session: techSession,
  }, techToken);
  if (!r_acc_bad.body?.ok) p(`G2: Accessory when not IN_PROGRESS blocked ✓ — ${r_acc_bad.body?.error?.code}`);
  else f('G2: Should have blocked accessory add when ALLOCATED');

  // G3: Accept then try to accept again
  info('G3: Accept subject...');
  await api(`/api/subjects/${subG.id}/respond`, {
    method: 'POST', body: { action: 'accept', visit_date: TODAY, visit_time: '15:00' }, _session: techSession,
  }, techToken);

  info('G4: Try to accept again (should fail — already accepted)...');
  const r_double_accept = await api(`/api/subjects/${subG.id}/respond`, {
    method: 'POST', body: { action: 'accept', visit_date: TODAY, visit_time: '16:00' }, _session: techSession,
  }, techToken);
  if (!r_double_accept.body?.ok) p(`G4: Double-accept blocked ✓ — ${r_double_accept.body?.error?.message}`);
  else f('G4: Double-accept should have been blocked');

  // G5: Skip ahead - try mark_complete without bill (should fail)
  info('G5: Try mark_complete without IN_PROGRESS or bill...');
  // Fast-forward to IN_PROGRESS
  await adminDb.from('subjects').update({ status: 'IN_PROGRESS' }).eq('id', subG.id);
  const r_complete_no_bill = await api(`/api/subjects/${subG.id}/workflow`, {
    method: 'POST', body: { action: 'mark_complete' }, _session: techSession,
  }, techToken);
  if (!r_complete_no_bill.body?.ok) p(`G5: Complete without bill/photo blocked ✓ — ${r_complete_no_bill.body?.error?.code}`);
  else f('G5: Complete without bill should have failed');

  // G6: Wrong technician — create a subject assigned to someone else
  info('G6: Wrong technician access attempt...');
  const { data: anotherSub } = await adminDb.from('subjects').insert({
    subject_number: `TEST-OTHER-${Date.now()}`,
    source_type: 'brand',
    brand_id: null,
    priority: 'low',
    priority_reason: 'other tech test',
    allocated_date: TODAY,
    technician_allocated_date: TODAY,
    type_of_service: 'service',
    category_id: '',
    customer_name: 'Other Customer',
    assigned_technician_id: adminUserId,  // assigned to admin, not Ramu
    job_type: 'OUT_OF_WARRANTY',
    status: 'ALLOCATED',
    technician_acceptance_status: 'pending',
    billing_status: 'not_applicable',
    is_warranty_service: false,
    is_amc_service: false,
    service_charge_type: 'customer',
    warranty_end_date: '2030-01-01',
    created_by: adminUserId,
    assigned_by: adminUserId,
  }).select('id').single();

  if (anotherSub) {
    createdSubjectIds.push(anotherSub.id);
    const r_wrong_tech = await api(`/api/subjects/${anotherSub.id}/workflow`, {
      method: 'POST', body: { action: 'update_status', status: 'EN_ROUTE' }, _session: techSession,
    }, techToken);
    if (!r_wrong_tech.body?.ok) p(`G6: Wrong technician blocked ✓ — ${r_wrong_tech.body?.error?.code}`);
    else f('G6: Wrong technician access should have been blocked');
    await adminDb.from('subjects').update({ is_deleted: true }).eq('id', anotherSub.id);
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  CLEANUP
  // ─────────────────────────────────────────────────────────────────────────
  sec('CLEANUP — Soft-deleting all test subjects');
  for (const id of createdSubjectIds) {
    const { error: cleanErr } = await adminDb.from('subjects').update({ is_deleted: true }).eq('id', id);
    if (!cleanErr) info(`Cleaned up: ${id}`);
    else info(`⚠️  Cleanup failed for ${id}: ${cleanErr.message}`);
  }

  return summary();
}

function summary() {
  sec('FINAL SUMMARY');
  console.log(`  Total:  ${passed + failed}`);
  console.log(`  ✅ Passed: ${passed}`);
  console.log(`  ❌ Failed: ${failed}`);
  if (issues.length > 0) {
    console.log('\n  ISSUES FOUND:');
    issues.forEach((item, i) => {
      console.log(`  ${i + 1}. ❌ ${item.msg}`);
      if (item.detail) console.log(`     → ${String(item.detail).slice(0, 400)}`);
    });
  } else {
    console.log('\n  🎉 All scenarios passed with no issues!');
  }
  console.log('');
}

main().catch((err) => {
  console.error('\n💥 FATAL ERROR:', err.message);
  process.exit(1);
});
