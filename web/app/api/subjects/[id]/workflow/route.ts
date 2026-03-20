import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import {
  updateJobStatus,
  markJobIncomplete,
  markJobComplete,
} from '@/modules/subjects/subject.job-workflow';
import type { IncompleteJobInput, IncompleteReason } from '@/modules/subjects/subject.types';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: subjectId } = await params;

  if (!subjectId) {
    return NextResponse.json(
      { ok: false, error: { message: 'Subject ID is required' } },
      { status: 400 },
    );
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
    return NextResponse.json(
      { ok: false, error: { message: 'Only technicians can update job workflow' } },
      { status: 403 },
    );
  }

  let body: {
    action?: string;
    status?: string;
    reason?: string;
    note?: string;
    sparePartsRequested?: string;
    sparePartsQuantity?: number;
    sparePartsItems?: Array<{ name: string; quantity: number; price: number }>;
    rescheduledDate?: string;
    notes?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: { message: 'Invalid JSON body' } },
      { status: 400 },
    );
  }

  const { action } = body;

  // ── update_status: ARRIVED | IN_PROGRESS | AWAITING_PARTS ────────────────
  if (action === 'update_status') {
    const { status } = body;
    if (!status) {
      return NextResponse.json(
        { ok: false, error: { message: 'status is required' } },
        { status: 400 },
      );
    }

    const result = await updateJobStatus(subjectId, userId, status);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true, data: result.data });
  }

  // ── mark_incomplete ────────────────────────────────────────────────────────
  if (action === 'mark_incomplete') {
    const input: IncompleteJobInput = {
      reason: (body.reason ?? '') as IncompleteReason,
      note: body.note ?? '',
      sparePartsRequested: body.sparePartsRequested,
      sparePartsQuantity: body.sparePartsQuantity,
      sparePartsItems: body.sparePartsItems,
      rescheduledDate: body.rescheduledDate,
    };

    const result = await markJobIncomplete(subjectId, userId, input);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true, data: result.data });
  }

  // ── mark_complete ──────────────────────────────────────────────────────────
  if (action === 'mark_complete') {
    const result = await markJobComplete(subjectId, userId, body.notes);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true, data: result.data });
  }

  return NextResponse.json(
    { ok: false, error: { message: `Unknown action: ${action ?? '(none)'}` } },
    { status: 400 },
  );
}
