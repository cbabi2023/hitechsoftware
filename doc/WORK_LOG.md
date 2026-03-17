# Work Log

This file tracks completed work items with timestamped entries.
Newest entries must be added at the top.

## [2026-03-17 08:39:26 +05:30] Replace Subjects Action Dropdown with Inline Buttons

- Summary: Removed the 3-dot dropdown from the subjects list actions column and replaced it with direct inline View, Edit, and Delete actions for better clarity and to avoid overflow clipping issues.
- Work done:
  - Removed dropdown-menu action logic from `web/app/dashboard/subjects/page.tsx`.
  - Removed the hidden 3-dot action menu UI from the actions column.
  - Added always-visible inline actions per row: View (blue), Edit (gray), Delete (red).
  - Wrapped Delete action with `ProtectedComponent permission="subject:delete"` so only super admin users can see it.
  - Kept the existing delete confirmation and row-level deleting state behavior.
  - Left API documentation unchanged because this task is UI and permission-presentation only, with no API contract changes.
- Files changed:
  - web/app/dashboard/subjects/page.tsx
  - doc/WORK_LOG.md
- Verification:
  - `get_errors` on `web/app/dashboard/subjects/page.tsx` returned no errors.
  - `npm run build` passed for the web workspace.
- Issues:
  - None
- Next:
  - Browser QA: verify Delete button visibility only for super admin.
  - Browser QA: verify no action clipping on narrow or scrollable table widths.

## [2026-03-17 08:32:12 +05:30] Configure Query Cache Defaults for Faster Return Navigation

- Summary: Updated TanStack Query global defaults so previously loaded data remains fresh for 5 minutes and cached for 10 minutes, reducing refetches when navigating back to pages.
- Work done:
  - Updated `web/components/providers/query-provider.tsx` QueryClient defaults.
  - Added `staleTime: 1000 * 60 * 5` (5 minutes).
  - Added `gcTime: 1000 * 60 * 10` (10 minutes).
  - Confirmed `refetchOnWindowFocus: false` remains in place.
  - Added `refetchOnReconnect: false`.
  - Left API documentation unchanged because this task only updates frontend query cache behavior and does not affect API contracts.
- Files changed:
  - web/components/providers/query-provider.tsx
  - doc/WORK_LOG.md
- Verification:
  - `get_errors` on `web/components/providers/query-provider.tsx` returned no errors.
  - `npm run build` passed for the web workspace.
- Issues:
  - None
- Next:
  - Browser QA: verify list/detail pages open instantly when revisiting within the cache freshness window.

## [2026-03-17 08:31:02 +05:30] Add Animated Loading Skeleton to Subjects Table

- Summary: Replaced the plain loading text state on the subjects list page with a full table skeleton so users immediately see table structure while data is fetching.
- Work done:
  - Updated the loading branch in the subjects table body to render 5 placeholder rows.
  - Added gray placeholder blocks across all columns to mirror the real table shape.
  - Applied Tailwind `animate-pulse` to each skeleton row for the requested loading effect.
  - Preserved existing error, empty-state, and loaded-data branches unchanged.
  - Left API documentation unchanged because this task is UI-only and does not change routes or data contracts.
- Files changed:
  - web/app/dashboard/subjects/page.tsx
  - doc/WORK_LOG.md
- Verification:
  - `get_errors` on `web/app/dashboard/subjects/page.tsx` returned no errors.
  - `npm run build` passed for the web workspace.
- Issues:
  - None
- Next:
  - Browser QA: verify skeleton appears instantly on page load and while refetching list data.

## [2026-03-17 08:25:55 +05:30] Refine Service List UX and Hide Unfinished Demo Modules

- Summary: Cleaned up the service subjects list for office staff by reducing default filter noise, restoring stronger visual hierarchy and urgency cues, correcting branding, and preventing unfinished modules from appearing as ready during demos.
- Work done:
  - Updated the service subjects toolbar so only Search, Status, Filters, and a stronger `+ Create Subject` action are visible by default.
  - Added an expandable advanced filters panel for Source, Brand, Dealer, Category, Priority, From, and To.
  - Added an explicit Dealer filter alongside Brand in advanced filters and wired them to the existing subject filtering state.
  - Changed the service type badge copy from `Warranty` to `Under Warranty`.
  - Improved Assigned To rendering to keep the technician visible with a stronger name line and a secondary technician code line, while preserving the red `Unassigned` badge when nobody is assigned.
  - Added a subtle red left border to rows that need attention, including critical-priority services and unassigned services.
  - Made the View and Edit actions visually consistent.
  - Standardized subject detail date rendering to `en-GB` so the service list and subject detail page both use a consistent DD/MM/YYYY-style presentation.
  - Replaced the incorrect header brand text `Hitech ERP Suite` with `Hi Tech Software`.
  - Marked unfinished top-level modules in the sidebar as `Coming soon` instead of making them appear fully available.
  - Updated the dashboard inventory card and inventory page to present a `Coming soon` state instead of an unfinished placeholder experience.
  - Left API documentation unchanged because this task did not modify routes, request or response payloads, auth behavior, or client-facing backend contracts.
- Files changed:
  - web/app/dashboard/subjects/page.tsx
  - web/app/dashboard/subjects/[id]/page.tsx
  - web/app/dashboard/layout.tsx
  - web/app/dashboard/page.tsx
  - web/app/dashboard/inventory/page.tsx
  - doc/WORK_LOG.md
- Verification:
  - `get_errors` returned no errors for all modified dashboard and subject files.
  - `npm run build` passed for the web workspace with all routes compiling successfully.
- Issues:
  - Assigned technician display still depends on the stored profile `display_name`; if some technician records only contain first names in data, those records should be corrected in the team data itself.
- Next:
  - Browser QA: verify the compact filter bar is easier to scan on desktop and laptop widths.
  - Browser QA: confirm advanced Brand and Dealer filters behave correctly when toggling Source.
  - Browser QA: confirm `Coming soon` sidebar items are non-navigable in the client demo flow.

## [2026-03-17 08:14:31 +05:30] Restore Super Admin Service Delete Action via 3-Dot Menu

- Summary: Added the service deletion action back to the service subjects list as a 3-dot row menu, visible only to super admins, with a confirmation step before deletion.
- Work done:
  - Updated the service list page to use the existing `deleteSubjectMutation` from `useSubjects`.
  - Added a per-row 3-dot action button to the Actions column on the service subjects list.
  - Restricted the 3-dot delete menu to users with `subject:delete`, which maps to super admin only.
  - Added a contextual dropdown with a single `Delete` action for each service row.
  - Added confirmation before deletion and row-level deleting state feedback (`Deleting...`).
  - Added menu-close behavior on outside click and `Escape` key.
  - Left API documentation unchanged because this task did not modify routes, payloads, auth contracts, or backend response shapes.
- Files changed:
  - web/app/dashboard/subjects/page.tsx
  - doc/WORK_LOG.md
- Verification:
  - `get_errors` on `web/app/dashboard/subjects/page.tsx` returned no errors.
  - `npm run build` passed for the monorepo web workspace and compiled `/dashboard/subjects` successfully.
- Issues:
  - None
