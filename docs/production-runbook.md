# Production runbook

This deployment targets a VPS with a reverse proxy, PostgreSQL, the Next.js web service, and the private Socket.IO realtime service. Expo/EAS is the authoritative native-mobile release path. The root `android/` directory is legacy and must not be used for a release; it remains in the repository only to avoid a destructive production-era cleanup.

## Required configuration

Web must have `DATABASE_URL`, `AUTH_SECRET`, `REALTIME_SECRET`, `APP_URL`, `ALLOWED_ORIGINS`, `PUBLIC_TENANT_SLUG`, and provider credentials used by the enabled upload/push features. Realtime must have the same `AUTH_SECRET` and `REALTIME_SECRET`, plus `WEB_ORIGIN`. Do not expose realtime port 3003 publicly; allow the web service to reach its `/broadcast` bridge over the VPS private interface or loopback.

Set `TRUSTED_IP_HEADER` to exactly the header the reverse proxy strips and rewrites (`x-real-ip` is recommended for a typical Nginx VPS). Configure the proxy to reject request bodies above 6 MB for the upload endpoint and 64 KB for the realtime bridge. Configure TLS and redirect HTTP to HTTPS.

Secrets do not rotate automatically. Keep them outside Git, back them up in the VPS secret store, and replace them manually only after suspected disclosure. Changing `AUTH_SECRET` signs all users out; changing `REALTIME_SECRET` requires web and realtime to be restarted with the same value.

## Rolling deployment order

1. Back up PostgreSQL and verify the generated `.sha256` sidecar.
2. Run `npm ci`, then `npm --prefix packages/db run db:deploy` once.
3. Deploy/restart realtime and verify `GET /health` and `GET /ready` on its private origin.
4. Deploy web instances one at a time and verify `GET /api/health` after each restart.
5. Run `npm run test:workflow` and the external smoke checks against the release environment.

The tenant-category migration copies the legacy global value to tenant keys and deliberately retains the legacy row, so old and new web instances can overlap during a rolling deployment. The operational-index migration only adds indexes and does not rewrite application data.

## Backup policy

Set `BACKUP_DIR` to an encrypted, access-controlled off-host mount or a directory synchronised to encrypted object storage. Set `BACKUP_RETENTION_DAYS` to the approved retention period. The script creates PostgreSQL custom-format dumps and SHA-256 sidecars; storage encryption is provided by the mounted/off-host destination, not by an application key stored beside the backup. Alert when the backup command fails or when no new dump appears within the RPO. Rehearse with `npm --prefix packages/db run db:rehearse-backup` on a schedule.

## Monitoring and rollback

Monitor web `/api/health`, realtime `/health` and `/ready`, HTTP 5xx rate, database saturation, failed realtime broadcasts, backup age, disk usage, and certificate expiry. Every proxy response carries `x-request-id`; include it in reverse-proxy access logs.

For an application rollback, keep the database migrations applied and roll web/realtime code back one release. Both new migrations are backward-compatible. Do not reverse migrations while older and newer processes overlap. Restore a database backup only for data-loss recovery, never as a routine code rollback.

## Mobile releases

Use `.github/workflows/mobile-release.yml` or run EAS from `apps/mobile`. The production application ID is `com.khobracleaning.app`. The separate Capacitor wrapper is an additional supported wrapper and requires its own `CAPACITOR_SERVER_URL`; it is not the Expo native project. Never build the legacy root Android project for store submission.

The supported native layout for the current release is portrait phones. Tablets and landscape are not claimed as supported until device QA is added. Before each store submission, test a small and large Android phone plus an iPhone for login/signup, booking creation, role workspaces, driver expenses, push/deep-link handling, logout/session expiry, dark mode, largest text size, and TalkBack/VoiceOver focus order. The browser smoke suite separately exercises 375 px responsive navigation.

User email is intentionally a global identity across tenants. The same email cannot hold independent tenant-local accounts; changing that model requires a dedicated authentication migration and tenant-discovery design.

## Accepted dependency exception

Compatible dependency updates patch `js-yaml`, `nanoid`, and DOMPurify. The remaining npm advisory is `image-size@1.2.1` inside Metro, which is build tooling and only parses repository-controlled mobile assets in this workflow. npm proposes a breaking Expo/React Native downgrade, so it is not forced into the deployed app. Reassess at each Expo SDK upgrade and never feed untrusted uploaded images to Metro.
