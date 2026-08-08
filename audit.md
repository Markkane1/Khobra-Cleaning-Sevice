# Pre-production repository audit

Audit date: 2026-08-08  
Repository: Khobra Cleaning Service monorepo  
Audit mode: initial read-only review followed by tracked remediation changes  
Release verdict: **CONDITIONAL GO after the VPS actions in this document**

## Executive summary

The repository now passes its code, schema, build, workflow, browser, and mobile-health gates. Web lint, strict TypeScript across web/realtime/mobile, the Next.js production build, 58 unit/domain tests, Prisma validation, all 15 migrations, backup/restore rehearsal, retention, actor-reference, timezone, the complete persisted workflow, 14 browser tests, and all 18 Expo Doctor checks passed.

The audit initially identified three critical defects; all three are now remediated in the working tree:

1. Committed realtime fallback secrets were removed.
2. Manual admin pickup alerts now store the authenticated admin's real `User.id`.
3. Service categories now use tenant-scoped settings keys with a production-safe data migration.

No automatic secret rotation was introduced. Existing production secrets remain valid; missing-secret fallbacks were removed and startup tests prove fail-closed behavior. All code changes were kept rolling-deploy compatible: migrations only add/copy/index data, legacy category data remains readable during rollout, API response contracts were preserved, and legacy native projects were retained.

The remaining conditions are operational or explicitly accepted risk: configure the documented VPS proxy/origin/header/body-limit values, store backups on an encrypted off-host destination with alerting, and keep the documented Metro `image-size` build-tool advisory exception under review. These cannot be truthfully completed only by changing repository code.

### Issue count

| Severity | Count | Meaning |
|---|---:|---|
| Final disposition | Count | Meaning |
|---|---:|---|
| Remediated | 14 | Code/config/test correction is implemented and verified |
| Mitigated with residual follow-up | 9 | Material risk reduced; deeper work is staged or operational |
| VPS action required | 4 | Deployment-specific control must be configured by the operator |
| Accepted/deferred | 2 | Intentional product/architecture decisions, not release regressions |

## Scope and repository map

Reviewed 514 tracked files, including 286 tracked source/configuration files and approximately 28,460 source lines.

| Surface | Scope reviewed |
|---|---|
| Web and API | Next.js app, proxy, 47 API route files, auth, rate limiting, uploads, CSP/security headers, public booking, reports and operational UI |
| Realtime | Socket.IO authentication, CORS, HTTP broadcast bridge, health endpoint, event routing |
| Mobile | Expo React Native application, API/session storage, push, native role screens, app/EAS configuration |
| Mobile wrapper | Capacitor config, Android/iOS projects, signing/build scripts, privacy manifest |
| Shared packages | Domain schemas, application services/interfaces, Prisma repositories, UI primitives |
| Data and operations | Prisma schema, 15 migrations, backup/restore tooling, retention and data audits |
| Delivery | npm scripts, workspace manifests, lockfiles, GitHub Actions, E2E configuration |

The worktree was already dirty at audit start. Existing modified and untracked files were preserved. Findings describe the current working tree, not only `HEAD`.

## Automated verification results

| Check | Result | Evidence |
|---|---|---|
| Canonical release gate | PASS | `npm run verify` completed end to end in 107.6 seconds on 2026-08-08 |
| Web ESLint | PASS | `npm run lint` |
| Web TypeScript | PASS | strict `noImplicitAny`; `npm run typecheck` |
| Realtime TypeScript | PASS | `npm --prefix apps/realtime run typecheck` |
| Mobile TypeScript | PASS | `npm --prefix apps/mobile run typecheck` |
| Unit/domain tests | PASS | 58 passed, 0 failed, including missing-secret and trusted-IP tests |
| Next.js production build | PASS | 77 routes/pages generated, including `/api/health` |
| Prisma schema validation | PASS | Schema valid through `packages/db/prisma.config.ts`; deprecated package config removed |
| Migration rehearsal | PASS | 15/15 migrations applied in an isolated schema |
| Backup/restore rehearsal | PASS | 40 public tables restored |
| Actor-reference audit | PASS | 0 dangling actor references |
| Timezone audit | PASS | 0/37 booking dates had an unexpected clock component |
| Retention test | PASS | Tenant isolation/soft-delete history scenario passed |
| Complete workflow integration | PASS | Real API/persistence lifecycle passed, including three pickup channels and two-tenant category isolation |
| Playwright browser suite | PASS | 14/14 desktop/mobile Chromium smoke tests; deterministic server teardown |
| Expo Doctor | PASS | 18/18 checks from the authoritative `apps/mobile` working directory |
| Production dependency audit | ACCEPTED EXCEPTION | 31 affected high-severity package nodes, all amplified from two `image-size` parser advisories in Expo/Metro build tooling; no critical/moderate/low findings |
| Native release builds | CONFIG-BOUND | EAS Expo and Capacitor paths require production credentials/URLs and are intentionally excluded from generic verification |