- Next:
  - Browser QA: verify the 3-dot menu appears only for super admin.
  - Browser QA: verify delete removes the service row and closes the menu correctly.

## [2026-03-17 08:07:51 +05:30] Elevate API Documentation as Mandatory Workflow

- Summary: Updated the project documentation workflow so API documentation is explicitly treated as mandatory and high-priority for every backend or contract-affecting change.
- Work done:
  - Updated the root `README.md` API section to state that `web/docs/API_DOCUMENTATION.md` must be updated whenever routes, payloads, auth rules, repository-backed server behavior, or client-consumed contracts change.
  - Updated the `Documentation Maintenance During Development` section in `README.md` to require API documentation updates in the same work item.
  - Added an API-specific check to the developer pre-push checklist in `README.md`.
  - Updated `web/docs/API_DOCUMENTATION.md` to declare itself mandatory project documentation for all implemented backend contract changes.
- Files changed:
  - README.md
  - web/docs/API_DOCUMENTATION.md
  - doc/WORK_LOG.md
- Verification:
  - Reviewed the updated documentation sections for consistency with the existing workflow rules.
  - No code changes were made; lint/build not required for this documentation-only update.
- Issues:
  - None
- Next:
  - Apply this rule on every future backend, API, auth, or client-contract change.

## [2026-03-17 08:06:22 +05:30] Web Project Analysis and Workflow Review

- Summary: Reviewed the `web` project structure, key documentation, current work-log history, and repository Git configuration to establish the expected coding workflow: analyze against the documented architecture, record every completed task in `doc/WORK_LOG.md`, and push completed work to GitHub `main`.
- Work done:
  - Reviewed the mandatory documentation rule in `.github/instructions/documentation rule.instructions.md`.
  - Reviewed the latest entries in `doc/WORK_LOG.md` to understand the current daily work pattern and verification style.
  - Analyzed the `web` app structure across `app`, `components`, `modules`, `repositories`, `hooks`, `stores`, `config`, `types`, and `docs`.
  - Reviewed core project documentation including root `README.md`, `web/docs/API_DOCUMENTATION.md`, `web/docs/ARCHITECTURE_COMPLIANCE_REPORT.md`, and `web/docs/AUTH_MODULE_MNC_IMPLEMENTATION.md`.
  - Verified repository Git state: current branch is `main`, remote `origin` points to `git@github.com:abijithsupportta/hitechsoftware.git`, and there were no pre-existing uncommitted changes.
  - Identified key implementation shape: Next.js App Router frontend, React Query + Zustand client state, layered modules/services/repositories pattern, and Supabase as the primary backend integration.
  - Identified documentation gap: `web/README.md` is still the default Next.js scaffold and does not yet reflect the actual project architecture or workflow.
- Files changed:
  - doc/WORK_LOG.md
- Verification:
  - Reviewed project and web documentation files successfully.
  - Confirmed Git branch and remote configuration.
  - Confirmed working tree was clean before this entry was added.
- Issues:
  - `web/README.md` is outdated and should be replaced with project-specific setup and architecture guidance.
  - `web/config/navigation.ts` does not match the permission naming used in `web/config/permissions.ts` and should be reviewed before being relied on.
- Next:
  - Replace the scaffolded `web/README.md` with project-specific documentation.
  - Continue logging each completed work item at the top of this file and push completed changes to GitHub `main` after coding.

## [2026-03-13 20:30:00 +05:30] Subjects List Table Redesign — 12-Point Spec + Quick Assign

- Summary: Full redesign of the subjects list (`/dashboard/subjects`) table per a detailed 12-point specification for daily office-staff use. Added `customer_name` to the data pipeline (type → repository → service mapper). Replaced the old `...` dropdown action pattern with inline View/Edit buttons. Added a contextual "Quick Assign" button on the subject detail page.
- Work done:
  - **`SubjectListItem` type**: Added `customer_name: string | null` field between `allocated_date` and `customer_phone`.
  - **Repository SELECT**: Added `customer_name` column to the `listSubjects` Supabase SELECT query so it is fetched from the database.
  - **Service mapper (`mapRawSubjectList`)**: Added `customer_name: string | null` to the raw type annotation and `customer_name: typed.customer_name` to the mapped return object.
  - **Subjects list page — imports**: Removed `useRouter`, `MoreHorizontal`, `PencilLine`, `Trash2` (no more dropdown). Removed `role` from `usePermission` destructure. Removed `deleteSubjectMutation` from `useSubjects` destructure.
  - **Subjects list page — helper functions**: Removed `getCoverageMeta`. Updated `formatDate` to use `en-GB` locale (DD/MM/YYYY). Added `getStatusMeta` with 9 named status colors (PENDING=slate, ALLOCATED=blue, ACCEPTED=indigo, IN_PROGRESS=orange, COMPLETED=green, INCOMPLETE=rose, AWAITING_PARTS=yellow, RESCHEDULED=purple, CANCELLED=slate-200). Added `getServiceTypeMeta` (AMC Free=emerald, Warranty=blue, Chargeable=slate).
  - **Subjects list page — table header**: New 9-column layout: Subject | Customer | Source | Priority | Status | Assigned To | Service Type | Date | Actions. Removed: Service Coverage, Billing, Allocated (renamed to Date).
  - **Subjects list page — row logic**: Rows with `!subject.assigned_technician_id && status === 'PENDING'` get `border-l-4 border-l-rose-400` red left border. Removed click-to-navigate-on-row.
  - **Subjects list page — cell contents**:
    - Subject: bold blue number link + gray category below.
    - Customer: name (bold) + gray phone below, or italic "Walk-in" if no customer name.
    - Source: source name (bold) + "Brand"/"Dealer" gray label below.
    - Priority: standalone colored badge.
    - Status: standalone colored badge (8 named values).
    - Assigned To: technician name text, or rose "Unassigned" badge if null.
    - Service Type: colored badge (AMC Free / Warranty / Chargeable).
    - Date: DD/MM/YYYY format.
    - Actions: inline "View" (blue) + "Edit" (gray, only if `can('subject:edit')`). No dropdown, no delete.
  - **Subjects list page — pagination buttons**: Replaced `ht-btn ht-btn-secondary ht-btn-sm` with direct Tailwind (`inline-flex items-center rounded-lg border...`).
  - **Subjects list page — card wrapper**: Removed `overflow-hidden` from outer div (kept `overflow-x-auto` on inner table wrapper only).
  - **Detail page — Quick Assign**: Added prominent "Quick Assign" button (solid blue, `bg-blue-600`) to the top-right action area, positioned before "Edit subject". Shown contextually only when `can('subject:edit')` AND `subject.assigned_technician_id` is null. Links to the edit page for technician assignment.
- Files changed:
  - web/modules/subjects/subject.types.ts
  - web/repositories/subject.repository.ts
  - web/modules/subjects/subject.service.ts
  - web/app/dashboard/subjects/page.tsx
  - web/app/dashboard/subjects/[id]/page.tsx
- Verification:
  - `npx tsc --noEmit` → zero TypeScript errors
  - `npx next build` → all 18 routes compiled successfully, zero failures
- Issues:
  - None
