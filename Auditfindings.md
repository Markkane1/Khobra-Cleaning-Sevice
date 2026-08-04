# Repository-wide Audit Findings

**Audit date:** 2026-08-04  
**Audited baseline:** The current working tree, including pre-existing uncommitted changes  
**Scope:** Web application, API routes, domain/application/data layers, Prisma schema and live database, realtime service, Expo mobile app, Android project, Capacitor wrapper, authentication/authorization, booking workflow, payments/transactions, notifications, reports, uploads, public pages, tests, dependency health, UI/UX, accessibility, and over-engineering.

## Executive conclusion

The repository is **not production-ready**. The web application builds and type-checks, and the live database currently matches the Prisma schema structurally, but those positive signals hide several release-blocking failures:

1. Multiple mutation APIs omit method-level authorization and/or tenant ownership checks.
2. The advertised multi-tenant model is not consistently enforced; several paths use the first tenant or globally address records by ID.
3. Cash and bank payments can bypass the approved operational workflows and be marked verified through the generic payments API.
4. Realtime notifications are unauthenticated, global rather than tenant-scoped, partially corrupted, and not actually wired to web push.
5. The Android project does not build and represents a different Expo/React Native dependency graph and application ID from the intended mobile app.
6. The database has no reproducible migration history or seed command, and current live data contains workflow-invalid financial records and passwordless users.
7. Historical transaction details are reconstructed from mutable booking data instead of being stored as immutable financial snapshots.
8. Existing tests do not cover most authorization, tenant-isolation, notification, reporting, mobile, or destructive data-retention paths; the one full workflow integration test currently fails.

**Release recommendation:** Block production deployment until all P0 items and the financial/data-integrity P1 items in this report are resolved and revalidated against a fresh database created solely from committed migrations and seeds.

## Severity model

| Severity | Meaning |
|---|---|
| **Critical / P0** | Exploitable authorization, tenant isolation, financial integrity, or deployment blocker. Must be fixed before release. |
| **High / P1** | Likely data loss, workflow bypass, inaccurate financial reporting, or a core feature that does not work. |
| **Medium / P2** | Incorrect or partial behavior, operational fragility, accessibility problem, or maintainability risk. |
| **Low / P3** | Cleanup, misleading copy, dependency hygiene, or a non-blocking UX problem. |

## Validation evidence

| Check | Result | Important qualification |
|---|---|---|
| `npm run lint` | Pass | Lint success does not exercise authorization or workflows. |
| `npm run build` | Pass | `apps/web/next.config.mjs` disables build-time TypeScript validation with `typescript.ignoreBuildErrors: true`; React strict mode is also disabled. |
| `npx tsc -p apps/web/tsconfig.json --noEmit` | Pass | This explicit check is stronger than the configured production build. |
| Mobile `npm run typecheck` | Pass | Does not validate native dependency compatibility or produce an APK. |
| Node test suite | **49/50 pass** | The end-to-end booking/payment persistence scenario fails when payment proof upload is not backed by Cloudinary. Most passing tests are helper-level tests. |
| Prisma schema-to-live-DB diff | Pass | “No difference detected” means structural sync only. There is no committed migration history proving reproducibility. |
| `npm audit --omit=dev` | **Fail** | 14 production vulnerabilities: 2 high and 12 moderate, including high-severity findings in `sharp` and `postcss` dependency ranges. |
| `npm ls --all --depth=0` | **Fail** | Extraneous root Expo/RN packages and an invalid TypeScript version for the installed Expo SDK. |
| `npx expo-doctor` | **16/18** | Duplicate/incompatible Expo, React, React Native, and native modules; TypeScript 6.0.3 does not match Expo’s expected `~5.9.2`. |
| Realtime TypeScript check | **Fail** | Corrupted compiler option `noUnusedParameteAED` and corrupted package metadata/names. |
| Android `:app:assembleDebug` | **Fail** | Native linker errors in generated app modules, including unresolved C++ runtime symbols. |
| Public browser smoke test | Partial pass | Landing and public booking render responsively, but authenticated screens were not bypass-tested because CAPTCHA and real login controls were intentionally preserved. |

## Live database snapshot

This is a point-in-time diagnostic of the configured database, not proof that another environment is healthy.

| Entity/state | Observed |
|---|---:|
| Tenants | 1 |
| Users | 19 |
| Bookings | 37 |
| Assignments | 22 |
| Invoices | 7 |
| Payments | 6 |
| Ratings | 0 |
| Notifications | 4 |
| Business expenses | 0 |
| Driver expenses | 0 |
| Passwordless users | **15** |
| Completed booking without invoice | **1** (`BK-01006`, net amount 1,800) |
| Verified bank payments without proof/reference/company account | **5** |
| Active company bank-account setting | **0** |

Current booking statuses include `assigned`, `confirmed`, `cancelled`, `pending_assignment`, `completed`, `pending`, `in_progress`, and `scheduled`. No current row is `on_the_way`. This confirms the schema accepts the new value, but it does not prove the operational path has been exercised in the live database.

No current duplicate assignment, invoice, or payroll rows were found. That is not sufficient protection because the schema lacks several uniqueness constraints described below.

---

## Detailed findings

### A. Security, authorization, and tenant isolation

#### SEC-001 — Critical — Service mutation endpoints omit authorization

`apps/web/src/app/api/services/route.ts` protects some methods but its `PUT` and `DELETE` handlers do not enforce the admin role. The proxy only establishes that a session exists for generic protected API paths; it does not supply resource-specific authorization. A customer, cleaner, or driver with a valid session can therefore attempt to alter or delete services directly. The delete handler also contains a dead/demo call using `getServices('fake')`.

