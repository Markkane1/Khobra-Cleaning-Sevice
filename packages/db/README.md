# Database releases

From the repository root:

1. Set `packages/db/.env` `DATABASE_URL` to the intended database.
2. Run `npm run db:backup --workspace @repo/db` and retain the printed dump.
3. Run `npm run db:status --workspace @repo/db` and review the pending migration names.
4. Run `npm run db:deploy --workspace @repo/db` during the deployment window.
5. Run `npm run db:status --workspace @repo/db` again; it must report that the schema is up to date.

Use `db:rehearse` and `db:rehearse-backup` before production. `db:push` is for local development only and must not be used for releases.
