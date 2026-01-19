# SKILLS.md — Repeatable playbooks for this repo

These are copy-paste-friendly checklists for common tasks in WELLSERV’s monorepo.

---

## Skill: Create a new Staff protected page

1. Add route under:

- `apps/web/app/staff/(protected)/<new-page>/page.tsx`

2. Use existing staff shell/layout automatically via `(protected)` layout.

3. Add navigation:

- Update `StaffNavi.tsx` with a new entry
- Add staff home card if it’s a major workflow

4. Follow styling:

- Copy structure from an existing staff page (table card, banner patterns, spacing)

5. Branch scoping:

- If needed, read branch via existing cookie helpers (don’t accept arbitrary branch from client)

6. Manual test:

- Unauthed access redirects to login
- Authed access renders correctly
- Branch switching changes data where applicable

---

## Skill: Create a staff API route with guard

1. Create route handler:

- `apps/web/app/api/staff/<feature>/route.ts`

2. Requirements:

- Use `guard.ts` (auth + scoping)
- Validate inputs
- Use server Supabase clients only

3. Errors:

- Return JSON `{ error: string, details?: any }` with correct status
- Avoid PHI in logs and responses

4. Manual test:

- Unauthed -> 401/redirect behavior matches existing routes
- Happy path -> 200
- Invalid input -> 400 with clear message

---

## Skill: Add / change Supabase schema safely

1. Add SQL migration file:

- `supabase/migrations/<timestamp>_<name>.sql`

2. Keep changes idempotent:

- `create table if not exists...`
- `create index if not exists...`
- careful with `create or replace view/function` limitations

3. Sync check:

- `supabase db pull` (verify no unexpected diffs)
- If function return types changed, you may need `drop function ...` then recreate.

4. Notes:

- For RPCs, document expected `p_*` args in the migration.

---

## Skill: Integrate Supabase RPC correctly

Rule: **RPC arg names must match function parameters exactly.**

Example:

```ts
await supabase.rpc("my_fn", {
  p_branch_code: branchCode,
  p_item_id: itemId,
});
```

If you see 400s and the payload looks correct, check:

wrong arg names (missing p\_)

date formatting (YYYY-MM-DD for Postgres date)

Skill: Add a Staff tab + staff home card
Update StaffNavi.tsx:

Add route and label

If role-gated, ensure it matches session/cookies role fields

Staff home (/staff/(protected)/page.tsx):

Add a card linking to the new module

Keep consistent spacing and card style

Manual test:

Tab appears

Link works

Role gating works

Skill: Rate-limit a staff API route
Find existing rate limit utility usage (search):

rg -n "rate.?limit|checkRateLimit" apps/web/app/api

Apply consistently:

Limit by actor/staff ID + route

Return 429 with friendly message

Manual test:

Trigger threshold locally (or lower limits in dev)

Ensure other routes unaffected

Skill: Mobile-safe changes checklist
When touching apps/mobile or shared packages:

Ensure env vars are correct:

EXPO_PUBLIC_DEV_API_BASE_URL (dev)

EXPO_PUBLIC_API_BASE_URL (prod)

EXPO_PUBLIC_WEB_API_BASE_URL (web API base URL used in mobile)

Confirm what http.ts uses

Run checks:

pnpm --filter mobile lint

pnpm --filter mobile typecheck

Guardrail:

Ensure scripts/check-mobile-phi.js passes

Do not add mobile code that queries PHI tables via Supabase directly

Manual:

Open on iOS/Android simulator if possible (or at least ensure bundling works)

Skill: “PHI safe” logging and audit
Never log:

lab values, diagnoses, SOAP notes, free-text clinical notes, personally identifying medical details

Audit:

Store metadata only (who/when/route/action/result)

Avoid storing request body for PHI routes

Review:

Search for accidental logs:

rg -n "console\\.log|console\\.error" apps/web apps/mobile packages
