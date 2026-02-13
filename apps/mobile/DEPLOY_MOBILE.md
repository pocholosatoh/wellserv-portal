# Mobile Release Workflow

## Branching Policy

- Do day-to-day development on `main`.
- Produce mobile builds from `release/mobile`.

## Sync Release Branch

Run these exact commands when you're ready to cut builds:

```sh
git switch main
git pull
git switch release/mobile
git pull
git merge main
git push
```

## Build Commands (from release/mobile)

Use the npm scripts from the mobile workspace:

```sh
pnpm -C apps/mobile eas:dev:android
pnpm -C apps/mobile eas:dev:ios
pnpm -C apps/mobile eas:internal:android
pnpm -C apps/mobile eas:internal:ios
pnpm -C apps/mobile eas:prod:android
pnpm -C apps/mobile eas:prod:ios
```

## Production Env Setup (EAS)

Set production values in EAS (do this once, then update when values rotate):

```sh
cd apps/mobile
eas env:create --scope project --environment production --name EXPO_PUBLIC_API_BASE_URL --value https://api.wellserv.co
eas env:create --scope project --environment production --name ADMOB_IOS_APP_ID --value <real_ios_admob_app_id>
eas env:create --scope project --environment production --name ADMOB_ANDROID_APP_ID --value <real_android_admob_app_id>
eas env:create --scope project --environment production --name EXPO_PUBLIC_ADMOB_REWARDED_ID_IOS --value <real_ios_rewarded_unit_id>
eas env:create --scope project --environment production --name EXPO_PUBLIC_ADMOB_REWARDED_ID_ANDROID --value <real_android_rewarded_unit_id>
eas env:create --scope project --environment production --name EXPO_PUBLIC_SUPABASE_URL --value <supabase_url>
eas env:create --scope project --environment production --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <supabase_anon_key>
```

If a variable already exists, replace `env:create` with `env:update`.

Verify the environment before building:

```sh
cd apps/mobile
eas env:list --environment production
```

Important:

- Do not use Google AdMob test app IDs in the `production` environment.
- `apps/mobile/.env.production` is intentionally excluded from EAS upload; production builds must read values from EAS environment variables.

## Sanity Check

- Run `pnpm -C apps/mobile exec eas build:inspect --profile internal --platform android` to validate `eas.json` (if `build:inspect` isn't available, any build will validate the config).

## Notes

- App display name can change without affecting the app identity. Bundle ID (`ios.bundleIdentifier`) and package name (`android.package`) must remain stable for updates.
- `name` controls the display name shown on device and in store listings.
- `slug` is the Expo/EAS project identifier and should stay matched to the existing EAS project.
- We intentionally keep `slug` as `wellserv-mobile` while the display name is `WELLSERV Patient`.
- `dev` and `internal` profiles use AdMob test IDs.
- `production` requires real values provided via EAS secrets (test IDs are blocked for production builds).
- For Play Console internal testing, use the `app-bundle` build type to produce an `.aab` file.
- The EAS schema expects `app-bundle` (not `aab`) in `eas.json` for Android build types.