- Next:
  - Browser QA: verify red border on unassigned+pending rows
  - Browser QA: confirm "Walk-in" renders when customer_name is null
  - Browser QA: confirm "Quick Assign" appears/disappears correctly by assignment state



- Summary: Removed `overflow-hidden` from all three management table wrappers and replaced `ht-btn` utility classes with explicit Tailwind button styles to eliminate any rendering dependency on external CSS classes. Buttons are now fully inline with no dropdown — no clipping possible.
- Work done:
  - **Removed `overflow-hidden`** from the table wrapper `<div>` in all three pages (categories, brands, dealers). The `overflow-hidden` was clipping any content that could overflow the card boundary.
  - **Replaced `ht-btn` classes** with direct Tailwind utility classes on all buttons across all three pages.
  - **Button styles**: Rename = blue outline (`border-blue-200 bg-blue-50 text-blue-700`), Enable/Disable = neutral outline, Delete = rose outline (`border-rose-200 bg-rose-50 text-rose-700`). Save = solid blue, Cancel = neutral outline.
  - **Permission gate on Delete**: Added `{can('service-settings:edit') && ...}` conditional wrapper around the Delete button on all three pages.
  - **Status badge**: Replaced plain "Yes/No" text in Active column with colored pill badge (green=Active, slate=Inactive) on all three pages.
  - **Input field improvements**: Improved inline rename input to `rounded-lg` with focus ring; improved add form input styling with placeholder text.
  - **Row hover**: Added `hover:bg-slate-50/50` to table rows.
  - **Empty state copy**: Improved empty state text to "No X yet. Add one above."
- Files changed:
  - web/app/dashboard/service/categories/page.tsx
  - web/app/dashboard/service/brands/page.tsx
  - web/app/dashboard/service/dealers/page.tsx
- Verification:
  - `get_errors` → zero TypeScript errors on all three files
  - `npm run build` → all 18 routes compiled, zero failures
- Issues:
  - None
- Next:
  - Browser QA: confirm buttons are fully visible without clipping
  - Verify Delete button hidden for non-super_admin roles

## [2026-03-13 18:38:14 +05:30] Subject Form UX Redesign

- Summary: Completely rewrote the Add/Edit Subject form (SubjectForm.tsx) for a significantly cleaner, simpler, and more guided user experience. Replaced the cluttered flat form with a stepped, section-based layout.
- Work done:
  - **Stepped sections**: Form now has 4 numbered sections (Service Info, Priority, Customer, Product) with visual step indicators (numbered circle badges).
  - **Source toggle**: Replaced "Source type" dropdown + separate brand/dealer dropdown with a single inline segmented control (Brand | Dealer toggle) + one select underneath — cleaner mental model.
  - **Type of service toggle**: Replaced dropdown with a two-button segmented control (Service | Installation).
  - **Priority pills**: Replaced priority dropdown with 4 color-coded clickable pill buttons (Critical=red, High=orange, Medium=yellow, Low=green) — visually communicates urgency at a glance.
  - **Required field markers**: Added red asterisk (*) to Subject Number, Category, Source, Type of Service, Allocated Date, Priority, and Reason fields.
  - **Optional field handling**: Customer and Product sections labeled "Optional" with badge. Product Details section is collapsible (chevron toggle) and auto-expands on edit if data exists.
  - **Phone auto-fill**: Retained debounced phone lookup with improved hint copy and a green checkmark icon on success.
  - **Coverage dates**: Grouped purchase date + warranty end + AMC end in a 3-column row with a clarifying note that status is calculated automatically.
  - **Sticky footer**: Submit/Cancel buttons are now in a sticky bottom bar — no more scrolling to the bottom to submit.
  - **Inline submit hint**: When submit is disabled, shows "Fill in all required fields to continue." inline next to the buttons.
  - **Better layout constraints**: Form is max-w-3xl centered with consistent padding and shadow-sm cards.
  - **Label improvements**: Replaced tiny uppercase tracking labels with normal `text-sm font-medium` labels.
  - **Removed unused imports**: Removed `SUBJECT_PRIORITY_OPTIONS`, `SUBJECT_SOURCE_OPTIONS`, `SUBJECT_TYPE_OF_SERVICE_OPTIONS` constants (no longer needed for render).
- Files changed:
  - web/components/subjects/SubjectForm.tsx
- Verification:
  - `get_errors` → zero TypeScript errors
  - `npm run build` → all 18 routes compiled, TypeScript finished in 4.8s, no failures
- Issues:
  - None
- Next:
  - Browser QA: verify form renders and submits correctly in all modes (create + edit)
  - Check mobile layout on narrow screens (grid collapses to 1-col correctly)

## [2026-03-13 18:27:55 +05:30] Full Service Module Audit — Code Layer Fixes

- Summary: Performed a comprehensive audit of the service module across all 10 categories (database, architecture, business logic, UI/UX, permissions, management, form validation, code quality, performance, edge cases). Fixed all identified code-layer gaps.
- Work done:
  - **Search**: Extended `listSubjects` repository query to search by `customer_name` in addition to subject number and phone.
  - **Date cross-validation**: Added `superRefine` rules to `subjectFormSchema` — warranty and AMC end dates cannot be before purchase date; Zod now rejects them with clear messages.
  - **Priority badge colors**: Added `getPriorityMeta()` helper in subjects list page — Critical=red, High=orange, Medium=yellow, Low=green badges.
  - **Category/Brand/Dealer filters**: Added `category_id`, `brand_id`, `dealer_id` to `SubjectListFilters` type, applied them in repository query, exposed `categoryId`/`brandId`/`dealerId` states and setters in `useSubjects` hook, added Brand (or Dealer, context-aware) and Category dropdowns in subjects list filter panel.
  - **Customer phone auto-fill**: Added `lookupCustomerByPhone()` to `customer.service.ts`, expanded `findByPhone()` repository to return address fields. SubjectForm now debounce-calls the lookup on phone change (500ms) and auto-fills `customer_name` + `customer_address` when a matching customer is found, with a green confirmation hint label.
  - **Rename capability**: Added `renameBrand()` / `renameDealer()` service functions; added `renameMutation` to both hooks; added `UpdateBrandInput` / `UpdateDealerInput` types. All three management pages (categories, brands, dealers) now show inline Rename → editable input → Save/Cancel flow (Enter=save, Escape=cancel).
  - **Constants files**: Created `service-category.constants.ts`, `brand.constants.ts`, `dealer.constants.ts` for complete module structure parity.
- Files changed:
  - web/repositories/subject.repository.ts
  - web/modules/subjects/subject.validation.ts
  - web/modules/subjects/subject.types.ts
  - web/app/dashboard/subjects/page.tsx
  - web/hooks/useSubjects.ts
  - web/repositories/customer.repository.ts
  - web/modules/customers/customer.service.ts
  - web/components/subjects/SubjectForm.tsx
  - web/modules/brands/brand.types.ts
  - web/modules/brands/brand.service.ts
  - web/modules/brands/brand.constants.ts (new)
  - web/hooks/useBrands.ts
  - web/app/dashboard/service/brands/page.tsx
  - web/modules/dealers/dealer.types.ts
  - web/modules/dealers/dealer.service.ts
  - web/modules/dealers/dealer.constants.ts (new)
  - web/hooks/useDealers.ts
  - web/app/dashboard/service/dealers/page.tsx
  - web/app/dashboard/service/categories/page.tsx
  - web/modules/service-categories/service-category.constants.ts (new)
  - doc/WORK_LOG.md
