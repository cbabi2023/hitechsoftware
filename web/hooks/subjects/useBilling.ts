// ─────────────────────────────────────────────────────────────────────────────
// useBilling.ts
//
// PURPOSE:
//   React Query hooks that provide the BillingSection of the Subject Detail
//   page with all data-fetching, mutation, and cache-management capabilities
//   related to billing operations (accessories, bill generation, bill editing,
//   payment status, and PDF download).
//
// WHY HOOKS CALL THE API ROUTE (NOT THE SERVICE DIRECTLY):
//   All mutating hooks send fetch() requests to Next.js API routes
//   (/api/subjects/[id]/billing, /api/bills/*) rather than calling
//   billing.service.ts functions directly in the browser. Reasons:
//
//   1. ADMIN CLIENT: The service layer uses createAdminClient() (bypasses RLS)
//      for technician-ownership checks. The admin Supabase client can only
//      be initialized on the server with SUPABASE_SERVICE_ROLE_KEY (a secret
//      environment variable not exposed to the browser).
//
//   2. SERVER-SIDE GUARD: The API routes verify the incoming session cookie
//      server-side (createClient() from @supabase/ssr) before calling the
//      service. If the session is expired, the API returns 401 before any
//      DB access occurs.
//
//   3. EXCEPTION: useSubjectAccessories and useSubjectBill call the service
//      directly (client-side RLS-enforced Supabase client). These are READ-ONLY
//      queries where the technician is reading their own subject's data —
//      RLS policies allow this without needing the admin client.
//
// REACT QUERY CACHE KEYS USED IN THIS MODULE:
//   ['subject-accessories', subjectId]
//     → Owned by: useSubjectAccessories
//     → Invalidated by: useAddAccessory, useRemoveAccessory, useGenerateBill,
//                        useEditBill
//
//   ['subject-bill', subjectId]
//     → Owned by: useSubjectBill
//     → Invalidated by: useGenerateBill, useUpdateBillPaymentStatus, useEditBill
//
//   SUBJECT_QUERY_KEYS.detail(subjectId)  e.g. ['subjects', 'detail', id]
//     → Owned by: useSubjectDetail (in useSubjects.ts)
//     → Invalidated by: useGenerateBill, useUpdateBillPaymentStatus, useEditBill
//       (so visit_charge, service_charge, grand_total on the header refresh)
//
//   SUBJECT_QUERY_KEYS.list              e.g. ['subjects', 'list']
//     → Owned by: useSubjects (in useSubjects.ts)
//     → Invalidated by: useGenerateBill, useEditBill
//       (so the list page shows updated billing_status)
//
// TOAST NOTIFICATION CONVENTION:
//   All hooks use the 'sonner' toast library:
//   • onSuccess callbacks  → toast.success('...')
//   • onError callbacks    → toast.error(error.message)
//   • Long ops (PDF)       → toast.loading('...') + toast.dismiss(id) in finally
//
// AUTH PATTERN:
//   Mutation hooks call useAuth() to get the current user.
//   They throw 'Not authenticated' if user.id is absent before any network call.
//   This is an early guard — the session could have expired between page load
//   and the user clicking "Add Accessory". Failing fast with a clear error
//   prevents a confusing 401 response from the API.
//
// MODULES IMPORTED:
//   @tanstack/react-query   — useQuery, useMutation, useQueryClient
//   sonner                  — toast (notifications)
//   @/hooks/auth/useAuth    — current authenticated user (id, role)
//   @/modules/subjects/subject.constants — SUBJECT_QUERY_KEYS factory
//   @/modules/subjects/billing.service   — getAccessoriesBySubject, getBillBySubject
//   @/modules/subjects/subject.types     — AddAccessoryInput, EditBillInput, etc.
// ─────────────────────────────────────────────────────────────────────────────
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/auth/useAuth';
import { SUBJECT_QUERY_KEYS } from '@/modules/subjects/subject.constants';
import {
  getAccessoriesBySubject,
  getBillBySubject,
} from '@/modules/subjects/billing.service';
import type { AddAccessoryInput, EditBillInput, GenerateBillInput } from '@/modules/subjects/subject.types';

