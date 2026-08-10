# Google Play Privacy Checklist

Use this checklist for the exact Android production artifact. Recheck it for every release that changes data, permissions, SDKs, or the web content loaded by the Capacitor wrapper.

## Listing and public pages

- [ ] Privacy policy URL: `https://khobraapp.duckdns.org/privacy-policy` after the new route is deployed.
- [ ] Confirm the URL is public, active, readable, non-geofenced, and not a PDF.
- [ ] Confirm the published page contains no bracketed placeholders.
- [ ] Link the policy inside the app. The native authentication screen and web experience include the link after this change.
- [ ] Publish a separate public account deletion request URL and enter it in Play Console.
- [ ] Implement an in-app account deletion path. Account creation exists, but account deletion does not. This is a submission blocker.

## Data Safety form, likely declarations from the current code

Verify every answer against production configuration and Play Console wording.

| Play category | Current app behavior | Required, optional, and purpose |
| --- | --- | --- |
| Personal info | Name, email, phone number, user ID, account status, and physical or service address | Core account and booking fields are required. Profile photo and some secondary details are optional. Purposes: app functionality and account management. |
| Financial info | Payment method, invoice and payment history, bank transfer reference, bank name, account holder, transfer date, proof, and verification records | Conditional on payment method. Purposes: payment processing, app functionality, fraud prevention, and legal records. No payment card numbers are collected in the current code. |
| Photos and videos | Optional profile photo, payment proof, complaint attachments, service images, and receipts | Optional generally, but proof may be required when bank transfer is selected. Purposes: account profile, payment verification, support, and app functionality. |
| Files and documents | User-selected complaint, receipt, and payment evidence files | Optional or conditional. Purposes: support, payment verification, expenses, and app functionality. |
| App activity and purchase history | Bookings, service selections, invoices, payments, cancellations, no-shows, and status history | Required to provide and administer services. |
| User-generated content | Booking notes, preferences, complaints, ratings, comments, and attachments | Optional or conditional. Purposes: app functionality and support. |
| Device or other identifiers | Mobile push tokens and browser push subscriptions | Optional because notifications can be disabled. Purpose: app communications. |
| Security and technical data | IP address for rate limiting and abuse prevention, session and request identifiers, and security signals processed through Turnstile | Required for security where the relevant feature is used. Verify the closest current Play Console category for IP and security signals. |
| Precise device location | A one-time foreground latitude and longitude reading is collected only when the customer selects **Use phone GPS** | Optional. Purposes: app functionality, saved service address, booking fulfilment, and dispatch. Manual address entry remains available. Declare precise location collection for both Android packages. |
| Contacts, microphone, health, fitness, browsing history | No collection found | Do not declare unless the production build changes. |
| Analytics, advertising, crash analytics | No analytics, advertising, or crash-reporting SDK found | Do not declare unless production infrastructure or a later SDK collects it. Server operational logs still require separate verification. |

## Collection, sharing, security, and deletion answers

- [ ] Declare data collected by the native app, the Capacitor-controlled webview, backend, and integrated SDKs.
- [ ] Review Cloudinary, Cloudflare Turnstile, Firebase Cloud Messaging, Apple Push Notification service, browser push providers, hosting, and database processing.
- [ ] Determine whether each service-provider transfer qualifies for Google Play's service-provider sharing exception. Do not answer “not shared” until contracts and provider purposes are verified.
- [ ] Confirm every production API, upload, push, and provider connection is encrypted in transit before answering yes.
- [ ] Confirm passwords are hashed and production secrets are not in the app bundle or repository.
- [ ] Answer that users cannot currently request complete account deletion through an in-app and web flow. Fix this before submitting.
- [ ] After deletion is implemented, describe lawful retention accurately and ensure retained data is protected and no longer used for unrelated purposes.
- [ ] Mark required versus optional data accurately. Data that is required only when a user chooses a specific feature, such as bank transfer proof, is conditional rather than universally required.

## Android permissions and build review

- [ ] Confirm the final merged manifest for each submitted package, not only the source manifest.
- [ ] Expected permissions are internet access, notification permission, approximate location, and precise foreground location. No background location, contacts, microphone, camera, or broad storage permission is intended.
- [ ] Explain foreground location accurately in Play Console: requested only after the user chooses phone GPS, used to save a service pin, and not used for background or continuous tracking.
- [ ] Confirm system document or photo pickers do not introduce broader access in the final build.
- [ ] Review `com.khobracleaning.app` and `com.khobracleaning.web` separately if both packages are submitted. Each listing and Data Safety form must match that package.
- [ ] Save a copy of the final permission report, SDK list, Data Safety answers, policy version, and signed artifact with the release record.

## Official Google sources

- Privacy, Deception and Device Abuse policy: https://support.google.com/googleplay/android-developer/answer/17190352
- Account deletion requirement: https://support.google.com/googleplay/android-developer/answer/13327111
- Data Safety form guidance: https://support.google.com/googleplay/android-developer/answer/10787469
