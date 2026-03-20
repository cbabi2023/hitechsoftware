import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: subjectId } = await params;

  if (!subjectId) {
    return NextResponse.json({ ok: false, error: { message: 'Subject ID is required' } }, { status: 400 });
  }

  const supabase = await createServerClient();
  const authState = await supabase.auth.getUser();

  if (authState.error || !authState.data.user) {
    return NextResponse.json({ ok: false, error: { message: 'Unauthorized' } }, { status: 401 });
  }

  const userId = authState.data.user.id;

  const profileResult = await supabase
    .from('profiles')
    .select('id,role')
    .eq('id', userId)
    .maybeSingle<{ id: string; role: string }>();

  if (profileResult.error || !profileResult.data || profileResult.data.role !== 'technician') {
    return NextResponse.json({ ok: false, error: { message: 'Only technicians can respond to subjects' } }, { status: 403 });
  }

  let body: { action?: string; rejection_reason?: string; visit_date?: string; visit_time?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: { message: 'Invalid JSON body' } }, { status: 400 });
  }

  const { action, rejection_reason, visit_date, visit_time } = body;

  if (action !== 'accept' && action !== 'reject') {
    return NextResponse.json({ ok: false, error: { message: 'action must be "accept" or "reject"' } }, { status: 400 });
  }

  if (action === 'reject' && (!rejection_reason || rejection_reason.trim().length === 0)) {
    return NextResponse.json({ ok: false, error: { message: 'A rejection reason is required' } }, { status: 400 });
  }

  if (action === 'accept') {
    if (!visit_date || !visit_time) {
      return NextResponse.json({ ok: false, error: { message: 'Visit date and time are required when accepting' } }, { status: 400 });
    }
  }

  const admin = createAdminClient();

  // Verify the subject is assigned to this technician and is in ALLOCATED status
  const subjectCheck = await admin
    .from('subjects')
    .select('id,status,assigned_technician_id,technician_acceptance_status,technician_allocated_notes')
    .eq('id', subjectId)
    .eq('is_deleted', false)
    .maybeSingle<{
      id: string;
      status: string;
      assigned_technician_id: string | null;
      technician_acceptance_status: string;
      technician_allocated_notes: string | null;
    }>();

  if (subjectCheck.error || !subjectCheck.data) {
    return NextResponse.json({ ok: false, error: { message: 'Subject not found' } }, { status: 404 });
  }

  const subject = subjectCheck.data;

  if (subject.assigned_technician_id !== userId) {
    return NextResponse.json({ ok: false, error: { message: 'This subject is not assigned to you' } }, { status: 403 });
  }

  if (subject.technician_acceptance_status !== 'pending') {
    return NextResponse.json({
      ok: false,
      error: { message: `Subject has already been ${subject.technician_acceptance_status}` },
    }, { status: 409 });
  }

  if (action === 'accept') {
    const existingNotes = subject.technician_allocated_notes?.trim() ?? '';
    const visitTimeNote = `Visit Time: ${visit_time}`;

    const updateResult = await admin
      .from('subjects')
      .update({
        technician_acceptance_status: 'accepted',
        status: 'ACCEPTED',
        technician_allocated_date: visit_date,
        technician_allocated_notes: existingNotes
          ? `${existingNotes} | ${visitTimeNote}`
          : visitTimeNote,
      })
      .eq('id', subjectId)
      .select('id,status,technician_acceptance_status,technician_allocated_date,technician_allocated_notes')
      .single();

    if (updateResult.error) {
      return NextResponse.json({ ok: false, error: { message: updateResult.error.message } }, { status: 500 });
    }

    return NextResponse.json({ ok: true, data: { action: 'accepted', subject: updateResult.data } });
  }

  // action === 'reject'
  const updateResult = await admin
    .from('subjects')
    .update({
      status: 'RESCHEDULED',
      technician_acceptance_status: 'rejected',
      technician_rejection_reason: rejection_reason!.trim(),
      rejected_by_technician_id: userId,
      is_rejected_pending_reschedule: true,
    })
    .eq('id', subjectId)
    .select('id,status,technician_acceptance_status,technician_rejection_reason')
    .single();

  if (updateResult.error) {
    return NextResponse.json({ ok: false, error: { message: updateResult.error.message } }, { status: 500 });
  }

  // Increment the technician's total_rejections counter
  await admin.rpc('increment_technician_rejections', { p_technician_id: userId });

  return NextResponse.json({ ok: true, data: { action: 'rejected', subject: updateResult.data } });
}
