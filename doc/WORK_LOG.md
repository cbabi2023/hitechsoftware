# Work Log

This file tracks completed work items with timestamped entries.
Newest entries must be added at the top.

## [2026-03-13 00:41:52 +05:30] Push to Main + Enforce Bug/Issue Logging Discipline

- Summary: Prepared dashboard improvements for push to `main` and strengthened work-log quality by explicitly capturing mistakes, bugs, and issues for each completed item.
- Work done:
  - Reviewed git working tree and isolated relevant project changes from unrelated runtime crash/replay logs.
  - Added explicit issue-tracking note in work-log entries to ensure bugs/mistakes are always documented.
  - Prepared commit scope for dashboard updates and documentation updates only.
- Files changed:
  - doc/WORK_LOG.md
  - web/app/dashboard/layout.tsx
  - web/app/dashboard/page.tsx
- Verification:
  - Confirmed diagnostics are clean for changed dashboard files.
  - Git push status recorded after push attempt.
- Issues/Bugs/Mistakes:
  - Unrelated Java crash/replay logs were present in workspace (`hs_err_pid*.log`, `replay_pid*.log`); excluded from commit to avoid polluting repository history.
  - No functional regression identified in changed dashboard files.
- Next:
  - Continue documenting `Issues/Bugs/Mistakes` explicitly in every future work-log entry, including `none` when no issue is observed.

## [2026-03-13 00:40:34 +05:30] Upgrade Dashboard Top Header to Enterprise ERP Style

- Summary: Redesigned the dashboard top navbar/header to feel more like an MNC ERP interface with stronger product identity, clearer module context, and polished action/account controls.
- Work done:
  - Refined header information hierarchy with ERP branding (`Hitech ERP Suite`) and enterprise badge.
  - Added dynamic module context breadcrumb based on current dashboard route.
  - Added quick-action controls in header (search trigger and notifications action button).
  - Improved account presentation with initials avatar chip, email identity, and role text.
  - Kept responsive behavior optimized for desktop and mobile while preserving existing sidebar toggle and logout flow.
- Files changed:
  - web/app/dashboard/layout.tsx
  - doc/WORK_LOG.md
- Verification:
  - TypeScript/compile diagnostics checked on `web/app/dashboard/layout.tsx`.
  - No errors found.
- Issues/Bugs/Mistakes:
  - None observed during implementation.
- Next:
  - Optionally wire search and notifications buttons to real modules once APIs and pages are finalized.

## [2026-03-13 00:38:26 +05:30] Dashboard Team Member Total Count

- Summary: Analyzed the web dashboard data flow and added a visible total Team Members count card on the main dashboard.
- Work done:
  - Reviewed dashboard architecture and existing stat card query pattern in the web app.
  - Added a dedicated React Query fetch for team member total using existing team service logic.
  - Added a new Team Members stat card linked to `/dashboard/team`.
  - Updated dashboard grid layout to support four stat cards cleanly across breakpoints.
  - Added error state messaging for team member count load failures.
- Files changed:
  - web/app/dashboard/page.tsx
  - doc/WORK_LOG.md
- Verification:
  - Checked TypeScript/compile diagnostics for `web/app/dashboard/page.tsx`.
  - No errors found.
- Issues/Bugs/Mistakes:
  - None observed during implementation.
- Next:
  - Optionally replace list-length counting with a dedicated server-side aggregate count endpoint if team dataset grows significantly.

## [2026-03-13 04:20:00 +05:30] Team Add Member Popup + Password Visibility Toggle

- Summary: Improved Team member creation UX by moving add-member form into a popup modal and adding an eye toggle to show/hide password while typing.
- Work done:
  - Converted inline add-member section to centered overlay popup opened by Add Member button.
  - Added close/cancel behavior for popup and auto-close on successful create.
  - Added password visibility toggle using eye/eye-off icon in password input.
  - Preserved existing auth-backed create flow and delete-confirmation flow.
