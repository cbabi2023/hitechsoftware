// ─────────────────────────────────────────────────────────────────────────────
// use-job-workflow.ts
//
// PURPOSE:
//   A COMPOSITE React Query hook that encapsulates every job lifecycle
//   operation available to a technician on the Subject Detail page:
//   status transitions, photo management, and job completion/incompletion.
//   Returns a flat object of actions + loading/error states for direct
//   destructuring in the UI component.
//
// WHO USES THIS HOOK:
//   TECHNICIANS ONLY. Admins and office staff do NOT call these mutations.
//   Admins use assignment hooks (useAssignTechnician) for status changes.
//   The API routes validate the caller's role and enforce this boundary
//   on the server side.
//
// WHY ALL MUTATIONS CALL API ROUTES (NOT SUPABASE DIRECTLY):
//   Every write operation requires the admin Supabase client (createAdminClient)
//   because the service layer verifies technician-subject ownership using
//   a DB query that bypasses RLS (RLS alone cannot perform join-based ownership
//   checks efficiently). The admin client uses SUPABASE_SERVICE_ROLE_KEY,
//   a server-only secret. The hierarchy is:
//
//     Browser (fetch) → Next.js API Route (server, validates session)
//       → Workflow Service (createAdminClient, validates ownership)
//         → Supabase DB (RLS bypassed for ownership checks, enforced for others)
//
// HOOK ARCHITECTURE (WHY ONE COMPOSITE HOOK INSTEAD OF SEPARATE HOOKS):
//   All six internal mutations share: subjectId, technicianId, queryClient.
//   Centralising them in one hook avoids re-fetching the same user context
//   and prevents queryClient inconsistencies if each mutation were in a
//   separate hook with different queryClient references (though React Query
//   guarantees a singleton, combining them is cleaner and collocated).
//   The returned object uses explicit property names to allow selective
//   destructuring in components.
//
// CACHE KEYS MANAGED:
//   ['job-workflow', subjectId, 'requirements']  → owned by workflowRequirementsQuery
//   SUBJECT_QUERY_KEYS.detail(subjectId)          → invalidated by all mutations
//   SUBJECT_QUERY_KEYS.list                       → invalidated by status transitions
//
// TOAST POLICY:
//   All onSuccess: toast.success('...')
//   All onError: toast.error(err.message)
//   The status labels map (ARRIVED, IN_PROGRESS, etc.) provides human-friendly
//   English instead of raw enum values in success toasts.
//
// PHOTO UPLOAD SPECIFICS:
//   Photo upload uses FormData (multipart/form-data), NOT JSON.
//   Binary file data cannot be encoded in JSON without base64 expansion;
//   FormData sends the file as a binary stream with proper MIME boundaries.
//   The server decodes it via `await req.formData()` in the API route.
//
// IMPORTS:
//   @tanstack/react-query   — useMutation, useQuery, useQueryClient
//   sonner                  — toast notifications
//   @/hooks/auth/useAuth    — current user (session user id = technicianId)
//   @/modules/subjects/subject.constants — SUBJECT_QUERY_KEYS factory
//   @/modules/subjects/subject.types     — JobCompletionRequirements, PhotoType, etc.
// ─────────────────────────────────────────────────────────────────────────────
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/auth/useAuth';
import { SUBJECT_QUERY_KEYS } from '@/modules/subjects/subject.constants';
import type {
  JobCompletionRequirements,
  PhotoType,
  IncompleteJobInput,
} from '@/modules/subjects/subject.types';

