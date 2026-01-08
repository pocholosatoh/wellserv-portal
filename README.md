# WELLSERV Online Portal App

Patient, staff, and doctor portals built on Next.js (App Router) with Supabase as the **source of truth**. Google Sheets is retained only for RMT CSV hemato uploads (branch “running sheets”).

## Personas & entry points

- **Doctor console** (`/doctor`): branch-aware consult queue, patient search redirect, ECG inbox (`/doctor/ecg`), and patient workspace (`/doctor/patient/[patientId]`) with lab results, other labs, consult notes/prescriptions/diagnoses, and past consultations.
- **Patient portal** (`/patient`): authenticated overview with latest result/prescription badges plus quick links to `/results`, `/prescriptions`, `/patient/medcerts`, `/patient/delivery`, and follow-up/help contacts.
- **Staff workspace** (`/staff` → protected): launcher for follow-ups (`/staff/followups`), other labs/send-outs (`/staff/other-labs`), patient vitals/history (`/staff/patienthistory`), results portal (`/staff/portal`), prescriptions (`/staff/prescriptions`), med orders (`/staff/med-orders`), medical certificates (`/staff/medcerts`), RMT hema upload (`/staff/rmt/hemaupload`), section assignments (`/staff/section-assignments`, ADM/RMT), staff registration (`/staff/staff/register`, ADM), and audit log viewer (`/staff/audit`, ADM).

## Monorepo layout

```
apps/
  web/      # Next.js portal
  mobile/   # Expo Router app
packages/
  core/     # shared types + helpers
  data/     # Supabase client + React Query hooks
  theme/    # design tokens + Tailwind presets
```

Use `pnpm dev:web`, `pnpm dev:mobile`, or `pnpm dev` (Turborepo) for both. Shared packages build with `pnpm --filter @wellserv/core build` etc.

## Key routes & APIs

- Patient results API: `/api/patient-results` (used by patient/staff/doctor viewers)
- Other labs viewer: `/api/patient/other-labs-v2`
- Doctor console: `/doctor`, patient workspace at `/doctor/patient/[patientId]`
- Patient portal: `/patient` with `/results`, `/prescriptions`, `/patient/medcerts`, `/patient/delivery`
- Staff portal: `/staff` and nested tools listed above
- RMT ingest: `/staff/rmt/hemaupload` → `/api/rmt/hema/import`

## Stack

- **Next.js App Router** (`/app`)
- **Supabase** (Postgres + RLS), optional **Supabase Storage** (future)
- **Google Sheets** (RMT ingest only)
- TypeScript, Tailwind + PostCSS

## CI / sanity checks

Run these from a clean checkout to mirror CI:

```bash
pnpm install
pnpm lint
pnpm build
pnpm test   # security regression checks (guard, rate limit, audit logging)
```

## Deploying to Vercel

- The Vercel project’s root dir must be `apps/web`. Set the build command to `pnpm --filter web build` (matches `vercel.json`).
- Keep the repo-level `vercel.json` committed so auto-imports don’t override the settings.
- When running locally you can mirror production with `pnpm --filter web build && pnpm --filter web start`.

## Environment variables

| Name                                 | Scope  | Purpose                                     |
| ------------------------------------ | ------ | ------------------------------------------- |
| `SUPABASE_URL`                       | Server | Supabase project URL                        |
| `SUPABASE_SERVICE_ROLE_KEY`          | Server | Service role key (server-only!)             |
| `DATA_BACKEND`                       | Server | `supabase` (default), `sheets` (debug only) |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL`       | Server | Sheets ingest only                          |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | Server | Sheets ingest only (escape `\n`)            |
| `SHEET_ID`                           | Server | Branch running sheet ID(s)                  |
| `NEXT_PUBLIC_SUPABASE_URL`           | Client | only if using client SDK (optional)         |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`      | Client | only if using client SDK (optional)         |

Create a `.env.local` with the server variables above (don’t commit it). In Vercel, set the same in Project → Settings → Environment Variables.

## Audit logging (PHI)

- Logged (metadata only): actor role/id, patient_id when known, route + method, action/result, status_code, IP/user agent when available, minimal reason/source meta.
- Not logged: request bodies, patient names, diagnoses, notes, lab values, prescription fields, raw headers, or tokens.
- Dev smoke check: make one authorized request to a guarded PHI route and one unauthorized request, then confirm rows in `public.audit_log` with no PHI in `meta`.
- Admin audit log viewer: `/staff/audit` (ADM only) shows metadata fields only (route/method/action/result, actor/branch/patient IDs, status_code, request_id) with date/action/result filters.

## Development

```bash
pnpm install
pnpm dev
# open http://localhost:3000
```

Smoke test the patient results API:

```bash
curl -X POST http://localhost:3000/api/patient-results \
  -H "content-type: application/json" \
  -d '{"patient_id":"<REAL_ID>"}'
```

## Maintenance notes

- `results_flat` contains one row per analyte; `ranges` provides label/unit/low/high and section via prefix (hema*, chem*, ua*, fa*, sero\_). We treat "-", empty, and n/a as blank.
- Urinalysis/Fecalysis UI hides Reference & Flag columns; flags show only L/H/A.
- Deprecated Sheets endpoints: `/api/results`, `/api/report`. Watch logs for `[DEPRECATED]` before removing.
- Useful hygiene: `npx depcheck` (unused deps), `npx ts-prune` (unused exports; beware Next false positives for pages/layout/metadata/middleware).
