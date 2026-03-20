import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const STORAGE_BUCKET = 'subject-photos';
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_PHOTOS_PER_SUBJECT = 12; // Max 12 photos/videos per subject
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime'] as const;

interface ErrorResponse {
  step: string;
  code: string;
  message: string;
  userMessage: string;
  details?: Record<string, unknown>;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: subjectId } = await params;
  const timestamp = new Date().toISOString();

  console.log(`[${timestamp}] ✓ Photo upload API: Starting for subject ${subjectId}`);

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
      userMessage: 'You must be logged in to upload photos',
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
      step: '3. Load Technician Profile',
      code: 'PROFILE_NOT_FOUND',
      message: 'User profile missing',
      userMessage: 'Your profile could not be found. Please log out and log back in.',
    };
    console.log(`[${timestamp}] ✗ Step 3 failed:`, error.code);
    return NextResponse.json({ ok: false, error }, { status: 400 });
  }

  if (profileResult.data.role !== 'technician') {
    const error: ErrorResponse = {
      step: '3. Verify Technician Role',
      code: 'INVALID_ROLE',
      message: `User role is '${profileResult.data.role}', expected 'technician'`,
      userMessage: 'Only technicians can upload photos',
    };
    console.log(`[${timestamp}] ✗ Step 3 failed:`, error.code);
    return NextResponse.json({ ok: false, error }, { status: 403 });
  }

  console.log(`[${timestamp}] ✓ Step 3 passed: User is technician`);

  // ──────────────────────────────────────────────────────────────────────────
  // Step 4: Parse FormData and get file + photoType
  // ──────────────────────────────────────────────────────────────────────────
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (err) {
    const error: ErrorResponse = {
      step: '4. Parse Request',
      code: 'INVALID_FORM_DATA',
      message: err instanceof Error ? err.message : 'Failed to parse form data',
      userMessage: 'Request format is invalid',
    };
    console.log(`[${timestamp}] ✗ Step 4 failed:`, error.code);
    return NextResponse.json({ ok: false, error }, { status: 400 });
  }

  const file = formData.get('file') as File | null;
  const photoType = formData.get('photoType') as string | null;

  if (!file) {
    const error: ErrorResponse = {
      step: '4. Parse Request',
      code: 'MISSING_FILE',
      message: 'file is required',
      userMessage: 'No file was selected',
    };
    console.log(`[${timestamp}] ✗ Step 4 failed:`, error.code);
    return NextResponse.json({ ok: false, error }, { status: 400 });
  }

  if (!photoType) {
    const error: ErrorResponse = {
      step: '4. Parse Request',
      code: 'MISSING_PHOTO_TYPE',
      message: 'photoType is required',
      userMessage: 'Photo type must be specified',
    };
    console.log(`[${timestamp}] ✗ Step 4 failed:`, error.code);
    return NextResponse.json({ ok: false, error }, { status: 400 });
  }

  console.log(`[${timestamp}] ✓ Step 4 passed: File and photoType received`);

  // ──────────────────────────────────────────────────────────────────────────
  // Step 5: Verify subject exists and technician is assigned
  // ──────────────────────────────────────────────────────────────────────────
  const admin = await createAdminClient();
  const subjectCheckResult = await admin
    .from('subjects')
    .select('id,assigned_technician_id,status')
    .eq('id', subjectId)
    .eq('is_deleted', false)
    .maybeSingle<{ id: string; assigned_technician_id: string | null; status: string }>();

  if (subjectCheckResult.error || !subjectCheckResult.data) {
    const error: ErrorResponse = {
      step: '5. Load Subject',
      code: 'SUBJECT_NOT_FOUND',
      message: `Subject ${subjectId} not found`,
      userMessage: 'This subject could not be found',
    };
    console.log(`[${timestamp}] ✗ Step 5 failed:`, error.code);
    return NextResponse.json({ ok: false, error }, { status: 404 });
  }

  const subject = subjectCheckResult.data;

  if (subject.assigned_technician_id !== userId) {
    const error: ErrorResponse = {
      step: '5. Verify Assignment',
      code: 'NOT_ASSIGNED_TO_SUBJECT',
      message: `You are not assigned to subject ${subjectId}`,
      userMessage: 'You can only upload photos for subjects assigned to you',
    };
    console.log(`[${timestamp}] ✗ Step 5 failed:`, error.code);
    return NextResponse.json({ ok: false, error }, { status: 403 });
  }

  console.log(`[${timestamp}] ✓ Step 5 passed: Subject verified`);

  // ──────────────────────────────────────────────────────────────────────────
  // Step 6: Validate file type and size
  // ──────────────────────────────────────────────────────────────────────────
  const isVideo = photoType === 'service_video';
  const isAllowedVideo = ALLOWED_VIDEO_TYPES.includes(file.type as (typeof ALLOWED_VIDEO_TYPES)[number]);
  const isAllowedImage = file.type.startsWith('image/');

  if ((isVideo && !isAllowedVideo) || (!isVideo && !isAllowedImage)) {
    const error: ErrorResponse = {
      step: '6. Validate File Type',
      code: 'INVALID_FILE_TYPE',
      message: `Received '${file.type || 'unknown'}' for ${isVideo ? 'video' : 'image'} upload`,
      userMessage: isVideo
        ? 'Invalid video format. Use MP4 or MOV.'
        : 'Invalid image file. Please upload an image.',
    };
    console.log(`[${timestamp}] ✗ Step 6 failed:`, error.code);
    return NextResponse.json({ ok: false, error }, { status: 400 });
  }

  const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
  const maxSizeLabel = isVideo ? '50MB' : '10MB';

  if (file.size > maxSize) {
    const error: ErrorResponse = {
      step: '6. Validate File Size',
      code: 'FILE_TOO_LARGE',
      message: `File is ${Math.round(file.size / 1024 / 1024)}MB, max ${maxSizeLabel}`,
      userMessage: `File is too large. Maximum size is ${maxSizeLabel}`,
    };
    console.log(`[${timestamp}] ✗ Step 6 failed:`, error.code);
    return NextResponse.json({ ok: false, error }, { status: 400 });
  }

  console.log(`[${timestamp}] ✓ Step 6 passed: File size valid (${Math.round(file.size / 1024)}KB)`);

  // ──────────────────────────────────────────────────────────────────────────
  // Step 7: Check current photo count
  // ──────────────────────────────────────────────────────────────────────────
  const photosCheckResult = await admin
    .from('subject_photos')
    .select('id,photo_type', { count: 'exact' })
    .eq('subject_id', subjectId)
    .eq('is_deleted', false);

  if (photosCheckResult.error) {
    const error: ErrorResponse = {
      step: '7. Check Photo Count',
      code: 'PHOTO_COUNT_CHECK_FAILED',
      message: photosCheckResult.error.message,
      userMessage: 'Failed to check photo count',
    };
    console.log(`[${timestamp}] ✗ Step 7 failed:`, error.code);
    return NextResponse.json({ ok: false, error }, { status: 400 });
  }

  const currentPhotoCount = photosCheckResult.count ?? 0;

  if (currentPhotoCount >= MAX_PHOTOS_PER_SUBJECT) {
    const error: ErrorResponse = {
      step: '7. Check Photo Count',
      code: 'MAX_PHOTOS_EXCEEDED',
      message: `Maximum ${MAX_PHOTOS_PER_SUBJECT} photos/videos allowed`,
      userMessage: `You have uploaded the maximum number of photos (${MAX_PHOTOS_PER_SUBJECT}). Please delete some before uploading more.`,
    };
    console.log(`[${timestamp}] ✗ Step 7 failed:`, error.code);
    return NextResponse.json({ ok: false, error }, { status: 400 });
  }

  console.log(`[${timestamp}] ✓ Step 7 passed: Photo count okay (${currentPhotoCount}/${MAX_PHOTOS_PER_SUBJECT})`);

  // ──────────────────────────────────────────────────────────────────────────
  // Step 8: Upload to storage
  // ──────────────────────────────────────────────────────────────────────────
  const timestamp_ms = Date.now();
  const randomStr = Math.random().toString(36).slice(2, 9);
  const fileName = `${photoType}_${timestamp_ms}_${randomStr}`;
  const storagePath = `${subjectId}/${fileName}`;

  const buffer = await file.arrayBuffer();
  const uploadResult = await admin.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadResult.error) {
    const normalizedStorageMessage = uploadResult.error.message.toLowerCase();
    const userMessage = normalizedStorageMessage.includes('mime') || normalizedStorageMessage.includes('content type')
      ? (isVideo ? 'Storage rejected the video type. Use MP4 or MOV.' : 'Storage rejected this image format. Try JPG or PNG if the issue continues.')
      : normalizedStorageMessage.includes('size')
        ? `File exceeds storage limit. Maximum size is ${maxSizeLabel}.`
        : 'Failed to upload file to storage. Please try again.';

    const error: ErrorResponse = {
      step: '8. Upload to Storage',
      code: 'STORAGE_UPLOAD_FAILED',
      message: uploadResult.error.message,
      userMessage,
    };
    console.log(`[${timestamp}] ✗ Step 8 failed:`, error.code);
    return NextResponse.json({ ok: false, error }, { status: 400 });
  }

  console.log(`[${timestamp}] ✓ Step 8 passed: File uploaded to storage`);

  // ──────────────────────────────────────────────────────────────────────────
  // Step 9: Get public URL
  // ──────────────────────────────────────────────────────────────────────────
  const { data: publicUrlData } = admin.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(storagePath);

  const publicUrl = publicUrlData?.publicUrl ?? '';

  console.log(`[${timestamp}] ✓ Step 9 passed: Public URL generated`);

  // ──────────────────────────────────────────────────────────────────────────
  // Step 10: Save metadata to database
  // ──────────────────────────────────────────────────────────────────────────
  const dbResult = await admin
    .from('subject_photos')
    .insert({
      subject_id: subjectId,
      photo_type: photoType,
      storage_path: storagePath,
      public_url: publicUrl,
      uploaded_by: userId,
      file_size_bytes: file.size,
      mime_type: file.type,
    })
    .select('id,photo_type,storage_path,public_url,uploaded_by,uploaded_at,file_size_bytes,mime_type')
    .single();

  if (dbResult.error) {
    // Attempt cleanup of uploaded file
    console.log(`[${timestamp}] ⚠ Cleaning up storage due to DB error`);
    await admin.storage.from(STORAGE_BUCKET).remove([storagePath]);

    const error: ErrorResponse = {
      step: '10. Save Photo Metadata',
      code: 'PHOTO_METADATA_SAVE_FAILED',
      message: dbResult.error.message,
      userMessage: 'Failed to save photo metadata. Please try again.',
    };
    console.log(`[${timestamp}] ✗ Step 10 failed:`, error.code);
    return NextResponse.json({ ok: false, error }, { status: 400 });
  }

  console.log(`[${timestamp}] ✓✓✓ Photo uploaded successfully: ${photoType}`);
  return NextResponse.json({
    ok: true,
    data: {
      id: dbResult.data.id,
      photo_type: dbResult.data.photo_type,
      public_url: dbResult.data.public_url,
    },
  });
}