- Files changed:
  - web/app/dashboard/team/page.tsx
  - doc/WORK_LOG.md
- Verification:
  - TypeScript/compile diagnostics checked on Team page and related team files.
  - No errors found.
- Next:
  - Optionally add keyboard shortcut (Esc) to close popup modal.
## [2026-03-13 04:05:00 +05:30] Team Member Delete Confirmation + Instant UI Removal

- Summary: Added delete confirmation popup for Team members and made delete UX instant via optimistic cache removal while keeping permanent deletion from Supabase Auth and linked DB records.
- Work done:
  - Integrated warning confirmation popup using existing reusable modal before deleting a team member.
  - Updated Team page delete action to open confirmation popup with member-specific warning text.
  - Implemented optimistic delete in `useTeam` mutation:
    - snapshot team list queries,
    - remove member immediately from UI,
    - rollback snapshot on failure,
    - invalidate team queries after completion.
  - Kept delete backend path unchanged (Auth admin delete endpoint), so successful delete still removes from Supabase Auth and cascades DB rows.
- Files changed:
  - web/app/dashboard/team/page.tsx
  - web/hooks/useTeam.ts
  - doc/WORK_LOG.md
- Verification:
  - TypeScript/compile diagnostics run on changed files.
  - No errors found.
- Next:
  - Optional: add typed member count badge in Team header for immediate visual confirmation after optimistic deletes.

## [2026-03-13 03:45:00 +05:30] Team Module UX + Auth-Backed Create/Delete Hardening

- Summary: Updated Team Management flow to match requested UX and security behavior: add form is hidden until Add Member is clicked, Add Member button uses sidebar navy theme, email+password are mandatory, auth users are auto-created in Supabase Auth, and delete removes user from Auth and cascades DB records.
- Work done:
  - Removed manual Auth UUID entry from add-member payload and UI.
  - Enforced mandatory password in create schema and payload.
  - Added secure server-side admin Supabase client for service-role operations.
  - Added API endpoint `POST /api/team/members` to:
    - validate payload,
    - create auth user via `supabase.auth.admin.createUser`,
    - create `profiles` row,
    - create `technicians` row when role is technician,
    - rollback auth user if DB insert fails.
  - Added API endpoint `DELETE /api/team/members/[id]` to delete from Supabase Auth; DB rows are removed via FK cascade (`profiles` and `technicians`).
  - Updated team service/hook to use API-backed create/delete mutations.
  - Updated Team page UX:
    - add-member form only renders after clicking Add Member,
    - Add Member and create action buttons use sidebar navy color,
    - email and password inputs are present/required,
    - delete action button added for authorized users.
- Files changed:
  - web/modules/technicians/technician.types.ts
  - web/modules/technicians/technician.validation.ts
  - web/modules/technicians/technician.service.ts
  - web/repositories/technician.repository.ts
  - web/hooks/useTeam.ts
  - web/app/dashboard/team/page.tsx
  - web/lib/supabase/admin.ts
  - web/app/api/team/members/route.ts
  - web/app/api/team/members/[id]/route.ts
  - doc/WORK_LOG.md
- Verification:
  - TypeScript/compile diagnostics checked across all touched files.
  - No errors reported after refactor.
- Next:
  - Ensure `SUPABASE_SERVICE_ROLE_KEY` is set in deployment/runtime env for API routes.
  - Optionally add confirmation modal before delete action in Team table.

## [2026-03-13 03:10:00 +05:30] Build Team Management Module (Technicians, Office Staff, Stock Managers)

