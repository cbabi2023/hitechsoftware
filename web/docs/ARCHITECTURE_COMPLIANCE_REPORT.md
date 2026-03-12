# Architecture Compliance Report

Date: 2026-03-12
Project: HitechSoftware Web Panel (Next.js)
Branch: main

## Executive Summary

This report confirms implementation of the layered MNC-style architecture for the web panel with strict responsibility boundaries:

- UI layer uses hooks only.
- Hooks call services only.
- Services contain business logic and call repositories only.
- Repositories are the only layer that communicates with Supabase.
- Shared types are centralized and reused across layers.

## Layer Mapping Table

| Layer | Responsibility | Allowed Dependencies | Implemented Files |
| --- | --- | --- | --- |
| UI (`app/`) | Rendering, navigation, user interaction | Hooks, constants | `app/page.tsx`, `app/login/page.tsx`, `app/dashboard/page.tsx`, `app/layout.tsx` |
| Hooks (`hooks/`) | React Query orchestration, UI-facing state | Services, stores | `hooks/useAuth.ts`, `hooks/useCustomers.ts`, `hooks/useSubjects.ts`, `hooks/useInventory.ts`, `hooks/useRealtime.ts` |
| Services (`modules/`) | Business rules, validation, flow control | Repositories, shared types, zod schemas | `modules/auth/auth.service.ts`, `modules/auth/auth.validation.ts`, `modules/customers/customer.service.ts`, `modules/subjects/subject.service.ts`, `modules/inventory/inventory.service.ts` |
| Repositories (`repositories/`) | Data access only (Supabase) | Supabase client, data types | `repositories/auth.repository.ts`, `repositories/customer.repository.ts`, `repositories/subject.repository.ts`, `repositories/inventory.repository.ts`, `repositories/stock.repository.ts`, `repositories/digital-bag.repository.ts`, `repositories/billing.repository.ts`, `repositories/amc.repository.ts`, `repositories/attendance.repository.ts`, `repositories/technician.repository.ts`, `repositories/payout.repository.ts` |
| Shared Types (`types/`) | Single source of truth for data contracts | None | `types/database.types.ts`, `types/common.types.ts`, `types/api.types.ts` |
| State (`stores/`) | Global client state (non-server) | Zustand only | `stores/auth.store.ts`, `stores/ui.store.ts`, `stores/notification.store.ts` |
| Config (`config/`) | Route/nav/permission definitions | Types/constants only | `config/permissions.ts`, `config/navigation.ts` |
| Providers (`components/providers/`) | App-level providers | React Query | `components/providers/query-provider.tsx` |

## Compliance Matrix (Rules)

| Rule | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| Rule 1 | Repository layer is Supabase-only, no business if/else logic | PASS | `repositories/*.repository.ts` use only Supabase operations and return DB results |
| Rule 2 | Service layer never imports Supabase; business logic lives in services | PASS | `modules/*/*.service.ts` import repositories and validation only |
| Rule 3 | Hooks never call Supabase directly; hooks call service functions | PASS | `hooks/useAuth.ts`, `hooks/useCustomers.ts`, `hooks/useSubjects.ts`, `hooks/useInventory.ts` call service functions |
| Rule 4 | UI never calls Service/Repository directly; UI uses hooks | PASS | `app/login/page.tsx`, `app/dashboard/page.tsx`, `app/page.tsx` consume hooks only |
| Rule 5 | Shared types are centralized and reused | PASS | `types/database.types.ts`, `types/common.types.ts`, `types/api.types.ts` consumed across service/repository/hook layers |

## Package Baseline

Installed and integrated:

- `zod`
- `zustand`
- `@tanstack/react-query`
- `react-hook-form`
- `@hookform/resolvers`

## Validation Results

- Type diagnostics: no errors.
- Production build: successful (`next build`).

## Structural Notes

- Legacy `web/lib/auth-context.tsx` removed and replaced with React Query + Zustand flow.
- Existing app routes preserved (`/`, `/login`, `/dashboard`) to avoid behavioral regressions.
- Module and repository stubs created for future domains (inventory, stock, digital-bag, billing, amc, attendance, technicians, payouts).

## Next Hardening Steps

1. Move route groups to App Router segments (`(auth)` and `(dashboard)`) once page-level feature modules are ready.
2. Add role-based route middleware and guard checks based on `config/permissions.ts`.
3. Expand module-level Zod validation and typed DTO contracts for each domain.
4. Add unit tests for service logic and integration tests for repository behavior.