**Required correction:** Enforce role and tenant ownership in every method at the route/service boundary, then add negative tests for every non-admin role and cross-tenant ID.

#### SEC-002 — Critical — Branch, inventory, vendor, and vendor-item mutations are incompletely protected

The following handlers repeat the same unsafe pattern:

- `apps/web/src/app/api/branches/route.ts`: `PUT`/`DELETE` lack role authorization; reads use the first tenant.
- `apps/web/src/app/api/inventory/route.ts`: `PUT`/`DELETE` lack role authorization; tenant selection is not session-scoped.
- `apps/web/src/app/api/vendors/route.ts`: `PUT`/`DELETE` lack role authorization.
- `apps/web/src/app/api/vendor-items/route.ts`: all methods lack adequate authentication/role/tenant enforcement.
- `apps/web/src/app/api/activity/route.ts`: lacks explicit authorization and uses the first tenant.

**Impact:** Unauthorized business-data mutation and cross-tenant disclosure/mutation if a second tenant is introduced.

#### SEC-003 — Critical — Tenant isolation is systemic rather than a single-route defect

Several routes and repositories use `tenant.findFirst()` or globally unique-looking `where: { id }` operations without proving the record belongs to `session.tenantId`. Confirmed first-tenant paths include activity, signup, branches, inventory, payroll, public bookings, public services, service creation, vendors, and settings. The schema advertises tenancy, but application enforcement is inconsistent.

**Required correction:** Make tenant ID a mandatory input to every tenant-owned repository operation, include it in every lookup/update/delete predicate, and reject mismatches. Add a two-tenant integration test suite; a one-tenant database cannot reveal these leaks.

#### SEC-004 — Critical — Settings expose global configuration across roles and tenants

`apps/web/src/app/api/settings/route.ts` permits any authenticated user to read settings. Its repository reads the first tenant and returns AppSettings key/value data broadly. This can expose inactive/deleted bank-account JSON, audit metadata, RBAC configuration, and future secrets to customers, drivers, or cleaners.

**Required correction:** Split public-safe settings from administrative settings, enforce admin permissions, tenant-qualify keys, and return explicit DTOs rather than raw key/value records.

#### SEC-005 — High — Employee directory leaks sensitive information to any authenticated role

The employee GET route uses authentication without a restrictive role check. It returns employee/user fields that include contact details, address, skills, and salary-related data. A customer or driver should not receive the full workforce directory.

**Required correction:** Apply least-privilege projections and role checks. Cleaners should see their own profile; drivers should receive only assignment-relevant names/contact fields; customers should receive only safe booking display information.

#### SEC-006 — High — Dashboard statistics disclose tenant-wide business data

The statistics route is available to any authenticated user and returns tenant-level revenue, attendance, and booking counts. This is administrative/business intelligence, not a generic authenticated-user resource.

#### SEC-007 — Critical — Realtime broadcast endpoint is unauthenticated and globally scoped

`apps/realtime/index.ts` accepts unauthenticated `POST /broadcast` requests, binds on all interfaces, accepts arbitrary event type/payload, and emits globally. Clients are not authenticated and subscription/tenant maps are not used to isolate delivery. The alternate `index.js` also accepts client-originated broadcast events.

**Impact:** Anyone who can reach the service can forge status/payment/pickup events for every connected user and leak one tenant’s events to another.

**Required correction:** Keep one realtime entrypoint, authenticate the internal publisher, authenticate socket clients, use tenant/user rooms, allowlist event types, validate payloads, and test cross-tenant denial.

#### SEC-008 — High — Auth tokens cannot be revoked and do not revalidate user state

The custom HMAC token is valid for up to eight hours. `requireAuth` validates signature and expiry but does not re-read the user’s active status, current role, current tenant, password/session version, or forced-logout timestamp. Deleting/disabling a user, changing their role, or changing their password does not invalidate an already-issued token. Logout only clears the local browser cookie; a copied bearer token remains valid.

**Required correction:** Add server-side session/version validation or short-lived access tokens with revocable refresh sessions. At minimum, compare token version and current active role/tenant on done the sensitive requests.

#### SEC-009 — High — Mobile logout is local-only

The mobile app removes local secure storage/cookie state but does not call the server logout endpoint. This creates the appearance of revocation while the bearer token remains usable on another client until expiry.

#### SEC-010 — High — Public booking permits customer impersonation and creates unclaimable accounts

The public booking flow accepts an email address and attaches the booking to an existing customer with that email without authentication or ownership verification. If the email is new, it creates a user without a password. The normal signup flow later rejects the duplicate email, leaving the public customer unable to claim the account.

**Required correction:** Use verified email/OTP claim flow or create a pending guest identity with an explicit account-claim token. Add rate limiting and abuse controls.

#### SEC-011 — High — No application-level rate limiting on sensitive/public endpoints

No durable rate limits were found for login, signup, public booking, uploads, or realtime publication. CAPTCHA reduces automated login/signup abuse, but it is not a replacement for server rate limiting. Public booking and uploads have neither. Login uses synchronous `scryptSync`, so high request volume can also block the Node.js event loop.

#### SEC-012 — Medium — Missing explicit browser security headers and CSRF/origin policy

The Next configuration defines no Content Security Policy, HSTS, frame restrictions, permissions policy, or related hardening headers. Cookie `SameSite=Lax` helps common CSRF cases, but state-changing cookie-authenticated requests do not have an explicit origin/CSRF validation strategy.

#### SEC-013 — Medium — Development auth secret has an unsafe fallback