## Final remediation disposition

| ID | Final status | Implemented result / remaining action |
|---|---|---|
| AUD-001 | Remediated | Predictable fallbacks removed; realtime startup fails closed when either secret is missing. No automatic rotation; production values remain operator-managed. |
| AUD-002 | Remediated | Pickup alerts persist the authenticated user's real foreign-key ID; workflow verified. |
| AUD-003 | Remediated | Categories are tenant-keyed, Zod-validated, transactionally serialized, migrated compatibly, and tested across two tenants. |
| AUD-004 | Remediated | Workflow assertion now validates one logical delivery across `in_app`, `web_push`, and `native_push`; gate passes. |
| AUD-005 | Mitigated | Safe audit fixes patched `nanoid`, `js-yaml`, and DOMPurify. Remaining finding is the documented Expo/Metro `image-size` build-only exception; a forced breaking Expo downgrade was rejected. |
| AUD-006 | Remediated | EAS is authoritative for Expo Android, Capacitor stays separate, and legacy root Android is retained for production safety. Expo Doctor passes 18/18. |
| AUD-007 | Remediated | Preproduction CI now provisions PostgreSQL and runs install, migrations, static checks, data rehearsals, audit policy, unit, build, workflow, and E2E gates. |
| AUD-008 | Mitigated | Next `after()` keeps broadcasts alive after responses; bounded retry/timeout and final failure logs added. A durable database outbox remains the future reliability upgrade. |
| AUD-009 | Mitigated | Added payload limits, timing-safe bridge auth, auth-payload-only tokens, readiness, timeouts, graceful drain, and pushed session revocation. Initial socket connections still do not query the database for `sessionVersion`. |
| AUD-010 | Mitigated | Missing repository tenant filters and multi-tenant tests were added. Composite tenant foreign keys require a production-data preflight and staged constraint rollout. |
| AUD-011 | VPS action required | Backups now have SHA-256 sidecars, safe retention, and restore rehearsal. Configure an encrypted off-host destination and failure alerts on the VPS. |
| AUD-012 | Remediated | E2E has bounded timeouts/reporters, one worker, failure artifacts, production server orchestration, and clean Windows teardown; 14/14 passed. |
| AUD-013 | Mitigated | Misleading tests were replaced with honest auth/protected/public desktop-mobile smoke coverage; the persisted workflow covers authenticated business logic. Full role-authenticated browser journeys remain future coverage. |
| AUD-014 | VPS action required | IP parsing validates only the first address from one configured trusted header and login adds account throttling. Set `TRUSTED_IP_HEADER` and make the proxy overwrite inbound copies. |
| AUD-015 | VPS action required | CSRF no longer trusts forwarded host/protocol. Set `APP_URL`/`ALLOWED_ORIGINS` to exact HTTPS production origins. |
| AUD-016 | VPS action required | Upload Content-Length and realtime stream limits are enforced in code. Also enforce the documented body limits at the public reverse proxy. |
| AUD-017 | Mitigated | High-risk 500 paths now log internally and return opaque errors. A centralized typed error mapper remains maintainability work. |
| AUD-018 | Mitigated | Request IDs, web/realtime health/readiness, retry logs, monitoring signals, and rollback instructions were added. External aggregation/metrics remains an operations choice. |
| AUD-019 | Remediated | Shared buttons meet 44px mobile targets and icon-only actions have accessible names. |
| AUD-020 | Mitigated | Phone portrait support and manual TalkBack/VoiceOver/dynamic-text checks are documented; automated native device accessibility remains future coverage. |
| AUD-021 | Remediated | The embedded WebView workspace was removed in favor of native API-backed role screens, eliminating its navigation/cookie boundary. |
| AUD-022 | Remediated | Web `noImplicitAny` is enabled and the dashboard/settings/customer schemas no longer use unrestricted `any` at the audited boundaries. |
| AUD-023 | Mitigated | Operational composite indexes were added via a rolling-safe migration. Production `EXPLAIN ANALYZE` and broader pagination tuning require real workload data. |
| AUD-024 | Accepted | Global email uniqueness is an intentional cross-tenant identity model and is documented. |
| AUD-025 | Remediated | ESM package types were declared and module-type warnings removed. |
| AUD-026 | Remediated | Prisma CLI config moved to `packages/db/prisma.config.ts`; deprecated manifest configuration removed. |
| AUD-027 | Remediated | Unreferenced config packages and stale Turbo config were removed after reference checks. |
| AUD-028 | Accepted/deferred | Repository abstraction collapse was not attempted in a production hardening pass; it is not a release correctness defect. |
| AUD-029 | Remediated | Environment matrix, rolling deployment, health, backup, rollback, proxy, secret, and mobile ownership instructions are in the production runbook. |