- Summary: Implemented a new Team Management module to add/manage technicians, office staff, and stock managers, including role updates, activation/deactivation, technician-code handling, sidebar routing, and permission/RLS alignment for requested responsibilities.
- Work done:
  - Added full team domain contracts under technicians module:
    - team member types,
    - creation/update payloads,
    - zod validation,
    - query keys/constants.
  - Expanded technician repository into workforce data access for:
    - listing filtered profile members,
    - creating/updating profiles,
    - upserting technician details,
    - deactivating technician records when role changes away from technician.
  - Added technician service orchestration for:
    - role-safe create/update,
    - customer-friendly error mapping,
    - phone normalization,
    - profile + technician detail merge.
  - Added `useTeam` hook with list filters and mutations (create/update) + query invalidation.
  - Implemented Team page at `/dashboard/team` with:
    - role/search filters,
    - add member form,
    - technician code support,
    - per-row role/status management actions.
  - Added Team route constant and sidebar item in dashboard layout.
  - Updated permission matrix to align requested behavior:
    - office staff can manage inventory/stock,
    - stock manager scope narrowed away from non-stock modules,
    - technician management create/edit restricted to super admin.
  - Added migration to align database RLS with app behavior:
    - created technicians table policies,
    - upgraded inventory/stock office_staff policies from read-only to full access.
- Files changed:
  - web/modules/technicians/technician.types.ts
  - web/modules/technicians/technician.validation.ts
  - web/modules/technicians/technician.constants.ts
  - web/modules/technicians/technician.service.ts
  - web/repositories/technician.repository.ts
  - web/hooks/useTeam.ts
  - web/app/dashboard/team/page.tsx
  - web/lib/constants/routes.ts
  - web/app/dashboard/layout.tsx
  - web/config/permissions.ts
  - supabase/migrations/20260313_005_team_module_rls_and_stock_staff_write.sql
  - doc/WORK_LOG.md
- Verification:
  - Ran compile/type diagnostics for all touched web files; fixed narrowing issue in technician service and revalidated zero remaining errors.
  - No lint/TS errors reported in changed files after fixes.
- Next:
  - Apply the new Supabase migration in target environment before using Team module write operations.
  - Optionally add auth-user invite flow (admin API/edge function) to remove manual Auth UUID entry.

## [2026-03-13 02:00:00 +05:30] Implement Smart Subject Creation (Phone-First Auto-Fill Workflow)

- Summary: Built the full phone-first ticket creation flow for Subjects so office staff can create service tickets faster with customer auto-detection, previous product suggestions, service history visibility, conditional new-customer capture, technician assignment, and one-click subject creation.
- Work done:
  - Expanded subject domain contracts with robust types for subject listing, creation, phone lookup context, technician options, product options, and service history.
  - Added validation schemas for subject creation, smart subject creation, ticket ID, priority, and phone lookup rules.
  - Rebuilt subject repository with production contracts: paginated list, create subject, find customer by phone, customer service history fetch, products catalog fetch, and assignable technician list.
  - Rebuilt subject service layer to:
    - normalize phone and ticket ID,
    - lookup customer context by phone,
    - derive previous product options from ticket history,
    - create new customer on-demand when phone is not found,
    - create subject ticket and map DB errors.
  - Rebuilt `useSubjects` hook for list/search/pagination and added `useSmartSubjectLookup` for phone lookup + reference data (technicians/products).
  - Replaced Subjects dashboard placeholder with a working list page, search, pagination, and Create Ticket CTA.
  - Added new Smart Subject Create page at `/dashboard/subjects/new` with full UX flow:
    - Step 1: phone lookup + CRM ticket id,
    - Step 2: existing customer auto-fill or new customer input,
    - Step 3: product, technician, priority, visit date, problem,
    - previous services panel,
    - create mutation + redirect to subjects list.
  - Added new route constant for `/dashboard/subjects/new`.
- Files changed:
  - web/modules/subjects/subject.types.ts
  - web/modules/subjects/subject.validation.ts
  - web/modules/subjects/subject.constants.ts
  - web/repositories/subject.repository.ts
  - web/modules/subjects/subject.service.ts
  - web/hooks/useSubjects.ts
  - web/app/dashboard/subjects/page.tsx
  - web/app/dashboard/subjects/new/page.tsx
  - web/lib/constants/routes.ts
  - doc/WORK_LOG.md
