import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

interface ErrorResponse {
  step: string;
  code: string;
  message: string;
  userMessage: string;
  details?: Record<string, unknown>;
}

const isDev = process.env.NODE_ENV === 'development';
const STORAGE_BUCKET = 'subject-photos';

export async function DELETE(
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

  const supabase = await createServerClient();
  const authState = await supabase.auth.getUser();

  if (authState.error || !authState.data.user) {
    const error: ErrorResponse = {
      step: '2. Authenticate User',
      code: 'UNAUTHORIZED',
      message: authState.error?.message ?? 'No authenticated user found',
      userMessage: 'You must be logged in to remove uploads',
    };
    return NextResponse.json({ ok: false, error }, { status: 401 });
  }

  const userId = authState.data.user.id;

  const body = await request.json().catch(() => null) as {
    photoId?: string;
    storagePath?: string;
  } | null;

  if (!body?.photoId || !body.storagePath) {
    const error: ErrorResponse = {
      step: '3. Validate Request',
      code: 'MISSING_FIELDS',
      message: 'photoId and storagePath are required',
      userMessage: 'Missing photo removal details',
    };
    return NextResponse.json({ ok: false, error }, { status: 400 });
  }

  const admin = await createAdminClient();

  const profileResult = await admin
    .from('profiles')
    .select('id,role')
    .eq('id', userId)
    .maybeSingle<{ id: string; role: string }>();

  if (profileResult.error || !profileResult.data) {
    const error: ErrorResponse = {
      step: '4. Load Profile',
      code: 'PROFILE_NOT_FOUND',
      message: profileResult.error?.message ?? 'Profile missing',
      userMessage: 'Your profile could not be loaded',
      details: isDev ? { dbError: profileResult.error?.message } : undefined,
    };
    return NextResponse.json({ ok: false, error }, { status: 400 });
  }

  const subjectResult = await admin
    .from('subjects')
    .select('id,assigned_technician_id,status')
    .eq('id', subjectId)
    .eq('is_deleted', false)
    .maybeSingle<{ id: string; assigned_technician_id: string | null; status: string }>();

  if (subjectResult.error || !subjectResult.data) {
    const error: ErrorResponse = {
      step: '5. Load Subject',
      code: 'SUBJECT_NOT_FOUND',
      message: subjectResult.error?.message ?? 'Subject missing',
      userMessage: 'Subject not found',
      details: isDev ? { dbError: subjectResult.error?.message } : undefined,
    };
    return NextResponse.json({ ok: false, error }, { status: 404 });
  }

  const isOwnerTechnician = subjectResult.data.assigned_technician_id === userId;
  const isPrivileged = profileResult.data.role === 'super_admin' || profileResult.data.role === 'office_staff';

  if (!isOwnerTechnician && !isPrivileged) {
    const error: ErrorResponse = {
      step: '5. Verify Access',
      code: 'ACCESS_DENIED',
      message: 'Not allowed to remove this upload',
      userMessage: 'You can only remove uploads for your assigned subject',
    };
    return NextResponse.json({ ok: false, error }, { status: 403 });
  }

  const photoUpdate = await admin
    .from('subject_photos')
    .update({ is_deleted: true })
    .eq('id', body.photoId)
    .eq('subject_id', subjectId)
    .select('id')
    .single();

  if (photoUpdate.error) {
    const error: ErrorResponse = {
      step: '6. Delete Photo Record',
      code: 'PHOTO_DELETE_FAILED',
      message: photoUpdate.error.message,
      userMessage: 'Could not remove uploaded photo',
      details: isDev ? { dbError: photoUpdate.error.message } : undefined,
    };
    return NextResponse.json({ ok: false, error }, { status: 400 });
  }

  await admin.storage.from(STORAGE_BUCKET).remove([body.storagePath]);

  return NextResponse.json({ ok: true, data: { id: photoUpdate.data.id } });
}