## Release blockers and findings

The sections below preserve the original evidence and recommended fixes for traceability. The **Final remediation disposition** table above is the authoritative current status after implementation and verification.

### AUD-001 — P0 — Predictable fallback secrets permit forged realtime access

Status: **remediated in the working tree on 2026-08-08**. The user reports that production variables are already configured. Realtime fails fast at service startup; web broadcasting fails closed at call time without making the Next.js build depend on runtime secrets.

Original evidence:

- `apps/realtime/index.ts:5-6` falls back to committed values for both `AUTH_SECRET` and `REALTIME_SECRET`.
- `apps/web/src/lib/broadcast.ts:26` falls back to the same predictable realtime bridge secret.
- The web auth implementation correctly fails closed when `AUTH_SECRET` is absent, but the realtime implementation does not.

Impact: if production configuration omits either variable, an attacker who can reach the realtime service can forge signed session tokens, join arbitrary tenant/user rooms, or call `/broadcast` and inject allowed events into arbitrary tenants. Because the values are committed, they must be considered disclosed even if production currently overrides them.

Required fix:

- Remove all secret fallbacks and fail process startup unless both secrets are present and meet an entropy/length policy.
- Rotation was originally recommended because the fallback strings were public. The operator explicitly chose not to rotate the separately configured production values; no automatic rotation was added.
- Add a startup/configuration test proving production fails closed.
- Keep the bridge on a private network and restrict ingress to the web service.

Validation: start realtime without each secret and assert non-zero exit; attempt a token/bridge request signed with the old committed value and assert rejection.

### AUD-002 — P0 — Admin manual pickup-alert endpoint violates its database foreign key

Status: **remediated in the working tree on 2026-08-08**. Manual admin alerts now store the authenticated admin's actual `User.id`.

Evidence:

- `BookingPickupAlert.generatedBy` is a foreign key to `User.id` in `packages/db/prisma/schema.prisma:461-466`.
- `apps/web/src/app/api/khobra-cleaning/bookings/pickup-alerts/route.ts:49` writes ``admin: ${name} (${userId})`` instead of `auth.session.userId`.
- The cleaner-driven endpoint correctly writes `auth.session.userId` at `apps/web/src/app/api/khobra-cleaning/bookings/completion-timing/route.ts:50`.

Impact: every otherwise-valid admin manual resend attempts to insert a nonexistent user reference and fails the transaction. Dispatch cannot manually recover or resend an urgent pickup alert.

Required fix: store the actual user ID in `generatedBy`; place display/audit text in a separate field if it is needed. Add an integration test that calls the admin POST route and verifies the generator relation.

### AUD-003 — P0 — Service categories are global, not tenant-isolated

Status: **remediated in the working tree on 2026-08-08**. Category settings now use the repository's existing `<tenantId>:<key>` convention, defaults are cloned per request, and a rolling-deploy-safe migration copies existing global categories to each tenant while retaining the legacy row for old instances during rollout.

Evidence:

- `AppSettings.key` is globally unique and the model has no `tenantId` (`packages/db/prisma/schema.prisma:797-803`).
- All category methods read/upsert the literal key `service_categories` (`apps/web/src/app/api/khobra-cleaning/services/categories/route.ts:16,37,73,106`).
- Authentication identifies a tenant, but that tenant ID is never used by this route.

Impact: an admin in tenant A can read, add, edit, and delete tenant B's categories. Concurrent admins also perform an unlocked JSON read-modify-write and can silently overwrite each other's changes.

