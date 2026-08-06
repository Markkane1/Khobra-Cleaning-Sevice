# Khobra Mobile

The mobile client is intentionally isolated from `apps/web`. It contains native presentation code and talks to the deployed Next.js API over HTTPS. The existing `packages/core` and `packages/application` remain the server-side domain and application layers.

The **Workspace** tab securely opens the existing complete operations workspace in the app's own WebView using the signed mobile session. This preserves feature parity for modules still awaiting a dedicated native screen without mixing any web code into the mobile project.

```
apps/mobile/
├── src/domain/          # Mobile-facing entities and value types
├── src/application/     # Use cases and gateway contracts
├── src/infrastructure/  # HTTP and secure-storage adapters
└── src/presentation/    # React Native screens
```

## Run

1. Copy `.env.example` to `.env` and set `EXPO_PUBLIC_API_URL` to the public HTTPS URL of `apps/web` (no trailing slash).
2. Add the Firebase Android client file as `apps/mobile/google-services.json`; it is ignored by Git.
3. Run `npm install` from the repository root.
4. Run `npm run start --workspace @khobra/mobile`, then choose Android or iOS.

`npm run prebuild --workspace @khobra/mobile` generates the native platform project(s). Android was generated in this workspace; generate and archive the iOS project on macOS with Xcode.

The API already accepts the bearer token returned at login, so the mobile app stores it in the operating system's secure storage rather than browser storage. Native Android/iOS device tokens are registered with the shared notifications API after sign-in; production still requires the Firebase and APNs server credentials listed in `apps/web/.env.example`.

`npm run build:android --workspace @khobra/mobile` compiles an Android App Bundle and refuses to build unless `EXPO_PUBLIC_API_URL` is an HTTPS origin. Store signing credentials outside the repository and sign the bundle in the deployment pipeline.
