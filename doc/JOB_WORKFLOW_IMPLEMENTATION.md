# Job Workflow Implementation Guide

Complete integration guide for the job status workflow, photo management, and job completion system.

## Architecture Overview

```
Subject Detail Page (Next.js Route)
  ↓
useJobWorkflow Hook (React Query)
  ├→ requiredPhotos (Query)
  ├→ completionRequirements (Query with 5s polling)
  ├→ updateStatus (Mutation)
  ├→ uploadPhoto (Mutation)
  ├→ markIncomplete (Mutation)
  └→ markComplete (Mutation)
  
  ↓ State & Data
  
Service Layer (subject.job-workflow.ts)
  ├→ updateJobStatus: Forward-only transitions
  ├→ getRequiredPhotos: Warranty-aware photo counts
  ├→ checkCompletionRequirements: Requirement validation
  ├→ uploadJobPhoto: File upload + metadata
  ├→ markJobIncomplete: Incomplete job handling
  └→ markJobComplete: Job completion with billing update
  ↓
Repository Layer
  ├→ photo.repository.ts (Photo CRUD)
  └→ subject.repository.ts (Subject queries with nested photos)
  ↓
Supabase (Database + Storage)
  ├→ subjects table (9 workflow columns)
  ├→ subject_photos table (Photo metadata)
  └→ subject-photos bucket (Photo storage)
```

## Files Overview

### Database (supabase/migrations/)

**`20260317_010_job_workflow.sql`**
- Workflow columns: `en_route_at`, `arrived_at`, `work_started_at`, `completed_at`, `incomplete_at`
- Incomplete tracking: `incomplete_reason` (enum), `incomplete_note`, `spare_parts_requested`, `spare_parts_quantity`
- Completion proof: `completion_proof_uploaded`, `completion_notes`, `rescheduled_date`
- Photo table: `subject_photos` with upload metadata, soft-delete support
- RLS: Technician-only INSERT/DELETE on own photos; authenticated READ

### Backend (Service & Repository Layers)

**`web/modules/subjects/subject.job-workflow.ts`** (Service Layer)
- `updateJobStatus()` - Forward-only status transitions with timestamp setting
- `getRequiredPhotos()` - Returns warranty-aware photo type array (7 for warranty, 3 for OOW)
- `checkCompletionRequirements()` - Real-time requirement validation
- `uploadJobPhoto()` - File upload with size/type validation
- `markJobIncomplete()` - Incomplete job with reason validation
- `markJobComplete()` - Job completion with photo validation & billing update

**`web/repositories/photo.repository.ts`** (Photo CRUD)
- `uploadPhoto()` - Upload to storage, save metadata to DB
- `findBySubjectId()` - List all photos for subject
- `findBySubjectAndType()` - Single photo lookup
- `deletePhoto()` - Soft-delete + storage cleanup
- `findById()` - Fetch single photo by ID

**`web/repositories/subject.repository.ts`** (Modified)
- `listSubjects()` select extended with 8 workflow columns
- `getSubjectById()` select extended with 14 workflow fields + nested `subject_photos`

**`web/modules/subjects/subject.service.ts`** (Modified)
- `getSubjectDetails()` now returns photos array mapped from nested `subject_photos` select

### Types & Interfaces

**`web/modules/subjects/subject.types.ts`** (Modified)
- `PhotoType` enum: serial_number, machine, bill, job_sheet, defective_part, site_photo_1-3, service_video
- `IncompleteReason` enum: customer_cannot_afford, power_issue, door_locked, spare_parts_not_available, site_not_ready, other
- `SubjectDetail` extended with 15 workflow fields + photos array
- `SubjectPhoto` interface for photo metadata
- `JobCompletionRequirements` interface for requirement tracking
- `IncompleteJobInput` interface for incomplete job form data

### React Hook