Required fix: model categories as tenant-owned rows, or minimally add `tenantId` to settings with `@@unique([tenantId, key])`. Validate category payloads with Zod and use transactional/atomic writes. Add a two-tenant integration test for every method.

### AUD-004 — P1 — The canonical `verify` gate is currently guaranteed to fail

Evidence:

- `package.json` includes `npm run test:workflow` in `verify`.
- The live workflow test failed at `apps/web/src/lib/complete-workflow.integration.test.mjs:171`: expected one notification, received three.
- `deliverPickupAlert` intentionally creates `in_app`, `web_push`, and `native_push` channel records, protected by channel-aware unique keys (`apps/web/src/lib/pickup-alerts.ts:6-23`, `packages/db/src/push-notifications.ts:126,147`).

Impact: no commit can pass the advertised full pre-production command. This obscures real regressions and encourages bypassing the gate.

Required fix: update the assertion to validate one logical delivery key across the three expected channels, including channel status, rather than counting all channel records as duplicates. Run the entire `verify` command in clean CI.

### AUD-005 — P1 — Production dependency audit contains untriaged high-severity advisories

`npm audit --omit=dev` reported 58 affected dependency nodes: 55 high and 3 moderate. The count is dependency-graph amplification rather than 58 independent CVEs, but the underlying advisories still require triage.

Notable underlying advisories in the result:

- `image-size` denial of service through infinite-loop parsers, pulled through Metro.
- `js-yaml` quadratic CPU consumption, present in tooling chains.
- `nanoid` zero-size custom-generator infinite loop, pulled through PostCSS.
- `dompurify` detached-subtree XSS, pulled through `jspdf`.

Direct packages shown as affected through their transitive trees include Expo/React Native packages, Next/PostCSS/Tailwind, and jsPDF.

Required fix:

- Export and review the JSON audit in CI rather than relying only on aggregate counts.
- Upgrade to patched Expo/React Native/Metro and web dependency sets where available.
- Verify whether the jsPDF path ever processes attacker-controlled HTML; remove client PDF dependencies if server PDF generation already covers the use case.
- Add a time-bounded, documented exception only where no patch exists and the vulnerable path is demonstrably unreachable.

### AUD-006 — P1 — Expo app configuration and native projects have drifted

Evidence:

- Expo Doctor failed its native/app-config synchronization check.
- The mobile app declares `com.khobracleaning.app` in `apps/mobile/app.json`, while root `app.json` and the tracked root Android project use `com.anonymous.khobracleaningmonorepo`.
- `apps/mobile/package.json` builds by changing to `apps/mobile/android`, but that directory does not exist in the current tree.
- A separate tracked root `android/` project exists, while Capacitor has its own `apps/mobilewrapper/android/` project.
- Root Android manifest still has legacy storage/overlay permissions and `allowBackup=true`; the Expo app config blocks those permissions and sets backup false, demonstrating the drift.

Impact: developers can build or modify the wrong native project, local `verify` cannot produce the declared Android release, and app ID/permission differences can ship depending on which path is used.

Required fix: choose one authoritative Expo native strategy:

- CNG/EAS: remove the stale root native project and generate native projects in CI; or
- committed native: move/regenerate it under `apps/mobile`, commit it, and make `expo prebuild --clean`/config synchronization explicit.

Keep the Capacitor wrapper clearly separate and document whether it is a supported product or a migration fallback.

### AUD-007 — P1 — Web, API, realtime, and database gates are absent from CI

Evidence: `.github/workflows/mobile-release.yml` is the only workflow. It typechecks and dispatches an EAS mobile build, but does not run web lint/build, realtime typecheck, unit/workflow/E2E tests, Prisma validation/migration rehearsal, dependency audit, or deployment.

Impact: most of the product can regress or become undeployable without a protected check. The currently failing workflow test illustrates why a real clean CI gate is necessary.

Required fix: add a pull-request workflow using `npm ci` and the reproducible non-secret subset of `verify`; provision ephemeral PostgreSQL for integration/migration tests; add secret-backed release jobs separately.

### AUD-008 — P1 — All realtime broadcasts are fire-and-forget in request handlers

Evidence: more than 40 API mutation paths call async `broadcast(...)` without `await`, `void`, or a durable outbox. Examples include `apps/web/src/app/api/khobra-cleaning/bookings/route.ts:66,129,155` and payment/bank-transfer paths. `broadcast` catches failures and only logs them.

