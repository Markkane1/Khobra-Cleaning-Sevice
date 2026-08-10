# Privacy Compliance TODO

This is an implementation and operational checklist based on the repository as reviewed on 11 August 2026. It is not a substitute for advice from a UAE-qualified lawyer. The default legal reference is UAE Federal Decree-Law No. 45 of 2021. Confirm whether the licensed operator is subject to the federal regime, DIFC law, ADGM regulations, or another applicable regime.

## CRITICAL: Before App Store/Production Release

- [x] Recorded legal company name, UAE jurisdiction, monitored privacy email, phone, and business address.
- [ ] Obtain business-owner approval that the operational claims match practices outside the code, including no data sale, no behavioral advertising, the intended minimum age, data recipients, and how support staff handle personal data.
- [ ] Confirm whether the operator is mainland UAE, DIFC, ADGM, or another free zone. Obtain UAE legal review if DIFC, ADGM, health data, children, or another sector-specific rule applies.
- [ ] Implement account deletion inside both account-creating native apps. Also publish a functional public web page where users can request deletion without reinstalling the app. The current admin customer deletion is a soft deactivation and is not a full deletion workflow.
- [ ] Make deletion cover the user account, push tokens, Cloudinary uploads, and associated data unless a documented legal or operational exception requires retention. Record what was deleted, retained, why it was retained, and the retention end condition.
- [ ] Add a clear Privacy Policy acknowledgement at signup and record the policy version and acknowledgement timestamp. Keep optional marketing consent separate and unchecked if marketing is later introduced.
- [ ] Establish a documented retention schedule for accounts, bookings, invoices, transfers, complaints, workforce data, uploads, logs, IP-based rate-limit records, push tokens, and backups. Add tested cleanup jobs. `BACKUP_RETENTION_DAYS`, when configured, covers backups only.
- [ ] Verify the legal name, processing location, data role, data processing terms, deletion support, security measures, and cross-border safeguards for the hosting provider, database provider, Cloudinary, Cloudflare, Google Firebase, Apple, and browser push services.
- [ ] Complete Google Play Data Safety and Apple App Privacy answers from the exact production builds. Include SDK and webview behavior. Do not copy generic answers from another app.
- [ ] Create a personal data breach response procedure with an incident owner, risk assessment, evidence log, processor escalation contacts, and the notification steps required by Article 9 of the UAE federal law.

## HIGH: Implement As Soon As Possible

- [ ] Create a privacy request workflow for access, correction, portable export, deletion, restriction, objection, and consent withdrawal. Authenticate requesters, track deadlines and decisions, and provide clear responses.
- [ ] Add a machine-readable account data export that covers profile, addresses, bookings, payments, complaints, ratings, and notification preferences where legally applicable.
- [ ] Ensure Cloudinary and other external records are deleted when their database record or user account is deleted. Add orphaned-upload cleanup.
- [ ] Decide whether a Data Protection Officer is legally required and document the assessment. Identify the internal privacy owner even if a statutory DPO is not required.
- [ ] Maintain a processing inventory that records purpose, data category, user category, legal ground, recipient, location, retention, and security controls for each processing activity.
- [ ] Assess and document the optional precise GPS address feature together with higher-risk workforce monitoring, payroll, dispatch, uploaded evidence, and any future continuous location tracking or automated decision-making. Confirm that coordinates are visible only to staff assigned to the service.
- [ ] Set automatic expiry and cleanup for IP-based rate-limit records. Review application, hosting, database, proxy, and error logs to prevent passwords, tokens, payment proof links, or unnecessary personal data from being logged.
- [ ] Review role permissions regularly. Confirm that cleaners and drivers receive only the contact, address, booking, payment status, and operational information needed for their current assignment.
- [ ] Decide and document the minimum user age. Add an age control if the service could realistically be used by minors.

## MEDIUM: Recommended

- [ ] Keep an inventory of cookies, secure storage, local storage, and SDK storage. The current implementation appears essential-only, so a marketing cookie banner is not currently needed. Reassess before adding analytics or advertising.
- [ ] Add granular notification preferences for booking, payment, complaint, and operational notifications instead of relying only on device-level permission.
- [ ] Add an annual processor security and privacy review, including access control, encryption, incident history, sub-processors, and deletion evidence.
- [ ] Store policy versions and present a change notice when a material policy update affects existing users.
- [ ] Test that public privacy and deletion pages are available without login, are not blocked by geography, and remain usable on small screens and assistive technology.

## LOW: Improvement

- [ ] Add automated tests that verify the privacy URL remains public and linked from web and native entry points.
- [ ] Add release checklist checks for new permissions, SDKs, data fields, processors, exports, and store disclosure changes.
- [ ] Run periodic data minimization reviews and remove fields or copies that no longer support a documented purpose.
- [ ] Conduct periodic deletion, restore, access-control, and incident-response exercises and retain evidence of the result.

## Verified official references

- UAE Federal Personal Data Protection Law: https://uaelegislation.gov.ae/en/legislations/1972
- UAE government overview of data protection laws: https://u.ae/en/about-the-uae/digital-uae/data/data-protection-laws
- Google Play account deletion: https://support.google.com/googleplay/android-developer/answer/13327111
- Google Play Data Safety: https://support.google.com/googleplay/android-developer/answer/10787469
- Apple in-app account deletion: https://developer.apple.com/support/offering-account-deletion-in-your-app/
- Apple App Privacy details: https://developer.apple.com/app-store/app-privacy-details/
