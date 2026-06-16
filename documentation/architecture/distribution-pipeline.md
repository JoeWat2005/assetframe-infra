# Distribution pipeline

> Part of the AssetFrame `/documentation` vault → `architecture/`.
> See also: [system-overview.md](./system-overview.md) ·
> [generation-pipeline.md](./generation-pipeline.md) ·
> [data-flow.md](./data-flow.md) · [trust-boundaries.md](./trust-boundaries.md) ·
> [directory-map.md](./directory-map.md)

Once a generated edition has passed QA and a human has stamped it
([generation-pipeline.md](./generation-pipeline.md) steps 10–11), three commands move it into
the live product. The sequence (from `README.md` §8 / `SKILL.md` step 12):

```
python scripts/export_content.py           # → web/content/*.json (catalog + track record)
python scripts/publish.py                   # → Cloudflare R2 (the actual report files)
(cd web && npm run sync-db)                 # → Neon Postgres (both branches), via web/scripts/sync-db.mjs
git add -A && git commit -m "edition: <date>" && git push   # Vercel auto-redeploys
```

**The trust boundary that defines this plane:** *only* `web/content/*.json` (and the
tracked `ledger/outcome_ledger.csv` source-of-truth) reach git/Neon. **Report files are
never copied into the web app or git** — every `free` and `pro` file lives privately in R2
and is served only through an auth-gated route. See
[trust-boundaries.md](./trust-boundaries.md#distribution-plane-private-r2--signed-urls).

---

## `export_content.py` — Python engine → the Next.js app

| | |
|---|---|
| **Reads** | `reports/*/*/metadata.json`, `ledger/outcome_ledger.csv`, `data/predictions/*_predictions.json` |
| **Writes** | `web/content/catalog.json`, `web/content/track-record.json` |

```
python scripts/export_content.py [--web web] [--reports reports] [--include-dev]
```

It writes **only** the catalog and track record into `web/content/` — report files are *not*
copied (docstring lines 1-12; the `_dir` field is deleted before serialising, lines 383-384).

- **`catalog.json`** — one entry per edition built from each `metadata.json`
  (`load_catalog()` lines 84-116). Asset paths point at the gated route, e.g.
  `freeHtml: /api/report/<date>/<slug>/free.html`, `freePdf`, `preview`, and `hasPro` is set
  from whether `pro.html` exists on disk. The base path is `/api/report/<date>/<slug>` (line
  95) — i.e. the catalog records *gated* paths, never public file URLs.
- **`track-record.json`** — `{ stats, open[], scored[], calibration, byInstrument,
  byAssetClass, byPredictionType, byRegime, timeline, calibrationCurve, componentVsOutcome }`
  (`main()` lines 365-380). `open[]` comes from the predictions files (open calls, expandable
  to individual predictions with per-call verdicts merged from the ledger's packed `results`
  string, lines 287-318); `scored[]` and the headline stats come from the ledger rows
  (`load_track_record()` lines 251-320); the derived analytics come from
  `_build_aggregates()` (lines 119-248).

**No new scoring happens here.** Every count is read back from the per-report hits/misses
already graded into the ledger (`_build_aggregates` comment, lines 119-122). The coarse
calibration buckets (`<=60` / `61-75` / `>75`) and the 10-point `calibrationCurve` are both
gated to **≥10 ledger rows** (lines 182, 276).

**Empty-ledger behaviour:** with no `outcome_ledger.csv` (the current day-one state), `total`
stays 0, `scored` is `[]`, `calibration` is `None`, and `_build_aggregates()` returns empty
arrays (lines 123-126). `open[]` can still be populated from the predictions files, so the
track record shows open calls awaiting scoring.

---

## `publish.py` — upload report files to private R2

| | |
|---|---|
| **Reads** | `reports/*/*/{free,pro}.{html,pdf}` + `preview.png`; R2 credentials from env or `web/.env.local` |
| **Writes** | objects into the private R2 bucket (default name `assetframe-pro`) |

```
python scripts/publish.py             # upload every edition's free + Pro files
python scripts/publish.py --dry-run   # show what would upload, change nothing
python scripts/publish.py --date 2026-06-13   # only that edition date
```

R2 is S3-compatible, so this uses `boto3` against the Cloudflare endpoint (`pip install
boto3`). It auto-loads missing `R2_*` vars from `web/.env.local` (`_load_local_env()` lines
42-55), so it works without exporting them by hand.

**Object keys mirror the request path** the `/api/report` route uses
(`UPLOAD_FILES` lines 33-39, `discover()` lines 58-70):

```
<date>/<slug>/free.html
<date>/<slug>/free.pdf
<date>/<slug>/preview.png
<date>/<slug>/pro.html
<date>/<slug>/pro.pdf
```

**All five file types are private** — free Snapshots and Pro reports alike (docstring lines
4-8). Nothing is public/static, so there is no way to read a report without going through the
gate. Editions whose date directory starts with `_` are skipped (drafts, line 62). The four
required env vars are `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
`R2_BUCKET`; a missing one exits 2 (lines 91-97).

### The `/api/report` gate and 120-second signed URLs

Report files are served only through the auth-gated `/api/report/[...key]` route in the
Next.js app, which streams the object from R2 behind **120-second signed URLs** (`README.md`
§4, §8, §9; §10 "served only through the auth-gated `/api/report` route as short-lived signed
URLs"). Free files need an account; Pro files need an active subscription
(Clerk entitlement). This is the distribution-plane trust boundary — detail and the test that
guards the path-traversal defence are in
[trust-boundaries.md](./trust-boundaries.md#distribution-plane-private-r2--signed-urls).

> The route handler, signing TTL, and entitlement checks live in the Next.js app under
> `web/app/api/report/` and `web/lib/` (e.g. `r2`, `access`). This doc cites the README's
> stated contract (private files, 120s signed URLs, account-for-free / subscription-for-Pro).
> `NOT VERIFIED` against the exact handler source — confirm against
> `web/app/api/report/[...key]/route.ts` and `web/lib/r2.ts` before relying on the precise
> TTL or header behaviour.

---

## `web/scripts/sync-db.mjs` — load content JSON into Neon

| | |
|---|---|
| **Reads** | `web/content/catalog.json`, `web/content/track-record.json`; `DATABASE_URL` (+ `DATABASE_URL_DEV`) from env or `web/.env.local` |
| **Writes** | the `editions`, `open_calls`, `open_call_predictions`, `scored_results` tables in Neon |

```
node web/scripts/sync-db.mjs
# usually via the npm scripts:
(cd web && npm run sync-db)     # data only
(cd web && npm run db:setup)    # migrate, then sync — the usual publish step
```

Verified against `web/scripts/sync-db.mjs` (7.4 KB):

- **It syncs to every configured target**, deduping identical URLs (lines 32-44):
  - `DATABASE_URL` (with `POSTGRES_URL` / `STORAGE_*` fallbacks) → labelled `production`
    (Neon `main` branch);
  - `DATABASE_URL_DEV` (or `DEV_DATABASE_URL`) → labelled `dev branch` (Neon `development`,
    used by preview deploys), added only if it differs from the primary.
  So **one `npm run sync-db` updates both Neon branches** (`README.md` §8). No target → exit
  1 (lines 41-44).
- **It loads DATA only; the schema is owned by `node-pg-migrate`** (`web/migrations/`). Run
  `npm run migrate:up` (against each branch) or `npm run db:setup` first (comment lines
  46-47).
- **`editions` are upserted** (`INSERT … ON CONFLICT (id) DO UPDATE`, lines 53-79); the id is
  `<date>/<slug>`. Pro keys (`pro_html_key`, `pro_pdf_key`) are set only when `hasPro` (lines
  74). Additive T12 columns (`asset_class_key`, `direction_view`, `prediction_type`,
  `market_regime`, `confidence_band`, `social_context`) pass through as `null` when absent
  (lines 75-77).
- **The track record is a replaced snapshot** (idempotent): `DELETE FROM open_calls`
  (cascades to `open_call_predictions`) then re-insert (lines 83-110), and `DELETE FROM
  scored_results` then re-insert (lines 111-122). Per-prediction rows upsert on
  `(report_id, pred_id)` (line 99).
- **Per-target isolation:** each target runs in its own `try/catch`; a failure increments a
  counter and the process exits 1 at the end if any failed (lines 126-138), so a broken dev
  branch doesn't silently mask a production failure.

---

## The `out_dir` nesting rule (do not regress)

`out_dir` MUST be exactly `reports/<date>/<slug>` (`SKILL.md` step 12; `mvp/CLAUDE.md`
conventions). The scaffold computes it as `reports/{report_date}/{ticker}`
(`scaffold_payload.assemble()` line 358), and both `export_content.load_catalog()` and
`publish.discover()` glob `*/*/metadata.json` and derive `date, slug` from
`meta.parent.parent.name` / `meta.parent.name` (`export_content.py` lines 86-87,
`publish.py` lines 60-61). A deeper or shallower path breaks that two-level glob — the
historical "nesting bug" — so the date/slug structure is load-bearing for discovery,
catalog paths, and R2 keys alike.

---

## Two branches → two environments

| Branch | Vercel env | Keys | Neon branch | URL |
|---|---|---|---|---|
| `main` | Production | live Clerk / Lemon Squeezy | `main` (`DATABASE_URL`) | `www.assetframe.co.uk` |
| `development` | Preview | test keys | `development` (`DATABASE_URL_DEV`) | a `*.vercel.app` URL |

Push to either branch and Vercel rebuilds (`README.md` §8). Because `sync-db.mjs` writes to
both `DATABASE_URL` and `DATABASE_URL_DEV` in one run, the catalog/track-record data stays in
step across both environments; the report files in R2 are shared (a single private bucket).

## After sync: what the app exposes

The synced data drives the reports browser (`/reports`), the Pro-gated track record
(`/track-record`), the homepage forecast-ledger strip, the MCP server (`/api/mcp`), and the
REST API (`/api/v1`) — all read-only and Pro-gated where appropriate (`README.md` §4–5,
§7). The MCP `get_pro_report` tool and Pro downloads both ultimately resolve to the same
gated R2 path with short-lived links.