Impact: serverless/container request lifecycles may end before the fetch completes. Events are silently lost during bridge downtime, causing stale dashboards and missed operational updates. There is no retry, queue, or delivery audit.

Required fix: for the minimum safe change, await broadcasts that are part of the response contract and surface/measure failure. For operationally critical events, use a database outbox processed after the transaction with retry and idempotency.

### AUD-009 — P1 — Realtime bridge lacks basic resource and lifecycle controls

Evidence in `apps/realtime/index.ts`:

- `/broadcast` concatenates request chunks with no byte limit (`line 82`).
- No request/header/timeouts are configured.
- No SIGTERM/SIGINT graceful shutdown closes Socket.IO/HTTP.
- Query-string tokens are accepted (`line 42`), exposing credentials to proxy/access logs and browser history.
- Token verification checks signature/expiry only; it does not re-check active user, tenant, role, or `sessionVersion`, unlike web `getAuthSession`.
- `/health` reports client/room counts but is not a dependency-aware readiness check.

Impact: memory denial of service, leaked bearer tokens, slow shutdown/data loss, and realtime access surviving account disable/password reset until token expiry or socket disconnect.

Required fix: enforce a small content-length/stream limit, request timeouts, auth only through the Socket.IO auth payload, active-session validation during connection, connection revocation strategy, graceful shutdown, and separate liveness/readiness endpoints.

### AUD-010 — P1 — Tenant consistency is mostly an application convention, not a database invariant

Many models carry `tenantId` beside foreign keys to tenant-owned rows, but the database does not use composite foreign keys to prove they belong to the same tenant. Examples include `Assignment(tenantId, bookingId, employeeId)`, `Payment(tenantId, invoiceId)`, `Invoice(tenantId, customerId, bookingId)`, and `StockMovement(tenantId, itemId)`.

The code usually checks tenancy, but repository queries are inconsistent. For example, auto-assignment leave/day-booking scans at `packages/db/src/repositories/PrismaBookingRepository.ts:715-736` omit tenant predicates. Globally unique IDs reduce accidental collision risk but do not enforce the business invariant.

Impact: one missed route/repository check can create cross-tenant relationships that later joins expose. AUD-003 demonstrates that application-only tenancy has already failed in one feature.

Required fix: add composite unique keys and composite foreign keys for tenant-owned relationships where Prisma/PostgreSQL support them; otherwise centralize scoped access and add database constraints/triggers plus multi-tenant integration tests.

### AUD-011 — P1 — Backup creation has no encryption, retention, or off-host durability policy

`packages/db/scripts/database-backup.mjs` creates a plain PostgreSQL custom dump in a local `backups/` directory (or configured path). Restore rehearsal is good and passed, but the script provides no encryption, checksum/signature, retention rotation, remote/object storage, access-control verification, or restore-point objective.

Impact: customer, employee, finance, and authentication data can be exposed if backup storage is copied; local-host loss can destroy both database and backup; storage can grow without bound.

Required fix: send encrypted backups to access-controlled off-host storage, define retention/RPO/RTO, generate checksums, alert on failures, and rehearse restoration on a schedule. Do not put encryption keys beside dumps.

### AUD-012 — P1 — Browser test execution is not a reliable gate

`npm run test:e2e` produced no progress/result for roughly three minutes and was terminated. No actionable reporter output was emitted during the run. Independently, the suite's coverage is mostly superficial (AUD-013), so even a passing result would not prove production workflows.

Required fix: use a line/JUnit reporter in CI, set per-test/global timeouts, run a deterministic single-worker smoke shard first, capture server stdout/stderr and traces on failure, and make teardown close all child services.

### AUD-013 — P2 — E2E test names overstate their coverage

Evidence:

- `e2e/admin.spec.ts` visits nonexistent `/admin/*` routes while unauthenticated and only asserts the response is not HTTP 500.
- `e2e/driver.spec.ts` does the same for `/driver/dashboard`.
- `e2e/auth.spec.ts` comments out credential entry and only checks that login UI renders.
- `e2e/booking.spec.ts` stops after opening the booking page.
- The “Mobile Responsive Navigation” test uses only the configured desktop Chromium project; no mobile viewport exists.
- No Firefox/WebKit, authenticated role fixture, accessibility engine, visual regression, or real create/update/delete workflow is configured.