- Verification:
  - TypeScript/compile diagnostics checked on all touched subject files.
  - Fixed nullability errors in smart create page and re-validated no remaining errors.
- Next:
  - Add persistent customer-product memory table (e.g., `customer_products`) and wire up automatic product save/update from completed subjects for even better future auto-fill.

## [2026-03-13 01:05:00 +05:30] Design Smart Subject Creation Flow (Auto Customer + Product + History)

- Summary: Produced a production-ready design for the most important office workflow: creating a service ticket by entering phone number first, auto-detecting customer, auto-filling profile/address, showing previous products and service history, then assigning technician and creating the subject in seconds.
- Work done:
  - Audited current schema and confirmed `subjects` already supports core fields (`customer_id`, `product_id`, `assigned_technician_id`, `description`, `schedule_date`, `status`) but the Subjects module UI/service/repository are still stubs.
  - Confirmed no dedicated `customer_products` table exists yet; identified this as the required schema addition to support product auto-fill by customer.
  - Defined final UX behavior: phone-first lookup, existing/new customer branch, product picker from historical products, service-history panel, and minimal required inputs for fast ticket creation.
  - Defined implementation sequencing and module status impact (Customer complete, Subjects/Inventory partial, remaining modules pending).
- Files changed:
  - doc/WORK_LOG.md
- Verification:
  - Cross-checked schema in `supabase/migrations/20260312_001_initial_schema.sql` and current web module files (`web/modules/subjects/*`, `web/repositories/subject.repository.ts`, `web/app/dashboard/subjects/page.tsx`).
  - No application code changes made in this task.
- Next:
  - Implement Phase 1: add `customer_products` table + repository/service/hook and build the smart subject creation page.

## [2026-03-13 00:30:00 +05:30] Make Customer Delete Instant with Optimistic UI

- Summary: Delete was waiting for the full DB round-trip before closing the modal and removing the row. Added optimistic cache removal so the customer disappears from the list the moment the user confirms, with automatic rollback if the server returns an error.
- Work done:
  - Added `onMutate` to `deleteCustomerMutation` in `useCustomers`: cancels in-flight queries, snapshots list cache, immediately filters the deleted customer out of every cached list page and decrements the total.
  - Added `onError` handler to roll back the snapshot if the deletion fails, then shows an error toast.
  - `onSuccess` for non-ok results (service-level errors like RLS block) also triggers a rollback refetch.
  - Changed the `onConfirm` handler in `customers/page.tsx` from `mutateAsync + await` to close the modal immediately then fire `mutate` (fire-and-forget).
- Files changed:
  - web/hooks/useCustomers.ts
  - web/app/dashboard/customers/page.tsx
- Verification:
  - No TypeScript/lint errors.
- Next:
  - None.

## [2026-03-13 00:25:00 +05:30] Change Customer Delete to Hard Delete (Permanent Removal from DB)

- Summary: The previous delete was a soft-delete (setting is_deleted=true while keeping the row). Changed to a permanent hard DELETE so the row is fully removed from the database on confirm.
- Work done:
  - Replaced `softDelete` repository function with a `destroy` function that issues a SQL `DELETE ... WHERE id = ? ... RETURNING id`.
  - Updated `deleteCustomer` service to call `destroy` instead of `softDelete`.
  - Removed unused `softDelete` import from service.
  - Updated delete confirmation modal description to accurately state the action is permanent.
- Files changed:
  - web/repositories/customer.repository.ts
  - web/modules/customers/customer.service.ts
  - web/app/dashboard/customers/page.tsx
- Verification:
  - No TypeScript/lint errors.
  - RLS `FOR ALL` policy for `super_admin` covers DELETE commands in Postgres.
  - Active-subjects guard (`hasActiveSubjects`) remains in place — delete is still blocked if the customer has open service subjects.