Authentication falls back to a known development secret when not in production. Production correctly requires configuration, but misclassified/staging environments can silently accept a predictable secret.

#### SEC-014 — High — Generic upload endpoint is too broadly authorized

Any authenticated role can use the generic uploader for broadly accepted image/PDF content and arbitrary sanitized purpose folders. Generic/service uploads rely primarily on declared MIME type, extension, and size; only payment proof receives stronger magic-byte checks. SVG is accepted in a path where active content can become risky depending on how it is later embedded.

**Required correction:** Allowlist upload purposes per role, verify content signatures for every supported type, disallow or sanitize SVG, enforce tenant ownership, and record asset ownership.

#### SEC-015 — High — Payment-proof ownership validation validates URL shape, not provenance

The payment workflow checks that a proof URL resembles an expected Cloudinary URL/path/extension, but it does not prove that the asset exists, belongs to the authenticated tenant/customer, or was uploaded through this application. A crafted or copied URL can pass shape validation.

#### SEC-016 — Medium — File download authorization is filename-based

The download route prevents simple path traversal with basename handling, but it has no booking/payment/tenant ownership check. Any authenticated user who learns a filename can retrieve it. Files under `public/uploads` may also be directly reachable without the route. The handler uses synchronous file reads, which unnecessarily block the server event loop.

#### SEC-017 — High — UI permissions and API permissions are separate, drifting systems

Saved RBAC permissions determine page/menu visibility, while APIs mostly hard-code roles independently. Revoking a page permission does not revoke its API. Custom roles can be created and assigned even though most APIs will not recognize them. Existing tokens retain old roles until expiry.

#### SEC-018 — Medium — Role model still contains legacy roles

The stated role model is Admin, Driver, Customer, and Cleaner, yet code/configuration still references manager, supervisor, accountant, and employee. Current RBAC settings contain legacy role keys, and some APIs authorize manager/accountant. This is both a security-policy ambiguity and a source of inconsistent access decisions.

### B. Booking workflow and notifications

#### WF-001 — High — Assignment can regress a booking to `assigned`

The assignment operation directly sets booking status to `assigned` without routing through the central transition validator. It can therefore regress a completed or in-progress booking and bypass the required sequence. It also deletes and recreates assignments/items, which can erase actual hours and break historical attribution.

**Required correction:** Guard assignment by current status, preserve historical assignment records, and enforce the same transition function used by status actions.

#### WF-002 — High — Workflow history actors are untyped strings

Fields such as `changedBy`, `createdBy`, `receivedBy`, and `verifiedBy` are strings without user foreign keys. Current data already mixes human names with user IDs. Audit screens that resolve actors by ID will therefore misattribute or fail to display legacy actions.

#### WF-003 — High — Notifications are database records, not end-to-end delivery

Status changes create in-app notification rows and immediately label them sent, but no functioning web-push service worker/VAPID/Expo push delivery implementation was found. This does not meet the requirement to use enabled in-app and web-push channels. Failed notification inserts are logged, but a durable failed delivery-attempt record is not guaranteed.

#### WF-004 — High — Realtime publication failures are silently ignored

Booking code attempts to broadcast updates but suppresses failures. Combined with the broken realtime package, status changes can persist while every live interface remains stale until polling/refetch. There is no operational signal that delivery failed.

#### WF-005 — Medium — Booking status vocabulary is unconstrained and already drifting

Booking, payment, transaction, reconciliation, and role states are stored as free strings. The database contains legacy states such as `pending`, `confirmed`, `pending_assignment`, and `assigned` alongside the new operational sequence. Without enums/check constraints and a documented transition graph, typo/legacy states can bypass filters and reports.

#### WF-006 — Medium — Pickup alert immediacy depends on polling or broken realtime

The mobile app polls for pickup state approximately every ten seconds. Web push is absent and realtime is not operational. The “immediate high-priority pickup alert” requirement is therefore only partially implemented.

#### WF-007 — Medium — Completion/payment selection rules are internally ambiguous

The completion flow can preselect an invoice payment method from the booking preference, while the stated workflow also requires the customer to explicitly choose cash or bank transfer after completion. Booking-time preference may be useful, but it must not be treated as post-completion confirmation unless the business rule explicitly says so.

#### WF-008 — Medium — No persisted completion timestamp on the booking

Reporting commonly filters completed bookings by scheduled date because the booking itself has no authoritative `completedAt`. Assignment-level completion information is not a reliable single booking completion timestamp when multiple cleaners are assigned.

### C. Payments, transactions, invoices, and reporting

#### FIN-001 — Critical — Generic payments API bypasses approved cash and bank workflows

The generic payments POST route allows authorized administrative roles to create verified cash or bank payments and increment invoice paid amount directly. It does not require:

- a completed booking;
- customer cash selection plus assigned-cleaner receipt confirmation; or
- submitted bank proof/company account plus explicit bank-transfer approval.

This violates the rule that a cash transaction is created only when the assigned cleaner marks cash received and a bank transaction only when an authorized admin approves a valid submission.

**Required correction:** Remove or strictly constrain the bypass route; route all confirmed inflows through the existing cash-receipt and bank-approval domain operations under one idempotent transaction.

#### FIN-002 — Critical — Historical transaction detail is not immutable

The transaction master/detail screen reconstructs its amount breakdown from current booking, service, assignment, and invoice data. If a service name/rate, booking duration, worker count, discount, or tax changes later, an old transaction’s displayed details can change. A financial record must preserve the calculation accepted at payment time.

**Required correction:** Persist the existing calculation output as immutable transaction detail rows or a validated snapshot when the confirmed transaction is created. Continue using one calculation function; do not create a parallel formula.

