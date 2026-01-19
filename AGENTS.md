# AGENTS.md — WELLSERV Online Portal App

This repo is a monorepo for WELLSERV’s web + mobile apps with Supabase backend. It handles PHI/medical data. Changes must prioritize privacy, auditability, and “don’t break prod/mobile builds.”

## Principles

- **PHI safety first.** Never leak PHI to client logs, analytics, or browser storage.
- **Server-side data access for PHI.** Staff/doctor PHI routes must go through server/API routes using server Supabase clients.
- **No service-role on client.** Service-role keys must never appear in browser/mobile bundles.
- **Prefer existing patterns.** Copy the style/structure of established staff pages and API routes.
- **Small diffs, testable changes.** Every change should include clear manual test steps and pass repo quality gates.

---

## Repo map

- `apps/web/` — Next.js App Router portal (staff/doctor/patient groups)
- `apps/mobile/` — Expo Router React Native app
- `packages/core/` — shared contracts/types
- `packages/data/` — shared data hooks/utilities
- `packages/theme/` — shared Tailwind preset/theme
- `supabase/` — Supabase config + migrations + schema baseline
- `scripts/check-mobile-phi.js` — lint-time PHI guardrail for client Supabase queries (mobile/shared code).

---

## Tooling and commands

Monorepo (from repo root):

- `pnpm dev` (or `pnpm dev:web`, `pnpm dev:mobile`)
- `pnpm lint`
- `pnpm build`
- `pnpm test` (if configured)

Scoped:

- `pnpm --filter web dev|build|lint|typecheck|test`
- `pnpm --filter mobile dev|start|lint|typecheck`

Mobile release guidance:

- See `apps/mobile/DEPLOY_MOBILE.md` + `apps/mobile/eas.json` for profiles and branch policy.

---

## Web app conventions (apps/web)

### Routing groups

Uses Next App Router with route groups (examples):

- `app/staff/(protected)/*` and `app/staff/(public)/*`
- `app/(doctor)/doctor/*`
- `app/(patient)/patient/*`

### Styling

- Tailwind v4 with shared preset from `@wellserv/theme`
- Global tokens/utilities in `globals.css`
- Staff pages follow the “staff shell” layout with consistent spacing, table cards, and inline banners.
- Primary accent color: `#44969b` (matches Doctor homepage Quick Search “Open” button)

### Staff navigation

- Tabs/routes are defined in `StaffNavi.tsx`
- Staff landing/home should link to major modules via cards (match existing staff style)

---

## Auth, sessions, and branch scoping

### Auth enforcement

- `/staff/*` protected via `middleware.ts` (public exceptions allowed)
- Protected layouts do server-side checks using session helpers (signed cookies)

### Signed cookies

- Signed cookie helpers exist for server and edge variants (do not reimplement cookie signing)
- Session reading/writing is centralized (reuse existing session helpers)

### Actor resolution

- Prefer `guard.ts` for API routes (scoping options like `requirePatientId`, `requireBranch`, etc.)
- Use `api-actor.ts` for server components/helpers where appropriate

### Branch scoping

- Staff branch is set/read via cookie (driven by BranchPicker + branch helper utilities)
- **Rule:** branch-scoped data must come from the branch cookie; do not accept branch from client payload unless explicitly needed and validated.

---

## API route patterns (apps/web/app/api/\*\*/route.ts)

### Must-haves

- Use the shared **guard** for auth + scoping.
- Validate request bodies (types + required fields + numeric ranges).
- Use server Supabase clients only (`supabaseServer.ts`, `supabaseAdmin.ts`, `supabase.ts`).
- Return consistent JSON errors (status + message). Avoid leaking internals.

### Error handling

- Log server errors safely (no PHI values).
- For Supabase RPC:
  - **Always pass exact `p_*` arg names** expected by the function
  - Return `{ error: error.message, details: error.details ?? null }` for actionable debugging (server-side only)

### Audit logging

- Audit logs should be metadata-only.
- Never log PHI bodies (lab values, notes, diagnoses) into audit tables or console logs.

---

## Supabase usage and migrations

### Server-only Supabase

- Service-role clients must be used on the server only; never in browser/mobile.
- If a file might run in the browser, it must not import server-only Supabase clients.

### Migrations

- SQL migrations live under `supabase/migrations/` and are timestamped.
- Keep schema changes in migrations (avoid “only in Supabase SQL editor” changes).
- Check sync status:
  - `supabase db pull` should show diffs when repo and remote diverge.

### RLS posture

- Some tables (e.g., audit) are deny-by-default. Follow existing conventions.
- Even when using service role server-side, keep future-safe RLS in mind and avoid exposing PHI routes to anon clients.

---

## Mobile app conventions (apps/mobile)

- Expo Router structure; do not break routing assumptions.
- API base URL selection uses public env vars: `EXPO_PUBLIC_DEV_API_BASE_URL` (dev) and `EXPO_PUBLIC_API_BASE_URL` (prod); mobile also reads `EXPO_PUBLIC_WEB_API_BASE_URL` for web API base.
- **Never query PHI tables directly from mobile/shared code.**
  - `check-mobile-phi.js` exists as a guardrail — keep it passing.
- Production builds require correct `EXPO_PUBLIC_API_BASE_URL` (see `app.config.js`).

Mobile changes must be tested on both platforms when possible (at least simulate in iOS/Android or ensure builds pass).

---

## PHI / Security “Do / Don’t”

### DO

- Keep PHI reads/writes behind server/API routes
- Use guard + session + branch scoping helpers
- Use RPC with correct `p_*` keys
- Add/extend audit trails with metadata-only fields
- Add rate limiting on sensitive endpoints (use existing rate limit utilities if present)

### DON’T

- Don’t store PHI in `localStorage`, AsyncStorage, or client caches
- Don’t log request bodies containing PHI
- Don’t expose service-role keys or import server Supabase clients in client components
- Don’t bypass middleware/guard patterns
- Don’t add “quick fixes” directly in Supabase UI without committing migrations

---

## Quality gates (Definition of Done)

Before considering work “done”:

- Web:
  - `pnpm lint`
  - `pnpm --filter web typecheck` (if available)
  - `pnpm --filter web build` (if relevant)
  - Manual smoke test: affected routes and flows
- Mobile (when touched):
  - `pnpm --filter mobile lint`
  - `pnpm --filter mobile typecheck`
  - Run app locally (iOS/Android) if the change affects runtime
  - Ensure `scripts/check-mobile-phi.js` passes
- CI: No repo CI config detected; run quality gates locally.
- Database:
  - Schema changes committed in `supabase/migrations`
  - `supabase db pull` shows no unexpected diff

Include short “How to test” steps in every PR summary.

---

## Golden references (copy patterns from existing code)

When implementing new features, locate existing examples and follow them rather than inventing new patterns.

Suggested search commands:

- Staff page patterns (tables/forms/banners):
  - `rg -n "staff-shell|rounded-xl|shadow-sm|inline.*banner|error.*banner" apps/web/app/staff`
- Guard usage in API routes:
  - `rg -n "guard\\(" apps/web/app/api`
  - `rg -n "requireBranch|requirePatientId" apps/web/app/api`
- Signed cookies / session:
  - `rg -n "signedCookies|readSignedCookie|getSession" apps/web`
- Mobile API base selection:
  - `rg -n "EXPO_PUBLIC_(DEV_)?API_BASE_URL" apps/mobile packages`

> If you’re unsure which file is the best example, pick the newest staff page that matches the UI you want and mimic its structure.

---

## If something is unclear

If you can’t find a pattern, do not guess. Search for similar features, report what you found, and propose the smallest consistent change.