/**
 * @summary React Query hook that fetches all accessories for a subject with summed total.
 *
 * @description
 * useSubjectAccessories() is a READ-ONLY query hook. It calls getAccessoriesBySubject()
 * (the billing service function) directly from the browser, relying on the
 * RLS-enforced Supabase client (not the admin client). The technician can read
 * their own subject's accessories because the RLS policy on subject_accessories
 * allows SELECT when subject_id belongs to the technician's assigned subjects.
 *
 * QUERY KEY STRUCTURE:
 *   ['subject-accessories', subjectId]
 *   The subjectId is part of the key so each subject's accessories are cached
 *   independently. Switching between subjects in the sidebar does not serve
 *   the previously loaded subject's accessories.
 *
 * ENABLED GUARD:
 *   enabled: Boolean(subjectId)
 *   This prevents the query from running when subjectId is undefined (e.g.,
 *   before route params are parsed, or during SSR). Without this guard,
 *   React Query would attempt to fetch with an empty URL segment and get a 404.
 *
 * RETURN SHAPE:
 *   result.data = { items: SubjectAccessory[], total: number }
 *   • items   — full rows from subject_accessories including id (for remove)
 *   • total   — JS-computed sum of all total_price values via toNumber()
 *   Used by AccessoriesTable (renders items) and AccessoriesSummaryLine (shows total).
 *
 * ERROR PROPAGATION:
 *   If getAccessoriesBySubject returns { ok: false }, the queryFn throws an Error
 *   with the service error message. React Query catches this and stores it in
 *   result.error. The AccessoriesSection shows an error boundary state in this case.
 *
 * STALE TIME:
 *   Uses the React Query global default (0 — stale immediately).
 *   This means a window re-focus or navigation back to this subject will
 *   re-fetch automatically. Appropriate because other technicians/admins could
 *   add accessories via the admin panel between visits.
 *
 * @param subjectId  UUID of the subject whose accessories to fetch.
 * @returns Standard React Query result: { data, isLoading, isError, error, refetch }
 */
export function useSubjectAccessories(subjectId: string) {
  return useQuery({
    queryKey: ['subject-accessories', subjectId],
    queryFn: async () => {
      const result = await getAccessoriesBySubject(subjectId);
      if (!result.ok) throw new Error(result.error.message);
      return result.data;
    },
    enabled: Boolean(subjectId),
  });
}

/**
 * @summary Mutation hook that adds a spare part/accessory via the billing API.
 *
 * @description
 * useAddAccessory() wraps a POST request to /api/subjects/[id]/billing with
 * action='add_accessory'. The API route delegates to addAccessory() in the
 * billing service which validates and inserts a row into subject_accessories.
 *
 * WHY USE AN API ROUTE AND NOT THE SERVICE DIRECTLY:
 *   addAccessory() calls getSubjectDetails() using the admin client to verify
 *   that the requesting technician is actually assigned to the subject.
 *   The admin client requires SUPABASE_SERVICE_ROLE_KEY, a server-only secret.
 *   Calling it from the browser would expose the secret in the JS bundle.
 *
 * AUTH GUARD:
 *   if (!user?.id) throw new Error('Not authenticated')
 *   This is checked synchronously BEFORE the fetch. If the user's session has
 *   expired between page load and clicking "Add Accessory", this throws early
 *   with a human-readable error instead of waiting for a 401 from the API.
 *
 * REQUEST SHAPE:
 *   Method: POST
 *   URL: /api/subjects/{subjectId}/billing
 *   Body: { action: 'add_accessory', item_name, quantity, unit_price, total_price }
 *   The action discriminator 'add_accessory' tells the API route which
 *   billing service function to call (since the route handles POST for both
 *   add_accessory and generate_bill via the action field).
 *
 * RESPONSE SHAPE (typed inline):
 *   { ok: true, data: { id, item_name, quantity, unit_price } }
 *   OR { ok: false, error: { userMessage: string } }
 *   The userMessage is the user-safe error message from the API error handler
 *   (not the raw database error, which might leak internal details).
 *
 * CACHE INVALIDATION:
 *   On success: ['subject-accessories', subjectId] → refetch
 *   This causes the AccessoriesTable to re-render with the new row.
 *   The bill query is NOT invalidated because no bill exists at this stage
 *   (accessories are added before bill generation).
 *
 * TOAST NOTIFICATION:
 *   onSuccess: toast.success(`${item.item_name} added`)
 *     Uses the item_name from the response to give specific feedback.
 *     e.g. 'Compressor added' (not just 'Accessory added').
 *   onError: toast.error(error.message)
 *
 * @param subjectId  UUID of the subject to add the accessory to.
 * @returns useMutation result: { mutate, mutateAsync, isPending, isError, ... }
 */