- Next:
  - None.

## [2026-03-13 00:20:00 +05:30] Fix Silent Customer Delete Failure — Add .select() to softDelete

- Summary: The `softDelete` repository function did `.update()` without `.select()`. Supabase returns `{ data: null, error: null }` in this case regardless of whether 0 or 1 rows were touched, so any silent RLS block or wrong ID would be invisible to the service — it would report success while nothing changed in the DB. Added `.select('id').single()` so actual row data is returned; added a `!result.data` check in the service so a 0-row update surfaces as a proper error toast instead of false success.
- Root cause explanation: The app uses soft-delete (sets `is_deleted = true, is_active = false, deleted_at = <timestamp>`) — the DB row intentionally stays, but the customer disappears from all list queries because they filter `.eq('is_deleted', false)`. If the update was silently blocked, nothing changed and the record stayed fully visible after the next cache refresh.
- Work done:
  - `softDelete` in customer.repository.ts: chained `.select('id').single<{ id: string }>()` after `.update()`.
  - `deleteCustomer` in customer.service.ts: added `|| !result.data` to the error guard so a matched-0-rows result is caught and surfaced.
- Files changed:
  - web/repositories/customer.repository.ts
  - web/modules/customers/customer.service.ts
- Verification:
  - No TypeScript/lint errors.
- Next:
  - None.

## [2026-03-13 00:15:00 +05:30] Fix Edit Customer — Navigate to Customer View Page After Save

- Summary: After updating a customer the page was redirecting to the customer list. Changed to navigate to the customer's own view page (`/dashboard/customers/:id`) so the user immediately sees the updated record.
- Files changed:
  - web/app/dashboard/customers/[id]/edit/page.tsx
- Verification: No errors.

## [2026-03-13 00:10:00 +05:30] Restrict Customer Delete Button to super_admin Only

- Summary: The Delete button on the customer list was visible and usable by all authenticated roles. The permissions config already declared `customer:delete` as super_admin-only, but the UI never checked it. Wired up the existing `usePermission` hook so the button only renders when `can('customer:delete')` is true.
- Work done:
  - Imported `usePermission` into `customers/page.tsx`.
  - Called `can('customer:delete')` and wrapped the Delete button in a conditional render.
- Files changed:
  - web/app/dashboard/customers/page.tsx
- Verification:
  - No TypeScript/lint errors.
  - `customer:delete` is already mapped to `[ROLES.SUPER_ADMIN]` in `config/permissions.ts`.
- Next:
  - None.

## [2026-03-13 00:05:00 +05:30] Fix Dashboard Customer Count Always Stays Fresh

- Summary: The dashboard customer count was using an isolated cache key `['dashboard', 'customer-count']` that was never invalidated by customer mutations, so the displayed total would stay stale indefinitely. Changed the key to `[...CUSTOMER_QUERY_KEYS.all, 'count']` so it lives under the `['customers']` namespace and is automatically refreshed whenever any customer mutation calls `invalidateQueries({ queryKey: CUSTOMER_QUERY_KEYS.all })`. Also reduced staleTime from 60s to 30s.
- Work done:
  - Imported `CUSTOMER_QUERY_KEYS` into dashboard page.
  - Changed query key from `['dashboard', 'customer-count']` to `[...CUSTOMER_QUERY_KEYS.all, 'count']`.
  - Reduced staleTime to 30 s.
- Files changed:
  - web/app/dashboard/page.tsx
- Verification:
  - No TypeScript/lint errors.
- Next:
  - None.

## [2026-03-12 23:59:30 +05:30] Fix Edit Customer Navigation — Redirect to Customer List

