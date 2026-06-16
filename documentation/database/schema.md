# Database — Schema overview

## Purpose

AssetFrame's database is a **Neon Postgres** instance that holds **report data only**. It is deliberately narrow: users live in Clerk, payments live in Lemon Squeezy, and the report files (HTML/PDF/PNG) live in private Cloudflare R2 (referenced here by object key). The database is the read source for the public catalogue, the reader, the track-record pages, the admin dashboard, the public REST API, and the MCP server.

## Connection

- Client: `@neondatabase/serverless` (`neon(url)` HTTP driver), instantiated once in `lib/db.ts`.
- The connection string is read from the first of these env vars that is set:
  `DATABASE_URL` → `POSTGRES_URL` → `STORAGE_DATABASE_URL` → `STORAGE_POSTGRES_URL` → `STORAGE_URL`.
  (Vercel's Neon integration may inject a prefixed variable, hence the fallback chain.)
- `lib/db.ts` exports `sql` (the query function, or `null` when no URL is configured) and `dbConfigured` (boolean). Every consumer must tolerate `sql === null` — see [json-fallback.md](./json-fallback.md).
- `lib/db.ts` is marked `import "server-only"`; the DB is never reachable from client code.

File: `C:\Users\cwatm\Desktop\advisor\mvp\web\lib\db.ts`

## Two Neon branches

The schema and data are applied to **two Neon branches** so production and preview stay in lockstep:

| Branch | Env var | Used by |
| --- | --- | --- |
| `main` (production) | `DATABASE_URL` | Production deploy (`main` git branch) |
| `development` | `DATABASE_URL_DEV` (or `DEV_DATABASE_URL`) | Preview deploys (`development` git branch) |

The data-sync script (`scripts/sync-db.mjs`) writes to **both** targets on a single publish when both are set. Migrations must be run against **each branch separately** (see [migrations.md](./migrations.md)).

## Schema ownership

The live schema is owned by **node-pg-migrate** under `web/migrations/` (13 migration files). A legacy hand-written `web/db/schema.sql` also exists; it documents the original bootstrap shape but is **no longer the source of truth** — the migrations supersede it and the `init` migration is written idempotently (`IF NOT EXISTS`) so it reconciles a DB that was first created by the old `sync-db` bootstrap without erroring.

> NOT VERIFIED: whether `web/db/schema.sql` is still applied by any tooling. It is referenced only as historical context in the file header; the active path is `migrate:up` (node-pg-migrate). Treat `db/schema.sql` as documentation, not as an applied artifact.

## Tables (summary)

| Table | Role | Migration |
| --- | --- | --- |
| `editions` | Published report catalogue (one row per edition) | `init` + `edition-hidden` + `track_record_analytics` |
| `open_calls` | Predictions awaiting scoring (track-record "open") | `init` + `call-hits` |
| `open_call_predictions` | Sub-predictions P1..Pn per open call | `open-call-predictions` + `track_record_analytics` |
| `scored_results` | Scored outcomes (the public outcome snapshot) | `init` + `track_record_analytics` |
| `download_log` | Pro file fetch log (admin charts) | `download-log` |
| `billing_subscriptions` | Lemon Squeezy subscription → Clerk-user mapping | `billing-subscriptions` |
| `admin_audit_log` | Privileged + billing action trail | `admin-audit-log` |
| `feedback` | Public feedback/feature-request inbox | `feedback` |
| `subscribers` | Newsletter audience (double opt-in) | `subscribers` |
| `watchlists` | Per-user followed instruments | `watchlists` |
| `report_views` | Per-day view counters ("Popular this week") | `report-views` |
| `push_subscriptions` | Web Push (VAPID) device endpoints | `push_subscriptions` |
| `social_engagement` | Marketing distribution metrics (firewalled) | `social_engagement` |

Full column-by-column detail is in [tables.md](./tables.md).

## Relationships

- `open_call_predictions.report_id` → `open_calls.report_id` (FK, `ON DELETE CASCADE`). This is the only declared foreign key in the schema.
- `editions` ↔ `open_calls` are joined **at query time**, not by an FK: the edition id `2026-06-15/AAPL` maps to the open-call `report_id` `AF-20260615-AAPL` via `'AF-' || replace(report_date,'-','') || '-' || slug` (see `EDITION_FROM` in `lib/content.ts`). A `LEFT JOIN` surfaces the research `confidence` onto the catalogue.
- `download_log`, `report_views`, `watchlists`, `subscribers`, `push_subscriptions`, `social_engagement` reference editions / users only by **string id or symbol**, with no DB-level FK (loose coupling so a data re-sync that deletes/replaces `editions` or `open_calls` can't cascade into operational tables).

## Data flow

1. The `/mvp` skill generates reports; `scripts/export_content.py` writes `web/content/catalog.json` + `web/content/track-record.json`.
2. `npm run migrate:up` ensures the schema exists on each branch.
3. `npm run sync-db` (`scripts/sync-db.mjs`) upserts `editions` and **replaces** the track-record snapshot (`open_calls`, `open_call_predictions`, `scored_results`).
4. The web app reads DB-first via `lib/content.ts`, wrapped in Next's `unstable_cache`; on any DB error or `sql === null` it falls back to the committed JSON.

See [sync-db.md](./sync-db.md) and [json-fallback.md](./json-fallback.md).

## Security notes

- All app queries are **parameterized** (`sql.query(text, params)`); no string interpolation of user input into SQL. See [../security/input-validation.md](../security/input-validation.md).
- The only user-supplied keys that reach a lookup (`date`/`slug`) are validated by `isValidReportRef` before the query (defence in depth).
- The DB stores **no card data and no passwords**. The most sensitive columns are emails (`feedback.email`, `subscribers.email`, `download_log.user_id`) and the Clerk user-id ↔ subscription mapping.

## Related docs

- [tables.md](./tables.md) · [migrations.md](./migrations.md) · [sync-db.md](./sync-db.md) · [json-fallback.md](./json-fallback.md)
- [../billing/webhooks.md](../billing/webhooks.md) (writes `billing_subscriptions`, `admin_audit_log`)
- [../auth/entitlement-checks.md](../auth/entitlement-checks.md)