/**
 * @summary Composite hook providing all job lifecycle operations for Subject Detail.
 *
 * @description
 * useJobWorkflow() is the single entry point for all workflow-related
 * UI interactions available to a technician on a subject's detail page.
 * It internally creates six sub-operations and returns them as a flat
 * collection of named properties for clean destructuring.
 *
 * INTERNAL OPERATIONS (in execution order during a typical job):
 *
 *   1. workflowRequirementsQuery   (READ, runs on mount)
 *      → GET /api/subjects/{id}/workflow
 *      → Returns requiredPhotos[] (PhotoType[]) + completionRequirements
 *      → Refetched after every photo upload/remove to keep checklist in sync
 *
 *   2. updateStatusMutation        (WRITE, technician-triggered)
 *      → POST /api/subjects/{id}/workflow { action: 'update_status', status }
 *      → Valid transitions: ASSIGNED → ARRIVED, ARRIVED → IN_PROGRESS,
 *        IN_PROGRESS → AWAITING_PARTS, AWAITING_PARTS → IN_PROGRESS
 *
 *   3. uploadPhotoMutation         (WRITE, technician-triggered)
 *      → POST /api/subjects/{id}/photos/upload (multipart/form-data)
 *      → Saves to Supabase Storage bucket 'subject-photos'
 *      → Inserts row in subject_photos table
 *
 *   4. removePhotoMutation         (WRITE, technician-triggered)
 *      → DELETE /api/subjects/{id}/photos { photoId, storagePath }
 *      → Soft-deletes the subject_photos row AND removes from storage bucket
 *
 *   5. markIncompleteMutation      (WRITE, technician-triggered)
 *      → POST /api/subjects/{id}/workflow { action: 'mark_incomplete', ...input }
 *      → Sets status = INCOMPLETE, records reason, notes, spare parts
 *
 *   6. markCompleteMutation        (WRITE, technician-triggered)
 *      → POST /api/subjects/{id}/workflow { action: 'mark_complete', notes? }
 *      → Sets status = COMPLETED WITHOUT generating a bill
 *        (for warranty jobs where admin generates the bill separately)
 *
 * RETURNED OBJECT STRUCTURE:
 *   {
 *     // READ state
 *     requiredPhotos: PhotoType[]                    // what photos must be uploaded
 *     completionRequirements: JobCompletionRequirements | undefined  // per-photo-type check
 *     isLoadingRequirements: boolean
 *
 *     // Status transitions
 *     updateStatus: (newStatus: string) => void
 *     isUpdatingStatus: boolean
 *     updateStatusError: Error | null
 *
 *     // Photo upload
 *     uploadPhoto: ({ file, photoType }) => void
 *     uploadPhotoAsync: ({ file, photoType }) => Promise<data>
 *     isUploadingPhoto: boolean
 *     uploadPhotoError: Error | null
 *
 *     // Photo removal
 *     removePhoto: ({ photoId, storagePath, photoType }) => void
 *     removePhotoAsync: ...
 *     isRemovingPhoto: boolean
 *     removePhotoError: Error | null
 *
 *     // Job incomplete
 *     markIncomplete: (input: IncompleteJobInput) => void
 *     isMarkingIncomplete: boolean
 *     markIncompleteError: Error | null
 *
 *     // Job complete (non-billing completion)
 *     markComplete: (notes?: string) => void
 *     isMarkingComplete: boolean
 *     markCompleteError: Error | null
 *   }
 *
 * @param subjectId  UUID of the subject whose job lifecycle this hook manages.
 */