#### FIN-003 — High — Cash collectible amount uses booking net amount instead of invoice total

The cleaner cash-receipt path calculates outstanding cash from `booking.netAmount - invoice.paidAmount`. The authoritative receivable should be the invoice total after all adjustments. If invoice adjustments differ from the booking net amount, the cleaner can be shown and record the wrong amount.

#### FIN-004 — High — Completed invoices are not calculated from actual worked hours

Invoice generation on completion uses scheduled booking/net values. Assignment actual start/end/hours are recorded but do not reprice the invoice. This conflicts with the requirement that a completed booking’s invoice be based on hours worked and can overcharge or undercharge.

#### FIN-005 — High — Tax representation is inconsistent

Completion can store subtotal/net values with a zero tax field even where the net amount includes configured tax. Transaction views later infer/reverse-engineer tax. The customer profile also hardcodes a 5% VAT split. These paths can disagree with tenant configuration and with one another.

#### FIN-006 — High — Database does not enforce one invoice per booking

The schema models booking-to-invoices as one-to-many and lacks a unique constraint on `Invoice.bookingId`. Multiple creation paths exist, so concurrent or retried completion/issuance can create duplicates even though no duplicate happens to exist today.

#### FIN-007 — High — Idempotency relies too heavily on application checks

Assignments, invoices, payroll periods, and daily attendance lack key uniqueness constraints such as booking+employee, booking, tenant+employee+month+year, and employee+date. Application locks/checks reduce ordinary duplication but do not protect against multiple processes, retries, or direct database writes.

#### FIN-008 — High — Financial values use floating point

Rates, tax, totals, discounts, and payment amounts use `Float`. Binary floating-point arithmetic can create rounding discrepancies, especially across subtotal/tax/payment reconciliation. Monetary columns should use fixed-scale decimal values with one documented rounding policy.

#### FIN-009 — High — Transaction number is derived, not a durable unique business key

The displayed number is synthesized from the tail of a payment ID (for example `TXN-...`) rather than stored as a unique, auditable transaction number. This is presentation logic, not a guaranteed business identifier.

#### FIN-010 — High — Transaction history is synthesized from current timestamps

The transaction history view infers events from current payment fields rather than reading an append-only transaction/audit ledger. It cannot reliably show intermediate decisions, retries, rejections, reopen actions, reconciliation changes, or who changed each state.

#### FIN-011 — High — Company bank accounts are settings JSON rather than relational records

Bank accounts are stored in AppSettings JSON. Consequences include:

- no foreign key from a payment to a real bank-account row;
- read-modify-write races that can lose concurrent edits;
- no database enforcement of one default per currency;
- audit and soft-delete rules enforced only by UI/application code;
- customer visibility and transaction retention becoming string/JSON conventions.

The `companyBankAccountId` on payments is therefore not referentially protected.

#### FIN-012 — High — Existing verified bank data violates the new approval requirements

All five currently verified bank payments lack proof URL, transfer reference, and company bank-account linkage. Rejected transfers do not create confirmed inflow in the reviewed current code, but this existing data cannot support the promised traceability and should be explicitly migrated, quarantined, or marked legacy rather than silently presented as fully verified.

#### FIN-013 — High — One completed live booking has no invoice

`BK-01006` is completed with a net amount of 1,800 but has no invoice. Any report that treats invoices as the complete set of completed receivables will omit it.

#### FIN-014 — Medium — Count-based reference generation is concurrency-unsafe

Booking, invoice, complaint, and employee references are based on row counts. Concurrent inserts can compute the same value; deletions can cause reuse. Driver codes use a small random range without database-enforced retry semantics. Use database sequences/unique constraints and retry on collision.

#### FIN-015 — High — Customer/employee/driver creation is not atomic

User creation and profile creation are separate operations without a single database transaction. A second-step failure leaves orphan users. The live database’s 15 passwordless users demonstrate that identity lifecycle is already fragile.

#### FIN-016 — Critical — Admin-created operational users cannot authenticate normally

Fifteen of nineteen live users have no password hash: four cleaners, two drivers, seven customers, and two admins. There is no complete invitation/password-setup/reset flow that safely activates these accounts. Merely “seeding one credential per role” does not solve lifecycle for real created users.

#### FIN-017 — Critical — Driver creation uses a role value incompatible with authorization

The driver repository creates roles/statuses using uppercase values such as `DRIVER`/`AVAILABLE`, while authorization and navigation expect lowercase `driver` and the established status vocabulary. New drivers can be invisible to role filters or unable to authenticate/authorize even after receiving credentials.

#### FIN-018 — Critical — Destructive deletes can erase operational history and partially fail

Employee deletion removes payroll, leave, attendance, assignments, and potentially ratings/work history before removing the user. Customer deletion removes complaints/bookings/invoices and can encounter payment foreign-key restrictions only after earlier destructive steps have succeeded. Driver deletion removes trips before later expense/user constraints may fail. These operations are not safe archival workflows and are not consistently atomic.

**Required correction:** Soft-delete business actors, preserve financial/booking history, anonymize only where required, and wrap allowed destructive changes in a transaction.

#### FIN-019 — Medium — Cash reconciliation status is semantically inconsistent

The reviewed live cash payment is verified while reconciliation is `not_required`, despite the specified cash workflow requiring pending reconciliation. The application needs one documented distinction between customer payment verification and employee cash handover/reconciliation.

#### FIN-020 — High — Cash-flow reporting is not a complete cash-flow statement