export function useAddAccessory(subjectId: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: AddAccessoryInput) => {
      if (!user?.id) throw new Error('Not authenticated');
      
      const res = await fetch(`/api/subjects/${subjectId}/billing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add_accessory', ...input }),
      });
      
      const json = await res.json() as { 
        ok: boolean
        data?: { id: string; item_name: string; quantity: number; mrp: number }
        error?: { userMessage: string }
      };
      
      if (!json.ok) throw new Error(json.error?.userMessage ?? 'Failed to add accessory');
      return json.data!;
    },
    onSuccess: (item) => {
      queryClient.invalidateQueries({ queryKey: ['subject-accessories', subjectId] });
      toast.success(`${item.item_name} added`);
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

/**
 * @summary Mutation hook that removes a single accessory from a subject's bill.
 *
 * @description
 * useRemoveAccessory() sends a DELETE request to /api/subjects/[id]/billing
 * with { action: 'remove_accessory', accessoryId }. The API delegates to
 * removeAccessory() in the billing service which hard-deletes the row.
 *
 * WHY DELETE (HARD) RATHER THAN SOFT-DELETE:
 *   Accessories are ephemeral line items — they don't have relationships
 *   to other tables (no foreign keys reference subject_accessories.id except
 *   for display purposes). A soft delete flag would complicate every query
 *   that sums accessories_total. Hard delete is appropriate.
 *   Note: if the subject_bill is already generated, removeAccessory() in the
 *   service returns an error ('Cannot remove accessory: bill already generated').
 *   The API surfaces this as a userMessage, and this hook shows it via toast.error.
 *
 * AUTH GUARD:
 *   if (!user?.id) throw new Error('Not authenticated')
 *   Same early-exit pattern as useAddAccessory. Prevents a confusing 401.
 *
 * REQUEST SHAPE:
 *   Method: DELETE
 *   URL: /api/subjects/{subjectId}/billing
 *   Body (JSON): { action: 'remove_accessory', accessoryId: '<uuid>' }
 *   Why send a body on DELETE? The Next.js App Router's route handler needs
 *   to distinguish between different DELETE operations (though currently only
 *   'remove_accessory' exists). The action field keeps it consistent with
 *   the POST handler pattern.
 *
 * RESPONSE SHAPE:
 *   { ok: true } — accessory was hard-deleted (no data returned in body)
 *   { ok: false, error: { userMessage: string } }
 *
 * CACHE INVALIDATION:
 *   On success: ['subject-accessories', subjectId] → refetch
 *   AccessoriesTable re-renders with the row removed and updated total.
 *   No detail or bill invalidation (bill doesn't exist yet at this stage,
 *   and even if it does, the service would have blocked the delete).
 *
 * TOAST NOTIFICATION:
 *   onSuccess: toast.success('Accessory removed')
 *   onError: toast.error(error.message)
 *
 * @param subjectId  UUID of the subject the accessory belongs to.
 * @returns useMutation result: { mutate(accessoryId: string), isPending, ... }
 */
export function useRemoveAccessory(subjectId: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (accessoryId: string) => {
      if (!user?.id) throw new Error('Not authenticated');
      
      const res = await fetch(`/api/subjects/${subjectId}/billing`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove_accessory', accessoryId }),
      });
      
      const json = await res.json() as { 
        ok: boolean
        error?: { userMessage: string }
      };
      
      if (!json.ok) throw new Error(json.error?.userMessage ?? 'Failed to remove accessory');
      return null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subject-accessories', subjectId] });
      toast.success('Accessory removed');
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

/**
 * @summary Mutation hook that orchestrates full bill generation for a subject.
 *
 * @description
 * useGenerateBill() is the most consequential mutation in this file. When it
 * succeeds, the job transitions from IN_PROGRESS to COMPLETED and the bill
 * is locked. It coordinates a POST to /api/subjects/[id]/billing with
 * action='generate_bill', then invalidates FOUR cache keys to refresh
 * every part of the Subject Detail page simultaneously.
 *
 * WHEN THIS HOOK IS USED:
 *   The GenerateBillForm component is rendered when:
 *     1. subject.status === 'IN_PROGRESS'
 *     2. subject.bill_generated === false (no bill exists)
 *   The form collects: visit_charge, service_charge, payment_mode (conditional),
 *   and optionally accessories[]. On submit, mutate(formValues) is called.
 *
 * AUTH GUARD:
 *   if (!user?.id) throw new Error('Not authenticated')
 *   Prevents a race condition where the user's token expires while the
 *   bill form is open (common on slow mobile connections).
 *
 * REQUEST SHAPE:
 *   Method: POST
 *   URL: /api/subjects/{subjectId}/billing
 *   Body: {
 *     action: 'generate_bill',
 *     visit_charge: number,       // default 0
 *     service_charge: number,     // default 0
 *     payment_mode: string|null,  // required for customer-pay bills
 *     accessories: [...]          // optional inline accessory items
 *   }
 *
 * RESPONSE SHAPE:
 *   { ok: true, data: { id, bill_number, bill_type, grand_total } }
 *   OR { ok: false, error: { userMessage: string } }
 *   Common error scenarios:
 *   • 'Not assigned to this subject' (403)
 *   • 'Bill already generated' (409 duplicate)
 *   • 'Required photos not uploaded: before_repair, ...' (422)
 *   • 'Payment mode is required for out-of-warranty jobs' (422)
 *
 * FOUR-KEY CACHE INVALIDATION PATTERN:
 *   On success, all four queries are invalidated simultaneously:
 *
 *   1. SUBJECT_QUERY_KEYS.detail(subjectId)
 *      → Causes the SubjectDetailHeader to re-fetch the full subject.
 *      → Updates: status='COMPLETED', bill_generated=true, grand_total,
 *        visit_charge, service_charge, billing_status in the header.
 *
 *   2. SUBJECT_QUERY_KEYS.list
 *      → Causes the SubjectList sidebar/page to refresh.
 *      → Updates: billing_status, status columns in the list view.
 *      → Completed jobs typically move to a different queue (COMPLETED filter).
 *
 *   3. ['subject-accessories', subjectId]
 *      → Re-fetches accessories in case any were inserted by the service
 *        during bill generation (Step 5: insert inline accessories).
 *
 *   4. ['subject-bill', subjectId]
 *      → Causes BillCard to appear (previously no bill existed).
 *      → BillCard shows bill_number, grand_total, payment_status.
 *
 *   React Query processes all four invalidations asynchronously and
 *   each query refetches independently without blocking the others.
 *
 * TOAST NOTIFICATION:
 *   onSuccess: toast.success('Bill generated and job completed successfully')
 *   This is a high-signal message — the combination of bill + completion
 *   is important enough to use a compound success message.
 *   onError: toast.error(error.message)
 *
 * @param subjectId  UUID of the subject to generate the bill for.
 * @returns useMutation result: { mutate(input: GenerateBillInput), isPending, ... }
 */
export function useGenerateBill(subjectId: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: GenerateBillInput) => {
      if (!user?.id) throw new Error('Not authenticated');
      
      const res = await fetch(`/api/subjects/${subjectId}/billing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate_bill', ...input }),
      });
      
      const json = await res.json() as { 
        ok: boolean
        data?: { id: string; bill_number: string; bill_type: string; grand_total: number }
        error?: { userMessage: string }
      };
      
      if (!json.ok) throw new Error(json.error?.userMessage ?? 'Failed to generate bill');
      return json.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SUBJECT_QUERY_KEYS.detail(subjectId) });
      queryClient.invalidateQueries({ queryKey: SUBJECT_QUERY_KEYS.list });
      queryClient.invalidateQueries({ queryKey: ['subject-accessories', subjectId] });
      queryClient.invalidateQueries({ queryKey: ['subject-bill', subjectId] });
      toast.success('Bill generated and job completed successfully');
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

