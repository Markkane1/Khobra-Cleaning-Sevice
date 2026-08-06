# Mobile Production Checklist

Use this checklist before publishing the Android or iOS mobile wrapper.

## 1. Production website and backend

- [ ] Deploy the web application and backend to one stable HTTPS origin.
- [ ] Set `CAPACITOR_SERVER_URL` to that origin, with no path or trailing slash.
  - Example: `https://app.example.com`
- [ ] Confirm the production database migrations have been applied.
- [ ] Confirm login, booking, uploads, PDF/CSV exports and logout work against production.
- [ ] Confirm the production server has all normal variables from [`apps/web/.env.example`](apps/web/.env.example).

## 2. Browser push notifications (VAPID)

- [ ] Generate one VAPID key pair:

  ```powershell
  npx web-push generate-vapid-keys
  ```

- [ ] Add the generated public key as `NEXT_PUBLIC_VAPID_PUBLIC_KEY`.
- [ ] Add the generated private key as `VAPID_PRIVATE_KEY`.
- [ ] Set `VAPID_SUBJECT` to an email you control.
  - Example: `mailto:admin@example.com`
- [ ] Keep the private key secret and backed up.
- [ ] Test browser push while the website is open, in the background and closed.

## 3. Android native push

The current Android implementation uses Firebase Cloud Messaging only for delivering native push notifications.

- [ ] Create or select a project in the [Firebase Console](https://console.firebase.google.com/).
- [ ] Register Android app ID `com.khobracleaning.app` in that project.
- [ ] Download `google-services.json` and place it at:
  - `apps/mobilewrapper/android/app/google-services.json`
- [ ] Create a Firebase service account for the backend.
- [ ] Add these service-account values to the production backend:
  - `FIREBASE_PROJECT_ID`
  - `FIREBASE_CLIENT_EMAIL`
  - `FIREBASE_PRIVATE_KEY`
- [ ] Enable the Firebase Cloud Messaging API in the Google Cloud project.
- [ ] Test notification permission, receipt, tapping and disabling on a physical Android device.

## 4. Android signing and release version

- [ ] Create or obtain the permanent Android release keystore.
- [ ] Back up the keystore and passwords securely. Losing them can prevent future updates.
- [ ] Set:
  - `ANDROID_KEYSTORE_PATH`
  - `ANDROID_KEYSTORE_PASSWORD`
  - `ANDROID_KEY_ALIAS`
  - `ANDROID_KEY_PASSWORD`
- [ ] Set `ANDROID_VERSION_CODE` to a positive integer that increases for every Play Store upload.
- [ ] Set `ANDROID_VERSION_NAME` to the customer-facing version, such as `1.0.0`.
- [ ] Build the signed Android App Bundle:

  ```powershell
  npm run build:android --workspace @khobra/mobilewrapper
  ```

- [ ] Upload the `.aab` to a Google Play internal-testing track.
- [ ] Install that Play build and repeat the complete smoke test.

## 5. iOS native push (APNs)

- [ ] Enrol in the [Apple Developer Program](https://developer.apple.com/programs/).
- [ ] Register bundle ID `com.khobracleaning.app`.
- [ ] Enable the Push Notifications capability for the App ID.
- [ ] Create an APNs authentication key and securely download its `.p8` private key.
- [ ] Add these values to the production backend:
  - `APNS_KEY_ID`
  - `APNS_TEAM_ID`
  - `APNS_PRIVATE_KEY`
  - `APNS_BUNDLE_ID=com.khobracleaning.app`
  - `APNS_PRODUCTION=true`
- [ ] Create or refresh the App Store provisioning profile after enabling push.
- [ ] Test permission, receipt, tapping and disabling on a physical iPhone.

## 6. iOS signing and release version

- [ ] Open `apps/mobilewrapper/ios/App/App.xcodeproj` on macOS with Xcode.
- [ ] Select the correct Apple development team and App Store provisioning profile.
- [ ] Increase `CURRENT_PROJECT_VERSION` for every upload.
- [ ] Set `MARKETING_VERSION` to the customer-facing version, such as `1.0.0`.
- [ ] Run the production sync before archiving:

  ```bash
  CAPACITOR_SERVER_URL=https://app.example.com npm run sync:production --workspace @khobra/mobilewrapper
  ```

- [ ] Archive and validate the app in Xcode.
- [ ] Upload it to TestFlight and repeat the complete smoke test.

## 7. Store information

- [ ] Final app name, description, category and support contact.
- [ ] Privacy Policy URL and Terms URL.
- [ ] App icon, screenshots and promotional graphics for required device sizes.
- [ ] Google Play Data Safety answers.
- [ ] Apple App Privacy answers.
- [ ] Support URL and account-deletion instructions.
- [ ] Reviewer test account if login is required.

## 8. Final device smoke test

Complete this on both a Play-installed Android build and a TestFlight-installed iPhone build.

- [ ] Fresh install and first launch.
- [ ] Login, logout and session expiry.
- [ ] All permitted screens for Admin, Customer, Driver and Cleaner accounts.
- [ ] Create and update a booking end to end.
- [ ] Upload photos/payment proof from camera and gallery.
- [ ] Download or share CSV and PDF files.
- [ ] Enable, receive, tap and disable push notifications.
- [ ] Receive booking-status and pickup-alert notifications in foreground, background and terminated states.
- [ ] Verify notification taps open the correct screen.
- [ ] Test slow internet, lost connection and server downtime.
- [ ] Confirm safe-area layout, keyboard behavior and no horizontal overflow.
- [ ] Confirm accessibility labels, readable text and touch targets.
- [ ] Confirm no secrets are committed to Git or included in screenshots/logs.

## Important architecture decision

- [ ] Accept the current network-dependent `server.url` wrapper for the first release, **or** replace it with a packaged mobile frontend before store submission.

The current wrapper always loads the live website. The offline page can explain a connection failure, but the application cannot perform its normal work without the website and backend being reachable.
