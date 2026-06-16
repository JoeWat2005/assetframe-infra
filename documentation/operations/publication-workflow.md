# Publication workflow

How an edition goes from a `/mvp` request to a live, notified report. The generation half is driven by the `mvp` skill (`mvp/.claude/skills/mvp/SKILL.md`); the publish half is three commands plus a git push.

## End-to-end pipeline

```
/mvp <instrument>
   |  (score yesterday FIRST — see scoring-workflow.md)
   |  score_report.py -> calibrate.py
   |
   |  intraday.py            OHLC + indicators + levels (engine)
   |  research_pack.py       sourced factual context
   |  social_pack.py         (optional) market-conversation summary, subtract-only
   |  ledger_context.py      per-instrument/type hit rates (no look-ahead)
   |  <research brief>       AI authors data/briefs/<NAME>_research_brief.json ONLY
   |  scaffold_payload.py    canonical levels + setups + R:R + ladder + predictions
   |     (invokes confidence.py and taxonomy.py)
   |  mvp_report.py          renders Snapshot + Pro (PDF/HTML) + metadata + preview.png
   |     + QA GATE (aborts on any violation)
   |  mvp_report.py <out_dir> --stamp-visual   <-- MANDATORY human review + stamp
   v
PUBLISH (run from mvp/):
   python scripts/export_content.py     # write web/content/catalog.json + track-record.json
   python scripts/publish.py            # upload free+pro+preview to R2 (assetframe-pro)
   (cd web && npm run sync-db)          # upsert editions + replace track record in Neon (both branches)
   git add -A && git commit -m "edition: <date>" && git push   # Vercel redeploys
   v
07:00 UTC cron -> /api/cron/new-editions -> push + email
```

> Script names above are confirmed against `mvp/README.md`. The exact flags of `mvp_report.py`/`scaffold_payload.py` beyond those shown (`--check`, `--stamp-visual`, `--session-profile`) are documented in the README and the skill — treat any flag not listed here as NOT VERIFIED in this doc set.

## Output layout

Per run, locally (`mvp/CLAUDE.md` conventions):

```
reports/YYYY-MM-DD/<INSTRUMENT>/
  free.pdf  pro.pdf  free.html  pro.html  metadata.json  preview.png
```

Intermediate data (gitignored): `data/candles/`, `data/analysis/`, `data/payloads/`, `data/predictions/`, `data/briefs/`, etc. Web content (committed): `web/content/catalog.json`, `web/content/track-record.json`.

> **Nesting bug to avoid (project memory):** the `out_dir` passed to the report/publish steps MUST be `reports/<date>/<slug>` exactly. Passing a deeper or wrapped path produces a nested directory that breaks the R2 key layout and the sync. Double-check `out_dir` before publishing.

## The QA gate (build aborts on any failure)

`mvp_report.py` enforces, among others (from `README.md`): price triple-equality (CSV == canonical == header); levels<->setups<->ladder<->ledger identity; R:R lint; banned-language scan; free/Pro split (no Pro vocab in the free Snapshot); UTC timestamps and no look-ahead; session fields and logo present; brief claims must trace to the research pack (else `THESIS_BLOCKED`); `primary_prediction.type` in the taxonomy enum; predictions reference only canonical level ids. These mirror the Python tests in `../testing/unit-tests.md` (`test_scaffold_payload.py`, `test_taxonomy.py`, `test_social_posts.py`).

## `export_content.py`

Writes the two web JSON files the site reads:
- `web/content/catalog.json` — every edition's public metadata + the `/api/report/...` asset keys.
- `web/content/track-record.json` — stats, `open[]` calls, `scored[]` results, calibration.

## `publish.py`

Uploads `free.{html,pdf}`, `pro.{html,pdf}`, `preview.png` to the private R2 bucket `assetframe-pro` under keys `<date>/<slug>/<file>`. Auto-loads `R2_*` from `web/.env.local`. Supports `--dry-run` and `--date YYYY-MM-DD`. See `../deployment/r2.md`.

## `sync-db.mjs` (`npm run sync-db`)

Node script (`web/scripts/sync-db.mjs`) that loads `web/content/*.json` into Neon:
- Reads `DATABASE_URL` (+ fallbacks) and `DATABASE_URL_DEV`; writes to **every** configured target, so prod + preview branches stay in lockstep.
- **Upserts** `editions` (core fields + asset keys + V2 columns like `asset_class_key`, `prediction_type`, `confidence_band`, `social_context`).
- **Replaces** the track-record snapshot: deletes `open_calls` and `scored_results` (cascading `open_call_predictions`), then repopulates all three from `track-record.json`.
- Idempotent; logs `editions: N, open_calls: M (P predictions), scored_results: Q` per target; exits non-zero if any target fails.
- Requires the schema to exist first (`npm run migrate:up` / `npm run db:setup`). See `../deployment/neon.md`.

## Commit + deploy

Commit `web/content/catalog.json` + `web/content/track-record.json` and push. The Vercel redeploy serves the new catalog. (The R2 files and DB rows are already live from `publish.py`/`sync-db` — the commit keeps the repo as the source of record and triggers a fresh build.)

## Notification (next morning)

At 07:00 UTC the cron picks up editions dated today and fans out push + email (see `daily-operations.md`).

## Related docs

- `scoring-workflow.md` (the score-first step), `daily-operations.md`, `incident-response.md`.
- `../deployment/r2.md`, `../deployment/neon.md`, `../admin/maintenance.md` (unpublish), `../report-engine/` (engine internals — owned elsewhere).