/**
 * @summary React Query hook that fetches the existing bill for a subject.
 *
 * @description
 * useSubjectBill() is a READ-ONLY query hook that fetches the subject_bills row
 * for the given subject from the browser (using RLS-enforced client), calling
 * getBillBySubject() from the billing service.
 *
 * THE NULL-RETURNING PATTERN — WHY THIS HOOK RETURNS NULL (not throws):
 *   getBillBySubject() returns { ok: false, error: 'Bill not found' } when no
 *   bill has been generated for the subject. The queryFn INTERCEPTS this specific
 *   error and returns null instead of throwing.
 *
 *   WHY THIS DESIGN:
 *     If the queryFn threw on 'Bill not found', React Query would mark the
 *     query as errored and BillingSection would show its error boundary state.
 *     But 'no bill yet' is NOT an error — it's the normal state for a job that
 *     is still in progress. The component needs to choose between:
 *       - bill === null   → render GenerateBillForm
 *       - bill !== null   → render BillCard (view/download/edit)
 *     Returning null cleanly communicates 'bill does not exist yet' to the
 *     component as data, not as an error state.
 *
 *   For any OTHER error from getBillBySubject (network failure, DB error),
 *   the queryFn DOES throw, marking the query as errored (correct behavior).
 *
 * QUERY KEY:
 *   ['subject-bill', subjectId]
 *   Independent per subject so multiple subjects can be open simultaneously
 *   (e.g., admin tab-per-job workflow).
 *
 * ENABLED GUARD:
 *   enabled: Boolean(subjectId)
 *   Prevents the query running before the subjectId is known.
 *
 * STALE TIME:
 *   Default (0). Bills are re-fetched on every window focus.
 *   Since bills rarely change after generation (they're locked), this is
 *   slightly aggressive. A future optimization might set staleTime: 60_000
 *   for generated bills and staleTime: 0 for null (not-yet-generated) bills.
 *
 * @param subjectId  UUID of the subject to fetch the bill for.
 * @returns React Query result where data is SubjectBill | null:
 *   - null:          No bill has been generated yet
 *   - SubjectBill:   The generated bill record
 *   - isLoading:     Initial fetch in progress
 *   - isError:       A non-404 error occurred (network, DB, etc.)
 */