- Verification:
  - `get_errors` on all 10 modified TypeScript files → zero errors
  - `npm run build` → passed, all 18 routes generated, zero TypeScript errors
- Issues found during audit (manual browser checks still required by developer):
  - Double-submit protection on create/edit subject form relies on `isSubmitting` prop being passed correctly from the page — confirm behavior in browser
  - Supabase RLS and trigger verification must be done in Supabase dashboard (cannot be verified via code)
  - Performance checks (load < 2s, search < 500ms) require real device testing
- Next:
  - Verify DB layer in Supabase dashboard (tables, constraints, RLS, triggers, seed data)
  - Manual browser QA across all roles (super_admin, office_staff, stock_manager, technician)
  - Consider adding form-level error message display for date validation failures (currently only Zod rejects via service layer, not shown inline in form)

## [2026-03-13 18:15:48 +05:30] Redesign Service List and Detail UX for Faster Understanding

- Summary: Redesigned the Service List and Service Detail pages to make warranty/free-service status and billing responsibility clearer, removed the View button, enabled direct navigation by subject click, and moved delete into a 3-dots action menu.
- Work done:
  - Redesigned Service List columns and row content for clarity:
    - Added a dedicated `Service Coverage` indicator per row (`Free Service - Under AMC`, `Under Warranty`, `Out of Warranty`).
    - Consolidated key information into easier-to-scan columns (`Customer / Phone`, `Priority / Status`, `Billing`).
  - Removed the explicit `View` button from list actions.
  - Enabled direct navigation to service detail by clicking:
    - the subject number
    - anywhere on the service row.
  - Replaced inline delete button with a 3-dots action menu.
  - Limited delete action visibility to menu context for permitted role.
  - Upgraded detail page UX with:
    - top-level coverage/status badges
    - summary cards for charge target, billing status, assignment, and allocated date
    - cleaner grouped sections for service info, coverage dates, and product info.
  - Extended subject list model/data mapping to include warranty/AMC and billing context for list rendering.
- Files changed:
  - web/app/dashboard/subjects/page.tsx
  - web/app/dashboard/subjects/[id]/page.tsx
  - web/modules/subjects/subject.types.ts
  - web/modules/subjects/subject.service.ts
  - web/repositories/subject.repository.ts
  - doc/WORK_LOG.md
- Verification:
  - Ran diagnostics on all touched subject list/detail/type/repository/service files.
  - Ran `npm run lint` in `web` and it passed.
  - Ran `npm run build` in `web` and it passed.
- Issues/Bugs/Mistakes:
  - None observed during this UX redesign.
- Next:
  - If you want, I can add quick filter chips at top (`AMC Active`, `Under Warranty`, `Out of Warranty`) for one-click service coverage filtering.

## [2026-03-13 18:08:06 +05:30] Fix 006 Migration Duplicate Constraint Error for Re-runs

- Summary: Fixed migration `20260314_006_service_module.sql` to be re-runnable by preventing duplicate-constraint failures on existing subjects check constraints.
- Work done:
  - Added explicit `DROP CONSTRAINT IF EXISTS` statements before re-adding these constraints on `subjects`:
    - `subjects_source_type_chk`
    - `subjects_priority_chk`
    - `subjects_type_of_service_chk`
    - `subjects_source_reference_chk`
  - Kept the existing safe drop/recreate flow for `subjects_service_charge_type_chk` and `subjects_billing_status_chk`.
- Files changed:
  - supabase/migrations/20260314_006_service_module.sql
  - doc/WORK_LOG.md
- Verification:
  - Read-back verification of updated migration block confirms drop/recreate ordering for all target constraints.
  - Diagnostics check on migration file returned no errors.
- Issues/Bugs/Mistakes:
  - Issue found: rerunning migration failed with `ERROR: 42710: constraint "subjects_source_type_chk" ... already exists`.
  - Resolved by making check constraint operations idempotent.
- Next:
  - If needed, I can also add a short migration comment block documenting rerun/idempotency expectations for future schema updates.

## [2026-03-13 18:06:54 +05:30] Strengthen README for Developer Product Understanding During Ongoing Development

- Summary: Improved README to make business logic and implementation expectations clearer for developers, and added a mandatory documentation-maintenance workflow section for future changes.
- Work done:
  - Updated Table of Contents to include a dedicated documentation-maintenance section.
  - Added a clear `Service Charge Determination (Developer Snapshot)` matrix under Module 1 showing AMC/Warranty/Out-of-Warranty behavior, flags, badges, charge target, and billing defaults.
  - Added explicit AMC precedence rule over Warranty when both are active.
  - Added `Documentation Maintenance During Development` section with mandatory update rules and a pre-push checklist for consistency.
  - Updated revision history with a new version entry reflecting these documentation improvements.
- Files changed:
  - README.md
  - doc/WORK_LOG.md
- Verification:
  - Ran diagnostics check on `README.md`.
  - Ran `npm run lint` in `web` and it passed.
- Issues/Bugs/Mistakes:
  - None observed during this documentation refinement.
- Next:
  - If needed, I can split README into a business-facing spec and a developer implementation guide while keeping both in sync.

## [2026-03-13 18:04:50 +05:30] Add Product Details Fields and AMC/Warranty Auto-Billing Rules

- Summary: Implemented the new optional Product Details section fields in the service subject form, added AMC/Warranty badge and billing visibility in subject detail, updated migration schema with requested columns and auto-calculation trigger logic, and updated README business rules.
- Work done:
  - Replaced single `product_details` form input with clean optional Product Details fields:
    - Product Name
    - Serial Number
    - Product Description
    - Purchase Date
    - Warranty End Date
    - AMC End Date
  - Updated subject types and validation schemas to persist the new optional fields.
  - Updated create/edit flows, repository RPC payload, subject update payload, and subject detail mapping to use the new product and date fields.
  - Added subject detail badges and billing metadata display:
    - `Free Service - Under AMC` (green)
    - `Under Warranty` (blue)
    - `Out of Warranty` fallback state
  - Updated migration `20260314_006_service_module.sql`:
    - Added requested subject columns: `product_name`, `serial_number`, `product_description`, `purchase_date`, `warranty_end_date`, `amc_end_date`, `service_charge_type`, `is_amc_service`, `is_warranty_service`, `billing_status`.
    - Added check constraints for `service_charge_type` and `billing_status`.
    - Added trigger function `apply_subject_warranty_amc_logic()` to auto-calculate AMC/Warranty and billing defaults on insert/update.
    - Updated `create_subject_with_customer` RPC signature and insert logic to accept/store new product/date fields.
  - Updated README:
    - Added `Field 12 — Product Details Section` with all optional fields.
    - Added AMC/Warranty billing logic into Business Rules and adjusted in-warranty default payment wording to `Due`.
