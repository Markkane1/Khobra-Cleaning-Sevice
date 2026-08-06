# Khobra Mobile Wrapper

Capacitor shells for the deployed Khobra dashboard. Both platforms use the same web frontend and backend contracts; native push registration is bridged to the shared notifications API.

## Release inputs

- `CAPACITOR_SERVER_URL`: the deployed dashboard HTTPS origin, with no path.
- Android: `android/app/google-services.json`, plus `ANDROID_KEYSTORE_PATH`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`, a monotonically increasing integer `ANDROID_VERSION_CODE`, and display `ANDROID_VERSION_NAME`.
- iOS: an Apple provisioning profile for `com.khobracleaning.app` with Push Notifications enabled.
- Backend: VAPID variables for web push, Firebase service-account variables for Android, and APNs key variables for iOS (see `apps/web/.env.example`).

Build a signed Android App Bundle with `npm run build:android --workspace @khobra/mobilewrapper`. On macOS, increment Xcode's `CURRENT_PROJECT_VERSION` and `MARKETING_VERSION`, run `npm run sync:production --workspace @khobra/mobilewrapper`, then archive the iOS project in Xcode.

For local Android development, run the web app, use `adb reverse tcp:3000 tcp:3000`, set `CAPACITOR_SERVER_URL=http://localhost:3000`, and run `npm run run:android --workspace @khobra/mobilewrapper`.

## Production architecture warning

Capacitor documents `server.url` as a live-reload feature that is not intended for production. These shells deliberately retain it because this Next.js application is server-rendered and cannot be copied into `webDir` without a separate static/mobile frontend. Store acceptance and offline startup therefore cannot be guaranteed by this wrapper. A store-grade replacement should package a local frontend (the existing `apps/mobile` project is the natural starting point) and call the deployed API instead of loading the dashboard URL.