Current reporting emphasizes confirmed payment inflows. Business expenses, approved driver expenses, salaries/payroll, and reconciliation timing are not consistently included in the same cash-flow model. Calling the result “cash flow” can materially mislead Admin.

#### FIN-021 — Medium — Dashboard financial/status metrics contain synthetic or incomplete logic

The dashboard’s `+12%` trend is fixed rather than computed. Pending counts omit relevant states such as `pending_assignment`, `assigned`, or `scheduled` depending on the widget. A status chart calculates “confirmed” as a residual. These values should not be used for operational decisions.

#### FIN-022 — Medium — Completed/date reports filter on scheduled date

Reports use the booking’s scheduled date instead of actual completion date. A late-running booking completed in another day/week/month appears in the wrong completed report.

#### FIN-023 — Medium — Cleaner worked-hours report overstates actual work

Where actual hours are absent, reporting falls back to scheduled duration and can include assignments that were only scheduled/pending. A report labeled “hours worked” must use actual completed work or clearly distinguish scheduled hours.

#### FIN-024 — Medium — Currency is configurable but AED is hardcoded in multiple flows

The tenant has a currency setting and company bank accounts have currency, yet UI messages, payment responses, and profile/invoice displays frequently hardcode AED. Multi-currency or even a changed tenant currency will display and record inconsistent information.

### D. Database sync, migrations, and data governance

#### DB-001 — Critical — Schema is synced, but the database is not reproducible

Prisma reports no structural difference between the current schema and configured live database. However, there is no committed `migrations/` directory, migration history, rollback path, or package-level migration command. “DB synced” is therefore true only for this one configured database at this moment.

**Required correction:** Baseline the live schema safely, commit forward migrations, and prove that an empty database can be created and upgraded in CI.

#### DB-002 — High — No reproducible seed command

No committed seed script/package command was found. The existing accounts/data cannot be recreated reliably, and credential seeding appears to have been performed manually or ad hoc.

#### DB-003 — High — Referential audit fields are strings

Actor, bank account, and some workflow links are not backed by foreign keys. This permits dangling IDs, names in ID fields, cross-tenant references, and deletion of actors required for an audit trail.

#### DB-004 — High — Soft-delete/retention policy is inconsistent

Bank-account requirements call for historical retention, while people, assignments, trips, payroll, complaints, and bookings have destructive deletion paths. There is no coherent retention model for operational and financial records.

#### DB-005 — Medium — Tenant timezone is stored but generally ignored

The repository contains many `new Date()`, `startOfDay`, and `setHours` calculations using server/browser timezone. Tenant timezone is stored but not consistently applied. “Today,” minimum notice, schedules, payroll/report boundaries, and notification times can drift between Asia/Dubai, the current Asia/Karachi workstation, and a UTC production host.

#### DB-006 — Medium — No evidence of automated backup/restore or migration rehearsal

No repository automation demonstrates database backup, restore, point-in-time recovery, or migration rehearsal. This cannot be proven by source inspection and must be treated as an operational gap until infrastructure evidence exists.

### E. Realtime and notification service health

#### RT-001 — Critical — Realtime package is corrupted and cannot install/type-check

`apps/realtime/package-lock.json` and source/config contain corrupted tokens such as `coAED`, `veAED ion`, and `noUnusedParameteAED`. NPM rejects invalid package names and TypeScript rejects the compiler option. The package has no reliable runnable script.

#### RT-002 — Critical — Two conflicting realtime implementations exist

`index.ts` is an HTTP/socket bridge while `index.js` contains a different implementation, client broadcasting, and fake events emitted every 15–30 seconds. It is unclear which is authoritative. The fake implementation could generate misleading production activity if launched.

#### RT-003 — High — Root development workflow does not start realtime

Root development scripts start the web app but not a validated realtime service. Even repaired code would not automatically be part of the common local workflow.

#### RT-004 — High — Notification delivery attempts are not a reliable troubleshooting ledger

Rows can be labeled sent when only database creation occurred; failed channel delivery is not represented as a durable per-channel attempt with retry/error metadata. This makes the acceptance criterion “record notification delivery attempts” only partially satisfied.

### F. Mobile and Android

#### MOB-001 — Critical — There are three competing mobile implementations

The repository contains:

1. `apps/mobile` — Expo/React Native application;
2. root `android` — generated native project tied to a different root Expo/RN graph; and
3. `apps/mobilewrapper` — Capacitor WebView wrapper.

This creates conflicting ownership, dependency, build, and release paths. One role-aware app is sufficient for Admin/Driver/Customer/Cleaner; separate role apps are not inherently required.

#### MOB-002 — Critical — Android debug build fails

After locating the installed Android SDK, `:app:assembleDebug` reaches native compilation but fails with unresolved C++ runtime/linker symbols in generated app-module code. Android has therefore **not** passed the requested device-build validation.

#### MOB-003 — Critical — Native dependency graphs are incompatible

Expo Doctor finds duplicate Expo 54/57, React 19.1/19.2, React Native 0.81/0.86, and related native modules. Root and app dependencies resolve different native versions. `apps/mobile` also declares a file dependency on the repository root, pulling the competing graph back into the mobile app.

#### MOB-004 — High — Application IDs do not match

The root native Android project uses `com.anonymous.khobracleaningmonorepo`, while `apps/mobile/app.json` and the wrapper expect `com.khobracleaning.app`. Builds, Firebase/push credentials, deep links, signing, store records, and updates will target different applications.

#### MOB-005 — High — Capacitor wrapper defaults to insecure device-local localhost

The wrapper defaults to `http://localhost:3000` with cleartext traffic enabled. On a physical device, localhost is the device itself, so a production build without explicit configuration fails to connect and permits insecure transport. Its bundled page only says that a connection is required, so it is not an offline app.