- Files changed:
  - web/modules/subjects/subject.types.ts
  - web/modules/subjects/subject.validation.ts
  - web/components/subjects/SubjectForm.tsx
  - web/repositories/subject.repository.ts
  - web/modules/subjects/subject.service.ts
  - web/app/dashboard/subjects/new/page.tsx
  - web/app/dashboard/subjects/[id]/edit/page.tsx
  - web/app/dashboard/subjects/[id]/page.tsx
  - supabase/migrations/20260314_006_service_module.sql
  - README.md
  - doc/WORK_LOG.md
- Verification:
  - Ran diagnostics on all updated subject/module/migration/document files.
  - Ran `npm run lint` in `web` and it passed.
  - Ran `npm run build` in `web` and it passed.
- Issues/Bugs/Mistakes:
  - None observed during implementation.
- Next:
  - If you want, I can add these AMC/Warranty/Billing columns to the subject list table with filter chips for faster operations tracking.

## [2026-03-13 17:59:40 +05:30] Restrict Service Module Subitems to Super Admin Only

- Summary: Updated sidebar behavior so only super admins can see and control Service Module subitems; all other roles are limited to the Service List destination only.
- Work done:
  - Restricted Service Module submenu/toggle rendering to `super_admin` only.
  - Kept the Service Module top-level link visible so staff/technician/other users can still open Service List.
  - Ensured non-super-admin users no longer see nested items (`Service Categories`, `Brands`, `Dealers`, or submenu controls).
- Files changed:
  - web/app/dashboard/layout.tsx
  - doc/WORK_LOG.md
- Verification:
  - Ran diagnostics on the updated dashboard layout file.
  - Ran `npm run lint` in `web` and it passed.
- Issues/Bugs/Mistakes:
  - None observed during this role-visibility restriction update.
- Next:
  - If needed, I can also enforce the same distinction with an explicit `Service List` label for non-super-admin users in the sidebar text.

## [2026-03-13 17:58:36 +05:30] Add Collapse/Minimize Toggle for Service Module Subitems

- Summary: Added a dedicated collapse/expand control so Service Module subitems can be minimized in the sidebar while preserving parent navigation.
- Work done:
  - Added a toggle button on the `Service Module` row in the expanded sidebar.
  - Implemented local sidebar state to collapse or expand all Service Module subitems.
  - Kept parent `Service Module` link behavior unchanged (still navigates to Service List).
  - Kept submenu visibility rules unchanged (super admin sees all service submenu pages; others see only allowed items).
  - Updated the service submenu rendering to show only when both sidebar and service submenu are expanded.
- Files changed:
  - web/app/dashboard/layout.tsx
  - doc/WORK_LOG.md
- Verification:
  - Ran diagnostics on the updated sidebar layout file.
  - Ran `npm run lint` in `web` and it passed.
- Issues/Bugs/Mistakes:
  - None observed during this sidebar collapse/minimize enhancement.
- Next:
  - If needed, I can also persist the Service Module collapsed state in local storage so it stays the same across page refreshes.

## [2026-03-13 17:55:15 +05:30] Move Service Module Next to Dashboard With Nested Super Admin Menu

- Summary: Restructured the dashboard sidebar so Service Module appears directly under Dashboard as a top-level item, opens the Service List page, and shows nested service pages under it for super admins.
- Work done:
  - Moved `Service Module` into the main sidebar navigation as the second top-level item, immediately after `Dashboard`.
  - Set the parent `Service Module` link target to the Service List page.
  - Removed the old separate lower Service section from the sidebar.
  - Added nested service navigation under the parent Service Module item when the sidebar is expanded.
  - Kept submenu order as:
    - `Service List`
    - `Service Categories`
    - `Brands`
    - `Dealers`
  - Kept `Service Categories`, `Brands`, and `Dealers` visible only for `super_admin` while other roles see only the parent Service Module entry and Service List destination.
  - Updated active-state handling so all service routes correctly highlight the Service Module parent item.
- Files changed:
  - web/app/dashboard/layout.tsx
  - doc/WORK_LOG.md
- Verification:
  - Ran diagnostics on the updated dashboard layout file.
  - Ran `npm run lint` in `web` and it passed.
- Issues/Bugs/Mistakes:
  - None observed during this sidebar navigation update.
- Next:
  - If you want, I can make the Service Module submenu collapsible instead of always expanded while the sidebar is open.

## [2026-03-13 17:50:51 +05:30] Add Technician Assignment to Service Creation and Show Assigned State

- Summary: Extended the Service Module so new subjects can be assigned to a technician during creation, remain in `PENDING` status when created, and show assigned technician or `Unassigned` state in subject views.
- Work done:
  - Added optional `assigned_technician_id` support to subject form values, validation, create payloads, and update payloads.
  - Added a technician picker to the shared subject create/edit form using active technicians from the existing team module.
  - Kept subject creation status behavior unchanged at database level so all newly created subjects still start in `PENDING`.
  - Updated subject repository create logic to attach technician assignment after subject creation without changing the initial `PENDING` status.
  - Updated subject list and subject detail mappings to include assigned technician name/code when available.
  - Updated subject list UI and subject detail UI to display assigned technician information or `Unassigned` when no technician is attached.
- Files changed:
  - web/modules/technicians/technician.types.ts
  - web/modules/technicians/technician.service.ts
  - web/modules/subjects/subject.constants.ts
  - web/modules/subjects/subject.types.ts
  - web/modules/subjects/subject.validation.ts
  - web/repositories/subject.repository.ts
  - web/modules/subjects/subject.service.ts
  - web/hooks/useSubjects.ts
  - web/components/subjects/SubjectForm.tsx
  - web/app/dashboard/subjects/new/page.tsx
  - web/app/dashboard/subjects/[id]/edit/page.tsx
  - web/app/dashboard/subjects/page.tsx
  - web/app/dashboard/subjects/[id]/page.tsx
  - doc/WORK_LOG.md
- Verification:
  - Ran `npm run lint` in `web` and it passed.
  - Ran `npm run build` in `web` and it passed.
- Issues/Bugs/Mistakes:
  - None observed during this technician-assignment update.
- Next:
  - If you want, I can also surface assigned technician details directly inside technician-facing dashboards or add a dedicated assignment badge/filter in the subject list.

## [2026-03-13 17:44:17 +05:30] Fix Web Runtime Validation Bug and Clear Lint/Build Failures

- Summary: Fixed the active web quality failures by resolving lint errors, correcting a subject edit runtime validation bug, and re-verifying the production build.
- Work done:
  - Fixed the subject validation schema so `created_by` is required only for create operations and no longer incorrectly required during subject updates.
  - Replaced the empty `UpdateSubjectInput` interface with a type alias to satisfy strict linting.
  - Refactored customer form secondary-address state syncing to avoid the React lint rule against synchronous state updates inside effects.
  - Exported permission module metadata to remove the unused-variable lint warning.
  - Updated Supabase middleware response initialization from `let` to `const`.
- Files changed:
  - web/modules/subjects/subject.validation.ts
  - web/modules/subjects/subject.types.ts
  - web/components/customers/CustomerForm.tsx
  - web/config/permissions.ts
  - web/lib/supabase/middleware.ts
  - doc/WORK_LOG.md
- Verification:
  - Ran `npm run lint` in `web` and it passed.
  - Ran `npm run build` in `web` and it passed.
