# Database — Migrations

## Tooling

Migrations are managed by **node-pg-migrate** (`node-pg-migrate@^8.0.4`, a devDependency). Files live in `web/migrations/` and are plain CommonJS (`*.js`) exporting `up(pgm)` / `down(pgm)`, each calling `pgm.sql(...)` with raw SQL. `exports.shorthands = undefined`.

NPM scripts (from `web/package.json`):

| Script | Command | Purpose |
| --- | --- | --- |
| `migrate` | `node-pg-migrate --envPath .env.local` | base runner |
| `migrate:up` | `node-pg-migrate up --envPath .env.local` | apply pending migrations |
| `migrate:down` | `node-pg-migrate down --envPath .env.local` | roll back the last migration |
| `migrate:create` | `node-pg-migrate create --migration-file-language js` | scaffold a new migration |
| `db:setup` | `npm run migrate:up && npm run sync-db` | migrate then load data |

`--envPath .env.local` means the runner reads the connection string from `web/.env.local`. node-pg-migrate connects using `DATABASE_URL` from that env file by default.

## The 13 migrations (in apply order)

node-pg-migrate orders migrations by the **full filename**, which begins with a millisecond timestamp. The current set:

| # | File | What it does |
| --- | --- | --- |
| 1 | `1750000000000_init.js` | Baseline: `editions`, `open_calls`, `scored_results` (idempotent `IF NOT EXISTS`) |
| 2 | `1750000001000_open-call-predictions.js` | Drops `open_calls.predictions` jsonb; creates child `open_call_predictions` |
| 3 | `1750000002000_download-log.js` | `download_log` |
| 4 | `1750000003000_call-hits.js` | Adds `open_calls.hits`, `open_calls.scored` |
| 5 | `1750000004000_billing-subscriptions.js` | `billing_subscriptions` |
| 6 | `1750000005000_admin-audit-log.js` | `admin_audit_log` |
| 7 | `1750000006000_edition-hidden.js` | Adds `editions.hidden` |
| 8 | `1750000007000_feedback.js` | `feedback` |
| 9 | `1750000008000_subscribers.js` | `subscribers` |
| 10 | `1750000009000_watchlists.js` | `watchlists` |
| 11 | `1750000010000_report-views.js` | `report_views` |
| 12 | `1750000011000_push_subscriptions.js` | `push_subscriptions` (T16) |
| 13 | `1750000012000_social_engagement.js` | `social_engagement` (T17) |
| 14 | `1750000013000_track_record_analytics.js` | Additive nullable columns on `open_call_predictions`, `editions`, `scored_results` (T12) |

(14 files; "13 migrations" in the task brief predates the `track_record_analytics` addition. The current count is 14.)

## Timestamp-ordering edge case

`track_record_analytics.js` is named `1750000013000_...` but its **header comment claims it shares the `1750000010000` timestamp with report-views**. In the file on disk the prefix is `1750000013000`, so it sorts last. Either way, node-pg-migrate orders by the full filename string, and the two migrations touch **disjoint tables** (report-views creates `report_views`; track-record-analytics alters `editions`/`open_call_predictions`/`scored_results`), so apply order between them is harmless.

> NOT VERIFIED: the comment's claim of a shared timestamp does not match the on-disk filename prefix (`1750000013000`). The comment appears stale; trust the filename for ordering.

## Idempotency / reconciliation

- `init` uses `CREATE TABLE IF NOT EXISTS` so it reconciles a database first created by the old `sync-db` bootstrap (or `db/schema.sql`) without error.
- `track_record_analytics` uses `ADD COLUMN IF NOT EXISTS` for every column, so a re-run is a no-op and it reconciles whatever the earlier bootstrap left.
- Column-adding migrations (`call-hits`, `edition-hidden`) also use `IF NOT EXISTS`.
- Every migration defines a `down` that drops exactly what its `up` added.

## Running against both Neon branches

The schema lives on **two** Neon branches (see [schema.md](./schema.md)). node-pg-migrate's `--envPath` points at a single `DATABASE_URL`, so to migrate both branches you run the command **once per branch** by pointing the connection string at each:

1. **Production (main branch):** ensure `.env.local`'s `DATABASE_URL` points at the Neon `main` branch pooled string, then `npm run migrate:up`.
2. **Development branch:** point the connection string at the Neon `development` branch and run `npm run migrate:up` again. In practice this means temporarily setting `DATABASE_URL` to the dev branch URL for that invocation (e.g. `DATABASE_URL=$DATABASE_URL_DEV npx node-pg-migrate up`).

> NOT VERIFIED: there is no script that migrates both branches in one command. `db:setup`/`migrate:up` target only the single `DATABASE_URL` from `.env.local`. The data-sync step (`sync-db.mjs`) *does* fan out to both branches, but **migrations do not** — they must be run per branch. Confirm the exact dev-branch invocation with the deploy owner before a release.

## Tests

There are no dedicated migration tests. Schema-shape correctness is exercised indirectly by the data layer (`lib/content.ts` retries pre-T12 projections if the new columns are missing — see [json-fallback.md](./json-fallback.md)) and by the security tests over the query helpers.

## Related docs

- [schema.md](./schema.md) · [tables.md](./tables.md) · [sync-db.md](./sync-db.md)
