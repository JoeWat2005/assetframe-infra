# Database — Data sync (`sync-db.mjs`)

## Purpose

`web/scripts/sync-db.mjs` loads the generated content JSON into Neon Postgres. The **schema** is owned by node-pg-migrate ([migrations.md](./migrations.md)); this script only syncs **data**. Run it after `python scripts/export_content.py`:

```
npm run sync-db          # node scripts/sync-db.mjs
npm run db:setup         # migrate:up THEN sync-db
```

File: `C:\Users\cwatm\Desktop\advisor\mvp\web\scripts\sync-db.mjs`

## Env loading

The script reads `web/.env.local` line by line and sets any key **not already present** in `process.env` (so real environment vars win over the file). It then resolves targets:

- **primary**: first set of `DATABASE_URL` → `POSTGRES_URL` → `STORAGE_DATABASE_URL` → `STORAGE_URL`
- **dev**: `DATABASE_URL_DEV` → `DEV_DATABASE_URL`

Both are added to a `targets` list (deduped if the dev URL equals primary). With **no** primary URL the script prints an error and exits 1. This is the script that keeps **prod + preview in lockstep on one publish** — unlike migrations, which run per branch.

## Inputs

- `content/catalog.json` — array of editions.
- `content/track-record.json` — `{ stats, open[], scored[], calibration }`.

## What it writes (per target)

For each target the script runs `syncOne(label, url)`:

1. **`editions` — upsert.** `INSERT ... ON CONFLICT (id) DO UPDATE` over all base columns plus the T12 additive columns (`asset_class_key`, `direction_view`, `prediction_type`, `market_regime`, `confidence_band`, `social_context`). The Pro keys are **derived**, not taken from JSON: `pro_html_key`/`pro_pdf_key` are set to `"<date>/<slug>/pro.html"` / `.../pro.pdf` only when `e.hasPro`, else `null`. T12 fields pass through only when present (`orNull`/`toJson` guard `undefined`/`""` → `null`), so an older `export_content.py` that doesn't emit them still works.

2. **track record — snapshot replace.**
   - `DELETE FROM open_calls` (cascades to `open_call_predictions` via the FK).
   - Re-insert each open call (`open_calls`), then each sub-prediction (`open_call_predictions`) with `INSERT ... ON CONFLICT (report_id, pred_id) DO UPDATE`. T12 per-prediction fields (`pred_type`, `verdict`, `setup_side`) pass through when present.
   - `DELETE FROM scored_results`, then re-insert each scored row including T12 `conf_version` + `confidence_components`.

This is a **destructive full-replace** of the track-record tables on every run — they always mirror the latest `track-record.json`. `editions` is an upsert (existing rows update; nothing is deleted), so editions accumulate over time.

> Implication: hiding/removing an edition is done by the admin `hidden` flag in the DB, **not** by sync-db. A re-sync will re-upsert a row that is in `catalog.json`, but it does not clear `hidden` (the upsert column list does not include `hidden`).

## Helpers

- `toInt(v)` → integer or null (handles `""`/null/NaN).
- `orNull(v)` → value or null for additive text columns.
- `toJson(v)` → `JSON.stringify` or null for jsonb columns.
- `confidence` is stored as text (`String(c.confidence)`), matching the `text` column type.

## Failure handling

Each target is wrapped in try/catch; a failure increments a counter and logs `[label] FAILED: <message>` but does **not** abort the other target. The script `process.exit(1)`s at the end if any target failed, so CI surfaces partial failures. Per-target success prints counts: editions, open_calls (+predictions), scored_results.

## Order of operations (release)

1. `export_content.py` regenerates `web/content/*.json`.
2. `npm run migrate:up` on each Neon branch (schema).
3. `npm run sync-db` (data → both branches at once).
4. Commit `web/content/*.json` and deploy; the app reads DB-first, JSON as fallback.

## Edge cases

- If `track-record.json` has empty `open`/`scored`, the DELETEs still run and the tables end up empty (intended — no stale calls).
- The FK cascade means you must never `DELETE FROM open_calls` expecting predictions to survive — they won't.
- Running sync-db **before** migrate:up against a fresh DB will fail (tables missing); always migrate first or use `db:setup`.

## Tests

No dedicated test for `sync-db.mjs`. `tests/publish.test.ts` covers the publish helper (`lib/publish.ts`), not this script.

## Related docs

- [migrations.md](./migrations.md) · [json-fallback.md](./json-fallback.md) · [tables.md](./tables.md)
