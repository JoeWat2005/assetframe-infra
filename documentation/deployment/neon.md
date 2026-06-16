# Neon Postgres

State that backs the catalog, track record, downloads, billing mirror, feedback, subscribers, watchlists, push subscriptions, and the admin audit log lives in **Neon Postgres**. Schema is owned by `node-pg-migrate` (`web/migrations/`). The connection helper is `web/lib/db.ts` (`@neondatabase/serverless`); when no connection string is set, `sql` is null and every query is skipped so the app still renders.

## Two branches

| Neon branch | Used by | Env var |
| --- | --- | --- |
| `main` | Vercel Production | `DATABASE_URL` |
| `development` | Vercel Preview | `DATABASE_URL_DEV` |

Both connection strings are pooled (`-pooler` host) with `sslmode=require`. `sync-db.mjs` writes to **every** configured target, so one publish updates both branches and prod + preview stay in lockstep. (Per project memory, creating the Neon dev branch was a tracked follow-up; both URLs are present in `web/.env.local`.)

## Migrations

Scripts in `web/package.json`:

```bash
# run from web/, against the branch named by .env.local's DATABASE_URL
npm run migrate:up      # apply all pending migrations (node-pg-migrate up)
npm run migrate:down    # roll back the last migration
npm run migrate:create  # scaffold a new migration (JS)
npm run db:setup        # migrate:up THEN sync-db (one-shot first-time setup)
```

`migrate` uses `--envPath .env.local`, so it reads `DATABASE_URL` from there. **Run migrations per branch.** To migrate the `development` branch, point `DATABASE_URL` at the dev string for that run (e.g. temporarily, or via a separate env file) — `node-pg-migrate` migrates the single database its connection string names; it does not fan out the way `sync-db.mjs` does.

## Migration list (current)

Filenames under `web/migrations/`, in order:

| Migration | Adds |
| --- | --- |
| `init` | base schema (editions, open_calls, scored_results, ...) |
| `open-call-predictions` | `open_call_predictions` (children of `open_calls`) |
| `download-log` | `download_log` (Pro download events; feeds admin downloads/MRR-adjacent KPIs) |
| `call-hits` | call-hit tracking |
| `billing-subscriptions` | `billing_subscriptions` (Lemon Squeezy mirror; source of the Pro-subscriber count) |
| `admin-audit-log` | `admin_audit_log` (admin + billing actions) |
| `edition-hidden` | `hidden` flag on `editions` (unpublish without deleting) |
| `feedback` | `feedback` (public form submissions + status) |
| `subscribers` | `subscribers` (email digest list, double opt-in) |
| `watchlists` | `watchlists` (instruments a user follows) |
| `report-views` | `report_views` (marketing/engagement metric — firewalled from scoring) |
| `push_subscriptions` | `push_subscriptions` (web-push endpoints + topics) |
| `social_engagement` | `social_engagement` (marketing-only metric — firewalled) |
| `track_record_analytics` | track-record analytics support |

> `report_views`, `download_log`, and `social_engagement` are marketing/engagement tables. They are deliberately walled off from the Python scoring engine — see `../analytics/tracking.md` and `../testing/security-tests.md` (the firewall test).

## How data lands

- **Editions + track record** are upserted by `web/scripts/sync-db.mjs` from `web/content/catalog.json` and `web/content/track-record.json` after `export_content.py`. It upserts `editions` (idempotent) and replaces the track-record snapshot (`DELETE` + repopulate `open_calls`, `open_call_predictions`, `scored_results`). See `../operations/publication-workflow.md`.
- **Runtime writes** come from the app: `download_log` (gated Pro fetch, deduped per user/report/kind/hour), `billing_subscriptions` (Lemon Squeezy webhook), `admin_audit_log` (admin actions), `feedback`, `subscribers`, `watchlists`, `push_subscriptions`.

## First-time setup for a branch

1. Create/identify the Neon branch and copy its pooled connection string.
2. Set `DATABASE_URL` (prod) / `DATABASE_URL_DEV` (dev) in `web/.env.local` and in Vercel.
3. `npm run migrate:up` against each branch.
4. `npm run sync-db` (or `npm run db:setup` to do both) to load the current editions + track record.

## Related docs

- `environment-variables.md` (`DATABASE_URL`, `DATABASE_URL_DEV`), `vercel.md` (branch->env), `production-checklist.md`.
- `../operations/publication-workflow.md` (sync-db in the pipeline), `../analytics/metrics.md` (which tables back which KPIs).
- `../database/` (schema deep-dive — owned elsewhere).