**`web/hooks/subjects/use-job-workflow.ts`**
- Query: `requiredPhotos` - Warranty-aware photo type requirements
- Query: `completionRequirements` - Real-time requirement validation (5s polling)
- Mutation: `updateStatus` - Change job status
- Mutation: `uploadPhoto` - Upload photo with progress tracking
- Mutation: `markIncomplete` - Mark job incomplete with reason
- Mutation: `markComplete` - Complete job (validates all photos, updates billing)

### UI Components

**`web/components/subjects/status-action-bar.tsx`**
- Status display with next transition button
- "Mark Complete" button (IN_PROGRESS only) → Dialog with optional notes
- "Cannot Complete" button → Dialog with reason selection + conditional fields
- Incomplete reason validation: 10+ chars for "other", qty+name for "spare_parts_not_available"

**`web/components/subjects/photo-upload.tsx`**
- Drag-drop upload interface
- File type validation (images: JPEG/PNG/WebP, video: MP4/MOV)
- File size validation (images: 2MB, video: 50MB)
- Upload progress display with percentage
- Auto-disabled during upload

**`web/components/subjects/photo-gallery.tsx`**
- Responsive grid layout (2-4 columns)
- Click to view full-size dialog with metadata
- Delete button (technician-only)
- Soft-delete safe (removes DB entry + storage file)
- File size formatting

**`web/components/subjects/job-completion-panel.tsx`**
- Required/uploaded photo count with progress bar
- Green alert if completion ready
- Amber alert if photos needed
- List of required photos with checkmark/circle icons
- Display missing photos in red box

## Integration Steps

### Step 1: Deploy Database Migration

```bash
# Run migration on target Supabase environment
supabase db push --linked
```

This creates:
- 9 workflow columns on `subjects` table
- `subject_photos` table with 9 columns
- 6 indexes for query performance
- RLS policies for authorization
- Photo storage grant

### Step 2: Verify Supabase Storage Bucket

Ensure `subject-photos` bucket exists in Supabase Storage with:
- Visibility: **Public** (for direct photo URL access)
- Allowed MIME types: image/jpeg, image/png, image/webp, video/mp4, video/quicktime
- Max file size: 50MB

### Step 3: Import Components in Subject Detail Page

Example integration in subject detail page:

```tsx
// web/app/dashboard/subjects/[id]/page.tsx

import { StatusActionBar } from '@/components/subjects/status-action-bar';
import { PhotoUpload } from '@/components/subjects/photo-upload';
import { PhotoGallery } from '@/components/subjects/photo-gallery';
import { JobCompletionPanel } from '@/components/subjects/job-completion-panel';
import { useJobWorkflow } from '@/hooks/subjects/use-job-workflow';

export default function SubjectDetailPage({ params }: { params: { id: string } }) {
  const subject = useSubject(params.id);
  const {
    requiredPhotos,
    completionRequirements,
    isLoadingRequirements,
    updateStatus,
    isUpdatingStatus,
    updateStatusError,
    uploadPhoto,
    isUploadingPhoto,
    uploadPhotoError,
    markIncomplete,
    isMarkingIncomplete,
    markIncompleteError,
    markComplete,
    isMarkingComplete,
    markCompleteError,
  } = useJobWorkflow(params.id);

  const isAssignedTechnician = subject?.assigned_technician_id === user?.id;

  return (
    <div>
      {/* Status Action Bar - Main workflow control */}
      {isAssignedTechnician && (
        <StatusActionBar
          currentStatus={subject?.status || ''}
          isAssignedTechnician={isAssignedTechnician}
          canTransition={!!subject}
          isLoading={isUpdatingStatus}
          onStatusChange={(status) => updateStatus(status)}
          onMarkIncomplete={(input) => markIncomplete(input)}
          onMarkComplete={(notes) => markComplete(notes)}
          completionError={markCompleteError}
          isMarkingComplete={isMarkingComplete}
        />
      )}

      {/* Job Completion Panel - Show required photos */}
      {subject?.status === 'IN_PROGRESS' && (
        <JobCompletionPanel
          requirements={completionRequirements}
          isLoading={isLoadingRequirements}
          canComplete={completionRequirements?.canComplete}
        />
      )}

      {/* Photo Upload Section - For IN_PROGRESS jobs */}
      {isAssignedTechnician && subject?.status === 'IN_PROGRESS' && (
        <div className="space-y-4">
          <h3 className="font-semibold">Upload Required Photos</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {requiredPhotos.map((photoType) => (
              <PhotoUpload
                key={photoType}
                photoType={photoType}
                onUpload={(file) =>
                  uploadPhoto({
                    file,
                    photoType,
                  })
                }
                isUploading={isUploadingPhoto}
                uploadError={uploadPhotoError}
                uploaded={completionRequirements?.uploaded.includes(photoType)}
                isCompleted={subject?.status === 'COMPLETED'}
              />
            ))}
          </div>
        </div>
      )}

      {/* Photo Gallery - Show uploaded photos */}
      {(subject?.photos?.length ?? 0) > 0 && (
        <div>
          <h3 className="font-semibold mb-3">Uploaded Photos</h3>
          <PhotoGallery
            photos={subject?.photos ?? []}
            isAssignedTechnician={isAssignedTechnician}
          />
        </div>
      )}
    </div>
  );
}
```