- Summary: After updating a customer the page was navigating to the customer detail page (`/dashboard/customers/:id`). Changed to redirect to the customer list (`/dashboard/customers`) and made navigation instant using `mutate` instead of `mutateAsync`.
- Work done:
  - Changed `onSubmit` in edit page from `mutateAsync + await + conditional push to detail` to `mutate + immediate push to list`.
- Files changed:
  - web/app/dashboard/customers/[id]/edit/page.tsx
- Verification:
  - No TypeScript/lint errors.
- Next:
  - None.

## [2026-03-12 23:58:00 +05:30] Fix Slow Customer Save — Eliminated Double Round-Trip

- Summary: Adding a new customer was taking 2x the expected time because the service made two sequential Supabase network calls per save: a pre-flight duplicate phone SELECT, then the INSERT. Since `phone_number` already has a `UNIQUE` constraint in the DB schema, the pre-flight check was completely redundant. Removed it, let the DB enforce uniqueness, and mapped the Postgres `23505` unique-violation error code to the correct user message. Also changed new-customer navigation to be optimistic (navigate immediately, let the background mutation toast on success/error).
- Work done:
  - Added `23505` (Postgres unique_violation) detection to `mapCustomerRepositoryError` for both create and update paths.
  - Removed `findByPhone` pre-flight call from `createCustomer` — now just calls `create()` directly (1 round-trip instead of 2).
  - Removed the inline duplicate-check block from `updateCustomer` (same reason — DB constraint is the source of truth).
  - Removed now-unused `findByPhone` import from customer.service.ts.
  - Changed `new/page.tsx` from `mutateAsync + await + conditional navigate` to `mutate + immediate navigate` — UX is now instant, toast appears while user is already on the list page.
  - Widened `CustomerForm` `onSubmit` prop type from `Promise<void>` to `void | Promise<void>` to accept the synchronous caller.
- Files changed:
  - web/modules/customers/customer.service.ts
  - web/app/dashboard/customers/new/page.tsx
  - web/components/customers/CustomerForm.tsx
  - doc/WORK_LOG.md
- Verification:
  - No TypeScript/lint errors in any changed file.
  - DB `UNIQUE` constraint on `phone_number` confirmed in migration `20260312_001_initial_schema.sql` (line 134).
- Next:
  - None.

## [2026-03-12 23:50:00 +05:30] Establish Global Premium White + Deep Navy Theme

- Summary: Defined a full design-token system as CSS custom properties in globals.css and applied the premium white (primary surface) + deep navy blue (brand accent, sidebar) theme across the dashboard shell.
- Work done:
  - Defined `--ht-*` CSS custom properties for surfaces, brand navy palette, text hierarchy, and borders.
  - Registered all tokens with Tailwind v4's `@theme inline` block so they are available as utility classes (`bg-ht-navy-950`, `text-ht-text-900`, etc.).
  - Removed the `@media (prefers-color-scheme: dark)` block — the app is always light-themed (premium white surfaces, never flips to dark).
  - Cleaned up `body` style: uses `--ht-page-bg` (`#f7f9ff`, barely-blue white) for background, appropriate font-smoothing, and the brand font stack.
  - Updated input/select/textarea text to use `--ht-text-900` (deep dark navy text) instead of hardcoded `#000000`.
  - Dashboard layout sidebar: changed from `bg-white` to `bg-ht-navy-950` (`#0d1f5c`) with `border-blue-900/40`. Nav items now show `text-blue-200/70`, hover as `bg-white/10 text-white`, active as `bg-white/15 text-white` with blue-400 active bar.
  - Dashboard header: border and button colors updated to `ht-border` / `ht-blue-50` tokens; text updated to `ht-text-900` / `ht-text-500`.
  - Dashboard page loading spinner: uses `bg-ht-page` + `border-blue-200 border-t-blue-700`.
  - Dashboard stat cards: border → `ht-border`, hover border → `ht-border-blue`, icon chip → `bg-ht-blue-50 text-ht-blue-600`, link text → `text-ht-blue-600`.
