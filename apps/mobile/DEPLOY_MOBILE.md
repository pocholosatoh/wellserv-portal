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

## Notes

- App display name can change without affecting the app identity. Bundle ID (`ios.bundleIdentifier`) and package name (`android.package`) must remain stable for updates.
- `dev` and `internal` profiles use AdMob test IDs.
- `production` requires real values provided via EAS secrets (test IDs are blocked for production builds).
