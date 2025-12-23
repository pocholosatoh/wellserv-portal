# Mobile App

## API base URL

The mobile app reads `EXPO_PUBLIC_API_BASE_URL` at runtime. Set it for the dev-client
via `apps/mobile/.env` and restart the Metro bundler or dev-client after changes.

Examples:

- Vercel: `EXPO_PUBLIC_API_BASE_URL=https://your-site.vercel.app`
- LAN: `EXPO_PUBLIC_API_BASE_URL=http://192.168.1.42:3000`