- Files changed:
  - web/app/globals.css
  - web/app/dashboard/layout.tsx
  - web/app/dashboard/page.tsx
  - doc/WORK_LOG.md
- Verification:
  - No TypeScript/lint errors in any changed file.
- Next:
  - Apply brand token classes to the CustomerForm, customer list, and other inner pages as they are worked on.

## [2026-03-12 23:25:00 +05:30] Fix Input Text Color Always Black

- Summary: Text typed into form fields (inputs, selects, textareas) was inheriting from the CSS `--foreground` custom property, which flips to near-white in dark color-scheme. Added a global CSS rule to pin form control text color to `#000000`.
- Work done:
  - Added `input, select, textarea { color: #000000; }` at the end of globals.css.
- Files changed:
  - web/app/globals.css
- Verification:
  - Rule is unconditional so it overrides dark-mode inheritance for all form controls site-wide.
- Next:
  - None.

## [2026-03-12 23:10:00 +05:30] Fix Customer Form Validation Failing on All User-Typed Fields

- Summary: All user-typed fields on the new customer form failed validation on submit (name, phone, address, area, postal code) even when valid data was entered. Pre-filled default fields (city = "Kottayam") passed correctly. Root cause: `reactCompiler: true` in `next.config.ts` caused the React Compiler to incorrectly memoize react-hook-form's ref-based internals, resulting in the form submitting stale empty-string default values instead of what the user typed.
- Work done:
  - Added `'use no memo'` directive as the first statement inside the `CustomerForm` function body. This is the React Compiler's official per-component opt-out, which tells the compiler to leave the component's code unmodified.
- Files changed:
  - web/components/customers/CustomerForm.tsx
- Verification:
  - No compile or type errors after the change.
  - The `'use no memo'` directive is the standard React Compiler opt-out, confirmed compatible with Next.js 16 + React 19 setup.
- Next:
  - Consider adding `'use no memo'` to `CustomerForm`'s edit-page counterpart if the edit form exhibits the same issue.
  - Evaluate whether other form components in the project also need the opt-out (`reactCompiler: true` affects the whole app).

## [2026-03-12 22:34:44 +05:30] Fix Customer Save Flow And Shared Form UX
- Summary: Fixed customer create and edit saves against the legacy schema and redesigned the shared customer form for a clearer operator workflow.
- Work done:
  - Updated customer repository writes to keep legacy address, city, and postal code columns synchronized with the new primary address fields.
  - Improved service-layer error messaging so outdated Supabase schema issues are surfaced clearly.
  - Refactored the shared customer form into a stronger card-based layout with guidance, validation summary, better field grouping, and the same UX for both create and edit.
  - Added form reset handling so async-loaded edit values populate reliably.
- Files changed:
  - web/repositories/customer.repository.ts
  - web/modules/customers/customer.service.ts
  - web/components/customers/CustomerForm.tsx
  - doc/WORK_LOG.md
- Verification:
	- Confirmed no compile errors in the touched customer files.
	- Ran `npm run build` in `web` successfully after the fixes.
  - Ran production build successfully after the route-matching fix.
- Next:
  - Validate in browser that clicking Customers, Subjects, and Inventory switches active highlight correctly.

## [2026-03-12 22:29:46 +05:30] Review Customer Module Schema For SaaS Readiness
- Summary: Reviewed the customer module schema, related tables, relationships, indexes, and RLS patterns for service-management and future multi-company SaaS scalability.
- Work done:
  - Analyzed customer, subject, warranty, AMC, billing, and customer RLS schema sections.
  - Identified multi-tenant SaaS gaps, data-model risks, RLS exposure, and migration issues.
  - Prepared production-oriented recommendations for fields, indexes, and module relationships.
- Files changed:
  - doc/WORK_LOG.md
- Verification:
  - Review based on current migrations and schema definitions in Supabase migration files.