#### MOB-006 — High — Mobile bank-transfer workflow is incomplete

Mobile can select bank transfer but does not provide the complete active-account display/copy flow, transfer form, proof upload, submission, rejection, or corrected resubmission path. This is a dead end compared with the web workflow.

#### MOB-007 — High — Mobile booking creation is only partial

The native booking form lacks important web fields and logic including full city/area handling, cleaner count/duration/materials/notes/payment preference, complete pricing, and service gallery/hero presentation. Web changes do not automatically sync into this native UI; shared API/domain changes can be reused, but screens must be implemented/tested separately.

#### MOB-008 — High — Mobile Admin “New Booking” action is logically broken

The Admin role can see the action, but the screen searches for a customer record matching the Admin user and then reports that a customer account is required. Either the action should be customer-only or Admin needs a real customer-selection workflow.

#### MOB-009 — Medium — Mobile Admin/operations screens are read-only summaries

Several mobile screens render generic record lists rather than the full CRUD/approval/reporting workflows offered on web. Mobile cannot be described as feature-matched to the whole web project.

#### MOB-010 — Medium — Branding assets are incomplete at native shell level

The app uses an in-app logo/colors, but `app.json` does not define a complete production icon, adaptive icon, splash, and platform asset set. Login/signup styling alone is not whole-app parity.

#### MOB-011 — Medium — Mobile session behavior still inherits server revocation defects

Secure local storage and local expiry handling are positive, but server tokens remain non-revocable and logout is local-only. A stolen token remains usable.

### G. Public web, UI/UX, and accessibility

#### UI-001 — High — Landing page publishes unsupported social proof

The public landing page hardcodes a 4.9 rating, a named testimonial, “Loved across Dubai,” and similar marketing assertions while the live database contains zero ratings. Unless these claims are verified external business facts, this is demo content presented as real evidence.

#### UI-002 — Medium — Service imagery is not actually populated

All six active live services have null gallery and hero image collections. Customer-facing cards fall back to gradients, so the promised service-gallery/hero workflow is not demonstrated in the current database.

#### UI-003 — Medium — Login/signup form labels are not programmatically associated

Browser inspection found visible labels without matching `for`/input `id`, and inputs without stable `name`/`aria-label` semantics. The login page also lacks a clear level-one heading. This harms screen-reader navigation, autofill, password managers, testing, and form usability.

#### UI-004 — Medium — Mobile-web service selection is unnecessarily long

At a 390×844 viewport there is no horizontal overflow, which is good, but each of six service choices is roughly a full-width 200px-tall card. Users must scroll through more than a thousand pixels of choices before continuing. Use compact selectable cards/list rows on narrow screens while retaining imagery.

#### UI-005 — Medium — Public API failures can render blank sections

Public service/booking components provide loading behavior but insufficient explicit error/retry states. A service API failure can leave the landing service section blank rather than explaining the problem.

#### UI-006 — Medium — Settings exposes non-working or deceptive controls

Custom theme and compact-mode controls report “Phase 2” behavior instead of working. A reset dialog describes permanent deletion/reseeding while its handler says the demo action is unavailable. Controls should be implemented, hidden, or clearly marked unavailable before confirmation.

#### UI-007 — Medium — Customer profile invoice UI contains demo calculations

The customer profile uses a fallback amount, hardcoded 5% VAT split, and a “Download Invoice PDF” action that only shows a toast. This is not a real invoice download and can display numbers inconsistent with the transaction system.

#### UI-008 — Medium — Dead customer/employee portal components contain hardcoded identities

Unwired portal components include hardcoded customer/employee identities. They are currently dead code, but accidental reuse would expose misleading or wrong-account data. Delete them or replace them only when a real route needs them.

#### UI-009 — Low — Authenticated UI validation is incomplete

The public pages were browser-smoke-tested. Full browser validation of Admin, Cleaner, Driver, and Customer screens was not completed because the audit did not bypass CAPTCHA or fabricate sessions. Automated authenticated browser fixtures are needed for release confidence.

### H. Test coverage, build, and dependency health

#### QA-001 — High — Production build explicitly ignores TypeScript errors

`apps/web/next.config.mjs` configures `typescript.ignoreBuildErrors: true`, and build output confirms type validation is skipped. The current explicit typecheck passes, but a future deployment can ship type errors unless CI independently blocks them.

#### QA-002 — Medium — React strict mode is disabled

Strict mode is disabled, reducing development detection of unsafe effects and lifecycle behavior. This is especially relevant in a UI with polling, realtime subscriptions, and large stateful pages.

#### QA-003 — High — The full persistence workflow test fails

The integration test fails at bank proof submission with HTTP 400 because the secure Cloudinary proof workflow is not configured. This means the cash/bank acceptance workflow is not currently green end to end.

#### QA-004 — High — Tests are concentrated in pure helpers

Most passing tests validate helper functions. There is insufficient automated coverage for method-level role denial, cross-tenant access, duplicate concurrent payments, destructive deletes, report periods/timezones, actual-hours invoicing, realtime authentication, push delivery, mobile role workflows, and Android builds.

#### QA-005 — High — Production dependency audit reports known vulnerabilities

The installed tree reports 14 production advisories, including two high-severity dependency findings. Upgrade and retest rather than applying blind forced upgrades, especially because Expo native versions must remain aligned.

#### QA-006 — High — Dependency installation is not clean/reproducible

`npm ls` reports extraneous packages and invalid peer/version alignment. The repository contains root/mobile lockfiles plus a corrupted realtime lockfile and evidence of mixed package-manager layouts. A clean install can resolve differently from the current workstation.