export function useSubjectBill(subjectId: string) {
  return useQuery({
    queryKey: ['subject-bill', subjectId],
    queryFn: async () => {
      const result = await getBillBySubject(subjectId);
      if (!result.ok) {
        if (result.error.message === 'Bill not found for subject') {
          return null;
        }
        throw new Error(result.error.message);
      }
      return result.data;
    },
    enabled: Boolean(subjectId),
  });
}

/**
 * @summary Async callback (not a mutation) that downloads the bill as a PDF.
 *
 * @description
 * useDownloadBill() returns an ASYNC FUNCTION (not a React Query mutation).
 * The caller invokes it as: const downloadBill = useDownloadBill(); downloadBill(billId);
 *
 * WHY NOT useMutation:
 *   PDF download doesn't mutate DB state. It also has specific browser behavior
 *   (blob URL creation, programmatic anchor click) that doesn't fit the
 *   React Query mutation lifecycle (onSuccess/onError/onSettled). An async
 *   function with try/catch/finally is simpler and more transparent.
 *
 * BLOB DOWNLOAD TECHNIQUE (the only reliable cross-browser approach):
 *   Step 1: fetch('/api/bills/{billId}/download')
 *           The server generates the PDF in memory and streams it back with:
 *           Content-Type: application/pdf
 *           Content-Disposition: attachment; filename="INV-2024-001500.pdf"
 *
 *   Step 2: await response.blob()
 *           Reads the entire response body into a Blob object in browser memory.
 *           This is synchronous-feeling but internally uses streaming under the hood.
 *
 *   Step 3: window.URL.createObjectURL(blob)
 *           Creates a temporary local URL like: blob:http://localhost:3000/a1b2c3...
 *           This URL only exists in the current browser session (not persistent).
 *
 *   Step 4: Create a hidden <a> element
 *           a.href = blobUrl
 *           a.download = filename  → triggers browser save dialog / auto-download
 *           document.body.appendChild(a) then a.click()
 *           The browser intercepts the click and initiates the file download.
 *
 *   Step 5: Cleanup
 *           a.remove() — remove the <a> element from the DOM
 *           window.URL.revokeObjectURL(url) — free the blob memory
 *           Without revokeObjectURL(), the blob stays in memory for the entire
 *           session (memory leak risk for large PDFs).
 *
 * FILENAME EXTRACTION:
 *   response.headers.get('Content-Disposition')?.split('filename=')[1]?.replaceAll('"', '')
 *   ?? fallbackName
 *
 *   The Content-Disposition header value looks like:
 *     'attachment; filename="INV-2024-001500.pdf"'
 *   Splitting on 'filename=' and stripping quotes gives: 'INV-2024-001500.pdf'
 *   The fallback `bill-${billId}.pdf` is used when the header is absent
 *   (e.g., development environments, unexpected responses).
 *
 * LOADING TOAST:
 *   toast.loading('Generating bill PDF...') returns a loadingId.
 *   toast.dismiss(loadingId) is called in finally (always, even on error).
 *   This ensures the loading toast doesn't stay open if the fetch fails.
 *
 * @returns An async function: (billId: string) => Promise<void>
 */