export function useJobWorkflow(subjectId: string) {
  const { user } = useAuth();
  const technicianId = user?.id;
  const queryClient = useQueryClient();

  // ── Requirements query ──────────────────────────────────────────────────────
  //
  // PURPOSE: Provides the checklist that the PhotoUploadSection renders.
  //   requiredPhotos: PhotoType[]             — which photo types must be uploaded
  //   completionRequirements: { canComplete, missingPhotoTypes[] }
  //
  // QUERY KEY: ['job-workflow', subjectId, 'requirements']
  //   The 'requirements' segment scopes this key away from future workflow
  //   queries that might share the ['job-workflow', subjectId] prefix.
  //
  // STALE TIME: 30 seconds (30 * 1000 ms)
  //   30 seconds is appropriate because photo requirements are determined by
  //   subject.type_of_service (installation vs service) which never changes.
  //   The completionRequirements (which photos are uploaded) becomes stale
  //   after upload/remove, but we manually call workflowRequirementsQuery.refetch()
  //   in each photo mutation's onSuccess callback to trigger an immediate re-fetch
  //   instead of waiting for the 30-second staleTime to expire.
  //   30 seconds prevents a flood of re-fetches when the user is actively
  //   navigating within the Subject Detail page tabs.
  //
  // ENABLED: !!subjectId
  //   Prevents the query from running before the subject UUID is available
  //   (e.g., during route param parsing or SSR).
  //
  // RESPONSE SHAPE (typed inline):
  //   { ok: boolean, data?: { requiredPhotos, completionRequirements }, error?: ... }
  //   The queryFn throws on ok=false, causing React Query to enter error state.
  const workflowRequirementsQuery = useQuery({
    queryKey: ['job-workflow', subjectId, 'requirements'],
    staleTime: 30 * 1000,
    queryFn: async () => {
      const res = await fetch(`/api/subjects/${subjectId}/workflow`, {
        method: 'GET',
      });

      const json = await res.json() as {
        ok: boolean;
        data?: {
          requiredPhotos: PhotoType[];
          completionRequirements: JobCompletionRequirements;
        };
        error?: { userMessage?: string; message?: string };
      };

      if (!json.ok) {
        throw new Error(json.error?.userMessage ?? json.error?.message ?? 'Failed to load workflow requirements');
      }

      return json.data!;
    },
    enabled: !!subjectId,
  });

  // ── Status update mutation ──────────────────────────────────────────────────
  //
  // PURPOSE: Allows the technician to move through lifecycle states:
  //   ASSIGNED → ARRIVED → IN_PROGRESS → AWAITING_PARTS (and back)
  //   These transitions are enforced server-side via the workflow service.
  //   Invalid transitions (e.g., skipping ARRIVED) return an error.
  //
  // LABEL MAP:
  //   The raw status strings ('ARRIVED', 'IN_PROGRESS', etc.) are not shown
  //   to users directly. The labels object maps them to human-friendly toasts.
  //   Any status not in the map falls back to 'Status updated'.
  //
  // ON SUCCESS:
  //   1. Invalidate SUBJECT_QUERY_KEYS.detail → header status badge updates.
  //   2. Invalidate SUBJECT_QUERY_KEYS.list   → list view status column updates.
  //   3. Manually refetch workflowRequirementsQuery → ensures the photo
  //      checklist section re-renders for the new status.
  //   Note: Promise.all() runs all three invalidations in parallel.
  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const res = await fetch(`/api/subjects/${subjectId}/workflow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_status', status: newStatus }),
      });
      const json = await res.json() as { ok: boolean; data?: { id: string; status: string }; error?: { message: string } };
      if (!json.ok) throw new Error(json.error?.message ?? 'Failed to update status');
      return json.data!;
    },
    onSuccess: async (_, newStatus) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: SUBJECT_QUERY_KEYS.detail(subjectId) }),
        queryClient.invalidateQueries({ queryKey: SUBJECT_QUERY_KEYS.list }),
        workflowRequirementsQuery.refetch(),
      ]);
      const labels: Record<string, string> = {
        ARRIVED: 'Marked as Arrived',
        IN_PROGRESS: 'Work Started',
        AWAITING_PARTS: 'Marked as Awaiting Parts',
      };
      toast.success(labels[newStatus] ?? 'Status updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ── Photo upload mutation ───────────────────────────────────────────────
  //
  // PURPOSE: Handles file selection → server upload → storage insert flow.
  //
  // WHY FormData (NOT JSON):
  //   JSON.stringify() cannot directly represent binary file data.
  //   Encoding as base64 works but increases payload size by ~33% and requires
  //   decoding on the server. FormData's multipart encoding is the standard
  //   way to send files over HTTP. The Next.js API route reads the file with:
  //     const formData = await request.formData();
  //     const file = formData.get('file') as File;
  //     const photoType = formData.get('photoType') as string;
  //
  // WHY NO Content-Type HEADER:
  //   When using FormData with fetch(), the browser AUTOMATICALLY adds:
  //     Content-Type: multipart/form-data; boundary=----FormBoundaryXXXXXX
  //   The boundary string is generated by the browser. Manually setting
  //   Content-Type would OMIT the boundary and break multipart parsing.
  //   Always let the browser set Content-Type for FormData requests.
  //
  // REQUEST ENDPOINT: /api/subjects/{subjectId}/photos/upload
  //   Separate endpoint from /workflow because photo upload has different
  //   request shape (FormData vs JSON) and response behavior (storage URL).
  //
  // RESPONSE SHAPE:
  //   { ok: true, data: { id, photo_type, public_url } }
  //   OR { ok: false, error: { code, userMessage } }
  //   Common error codes: 'INVALID_TYPE', 'FILE_TOO_LARGE', 'NOT_ASSIGNED'
  //
  // AUTH GUARD:
  //   if (!technicianId) throw new Error('Not authenticated')
  //   Checked before fetch so we don't waste bandwidth uploading if session expired.
  //
  // ON SUCCESS:
  //   1. Invalidate SUBJECT_QUERY_KEYS.detail → photo gallery section re-renders
  //      with the new photo thumbnail.
  //   2. workflowRequirementsQuery.refetch() → completionRequirements updates
  //      (canComplete may now be true if this was the last required photo).
  //   3. toast.success with humanised photo type:
  //      photoType.replace(/_/g, ' ') converts 'before_repair' to 'before repair'.
  //
  // BOTH mutate AND mutateAsync ARE EXPOSED:
  //   • uploadPhoto (mutate)      — fire-and-forget, errors handled by onError
  //   • uploadPhotoAsync (mutateAsync) — for components that await the upload
  //     before updating their own local state (e.g., to show a preview)
  const uploadPhotoMutation = useMutation({
    mutationFn: async ({ file, photoType }: { file: File; photoType: PhotoType }) => {
      if (!technicianId) throw new Error('Not authenticated');
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('photoType', photoType);
      
      const res = await fetch(`/api/subjects/${subjectId}/photos/upload`, {
        method: 'POST',
        body: formData,
      });
      
      const json = await res.json() as { 
        ok: boolean
        data?: { id: string; photo_type: string; public_url: string }
        error?: { code: string; userMessage: string }
      };
      
      if (!json.ok) throw new Error(json.error?.userMessage ?? 'Upload failed');
      return json.data!;
    },
    onSuccess: (_, { photoType }) => {
      queryClient.invalidateQueries({ queryKey: SUBJECT_QUERY_KEYS.detail(subjectId) });
      workflowRequirementsQuery.refetch();
      toast.success(`${photoType.replace(/_/g, ' ')} uploaded`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ── Photo remove mutation ───────────────────────────────────────────────
  //
  // PURPOSE: Deletes a previously uploaded photo from both the DB and storage.
  //
  // REQUEST SHAPE:
  //   Method: DELETE  (correct HTTP verb for remove operations)
  //   URL: /api/subjects/{subjectId}/photos
  //   Body: { photoId: '<uuid>', storagePath: 'subject-photos/technician-id/...' }
  //
  // WHY BOTH photoId AND storagePath ARE SENT:
  //   The server needs photoId to soft-delete the subject_photos row.
  //   The server needs storagePath to call supabase.storage.remove([storagePath]).
  //   The client has both values from the photo record fetched in SubjectDetail.
  //   Sending storagePath from the client avoids an extra DB lookup on the server.
  //   SECURITY NOTE: The API route verifies the photo belongs to this subjectId
  //   and the technician is assigned to it before performing the delete.
  //   The client-provided storagePath is validated on the server; it cannot
  //   be used to delete other subjects' photos.
  //
  // photoType IN PARAMETERS BUT NOT IN REQUEST BODY:
  //   photoType is only used in onSuccess for the toast message
  //   (shows which type was removed, e.g., 'before repair removed').
  //   It does not need to be sent to the server.
  //
  // RESPONSE SHAPE:
  //   { ok: true } (no data returned — the row is deleted)
  //   OR { ok: false, error: { userMessage?, message? } }
  //
  // ON SUCCESS:
  //   1. Invalidate SUBJECT_QUERY_KEYS.detail → photo gallery removes the thumbnail.
  //   2. workflowRequirementsQuery.refetch() → canComplete may now be false if
  //      removing a required photo breaks the completion requirement.
  //   3. toast.success with humanised photo type.
  const removePhotoMutation = useMutation({
    mutationFn: async ({
      photoId,
      storagePath,
      photoType,
    }: {
      photoId: string;
      storagePath: string;
      photoType: PhotoType;
    }) => {
      const res = await fetch(`/api/subjects/${subjectId}/photos`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoId, storagePath }),
      });

      const json = await res.json() as {
        ok: boolean;
        error?: { userMessage?: string; message?: string };
      };

      if (!json.ok) {
        throw new Error(json.error?.userMessage ?? json.error?.message ?? 'Failed to remove upload');
      }

      return { photoType };
    },
    onSuccess: (_, { photoType }) => {
      queryClient.invalidateQueries({ queryKey: SUBJECT_QUERY_KEYS.detail(subjectId) });
      workflowRequirementsQuery.refetch();
      toast.success(`${photoType.replace(/_/g, ' ')} removed`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ── Mark incomplete mutation ───────────────────────────────────────────
  //
  // PURPOSE: Records why a job could not be completed and marks it INCOMPLETE.
  //   This allows the job to be rescheduled, reassigned, or have spare parts
  //   ordered before re-attempting.
  //
  // INPUT (IncompleteJobInput):
  //   incompleteReason: IncompleteReason  — the enum cause code
  //   incompleteNote?: string             — free-text explanation (optional)
  //   sparesRequired?: boolean            — flag indicating parts are needed
  //   rescheduledDate?: string            — ISO date for next appointment
  //
  // BODY SPREADING PATTERN ({ action: 'mark_incomplete', ...input }):
  //   The API route reads action at the top level and passes the rest of the
  //   body to the service. Spreading input at the top level avoids an extra
  //   'data' wrapper in the request body:
  //     GOOD: { action: 'mark_incomplete', incompleteReason: 'NO_RESPONSE', ... }
  //     BAD:  { action: 'mark_incomplete', data: { incompleteReason: ... } }
  //
  // ON SUCCESS:
  //   1. Invalidate detail query → status badge changes to INCOMPLETE
  //   2. Invalidate list query   → list view reflects incomplete status
  //   3. toast.success('Job marked as incomplete')
  //
  // NOTE ON WORKFLOW REQUIREMENTS:
  //   workflowRequirementsQuery is NOT refetched here because once the job
  //   is INCOMPLETE, the photo upload section is hidden (the UI conditionally
  //   renders based on status). The next time the job re-enters IN_PROGRESS,
  //   the query will re-fetch due to enabled: !!subjectId + React Query's
  //   default behaviour on component mount.
  const markIncompleteMutation = useMutation({
    mutationFn: async (input: IncompleteJobInput) => {
      const res = await fetch(`/api/subjects/${subjectId}/workflow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_incomplete', ...input }),
      });
      const json = await res.json() as { ok: boolean; data?: { id: string; status: string }; error?: { message: string } };
      if (!json.ok) throw new Error(json.error?.message ?? 'Failed to mark incomplete');
      return json.data!;
    },
      onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: SUBJECT_QUERY_KEYS.detail(subjectId) }),
          queryClient.invalidateQueries({ queryKey: SUBJECT_QUERY_KEYS.list }),
        ]);
        toast.success('Job marked as incomplete');
      },
      onError: (err: Error) => toast.error(err.message),
  });

  // ── Mark complete mutation ───────────────────────────────────────────────
  //
  // PURPOSE: Transitions the job to COMPLETED without generating a bill.
  //   Used for WARRANTY and AMC jobs where the bill is generated separately
  //   by the admin (via the admin panel using the billing service directly)
  //   rather than by the technician on-site. Also used for jobs where no
  //   payment is collected (goodwill, internal jobs).
  //
  // VS generateBill (in useBilling.ts):
  //   • generateBill: technician generates + collects payment + completes job
  //   • markComplete: technician just marks the job done, admin bills separately
  //   Both set status = COMPLETED, but generateBill also inserts a subject_bills row.
  //
  // PARAMETER:
  //   notes?: string — optional completion notes saved to subjects.completion_notes.
  //   e.g., 'Replaced compressor, tested for 30 minutes, no leaks found.'
  //
  // REQUEST BODY:
  //   { action: 'mark_complete', notes: '...' }
  //   notes may be undefined; the service treats undefined as no notes.
  //
  // ON SUCCESS:
  //   1. Invalidate detail query → status badge changes to COMPLETED
  //   2. Invalidate list query   → job appears in completed queue
  //   3. toast.success('Job completed successfully')
  //
  // WORKFLOW REQUIREMENTS NOTE:
  //   The service validates that all required photos are uploaded before
  //   allowing mark_complete. The workflowRequirementsQuery.completionRequirements
  //   in the UI is used to disable the 'Mark Complete' button if canComplete=false,
  //   providing an inline preview of why completion is blocked.
  const markCompleteMutation = useMutation({
    mutationFn: async (notes?: string) => {
      const res = await fetch(`/api/subjects/${subjectId}/workflow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_complete', notes }),
      });
      const json = await res.json() as { ok: boolean; data?: { id: string; status: string }; error?: { message: string } };
      if (!json.ok) throw new Error(json.error?.message ?? 'Failed to mark complete');
      return json.data!;
    },
      onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: SUBJECT_QUERY_KEYS.detail(subjectId) }),
          queryClient.invalidateQueries({ queryKey: SUBJECT_QUERY_KEYS.list }),
        ]);
        toast.success('Job completed successfully');
      },
      onError: (err: Error) => toast.error(err.message),
  });

  // \u2500\u2500 Return object \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  //
  // NAMING CONVENTION:
  //   \u2022 verb-first (uploadPhoto, removePhoto, markComplete) for actions
  //   \u2022 is/are-prefix (isUploadingPhoto, isMarkingIncomplete) for loading flags
  //   \u2022 verbError suffix (uploadPhotoError, markCompleteError) for error states
  //
  // BOTH mutate AND mutateAsync ARE EXPOSED FOR PHOTO OPS:
  //   Components using the file input directly (onClick handlers) use mutate.
  //   Components that need to await the result (progress bars, optimistic UI)
  //   use mutateAsync. Other mutations only expose mutate (fire-and-forget is fine).
  //
  // DEFAULTS:
  //   requiredPhotos ?? [] prevents undefined spreading in PhotoUploadSection's
  //   map() calls before the query resolves.
  //   completionRequirements is undefined until the query resolves; components
  //   should guard with optional chaining: completionRequirements?.canComplete.
  return {
    requiredPhotos: workflowRequirementsQuery.data?.requiredPhotos ?? [],
    completionRequirements: workflowRequirementsQuery.data?.completionRequirements,
    isLoadingRequirements: workflowRequirementsQuery.isLoading,

    updateStatus: updateStatusMutation.mutate,
    isUpdatingStatus: updateStatusMutation.isPending,
    updateStatusError: updateStatusMutation.error,

    uploadPhoto: uploadPhotoMutation.mutate,
    uploadPhotoAsync: uploadPhotoMutation.mutateAsync,
    isUploadingPhoto: uploadPhotoMutation.isPending,
    uploadPhotoError: uploadPhotoMutation.error,

    removePhoto: removePhotoMutation.mutate,
    removePhotoAsync: removePhotoMutation.mutateAsync,
    isRemovingPhoto: removePhotoMutation.isPending,
    removePhotoError: removePhotoMutation.error,

    markIncomplete: markIncompleteMutation.mutate,
    isMarkingIncomplete: markIncompleteMutation.isPending,
    markIncompleteError: markIncompleteMutation.error,

    markComplete: markCompleteMutation.mutate,
    isMarkingComplete: markCompleteMutation.isPending,
    markCompleteError: markCompleteMutation.error,
  };
}
