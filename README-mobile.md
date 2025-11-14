# Wellserv Mobile (Expo)

Patient-facing Expo app that shares code with `apps/web`. This baseline wires up Expo Router, NativeWind, Supabase APIs, and React Query through the shared `@wellserv/*` packages.

## Getting started

```bash
pnpm install
cp .env.mobile.example apps/mobile/.env
pnpm --filter @wellserv/core build
pnpm --filter @wellserv/data build
pnpm --filter mobile dev
```

> `pnpm dev` runs Turborepo to watch every workspace; use `pnpm --filter mobile start` for Expo only.

## Environment

Add these keys to `apps/mobile/.env`:

```
EXPO_PUBLIC_SUPABASE_URL=<https://xxx.supabase.co>
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key>
EXPO_PUBLIC_PATIENT_ACCESS_CODE=<same code as web portal>
```

Values are available via `process.env` and `expo-constants` inside the mobile app. Never ship service-role keys.

## Deep links & routing

- Scheme: `wellserv://`.
- `wellserv://results/<id>` opens the Results tab and pushes the detail screen.
- `app.json` contains Android intent filters; for iOS run `npx uri-scheme open wellserv://results/ABC --ios`.

## Push notifications (skeleton)

- `SessionProvider` registers with `expo-notifications` on launch and logs/stores the Expo push token.
- Tokens are not sent to the API yet. See `notifications/README.md` for follow-up steps.

## Shared packages

- `@wellserv/core` – patient/result/prescription contracts + helpers.
- `@wellserv/data` – Supabase client factory, secure storage adapter, and React Query hooks.
- `@wellserv/theme` – color/spacing tokens + Tailwind/NativeWind presets.

Run `pnpm --filter <pkg> build` to emit JS/types; Turbo will cache these builds in CI.