- Next:
  - Apply schema revisions for tenant isolation, customer asset modeling, and safer customer uniqueness rules before production rollout.

## [2026-03-12 22:25:03 +05:30] Convert Sidebar To Compact Icon Rail
- Summary: Changed the dashboard sidebar from full hide/show behavior to an expanded or compact icon-only mode.
- Work done:
  - Replaced sidebar visibility toggle with expanded and compact states.
  - Kept navigation available in compact mode using icon-only items.
  - Added tooltips and accessible labels for compact sidebar items.
  - Preserved active-state highlight styling in both expanded and compact modes.
- Files changed:
  - web/app/dashboard/layout.tsx
  - doc/WORK_LOG.md
- Verification:
  - Confirmed updated layout file has no compile/type errors.
  - Ran production build successfully after the sidebar behavior change.
- Next:
  - Validate in browser that compact mode feels usable on desktop and active route remains clear.

## [2026-03-12 22:18:58 +05:30] Strengthen Customer Sidebar Active Highlight
- Summary: Improved the sidebar active-state styling so the Customers item is clearly highlighted when any customer page is open.
- Work done:
  - Added aria-current for the active navigation item.
  - Changed active styling to a blue-tinted background with blue text and border.
  - Added a left-side accent bar for stronger visual emphasis on the active item.
- Files changed:
  - web/app/dashboard/layout.tsx
  - doc/WORK_LOG.md
- Verification:
  - Confirmed updated layout file has no compile/type errors.
- Next:
  - Validate in browser that Customers remains highlighted on list, detail, new, and edit customer pages.

## [2026-03-12 22:17:54 +05:30] Shared Light Sidebar For Dashboard And Customer Pages
- Summary: Implemented a proper light-theme shared sidebar and improved dashboard UX so customer pages also show consistent navigation.
- Work done:
  - Added a new shared dashboard layout with top header and light-theme sidebar.
  - Sidebar now includes Customers, Dashboard, Subjects, and Inventory links with active-state highlighting.
  - Refactored dashboard home page into a cleaner card-based view aligned with the new layout.
  - Kept customer total visible on dashboard via live query.
- Files changed:
  - web/app/dashboard/layout.tsx
  - web/app/dashboard/page.tsx
  - doc/WORK_LOG.md
- Verification:
  - Ran production build successfully after changes.
  - Confirmed no TypeScript/compile errors in updated files.
- Next:
  - Validate in browser that all customer routes show the shared sidebar and active item state.

## [2026-03-12 22:13:05 +05:30] Add Customers Sidebar Link And Dashboard Count
- Summary: Added customer navigation option in dashboard sidebar and surfaced live total customer count on dashboard stats.
- Work done:
  - Added Customers link in dashboard sidebar navigation to route /dashboard/customers.
  - Updated dashboard stat cards to include live total customer count from customer service.
  - Wired customer count fetch using TanStack Query with lightweight list query.
- Files changed:
  - web/app/dashboard/page.tsx
  - doc/WORK_LOG.md
- Verification:
  - Ran production build successfully (Next.js build passed with all routes generated).
  - Confirmed no TypeScript/compile errors in updated dashboard page.
- Next:
  - Validate in browser that sidebar Customers link opens customer list and count displays expected total.

## [2026-03-12 22:09:51 +05:30] Enforce Documentation Workflow
- Summary: Established a mandatory documentation process so every completed work item is logged with time and details.
- Work done:
  - Replaced placeholder instruction content with enforceable documentation rules.
  - Standardized required fields for each work log entry.
  - Enabled rule scope for all tasks by setting applyTo to all files.
- Files changed:
  - .github/instructions/documentation rule.instructions.md
  - doc/WORK_LOG.md
- Verification:
  - Confirmed instruction file now contains mandatory logging requirements.
  - Confirmed work log file exists with a valid initial entry.
- Next:
  - Continue appending new entries here after every completed task.