export function useDownloadBill() {
  return async (billId: string) => {
    const loadingId = toast.loading('Generating bill PDF...');
    try {
      const response = await fetch(`/api/bills/${billId}/download`);
      if (!response.ok) {
        throw new Error('Failed to download bill');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const fallbackName = `bill-${billId}.pdf`;
      const headerName = response.headers.get('Content-Disposition')?.split('filename=')[1]?.replaceAll('"', '') ?? fallbackName;
      a.download = headerName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Download started');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to download bill');
    } finally {
      toast.dismiss(loadingId);
    }
  };
}

/**
 * @summary Mutation hook that updates the payment status of an existing bill.
 *
 * @description
 * useUpdateBillPaymentStatus() is an ADMIN/OFFICE STAFF operation that
 * changes the payment_status field on an existing bill from 'due' to 'paid',
 * 'waived', or back to 'due'. It sends a PATCH request to the billing API.
 *
 * WHEN THIS IS USED:
 *   Scenario 1: Brand-dealer invoice was generated (payment_status='due').
 *               Admin confirms brand sends payment → update to 'paid'.
 *   Scenario 2: Customer paid but technician forgot to select payment_mode
 *               during bill generation → admin back-fills via this hook.
 *   Scenario 3: Admin decides to waive payment (goodwill, repeat customer).
 *   Scenario 4: Admin corrects a premature 'paid' marking → revert to 'due'.
 *
 * ROLE RESTRICTION:
 *   The service layer (updateBillPaymentStatus in billing.service.ts) validates
 *   that the caller's role is 'office_staff' or 'super_admin'. The API route
 *   also enforces this at the session level. This hook provides no extra
 *   role check — it trusts the server to reject unauthorized callers.
 *
 * REQUEST SHAPE:
 *   Method: PATCH
 *   URL: /api/subjects/{subjectId}/billing
 *   Body: {
 *     action: 'update_payment_status',
 *     billId: '<uuid>',
 *     paymentStatus: 'paid' | 'due' | 'waived',
 *     paymentMode?: 'cash' | 'upi' | 'card' | 'cheque'  // optional
 *   }
 *   paymentMode is included when the admin is back-filling payment method
 *   (e.g., customer paid by UPI but technician didn't record it).
 *
 * RESPONSE SHAPE:
 *   { ok: true, data: { id, payment_status } }
 *   OR { ok: false, error: { userMessage: string } }
 *
 * TWO-KEY CACHE INVALIDATION:
 *   1. ['subject-bill', subjectId] → BillCard shows updated payment_status badge
 *   2. SUBJECT_QUERY_KEYS.detail(subjectId) → SubjectDetailHeader updates
 *      billing_status and payment_collected flags
 *
 * TOAST NOTIFICATION:
 *   onSuccess: toast.success('Payment status updated')
 *   onError: toast.error(error.message)
 *
 * @param subjectId  UUID of the subject whose bill is being updated.
 * @returns useMutation result: { mutate({ billId, paymentStatus, paymentMode? }), ... }
 */
export function useUpdateBillPaymentStatus(subjectId: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ billId, paymentStatus, paymentMode }: { billId: string; paymentStatus: 'paid' | 'due' | 'waived'; paymentMode?: 'cash' | 'upi' | 'card' | 'cheque' }) => {
      if (!user?.id) throw new Error('Not authenticated');
      
      const res = await fetch(`/api/subjects/${subjectId}/billing`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_payment_status', billId, paymentStatus, paymentMode }),
      });
      
      const json = await res.json() as { 
        ok: boolean
        data?: { id: string; payment_status: 'paid' | 'due' | 'waived' }
        error?: { userMessage: string }
      };
      
      if (!json.ok) throw new Error(json.error?.userMessage ?? 'Failed to update payment status');
      return json.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subject-bill', subjectId] });
      queryClient.invalidateQueries({ queryKey: SUBJECT_QUERY_KEYS.detail(subjectId) });
      toast.success('Payment status updated');
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