Impact: the suite can pass while auth, RBAC, payments, dispatch, uploads, responsiveness, or accessibility are broken.

Required fix: replace placeholder cases with seeded, authenticated end-to-end flows for each role and the critical booking/payment lifecycle. Add a mobile Chromium project, then a small WebKit/Firefox smoke matrix as capacity permits.

### AUD-014 — P2 — Client IP rate-limit keys trust unnormalized forwarding headers

Login uses raw `x-forwarded-for`; signup/public booking prefer `cf-connecting-ip` but also accept raw forwarding data. A multi-hop value becomes the entire key, and a deployment that does not overwrite inbound forwarding headers allows attackers to rotate the value and bypass rate limiting.

Files: `apps/web/src/app/api/khobra-cleaning/auth/login/route.ts:9`, signup `route.ts:10`, public booking `route.ts:29`.

Required fix: define the trusted proxy/CDN topology, read only the header it guarantees, parse the first validated IP, cap key length, and combine IP throttling with an account/email key for login.

### AUD-015 — P2 — Cookie CSRF origin validation trusts forwarded host/protocol too broadly

`apps/web/src/lib/auth.ts:43-46` builds the allowed-origin set using request-supplied `x-forwarded-host` and `x-forwarded-proto`. This is safe only if a trusted proxy always strips and rewrites those headers. That deployment requirement is undocumented.

Required fix: use an explicit production origin allowlist and treat proxy-derived host values as trusted only behind a verified proxy configuration. Add hostile-origin tests for every cookie-authenticated mutation family.

### AUD-016 — P2 — Upload and realtime payload limits are enforced after buffering or not at all

The upload route calls `request.formData()` and `file.arrayBuffer()` before signature validation; declared size validation happens only after multipart parsing. Realtime has no body limit at all. Request-count rate limiting does not prevent a small number of very large bodies.

Files: `apps/web/src/app/api/khobra-cleaning/upload/route.ts:30-51`, `apps/realtime/index.ts:81-84`.

Required fix: enforce ingress/body limits at the reverse proxy and framework level, reject oversized `Content-Length` early, stream uploads directly to the provider where practical, and keep magic-byte/type validation.

### AUD-017 — P2 — API errors are inconsistent and sometimes expose internal messages

Several routes return `error.message` directly, sometimes as HTTP 500 and sometimes translating arbitrary repository/Prisma errors into HTTP 400. Examples include settings, signup, booking, invoice, and bank-transfer routes. Other routes collapse all validation problems into `{ error: 'Failed' }`.

Impact: clients cannot reliably distinguish validation/conflict/server failures; database/internal detail may leak; production diagnosis is harder.

Required fix: use a small typed error mapper (`validation=400`, `auth=401/403`, `not found=404`, `conflict=409`, unexpected=500 with opaque request ID), log the internal cause once, and return stable public codes/messages.

### AUD-018 — P2 — Observability and operational health are insufficient

There is no structured logger, request correlation ID, metrics, tracing, error-reporting integration, or documented alerting. Web `/api` returns `Hello, world!` rather than liveness/readiness. Realtime readiness does not check configuration or dependencies. Broadcast failures are console errors and otherwise invisible.

Required fix: add structured JSON logs with request/tenant/user IDs (excluding secrets/PII), error aggregation, latency/error-rate metrics, database/realtime readiness, and alerts for auth spikes, notification failures, migration/backup failures, and payment workflow errors.

### AUD-019 — P2 — Web touch targets and icon-only controls fail the UI checklist

At least 24 action buttons are explicitly `h-7 w-7` (28×28 px), below the 44×44 touch-target baseline. Several icon-only buttons have no visible text or explicit accessible label, such as inventory edit/delete at `apps/web/src/components/khobra-cleaning/inventory.tsx:367-368` and invoice PDF at `finance.tsx:711`.

Reduced-motion CSS exists (`apps/web/src/app/globals.css:213`), which is positive, but no automated accessibility or keyboard test covers these screens.

Required fix: make interactive hit areas at least 44×44 on touch layouts, add accessible names/tooltips where the icon is the only content, and test keyboard focus, screen-reader names, contrast, and responsive layout.

### AUD-020 — P2 — Mobile UI/device support is not production-verified

Evidence:

- `apps/mobile/app.json` locks orientation to portrait.
- No tablet-specific config or test matrix is present.
- No automated mobile UI, dynamic type, screen-reader, dark-mode contrast, landscape, or 375 px test exists.
- The app uses many per-screen raw color values; semantic tokens are only partial.

Impact: accessibility and layout failures can ship despite TypeScript passing. Portrait lock may be intentional, but it conflicts with the pre-delivery landscape/adaptive checklist and should be an explicit product decision.

Required fix: document supported devices/orientations, test small/large phone and tablet where supported, verify largest text size and screen readers, and add native smoke tests for login, booking, operations, expenses, push deep links, and session expiry.

### AUD-021 — P2 — Embedded mobile workspace has no navigation allowlist

`apps/mobile/src/presentation/workspace-screen.tsx:53` enables JavaScript, DOM storage, shared cookies, and third-party cookies in a WebView, but does not implement `onShouldStartLoadWithRequest` or external-link handling.

Impact: links can navigate the authenticated workspace WebView to untrusted origins, creating phishing/confused-context risk and unnecessary third-party cookie exposure.

Required fix: allow only the configured API/web origin inside the WebView, open external HTTPS links in the system browser, block non-HTTPS/custom schemes unless explicitly required, and disable third-party cookies unless a documented feature needs them.

### AUD-022 — P2 — Core UI and booking modules are too large and weakly typed

The largest files are `bookings.tsx` (2,621 lines), `customers.tsx` (986), `employees.tsx` (911), `complaints.tsx` (888), `PrismaBookingRepository.ts` (881), and the main web shell (819). The repo contains roughly 475 `any` occurrences; `DashboardResponseSchema` is literally `z.any()` and `DashboardDTO` is `any` (`packages/core/src/dashboard/schema.ts:3-4`). Web TypeScript also sets `noImplicitAny: false` despite `strict: true`.

Impact: changes have large blast radii, API contract drift is hidden, review is difficult, and regression tests cannot target cohesive units.

Required fix: first define/parse API response DTOs at boundaries, turn on `noImplicitAny`, then split only along real feature/state boundaries (forms, tables, dialogs, workflow actions). Avoid creating wrapper-only files.

### AUD-023 — P2 — Database query/index shape will degrade under production volume

High-traffic booking queries filter/order by tenant, deletion state, scheduled date, and status, but `Booking` only declares `@@index([driverId])` in the Prisma schema; the deletion migration adds `(tenantId, deletedAt)` but not the common date/status combinations. Similar tenant/status/date access patterns exist across notifications, services, complaints, leave, and assignments.

Required fix: collect representative `EXPLAIN (ANALYZE, BUFFERS)` plans with production-like cardinality, then add only demonstrated composite indexes such as booking tenant/date/status and notification tenant/user/read/created. Add pagination to list endpoints before data grows.

### AUD-024 — P2 — Global email uniqueness conflicts with a general multi-tenant identity model

`User.email` is globally unique and login resolves by email alone. This is coherent for a single global identity, but it means the same person cannot have separate accounts/roles in multiple tenants. Public signup also binds to one configured public tenant.

Required action: document this as an intentional global-identity decision. If tenant-local identity is required, migrate to `@@unique([tenantId, email])` and include tenant discovery/slug in login; do not change this casually because it affects authentication semantics.

## Low-severity and maintainability findings

### AUD-025 — P3 — Test execution emits module-type warnings

Node reparses TypeScript imports in web/core/db as ES modules because relevant package manifests do not declare module type. All tests pass, but startup noise hides useful warnings and adds parse overhead. Align package module metadata with the actual source/build strategy.

### AUD-026 — P3 — Prisma configuration uses a deprecated location

Every Prisma command warns that `package.json#prisma` will be removed in Prisma 7. Move seed/configuration to `prisma.config.ts` before upgrading.

### AUD-027 — P3 — Dead monorepo configuration packages and Turbo config add noise

`packages/config-eslint`, `packages/config-typescript`, and `packages/config-tailwind` contain only package manifests, expose nonexistent `index.js` entry points, and are not referenced. `turbo.json` is present, but root scripts do not invoke Turbo and Turbo is not a declared root dependency.

Recommendation: delete these four unused configuration surfaces, or actually centralize config through them. Current state creates false architecture without reuse.

### AUD-028 — P3 — Single-implementation repository interfaces add ceremony

