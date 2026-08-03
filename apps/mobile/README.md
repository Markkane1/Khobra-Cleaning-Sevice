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
2. Run `npm install` from the repository root.
3. Run `npm run start --workspace @khobra/mobile`, then choose Android or iOS.

`npm run prebuild --workspace @khobra/mobile` generates the native platform project(s). Android was generated in this workspace; generate the iOS project on macOS or Linux, then open it in Xcode.

The API already accepts the bearer token returned at login, so the mobile app stores it in the operating system's secure storage rather than browser storage.