#### QA-007 — Medium — No single root verification command

Root scripts do not provide one command that type-checks web/mobile/realtime, runs tests, validates Prisma, audits dependencies, and builds Android. Important failures are easy to miss when `npm run build` alone is green.

#### QA-008 — Medium — Cloudinary is a required but unverified runtime dependency

The secure proof flow and service-image upload depend on Cloudinary configuration that is absent in the audited environment. No local storage fallback should be added for production, but CI needs a test double or isolated Cloudinary test account so the workflow remains testable.

### I. Maintainability and over-engineering (Ponytail audit)

These are ranked cleanup opportunities, not instructions to delete blindly. First confirm production imports and visual usage, then remove the unused surface with its dependencies.

1. **[delete] Three mobile stacks** — choose `apps/mobile` or the web wrapper as the owned product; remove the other generated/duplicate native paths. Expected saving: an entire dependency graph, native build surface, and conflicting app identifiers.
2. **[delete] Duplicate realtime entrypoints** — retain one authenticated TypeScript service and remove the fake/corrupted JavaScript path. Expected saving: one implementation plus ambiguity about which server runs.
3. **[shrink] `apps/web/src/components/bookings.tsx` (~2,620 lines)** — split only along existing business seams (list/filter, detail, assignment, payment) and move shared server business rules out of UI handlers. Avoid introducing generic framework abstractions.
4. **[delete] Unused UI primitives** — 26 of 49 primitive files have no application imports (about 3,404 lines). Removing them may also remove unused packages such as carousel, drawer, OTP, resizable, and calendar dependencies.
5. **[delete] Dead demo portals** — remove unreferenced CustomerPortal/EmployeePortal components containing hardcoded identities.
6. **[delete] Superseded upload abstraction** — the unused UploadService/IUploadRepository/local “PrismaUploadRepository” path duplicates the direct Cloudinary API workflow.
7. **[delete] Dead notification abstraction** — unused notification service/repository code does not deliver actual push notifications and creates a false impression of coverage.
8. **[shrink] One-implementation interface layers** — approximately 46 service/interface files add pass-through indirection. Keep interfaces only where there are real alternate implementations or valuable domain isolation; collapse no-op wrappers.
9. **[native] Duplicate Prisma singletons** — `apps/web/src/lib/db.ts` and `packages/db/src/index.ts` create competing client access patterns. Use one server-owned singleton to avoid excess connections and mocking ambiguity.
10. **[shrink] Package dependency cycle/undeclared coupling** — database source imports application interfaces while the DB package does not declare that dependency, and the application package declares DB without apparently using it. Put repository contracts in the domain package or keep concrete repository types in DB; remove the cycle instead of adding more manifests.
11. **[delete] Unused direct dependencies** — candidates include DnD packages, hook-form resolvers, MDX editor, React-use utilities, TanStack table, `next-auth`, `next-intl`, markdown/syntax-highlighter, `uuid`, and `z-ai-web-dev-sdk`. Confirm with a clean import scan before removal.
12. **[shrink] Large page modules** — customers (~981 lines), employees (~907), complaints (~888), finance (~805), services (~780), reports (~772), dashboard (~677), and sidebar (~672) mix presentation, queries, dialogs, and business rules. Extract only repeated or independently testable seams.
13. **[delete] Stale standalone artifacts** — `paq-dashboard-enhanced.html`, old workflow markdown, and contradictory work logs should be archived or removed after ownership confirmation; stale documentation is currently capable of overstating implemented realtime/workflow behavior.
14. **[native] Replace count-based IDs with DB uniqueness/sequences** — this deletes custom collision-prone reference logic and lets the database perform the job it is designed for.
15. **[native] Replace app-only uniqueness locks with DB constraints** — fewer locks/checks and stronger correctness across multiple processes.

The biggest safe reduction is duplicate/dead surfaces, not aggressive refactoring of working financial logic. Security validation, audit history, money precision, and accessibility are explicitly not candidates for simplification.

## Workflow coverage matrix

| Required scenario | Status | Audit result |
|---|---|---|
| Assigned driver: Scheduled → On the Way | Partial | Domain/API action exists, but live data has no exercised `on_the_way` row and realtime propagation is broken. |
| Customer and cleaners notified | Partial | In-app rows are created; actual web-push delivery is absent and realtime is unreliable. |
| Assigned cleaner: On the Way → In Progress | Implemented with gaps | Authorization/transition logic exists; full browser/mobile end-to-end evidence is incomplete. |
| Cleaner completion-time response/history | Implemented with gaps | Persistence exists; driver immediate delivery depends on broken realtime/polling. |
| Pickup alert on No → Yes | Partial | Deduplication logic exists, but high-priority push and reliable immediate delivery do not. |
| Assigned cleaner: In Progress → Completed | Implemented with gaps | Transition and completion data exist; invoice calculation uses scheduled rather than actual hours. |
| Booking status separate from payment status | Mostly implemented | Separate fields exist, but generic payment API and mixed free-string states permit logical drift. |
| Customer selects cash | Implemented | Selection alone does not normally create the intended cash transaction; generic API remains a bypass. |
| Cleaner marks cash received | Implemented with defect | Idempotent flow exists, but amount basis and reconciliation state are inconsistent. |
| Bank account display/copy | Web only/blocked by data | CRUD/UI exists, but no active live account; mobile flow is missing. |
| Customer submits bank proof | Blocked in audited environment | Integration test fails without Cloudinary. Provenance validation is incomplete. |
| Admin approves/rejects bank transfer | Implemented with bypass risk | Approved path creates inflow; generic payments API can bypass proof/approval. |
| Duplicate confirmed transactions prevented | Partial | Application checks/locks exist; database uniqueness constraints are insufficient. |
| Transaction master/detail | Partial | Screen exists, but detail/history are synthesized and not immutable. |
| Cash/bank cash-flow reporting | Partial | Inflows appear; outflows/reconciliation are not a complete cash-flow model. |
| Customer rates each cleaner + overall service | Implemented, unexercised | No live ratings; DB constraints/automated coverage should prove one submission per booking/customer. |
| Cleaner sees only assigned bookings | Mostly implemented | Core cleaner queries are scoped, but broader employee/settings/stats APIs overexpose tenant data. |
| Driver sees only assigned work | Mostly implemented | Core booking filters are scoped; shared admin/statistics/data APIs need tighter role projections. |
| All actions have durable audit trail | Fail | Several histories are synthesized or string-based; notification delivery and CRUD audits are incomplete. |

