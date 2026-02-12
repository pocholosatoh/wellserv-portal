# Mobile App

## API base URL

The mobile app reads `EXPO_PUBLIC_API_BASE_URL` at runtime. Set it for the dev-client
via `apps/mobile/.env` and restart the Metro bundler or dev-client after changes.
Production env values are provided via EAS Secrets.

Examples:

- Vercel: `EXPO_PUBLIC_API_BASE_URL=https://your-site.vercel.app`
- LAN: `EXPO_PUBLIC_API_BASE_URL=http://192.168.1.42:3000`

## Rewarded ads

Environment variables:

- `EXPO_PUBLIC_ADMOB_APP_ID_IOS` (App ID, contains `~`, native config)
- `EXPO_PUBLIC_ADMOB_REWARDED_ID_IOS`
- `EXPO_PUBLIC_ADMOB_REWARDED_ID_ANDROID`
  Production AdMob IDs are provided via EAS Secrets.

Notes:

- AdMob iOS App ID (`ca-app-pub-...~...`) is different from rewarded Ad Unit ID (`ca-app-pub-.../...`).
- After changing iOS App ID in Expo config/plugin env, you must rebuild iOS (`eas build --platform ios`) so native Info.plist is regenerated.

Cooldown behavior:

- Results can show a rewarded ad overlay at most once per hour.
- The last successful ad timestamp is stored in SecureStore as `LAST_REWARDED_AD_TS`.
- Ads are skipped during the cooldown and results load immediately.