### Step 4: Handle Status Display for Non-Technicians

```tsx
// For office/admin users - read-only status display
{!isAssignedTechnician && (
  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
    <p className="text-sm text-blue-900">
      Current Status: <span className="font-semibold">{subject?.status}</span>
    </p>
    {subject?.incomplete_reason && (
      <p className="text-sm text-orange-900 mt-2">
        Incomplete Reason: {subject.incomplete_reason}
      </p>
    )}
  </div>
)}
```

## Business Rules Enforced

### Status Transitions (Forward-Only)
- `ACCEPTED` → `EN_ROUTE`
- `EN_ROUTE` → `ARRIVED`
- `ARRIVED` → `IN_PROGRESS`
- `IN_PROGRESS` → `COMPLETED` or `INCOMPLETE`
- No backward transitions or skipping steps

### Photo Requirements (Warranty-Aware)
- **In-Warranty/AMC**: 7 required photos
  - serial_number (label photo)
  - machine (equipment photo)
  - bill (invoice/bill)
  - job_sheet (job sheet document)
  - defective_part (damaged part if applicable)
  - service_video (work process video)
  - (3 site_photo slots for additional context)

- **Out-of-Warranty**: 3 required photos
  - serial_number
  - machine
  - bill

### Incomplete Job Validation
- Must select a reason from 6 predefined options
- For "other" reason: mandatory 10+ character note
- For "spare_parts_not_available": mandatory part name + quantity
- All other reasons: optional notes
- Optional reschedule date can be provided

### Job Completion Validation
- All required photos must be uploaded
- Billing status auto-updates:
  - If `service_charge_type` = 'brand_dealer' → `billing_status` = 'due'
  - If `service_charge_type` = 'customer' → `billing_status` unchanged

### Authorization
- Only assigned technician can:
  - Change job status
  - Upload photos
  - Mark incomplete
  - Mark complete
- All authenticated users can:
  - View subject details
  - View photos
  - View job status

## Common Scenarios

### Technician Accepting a Job

1. Technician assigned job with status `ALLOCATED`
2. Technician views subject detail
3. Clicks "Mark as Accepted" (if visible, else auto-transitions)
4. Status updates to `ACCEPTED`

### Technician Starting Work

1. Technician updates status: `ACCEPTED` → `EN_ROUTE`
2. Updates status: `EN_ROUTE` → `ARRIVED`
3. Updates status: `ARRIVED` → `IN_PROGRESS` (work started)
4. `StatusActionBar` shows "Mark Complete" + "Cannot Complete" buttons
5. `JobCompletionPanel` shows required photos

### Technician Completing Work