- Issues/Bugs/Mistakes:
  - Issue found: subject edit/update flow could fail at runtime because the shared subject form schema incorrectly required `created_by` for updates.
  - Issue found: lint failed on customer form effect state sync, middleware `prefer-const`, and subject type definitions.
- Next:
  - If you still see a runtime error in the browser, capture the exact route and message so I can trace the remaining failure path directly.

## [2026-03-13 17:38:23 +05:30] Regroup Service Sidebar Navigation Under One Service Module

- Summary: Updated the dashboard sidebar so all service-related pages sit under one Service Module group, with Service List first and service master pages visible only to super admins.
- Work done:
  - Removed the standalone top-level `Service` sidebar item.
  - Replaced the separate `Service Settings` block with a unified `Service Module` group.
  - Ordered the Service group items as:
    - `Service List`
    - `Service Categories`
    - `Brands`
    - `Dealers`
  - Limited `Service Categories`, `Brands`, and `Dealers` sidebar visibility to `super_admin` only.
  - Kept `Service List` visible for all roles that can access subjects.
- Files changed:
  - web/app/dashboard/layout.tsx
  - doc/WORK_LOG.md
- Verification:
  - Diagnostics check run on updated dashboard layout file.
  - No errors found.
- Issues/Bugs/Mistakes:
  - None observed during this sidebar restructuring.
- Next:
  - If you want, I can also make the Service Module group collapsible/expandable in the sidebar for super admins.

## [2026-03-13 17:37:13 +05:30] Add Dedicated Subject Edit Page with Shared Service Form Component

- Summary: Added a true editable subject page and refactored create/edit to use the same reusable Service Module form component instead of routing Edit actions to the detail page.
- Work done:
  - Added a reusable subject form component for the Service Module and moved the shared create/edit UI into it.
  - Refactored the create subject page to use the shared component.
  - Added a dedicated edit route and page for subjects.
  - Added subject update types, validation, repository update logic, service update flow, and hook mutation support.
  - Updated subject list and detail pages so Edit now routes to the dedicated edit page.
- Files changed:
  - web/components/subjects/SubjectForm.tsx
  - web/app/dashboard/subjects/new/page.tsx
  - web/app/dashboard/subjects/[id]/edit/page.tsx
  - web/app/dashboard/subjects/page.tsx
  - web/app/dashboard/subjects/[id]/page.tsx
  - web/modules/subjects/subject.types.ts
  - web/modules/subjects/subject.validation.ts
  - web/modules/subjects/subject.service.ts
  - web/repositories/subject.repository.ts
  - web/hooks/useSubjects.ts
  - web/lib/constants/routes.ts
  - doc/WORK_LOG.md
- Verification:
  - Diagnostics check run on all touched subject form, page, hook, service, and repository files.
  - No errors found.
- Issues/Bugs/Mistakes:
  - None observed during the create/edit form refactor.
- Next:
  - If you want, I can add field-level inline validation messages inside the shared subject form instead of relying only on mutation/toast errors.

## [2026-03-13 15:36:13 +05:30] Refine Subject Role Visibility and Technician-Only Assignment Access

- Summary: Updated the Service Module access rules so subject visibility and actions now match the requested role matrix, including technician access restricted to assigned subjects only.
- Work done:
  - Updated the main project specification in `README.md`:
    - Expanded Part 5 role matrix to include Super Admin, Office Staff, Stock Manager, and Technician.
    - Added explicit subject list visibility and action rules per role.
    - Added a Business Rules item stating technicians can only see subjects assigned to them while all other roles see all subjects.
  - Updated web permission rules so:
    - `subject:view` includes stock managers.
    - `subject:edit` is restricted to super admins and office staff.
    - `subject:create` remains limited to super admins and office staff.
  - Updated the service-module migration RLS policies so:
    - Super admins, office staff, and stock managers can read all subjects.
    - Technicians can only read subjects where `assigned_technician_id = auth.uid()`.
  - Updated the subject list UI so:
    - `Create subject` button is visible only to super admins and office staff.
    - All roles can see the list if permitted.
    - Super admins see `View`, `Edit`, and `Delete` actions.
    - Office staff see `View` and `Edit` actions.
    - Stock managers and technicians see `View` only.
  - Added subject delete mutation flow to support the super-admin delete action.
- Files changed:
  - README.md
  - supabase/migrations/20260314_006_service_module.sql
  - web/config/permissions.ts
  - web/repositories/subject.repository.ts
  - web/modules/subjects/subject.service.ts
  - web/hooks/useSubjects.ts
  - web/app/dashboard/subjects/page.tsx
  - doc/WORK_LOG.md
- Verification:
  - Diagnostics check run on updated README and migration files.
  - No errors found in checked files.
- Issues/Bugs/Mistakes:
  - No new issues found during this access-control update.
- Next:
  - If you want, I can add a dedicated subject edit page so the `Edit` action is routed to a real edit form instead of sharing the detail route.

## [2026-03-13 15:32:50 +05:30] Complete Service Module Implementation (Schema, Layers, Pages, Rules)

- Summary: Implemented the full Service Module foundation across database migration, architecture layers, hooks, dashboard pages, and role-based Service Settings navigation with required business-rule enforcement.
- Work done:
  - Added migration `20260314_006_service_module.sql` with:
    - New master tables: `service_categories`, `brands`, `dealers` (with indexes, triggers, seed categories, and RLS policies).
    - Subject schema enhancements: source type, brand/dealer/category linkage, priority fields, allocated date, service type, customer/product context fields.
    - Business constraints and unique indexes for subject number uniqueness per brand/dealer.
    - Status timeline table `subject_status_history` + insert/update trigger logging.
    - Transactional RPC `create_subject_with_customer(...)` for smart create with optional customer auto-save.
    - Updated subject RLS to match requested permissions (all-auth read, staff/admin create-update, super-admin delete).
  - Implemented repository/service/hook architecture for new master modules:
    - Service categories, brands, dealers CRUD with usage guards to prevent deleting referenced records.
  - Refactored subjects module to the requested model:
    - New types/validation/constants for source-based subject creation and advanced filtering.
    - Subject repository updated for list filters, detail fetch, timeline fetch, and transactional create via RPC.
    - Subject service updated for mapping, validation, and business-rule-aware error handling.
    - Subjects hook updated for filter state, create mutation, and detail query.
  - Implemented requested dashboard pages:
    - Master pages: Service Categories, Brands, Dealers.
    - Subjects list with filters (source, priority, status, date range, search).
    - Subject create flow with required source-dependent selection and required priority reason.
    - Subject detail page with overview and status timeline.
  - Updated dashboard sidebar to include super-admin-only Service Settings links.
  - Added/updated route constants and permissions for Service Settings module access.
