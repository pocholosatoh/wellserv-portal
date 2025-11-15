# WELLSERV Online Portal App

Patient + staff results viewer powered by Next.js (App Router) with Supabase as the **source of truth**. Google Sheets is retained only for RMT CSV hemato uploads (branch “running sheets”).

## Monorepo layout

```
apps/
  web/      # Next.js portal (existing app)
  mobile/   # Expo Router app
packages/
  core/     # shared types + helpers
  data/     # Supabase client + React Query hooks
  theme/    # design tokens + Tailwind presets
```

Use `pnpm dev:web`, `pnpm dev:mobile`, or `pnpm dev` (Turborepo) for both. Shared packages build with `pnpm --filter @wellserv/core build` etc.

## Deploying to Vercel

- The Vercel project’s root dir must be `apps/web`. Set the build command to `pnpm --filter web build` (matches `vercel.json`).
- Keep the repo-level `vercel.json` committed so auto-imports don’t override the settings.
- When running locally you can mirror production with `pnpm --filter web build && pnpm --filter web start`.

## Stack

- **Next.js App Router** (`/app`)
- **Supabase** (Postgres + RLS), optional **Supabase Storage** (future)
- **Google Sheets** (RMT ingest only)
- TypeScript, (optional) Tailwind + PostCSS

## High-level flow

UI (ReportViewer)
⇅ JSON
/app/api/patient-results ← unified API (Node runtime)
⇅ DataProvider (lib/data)
Supabase (patients, results_flat, ranges)

markdown
Copy code new

## Key routes

- Patient view: `/patient-results`
- Staff portal: `/portal`
- Unified API (Supabase): `/api/patient-results`
- RMT ingest (Sheets): `/rmt/hemaupload` → `/api/rmt/hema/import`

## Repo layout

/app
/(patient)/patient-results/page.tsx
/(portal)/portal/page.tsx
/api/patient-results/route.ts
/components/ReportViewer.tsx
/lib
/data
data-provider.ts # interface + types
provider-factory.ts # picks sheets/supabase by DATA_BACKEND
supabase-provider.ts # Supabase implementation (source of truth)
supabase.ts # create Supabase client (server)
/public # logos, static assets
/scripts # future ETL, migrations

pgsql
Copy code

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

## Development

````bash
npm i
npm run dev
# open http://localhost:3000
Smoke tests
bash
Copy code
# API
curl -X POST http://localhost:3000/api/patient-results \
  -H "content-type: application/json" \
  -d '{"patient_id":"<REAL_ID>"}'

# UI
# - /patient-results (patient)
# - /portal (staff)
Logs (local & Vercel)
We log a single line per request in /api/patient-results:

json
Copy code
{"route":"patient-results","patient_id":"P-0001","count":3,"dates":["2025-09-25","2025-07-10","2025-06-02"]}
Filter for it in Vercel Logs to spot anomalies.

Deployment (Vercel)
Ensure /app/api/patient-results/route.ts has:

ts
Copy code
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
Push to main; Vercel builds & deploys.

Set ENV vars in Vercel before/after first deploy.

Data notes
results_flat contains one row per analyte; ranges provides label/unit/low/high and section via prefix (hema_, chem_, ua_, fa_, sero_).

We treat "-", empty, and n/a as blank (not rendered).

Flags: we show only L/H/A. Normal is blank.

Urinalysis/Fecalysis: UI hides Reference & Flag columns.

Maintenance
Deprecated Sheets endpoints: /api/results, /api/report. Watch logs for [DEPRECATED]. Delete after a week of zero hits.

Edit DEFAULT_ORDER in supabase-provider.ts (fallback ordering). If ranges.order exists, it takes precedence.

Run:

npx depcheck (unused deps)

npx ts-prune (unused exports) — beware Next false positives (pages/layout/metadata/middleware).

Glossary
API/endpoint: URL that returns data (JSON).

Adapter/Data Provider: hides the data source (Sheets vs Supabase) and returns stable shapes to the UI.

JSON shape: the structure of returned fields and types.

Node runtime: full Node.js environment for server routes (required for Supabase service key & Google APIs).

yaml
Copy code

---

## “Watch logs for a week”—put it on rails

- Add the deprecation log (you already did):
  `console.warn("[DEPRECATED] /api/results ...");`
- Set a calendar reminder to run:
  ```bash
  vercel logs https://<your-prod>.vercel.app --since 7d --filter "[DEPRECATED]"
Or add a log drain + saved query → email/slack alert if count > 0 in last 24h.
````