1. Technician uploads all required photos via `PhotoUpload` components
2. `JobCompletionPanel` shows "All required photos uploaded" green alert
3. Technician clicks "Mark Complete" button
4. Fills optional completion notes in modal
5. Confirms completion
6. Service automatically:
   - Sets `status` = 'COMPLETED'
   - Sets `completed_at` = current timestamp
   - Sets `completion_proof_uploaded` = true
   - Updates `billing_status` based on service_charge_type
   - Timeline updated with completion event

### Technician Cannot Complete Work

1. Technician clicks "Cannot Complete" button
2. Selects incompletion reason from dropdown:
   - **Customer Cannot Afford**: Optional notes + reschedule date
   - **Power Issue**: Optional notes + reschedule date
   - **Door Locked**: Optional notes + reschedule date
   - **Spare Parts Not Available**: Mandatory part name + qty + reschedule date
   - **Site Not Ready**: Optional notes + reschedule date
   - **Other**: Mandatory 10+ character note + reschedule date (optional)
3. Confirms modal
4. Service automatically:
   - Sets `status` = 'INCOMPLETE'
   - Sets `incomplete_at` = current timestamp
   - Stores `incomplete_reason`, `incomplete_note`, `spare_parts_*`, `rescheduled_date`
   - Timeline updated with incomplete event

### Admin Viewing Completed Job

1. Admin navigates to subject detail
2. Status shows `COMPLETED`
3. `StatusActionBar` hidden (technician-only)
4. Read-only status display shows:
   - Completed timestamp
   - Completion notes
5. `PhotoGallery` displays all uploaded photos (read-only, no delete)

## Testing Checklist

- [ ] Migration deploys successfully to Supabase
- [ ] `subject-photos` bucket exists and is public
- [ ] Service layer functions execute without errors
- [ ] React hook queries/mutations work with sample data
- [ ] `StatusActionBar` displays correct status and buttons
- [ ] Photo upload accepts valid files, rejects invalid
- [ ] Photo validation enforces correct file sizes/types
- [ ] Incomplete reason dropdown shows all 6 options + validation
- [ ] `markComplete` validates all required photos before allowing completion
- [ ] Billing status updates correctly on completion
- [ ] Photos array populated in subject detail response
- [ ] Non-technicians cannot modify job status
- [ ] Photo deletion removes from storage + DB
- [ ] Status transitions are forward-only (no backward)

## Performance Considerations

- **Query polling**: `completionRequirements` polls every 5 seconds during IN_PROGRESS state
- **Photo gallery**: Loads up to 50 photos per subject (pagination recommended if >50)
- **Storage paths**: Collision-safe: `{subjectId}/{photoType}_{timestamp}_{random}`
- **RLS policies**: Indexed on `(subject_id)` for fast technician photo queries
- **Soft delete**: Uses sparse index on `is_deleted` to exclude deleted photos from queries

## Troubleshooting

### Photos Not Appearing in Gallery
- Check `subject_photos` table has records for the subject
- Verify RLS policies allow authenticated READ
- Ensure `public_url` is properly formatted (Supabase Storage public URL)

### Status Transition Fails
- Verify current status is in `VALID_TRANSITIONS` map
- Check technician is assigned to subject
- Verify subject exists and is not deleted

### Photo Upload Fails
- Validate file type is in allowed list (2MB for images, 50MB for video)
- Check `subject-photos` bucket exists and is public
- Verify Supabase Storage permissions for authenticated users

### Completion Requirements Always Empty
- Ensure `getRequiredPhotos()` returns correct warranty-aware count
- Check `subject.is_warranty_service` and `subject.is_amc_service` flags
- Verify photos are not soft-deleted (`is_deleted = false`)

## Future Enhancements

- [ ] Backup photo from multiple angles before completion
- [ ] Signature capture on job completion
- [ ] QR code scanning for job sheet verification
- [ ] Offline photo upload queue
- [ ] Photo compression before upload
- [ ] Admin photo annotation/redaction tools
- [ ] Technician photo gallery management dashboard