- Files changed:
  - supabase/migrations/20260314_006_service_module.sql
  - web/repositories/service-categories.repository.ts
  - web/repositories/brands.repository.ts
  - web/repositories/dealers.repository.ts
  - web/repositories/subject.repository.ts
  - web/modules/service-categories/service-category.types.ts
  - web/modules/service-categories/service-category.validation.ts
  - web/modules/service-categories/service-category.service.ts
  - web/modules/brands/brand.types.ts
  - web/modules/brands/brand.validation.ts
  - web/modules/brands/brand.service.ts
  - web/modules/dealers/dealer.types.ts
  - web/modules/dealers/dealer.validation.ts
  - web/modules/dealers/dealer.service.ts
  - web/modules/subjects/subject.types.ts
  - web/modules/subjects/subject.validation.ts
  - web/modules/subjects/subject.constants.ts
  - web/modules/subjects/subject.service.ts
  - web/hooks/useServiceCategories.ts
  - web/hooks/useBrands.ts
  - web/hooks/useDealers.ts
  - web/hooks/useSubjects.ts
  - web/app/dashboard/subjects/page.tsx
  - web/app/dashboard/subjects/new/page.tsx
  - web/app/dashboard/subjects/[id]/page.tsx
  - web/app/dashboard/service/categories/page.tsx
  - web/app/dashboard/service/brands/page.tsx
  - web/app/dashboard/service/dealers/page.tsx
  - web/app/dashboard/layout.tsx
  - web/lib/constants/routes.ts
  - web/config/permissions.ts
  - doc/WORK_LOG.md
- Verification:
  - Ran diagnostics check for the `web` workspace after implementation.
  - No TypeScript/diagnostics errors reported.
- Issues/Bugs/Mistakes:
  - Encountered one temporary merge corruption while replacing `web/app/dashboard/subjects/new/page.tsx`.
  - Resolved by fully rewriting the page file cleanly and re-validating diagnostics.
- Next:
  - Run migration in Supabase environment and verify policy/function behavior with role-based test accounts.
  - If desired, I can add API route handlers for master-data management to mirror this client-side repository/service architecture server-side.

## [2026-03-13 15:00:14 +05:30] Rename Service Action Label from Ticket to Subject

- Summary: Updated service module action text to use “subject” terminology instead of “ticket” for consistency with your requested naming.
- Work done:
  - Changed service list CTA label from `Create ticket` to `Create subject`.
  - Changed submit button text on new service form from `Create ticket` to `Create subject`.
  - Changed pending submit text from `Creating ticket...` to `Creating subject...`.
- Files changed:
  - web/app/dashboard/subjects/page.tsx
  - web/app/dashboard/subjects/new/page.tsx
  - doc/WORK_LOG.md
- Verification:
  - TypeScript diagnostics run on updated subject pages.
  - No errors found.
- Issues/Bugs/Mistakes:
  - None observed during this text update.
- Next:
  - If needed, I can also rename any remaining “ticket” references in headings/messages to “subject” across the full module.

## [2026-03-13 14:59:29 +05:30] Audit and Correct API Documentation + Work Log Compliance Check

- Summary: Audited documentation quality for API docs and work log, then corrected API documentation to reflect currently implemented endpoints and conventions.
- Work done:
  - Reviewed API documentation and validated implemented route handlers in `web/app/api/**`.
  - Updated API doc to explicitly distinguish current implemented APIs from planned `/api/v1` architecture.
  - Added accurate implemented endpoint documentation for:
    - `POST /api/team/members`
    - `DELETE /api/team/members/{id}`
  - Updated base URL/versioning/auth notes to match current implementation behavior.
  - Verified ongoing work-log entries include required fields (summary, work done, files changed, verification, issues/mistakes, next).
- Files changed:
  - web/docs/API_DOCUMENTATION.md
  - doc/WORK_LOG.md
- Verification:
  - Documentation diagnostics check completed for updated API documentation file.
  - No errors found.
- Issues/Bugs/Mistakes:
  - Issue found: API documentation contained legacy/planned `/api/v1` framing that could mislead implementers about currently available endpoints.
  - Resolved by adding an explicit "Current Implementation Status" and accurate implemented endpoint section.
- Next:
  - If desired, I can continue by splitting the API doc into two clear files: `CURRENT_API.md` (implemented) and `API_V1_TARGET.md` (planned roadmap) to avoid future confusion.

## [2026-03-13 14:58:07 +05:30] Standardize System Buttons and Color Consistency Across Modules

- Summary: Implemented a shared button style system and migrated major dashboard/service/customer/team controls to use the same component patterns and software color palette.
- Work done:
  - Added global reusable button classes (`ht-btn` family) in design tokens layer for primary, secondary, accent-outline, danger, danger-outline, and small-size variants.
  - Added brand hover token `--ht-blue-700` to keep CTA hover color consistent with system palette.
  - Replaced ad-hoc button/link class strings with shared button classes in:
    - Service ticket list page
    - Service ticket create page
    - Customer list and customer detail pages
    - Team management page actions
    - Delete confirmation modal
    - Customer form footer actions
  - Verified no remaining legacy button patterns for the previously inconsistent blue/rose button class signatures.
- Files changed:
  - web/app/globals.css
  - web/app/dashboard/subjects/page.tsx
  - web/app/dashboard/subjects/new/page.tsx
  - web/app/dashboard/customers/page.tsx
  - web/app/dashboard/customers/[id]/page.tsx
  - web/app/dashboard/team/page.tsx
  - web/components/customers/DeleteConfirmModal.tsx
  - web/components/customers/CustomerForm.tsx
  - doc/WORK_LOG.md
- Verification:
  - TypeScript/diagnostics checks run on all modified files.
  - No errors found.
- Issues/Bugs/Mistakes:
  - None observed during implementation.
- Next:
  - Optionally migrate remaining non-critical icon-only controls to a shared `ht-icon-btn` class for full interaction consistency.

## [2026-03-13 14:54:52 +05:30] Promote Service as Second Core Sidebar Module

- Summary: Updated dashboard navigation so Service appears directly after Dashboard, reflecting its role as the core business module.
- Work done:
  - Added `Service` as the second sidebar item.
  - Mapped `Service` to the existing subjects/service route.
  - Removed old `Subjects` label entry to avoid duplicate navigation item.
- Files changed:
  - web/app/dashboard/layout.tsx
  - doc/WORK_LOG.md
- Verification:
  - TypeScript diagnostics run for updated dashboard layout file.
  - No errors found.
- Issues/Bugs/Mistakes:
  - None observed during this navigation update.
- Next:
  - Align page titles and module headings from “Subjects” to “Service” if you want full naming consistency across the app.

## [2026-03-13 14:50:02 +05:30] Make Sidebar Toggle Logo Secondary in Header

- Summary: Adjusted the top-left sidebar toggle logo to feel more secondary by reducing visual prominence.
- Work done:
  - Reduced toggle button dimensions from `h-9 w-9` to `h-8 w-8`.
  - Reduced icon size from `18` to `16`.
  - Applied lower default icon opacity via `text-ht-text-700/65` and preserved stronger hover state.
- Files changed:
  - web/app/dashboard/layout.tsx
  - doc/WORK_LOG.md
- Verification:
  - TypeScript diagnostics run on dashboard layout file.
  - No errors found.
- Issues/Bugs/Mistakes:
  - None observed during this UI change.
- Next:
  - Optionally tune secondary opacity further (for example `60%` or `55%`) based on visual preference.

## [2026-03-13 14:48:21 +05:30] Modern-Classical Branding Refresh for Hitech ERP Suite Header