## Prioritized remediation plan

### P0 — Before any production or external pilot

1. Close every missing method-level role check and enforce tenant ID in repository predicates.
2. Remove the generic verified-payment bypass; make cash receipt and bank approval the only confirmed inflow paths.
3. Repair and secure one realtime implementation; remove fake/corrupted alternatives and add tenant/user rooms.
4. Decide the single mobile architecture, align Expo/RN versions and application ID, then produce a passing signed/debug Android build.
5. Add committed Prisma migrations and a deterministic seed; prove fresh-database deployment.
6. Fix user provisioning/invitation and role casing; address the 15 passwordless accounts.
7. Replace destructive actor deletion with retention-safe soft deletion and transactional operations.
8. Persist immutable transaction details/history and add database idempotency constraints.

### P1 — Before financial/operational acceptance

1. Use Decimal/fixed-scale money and one rounding policy.
2. Calculate completed invoices from approved actual hours and authoritative adjustments.
3. Make company bank accounts relational and tenant-scoped with historical FK retention.
4. Migrate/quarantine five unverifiable legacy bank payments and repair the missing invoice.
5. Complete proof provenance validation and establish a testable Cloudinary environment.
6. Implement real notification delivery attempts, retry/error history, web push, and mobile push where supported.
7. Add two-tenant and role-negative integration tests for every mutation endpoint.
8. Correct timezone, completion-date, currency, dashboard, worked-hours, and cash-flow reporting.

### P2 — Before broad customer launch

1. Complete native mobile bank transfer, booking creation, Admin behavior, and role workflow parity.
2. Fix auth form semantics and run authenticated accessibility/browser tests.
3. Remove unsupported marketing/demo claims or back them with real approved data.
4. Populate and verify service hero/gallery assets and public API error states.
5. Remove/disable settings and invoice controls that currently only show demo toasts.
6. Upgrade vulnerable dependencies within one coherent Expo/web dependency graph.

### P3 — Controlled simplification

1. Delete unused UI primitives, dead portals, dead services, stale artifacts, and unused dependencies.
2. Collapse duplicate DB access and unnecessary one-implementation interfaces.
3. Break only the largest monoliths at existing business seams.
4. Add one root verification command after the repository has one authoritative dependency/build graph.

## Positive controls already present

The audit also found useful foundations worth preserving:

- CAPTCHA is integrated on web login and signup.
- Core booking transitions include explicit assigned-driver/assigned-cleaner checks in the intended workflow paths.
- Booking and payment statuses are stored separately.
- Cash and bank approval operations contain application-level duplicate checks/locking.
- Payment-proof validation has stronger type checks than the generic uploader.
- Mobile stores credentials in secure storage and implements local expiry handling.
- The public landing and booking pages render without horizontal overflow at a narrow mobile viewport.
- Web lint, explicit web typecheck, mobile typecheck, and web production compilation currently pass.
- The current live database structurally matches the current Prisma schema.

These controls reduce risk but do not offset the P0 findings.

## Audit limitations

- This was a source/configuration/database/browser/build audit of the current workstation and configured database. It did not inspect production infrastructure, CDN rules, backups, Cloudinary account policy, push-provider dashboards, TLS termination, secrets management, or app-store signing accounts.
- No security penetration testing, destructive data test, load test, email/SMS delivery test, or real-money bank verification was performed.
- Authenticated UI pages were not entered by bypassing CAPTCHA or fabricating a user session. Their server and component code was reviewed, but all role-specific UI journeys still need automated authenticated browser tests.
- Android did not build, so device-level UX, notifications, deep links, file upload, and secure storage behavior could not be fully validated.
- Existing dirty-worktree changes were treated as part of the audit baseline and were not reverted or rewritten.

## Definition of a clean re-validation

Do not close the remediation effort on a green web build alone. A clean acceptance run should include:

1. Fresh install from the committed lockfile(s) with no extraneous/invalid packages.
2. Fresh database created from committed migrations and deterministic seeds.
3. Two-tenant authorization suite with negative tests for every role and mutation.
4. Full `Scheduled → On the Way → In Progress → Completed → cash/bank payment → rating` tests, including retries and concurrent duplicate requests.
5. Immutable transaction master/detail reconciliation assertions.
6. Real or isolated-test Cloudinary proof upload and push/realtime delivery evidence.
7. Web accessibility/browser tests for all four roles.
8. Successful Android debug/release build from the single chosen mobile source, followed by device tests for all four role journeys.
9. Verified finance reports that reconcile invoices, confirmed payments, cash reconciliation, bank inflow, expenses, salaries, and date/timezone boundaries.