/**
 * @summary Mutation hook that edits an existing bill's charges and accessories.
 *
 * @description
 * useEditBill() is an ADMIN-ONLY operation that allows modifying a generated
 * bill's financial fields (visit_charge, service_charge, apply_gst) and
 * replacing the accessory list. It sends a PUT request to the billing API.
 *
 * WHEN EDITING IS ALLOWED:
 *   Generated bills are considered locked financial documents, but admins can
 *   edit them before the payment is collected (billing_status != 'paid').
 *   The service (editBill()) returns an error if the bill's payment_status
 *   is already 'paid' — the guard message is:
 *   'Cannot edit a bill that has already been paid'
 *
 * WHY PUT (NOT PATCH):
 *   PUT semantics: the full EditBillInput replaces the bill's editable fields.
 *   This avoids partial-update confusion — the admin always submits the
 *   complete set of charges and the full accessories list.
 *   (PATCH would imply only changed fields are sent.)
 *
 * NO AUTH GUARD IN THIS HOOK:
 *   Unlike mutations that technicians can call (useAddAccessory, useRemoveAccessory,
 *   useGenerateBill), useEditBill deliberately does NOT check user?.id before fetching.
 *   The API route itself validates the session and rejects unauthenticated requests.
 *   The admin-only restriction is enforced server-side by the API route role check.
 *   This hook is only rendered in the admin UI so the risk is minimal.
 *
 * REQUEST SHAPE:
 *   Method: PUT
 *   URL: /api/subjects/{subjectId}/billing
 *   Body (EditBillInput): {
 *     billId: '<uuid>',
 *     visit_charge?: number,
 *     service_charge?: number,
 *     accessories?: [{ item_name, quantity, unit_price, total_price }],
 *     apply_gst?: boolean
 *   }
 *   The server recomputes grand_total = visit + service + accessories + GST.
 *
 * RESPONSE SHAPE:
 *   { ok: true, data: { id, grand_total, accessories_total, visit_charge, service_charge } }
 *   OR { ok: false, error: { userMessage: string } }
 *
 * FOUR-KEY CACHE INVALIDATION:
 *   On success, the same four keys are invalidated as in useGenerateBill:
 *
 *   1. ['subject-bill', subjectId]
 *      → BillCard re-renders with corrected totals and new bill fields.
 *
 *   2. ['subject-accessories', subjectId]
 *      → AccessoriesTable refreshes (accessories may have been replaced).
 *
 *   3. SUBJECT_QUERY_KEYS.detail(subjectId)
 *      → SubjectDetailHeader updates visit_charge, grand_total display.
 *
 *   4. SUBJECT_QUERY_KEYS.list
 *      → List view shows correct billing_status after edit.
 *
 * TOAST NOTIFICATION:
 *   onSuccess: toast.success('Bill updated successfully')
 *   onError: toast.error(error.message)
 *
 * @param subjectId  UUID of the subject whose bill is being edited.
 * @returns useMutation result: { mutate(input: EditBillInput), isPending, ... }
 */
export function useEditBill(subjectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: EditBillInput) => {
      const res = await fetch(`/api/subjects/${subjectId}/billing`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      const json = await res.json() as {
        ok: boolean;
        data?: { id: string; grand_total: number; accessories_total: number; visit_charge: number; service_charge: number };
        error?: { userMessage: string };
      };

      if (!json.ok) throw new Error(json.error?.userMessage ?? 'Failed to update bill');
      return json.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subject-bill', subjectId] });
      queryClient.invalidateQueries({ queryKey: ['subject-accessories', subjectId] });
      queryClient.invalidateQueries({ queryKey: SUBJECT_QUERY_KEYS.detail(subjectId) });
      queryClient.invalidateQueries({ queryKey: SUBJECT_QUERY_KEYS.list });
      toast.success('Bill updated successfully');
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