- Summary: Refined the dashboard top brand area to feel more modern and classical while preserving a professional enterprise style.
- Work done:
  - Upgraded header surface to a subtle premium gradient with a light shadow for depth.
  - Redesigned the Hitech brand lockup with a cleaner icon tile and stronger visual hierarchy.
  - Added a refined secondary line (Operations Console) for classical enterprise character.
  - Improved user profile chip visuals with subtle depth and gradient avatar background.
- Files changed:
  - web/app/dashboard/layout.tsx
  - doc/WORK_LOG.md
- Verification:
  - TypeScript diagnostics run for updated dashboard layout file.
  - No errors found.
- Issues/Bugs/Mistakes:
  - None observed during implementation.
- Next:
  - Optionally align sidebar typography with the same uppercase tracking style for full branding consistency.

## [2026-03-13 14:46:27 +05:30] Remove Header Search and Simplify Top Navbar

- Summary: Removed the top Search control and refined dashboard header styling to a cleaner, simpler, and more professional appearance.
- Work done:
  - Removed Search button and Search icon import from dashboard layout header.
  - Simplified header container style (solid white, cleaner spacing, reduced visual noise).
  - Standardized icon button sizing for sidebar toggle, notifications, and logout.
  - Simplified branding row by removing extra enterprise badge.
  - Refined account section and divider for cleaner right-side hierarchy.
- Files changed:
  - web/app/dashboard/layout.tsx
  - doc/WORK_LOG.md
- Verification:
  - TypeScript diagnostics run on updated dashboard layout file.
  - No errors found.
- Issues/Bugs/Mistakes:
  - None observed during implementation.
- Next:
  - Optionally wire notification button to a dropdown/panel or hide it until notifications are implemented.

## [2026-03-13 14:44:08 +05:30] Simplify Dashboard Header Toggle and Remove Breadcrumb

- Summary: Simplified the dashboard top-left header controls by using a clear collapse/expand symbol and removing the redundant "Dashboard > Dashboard" breadcrumb row.
- Work done:
  - Replaced close/menu toggle icons with dedicated sidebar collapse/expand icons.
  - Removed breadcrumb line beneath the product title in the dashboard header.
  - Removed now-unused breadcrumb/nav icon imports and related computed variable.
- Files changed:
  - web/app/dashboard/layout.tsx
  - doc/WORK_LOG.md
- Verification:
  - TypeScript diagnostics check run for updated dashboard layout file.
  - No errors found.
- Issues/Bugs/Mistakes:
  - None observed during this UI update.
- Next:
  - If desired, align icon style with your preferred glyph set across all header controls for visual consistency.

## [2026-03-13 14:40:06 +05:30] Diagnose Slow Website Loading and Data Display

- Summary: Investigated why the web app feels slow while loading pages and rendering data, and identified concrete bottlenecks in auth checks and query patterns.
- Work done:
  - Reviewed dashboard, customer, team, subject, auth, and middleware flows in the Next.js web app.
  - Identified repeated auth round-trips (middleware getUser plus client getSession/profile fetch) before dashboard render.
  - Identified expensive data patterns including full-list fetches for counts and multi-step team/technician fetch composition.
  - Confirmed current caching behavior and query defaults for React Query.
- Files changed:
  - doc/WORK_LOG.md
- Verification:
  - Static code-path analysis completed across affected files.
  - No runtime code changes made in this task.
- Issues/Bugs/Mistakes:
  - Issue found: dashboard waits on client auth hydration even after middleware auth check, adding visible spinner delay.
  - Issue found: count widgets perform full or count-heavy list queries instead of lightweight dedicated count endpoints.
  - Issue found: team list combines separate profile and technician queries, increasing latency on larger datasets.
- Next:
  - If approved, implement targeted optimizations (server-side auth bootstrapping, lightweight count endpoints, paginated team listing, and tuned query stale/cache timings).

## [2026-03-13 00:48:29 +05:30] Push Cleanup Documentation to GitHub Main

- Summary: Pushed latest documentation updates to GitHub `main` branch.
- Work done:
  - Verified branch and pending changes before push.
  - Added work-log entry for this push action.
  - Committed updated work log and pushed to remote main.
- Files changed:
  - doc/WORK_LOG.md
- Verification:
  - Git push completed successfully to `origin/main`.
- Issues/Bugs/Mistakes:
  - None during push.
- Next:
  - Continue logging each completed task before every push.

## [2026-03-13 00:47:45 +05:30] Remove Local JVM Crash/Replay Log Artifacts

- Summary: Deleted local JVM crash and replay artifacts from the repository root to keep workspace clean.
- Work done:
  - Removed `hs_err_pid22656.log`, `hs_err_pid3228.log`, `hs_err_pid33096.log`.
  - Removed `replay_pid22656.log`, `replay_pid3228.log`, `replay_pid33096.log`.
  - Rechecked git status to confirm no remaining untracked crash/replay logs.
- Files changed:
  - doc/WORK_LOG.md
- Verification:
  - `git status --short --branch` shows clean working tree (`## main...origin/main`).
- Issues/Bugs/Mistakes:
  - None during cleanup.
- Next:
  - Optionally add ignore rules for `hs_err_pid*.log` and `replay_pid*.log` to prevent future accidental workspace clutter.

## [2026-03-13 00:45:19 +05:30] Push Latest Fixes to GitHub Main

- Summary: Pushed the latest dashboard build-fix changes to `main` with complete documentation and issue tracking.
- Work done:
  - Verified current branch and pending changes before push.
  - Ensured work-log documentation is complete and up to date for this push action.
  - Prepared a focused commit containing only relevant tracked files.
- Files changed:
  - doc/WORK_LOG.md
  - web/app/dashboard/layout.tsx
- Verification:
  - Git status reviewed before commit/push.
  - Push result captured after publishing to `origin/main`.
- Issues/Bugs/Mistakes:
  - Unrelated crash/replay logs (`hs_err_pid*.log`, `replay_pid*.log`) remain untracked locally and were intentionally excluded from commit.
  - No additional code issues identified during this push task.
- Next:
  - Keep excluding runtime crash artifacts from versioned commits unless explicitly needed for incident analysis.

## [2026-03-13 00:44:03 +05:30] Fix Web Build Error in Dashboard Header

- Summary: Resolved production build failure caused by a TypeScript nullability issue in the dashboard header layout.
- Work done:
  - Reproduced the failure with `npm run build` in `web` and captured the exact compiler error.
  - Fixed `app/dashboard/layout.tsx` by moving user-dependent identity/role/initials computations below the authenticated-user guard (`if (isLoading || !user) return ...`).
  - Re-ran diagnostics and full web production build to verify end-to-end success.
- Files changed:
  - web/app/dashboard/layout.tsx
  - doc/WORK_LOG.md
- Verification:
  - TypeScript diagnostics: no errors in `web/app/dashboard/layout.tsx`.
  - Build verification: `npm run build` completed successfully with all routes generated.
- Issues/Bugs/Mistakes:
  - Root cause: `user`-derived values were computed before null-guard flow narrowing, triggering `TS18047: 'user' is possibly 'null'` during `next build` type check.
  - Additional issues found: none.
- Next:
  - If desired, add a small typed helper for auth-safe user display metadata to prevent similar nullability regressions in future header changes.

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

