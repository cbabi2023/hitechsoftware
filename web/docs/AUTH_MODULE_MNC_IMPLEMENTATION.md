# Auth Module MNC Implementation Guide

This document describes the enterprise-grade auth implementation used by the web app and consumed by Flutter apps.

## 1. Route Protection (Server-Side)

- Middleware: `web/middleware.ts`
- Supabase middleware client: `web/lib/supabase/middleware.ts`
- Protected routes: `/dashboard/**`
- Public-only routes: `/login`

Behavior:
- Unauthenticated users visiting protected routes are redirected to `/login?next=<path>`.
- Authenticated users visiting `/login` are redirected to `/dashboard`.

## 2. Permission Matrix (14 Modules)

Implemented in `web/config/permissions.ts`.

Modules covered:
- customer
- subject
- inventory
- stock
- digital-bag
- billing
- amc
- technician
- payout
- reports
- settings
- attendance
- notifications
- auth

The file exports:
- `Permission` union type
- `PERMISSIONS` matrix
- `hasPermission(role, permission)` helper

## 3. Runtime Permission Checks

- Hook: `web/hooks/usePermission.ts`
- Component: `web/components/ui/ProtectedComponent.tsx`

Supported checks:
- `can(permission)`
- `canAny(permissions[])`
- `canAll(permissions[])`

## 4. Role-Based Post-Login Redirect

- Function: `getDashboardRouteByRole` in `web/modules/auth/auth.service.ts`
- Login page uses `result.data.redirectTo` from service response.

Role mapping:
- `super_admin` -> `/dashboard`
- `office_staff` -> `/dashboard/subjects`
- `stock_manager` -> `/dashboard/inventory`
- `technician` -> `/dashboard`

## 5. Session Expiry Handling

- Provider: `web/components/providers/AuthProvider.tsx`
- Registered in root layout: `web/app/layout.tsx`

Auth event handling:
- `SIGNED_OUT`: clears auth store and redirects to `/login`
- `TOKEN_REFRESHED`: refreshes auth state from service/store

## 6. Auth Audit Logs (Database)

Migration: `supabase/migrations/20260312_003_auth_logs.sql`

Table columns:
- `id`
- `user_id`
- `event`
- `role`
- `ip_address`
- `user_agent`
- `created_at`

Security:
- RLS enabled
- Insert policy: authenticated user can insert own log (`auth.uid() = user_id`)
- Select policy: only `super_admin` can view logs

App write path:
- Login success event written in `signIn()` via repository insert.

## 7. Flutter Integration Notes

Flutter apps (`hitech_admin`, `hitech_technician`) should:
- Authenticate with Supabase and include JWT in API requests.
- Respect role-based route/module access from backend permission outcomes.
- Send client metadata where possible:
  - `X-Client-Platform`
  - `X-App-Version`
  - device user-agent equivalent

Recommended startup flow for Flutter:
1. Restore Supabase session.
2. Fetch current profile (`role`, account status).
3. Resolve landing screen by role.
4. Gate UI actions using permission checks from API responses.