The application package declares roughly 20 repository interfaces, nearly all with one Prisma implementation and direct construction inside routes. This is useful only where domain services/tests genuinely substitute implementations; otherwise it adds navigation and unsafe casts without polymorphism.

Recommendation: retain interfaces used by real services/test doubles; collapse pure pass-through interface/repository pairs into typed functions or direct Prisma access. Do not refactor this before P0/P1 fixes.

### AUD-029 — P3 — Release and operations documentation is missing

There is no tracked README/runbook covering supported apps, environment-variable ownership, deployment topology, secret rotation, migration order, backup schedule, rollback, health checks, mobile store release, or incident response. Multiple `.env.example` files exist, but realtime and wrapper requirements are not presented as one environment matrix.

Required before handoff: create a short production runbook and explicit app support matrix, especially clarifying Expo vs Capacitor vs the stale root Android project.

## Over-engineering audit

Ranked in the repo-audit format:

- `delete:` unused config-eslint/config-typescript/config-tailwind packages and inactive Turbo configuration. Replacement: nothing until a second consumer needs shared config. [`packages/config-*`, `turbo.json`]
- `yagni:` single-implementation repository interfaces that are never substituted. Replacement: keep direct typed repository/functions only where a service or test needs a port. [`packages/application/src/**/I*Repository.ts`]
- `shrink:` duplicated native Android ownership. Replacement: one documented Expo native source plus the explicitly supported Capacitor wrapper, if both products are truly required. [`android/`, `apps/mobile`, `apps/mobilewrapper`]
- `shrink:` duplicate client-side and server-side PDF paths if both generate the same invoice artifact. Replacement: one authoritative server PDF endpoint and a download action. [`jspdf`, `jspdf-autotable`, `invoice-pdf/route.ts`]
- `shrink:` large UI files mixing queries, forms, tables, dialogs, and workflow rules. Replacement: extract only cohesive feature units and shared typed API calls; avoid one-component-per-file churn. [`apps/web/src/components/khobra-cleaning/*`]

Estimated net opportunity: **-1,500 to -3,000 lines and -3 to -6 direct/config dependencies**, subject to confirming the PDF and Capacitor product requirements.

## Recommended remediation order

### Before any production deployment

1. Fix AUD-001, rotate both secrets, and add fail-closed startup validation.
2. Fix and integration-test AUD-002.
3. Migrate service categories to tenant-owned storage and test AUD-003 with two tenants.
4. Repair the workflow assertion and make the full clean `verify` gate pass.
5. Triage/upgrade AUD-005 advisories and document any temporary exception.
6. Decide and repair the Expo/native source of truth (AUD-006).
7. Add clean CI for web, realtime, database, and tests (AUD-007).

### Before launch traffic

8. Make realtime delivery/lifecycle reliable (AUD-008/009), enforce payload limits, and harden proxy/IP trust (AUD-014/015/016).
9. Add database tenant invariants where practical and regression tests for cross-tenant access (AUD-010).
10. Put encrypted off-host backups, monitoring, readiness, and alerting in place (AUD-011/018).
11. Replace placeholder E2E tests with authenticated critical-path tests and make browser execution deterministic (AUD-012/013).
12. Complete web/mobile accessibility and device verification (AUD-019/020/021).

### After release blockers

13. Type API boundaries and reduce the largest modules (AUD-022).
14. Profile queries and add evidence-backed indexes/pagination (AUD-023).
15. Resolve module/Prisma deprecations and remove dead architecture (AUD-025 through AUD-028).
16. Add the production runbook and ownership matrix (AUD-029).

## Exit criteria for a go decision

- No P0 findings remain, and every P1 has either been fixed or has a signed, time-bounded risk acceptance.
- `npm ci` followed by the clean CI verification suite passes from a fresh checkout and ephemeral database.
- Dependency audit has no unaccepted reachable high/critical advisories.
- Web, realtime, Expo, and any retained Capacitor release artifacts are reproducible from documented commands.
- Two-tenant authorization/isolation tests pass for every API family, including categories, payments, uploads, notifications, and realtime rooms.
- Authenticated browser tests cover admin, customer, cleaner, and driver critical paths on desktop and mobile viewport.
- Backup restore, migration rehearsal, health/readiness, monitoring, rollback, and secret rotation are documented and tested.
- Accessibility checks cover keyboard, screen-reader names, touch targets, contrast, reduced motion, dynamic text, and supported device/orientation sizes.
