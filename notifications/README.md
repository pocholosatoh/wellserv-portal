# Push notifications

The Expo app is configured with `expo-notifications` and requests permissions on launch. The Expo push token is stored in React state, but not yet persisted. To send real "results ready" alerts:

1. **Persist tokens**
   - Add an API route (Next.js) or Supabase table `mobile_push_tokens` with `{ patient_id, expo_token, platform, updated_at }`.
   - Call it from the mobile app after every login + permission change.

2. **Server job**
   - When new lab results land, enqueue a job containing the patient ID and result ID.
   - Look up tokens, batch by 100, and POST to `https://exp.host/--/api/v2/push/send`.

3. **Deep links**
   - Include `data: { url: "wellserv://results/<id>" }` so tapping the notification routes directly to the result detail screen.

4. **Monitoring**
   - Store push receipts returned by Expo and prune invalid tokens.
   - Add alerts if the push send queue grows or receipts contain errors.

For production you will also need to configure Apple Push (APNs) and Firebase (FCM) credentials in Expo.
