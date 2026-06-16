# `export_content.py` — engine → web content bridge

`scripts/export_content.py` is the bridge from the Python report pipeline to the Next.js app. It writes the **catalog** and **track-record** as JSON that the web app reads. Crucially, it does **not** copy report files into the web app — every report file (free Snapshots *and* Pro reports) is private in R2 and served only through the auth-gated `/api/report` route (module docstring lines 1–13; see [`publish.md`](./publish.md)).

## CLI

```
python scripts/export_content.py [--web web] [--reports reports] [--include-dev]
```

`argparse` (lines 324–328): `--web` (default `web`), `--reports` (default `reports`), `--include-dev` (flag). Relative paths resolve against the repo root (`ROOT = scripts/../`, line 21; lines 330–331).

## Inputs

- **`reports/*/*/metadata.json`** — one per published edition. `load_catalog()` (lines 84–116) globs `reports/<date>/<slug>/metadata.json`.
- **`ledger/outcome_ledger.csv`** — the append-only scored track record (lines 338, 341–346, 251–285).
- **`data/predictions/*_predictions.json`** — the registered (open + scored) predictions (lines 348–349, 287–317).

Asset-class normalisation reuses `taxonomy` (`ASSET_CLASS_KEYS`, `validate_asset_class`), with a pass-through fallback so a missing module can never break the export (lines 26–33). `_norm_asset_class()` (lines 36–48) maps free-text/legacy aliases (`equities→equity`, `forex→fx`, `future→futures`, …) onto taxonomy keys.

## Outputs (the two web JSONs)

Written to `<web>/content/` (lines 332–333, 386–387):

### `web/content/catalog.json`

A list of editions, newest first (sorted by `(date, slug)` reverse, line 115). Each edition (lines 96–114):

```
date, slug, instrument, ticker, assetClass, status, risk, bias, lastPrice,
dataQuality, windowEnd, reportDate, catalystStatus,
freeHtml, freePdf, preview, hasPro
```

The asset paths use the base `/api/report/<date>/<slug>` (line 95): `freeHtml`, `freePdf`, `preview` point at that route; `hasPro` is whether `pro.html` exists on disk. The internal `_dir` key is **deleted before writing** (lines 383–384) — it is only used to test `pro.html` existence, never serialised.

### `web/content/track-record.json`

Shape (lines 365–380): `{ stats, open[], scored[], calibration, byInstrument, byAssetClass, byPredictionType, byRegime, timeline, calibrationCurve, componentVsOutcome }`.

- **`stats`** (lines 366–369) — headline numbers from the raw ledger: `reportsScored`, `openCalls`, `predictionsGraded` (= hits+misses), `hitRate`.
- **`open[]`** — every predictions file (open *and* scored — a scored report's tracker flips from `0/n` to `hits/n`, lines 287–318). Each: `reportId`, `instrument`, `symbol`, `view`, `confidence`, `windowEnd`, `n`, `nManual`, `hits`, `scored` (bool), and `predictions[]` (per-prediction `id/type/text/manual/expect/verdict/predType`). Per-prediction `verdict` is merged from the ledger's packed `results` string (`_parse_results`, lines 51–58), so per-call outcomes need no extra ledger columns.
- **`scored[]`** — one row per ledger row (lines 265–275): `reportId`, `instrument`, `view`, `confidence`, `results`, `hits`, `misses`, `hitRate`, `windowEnd`, `assetClass`, `predType`.
- **`calibration`** — coarse 3-bucket calibration (`<=60` / `61-75` / `>75`) → `{hitRate, n}` (lines 276–285). **Only computed at ≥ 10 ledger rows** (`if len(rows) >= 10`, line 276), else `null`.

## Why report files are NOT copied

The export deliberately strips `_dir` and writes only JSON. The docstring (lines 3–6) and the closing print (line 393) make it explicit:

> Report files (free Snapshots AND Pro reports) are private in R2 (pushed by `scripts/publish.py`) and served only through the auth-gated `/api/report` route.

So the web app gets *metadata + paths*, never the report bytes — even free Snapshots require an account, and the path-traversal-guarded `/api/report` route is the single way in (`README.md` §10).

## Calibration gating

Both the coarse `calibration` (line 276) and the finer `calibrationCurve` (line 182) require **≥ 10 scored ledger rows** before they populate; below that they are `null` / `[]`. This matches the engine-wide rule that calibration is meaningful only at ≥10 rows (`SKILL.md`, `README.md` §7).

## The derived analytics arrays

`_build_aggregates(rows)` (lines 119–248) computes additive analytics from the scored ledger rows — **no new scoring** (all counts come from the per-report hits/misses already graded). An empty ledger yields empty arrays / object (lines 124–126).

| Array | Grouped by | Shape |
|---|---|---|
| `byInstrument` | instrument name | `{instrument, ticker, assetClass, reportsScored, hits, misses, hitRate}` (lines 129–150). Ticker + assetClass back-filled from open calls / catalog in `main()` (lines 351–362). |
| `byAssetClass` | `_norm_asset_class(asset_class)` | `{assetClass, reportsScored, hits, misses, hitRate}` |
| `byPredictionType` | `pred_type` | `{predType, …}` |
| `byRegime` | `market_regime` | `{regime, …}` |
| `timeline` | chronological by `window_end_utc` | `{reportId, instrument, windowEnd, perReportHitRate, cumulativeHitRate}` (lines 163–176) |
| `calibrationCurve` | 10-point confidence bins | `{bucket, confLo, confHi, reports, hits, misses, hitRate}`; gated to overall n ≥ 10 (lines 181–200) |
| `componentVsOutcome` | confidence display band (Low/Moderate/Elevated/High) | `{band, reports, avgConfidence, hitRate}` — surfaces over/under-confidence (lines 205–243) |

`_agg_rows()` (lines 61–81) is the shared grouping helper (skips empty keys, sorts by hitRate desc then count). The flat groupings are renamed to their public key by `_rename()` (lines 152–154).

The `byInstrument` ticker/assetClass back-fill (lines 351–362) exists because the ledger carries neither the symbol nor a guaranteed asset class — they are matched on instrument name from the open calls (`symbol`) and the catalog (`assetClass`).

## Edge cases / robustness

- A malformed `metadata.json` or predictions file is skipped (`try/except`, lines 90–91, 290–291).
- `--include-dev` controls whether date directories starting with `_` are included (line 88) — those are dev/staging editions.
- All counts coerce missing values to 0 (`int(r.get("hits", 0) or 0)` throughout), so legacy/partial rows never raise.

## Output (stdout)

Prints the content dir, edition count, open-call count, scored-row count (`(calibration ready)` when ≥10), and the reminder that all report files are private in R2 (lines 389–393).

## Where this fits

This is **step 12** of the publishing routine (`README.md` §3, §8): `export_content.py` → `publish.py` → `web/scripts/sync-db.mjs`. The two JSONs are loaded into Neon by `sync-db.mjs` (or read directly as a JSON fallback when `DATABASE_URL` is unset). The track-record analytics feed `components/TrackRecordAnalytics.tsx` (`README.md` §7).

## Related docs

- [`publish.md`](./publish.md) — pushes the actual report files to private R2.
- [`generated-artifacts.md`](./generated-artifacts.md) — the `metadata.json` fields this script reads.
- [`overview.md`](./overview.md) — the full publishing routine.
- `../ledger/` — the `outcome_ledger.csv` schema and scoring.
- `../website/` — how the web app consumes `catalog.json` / `track-record.json`.

## Tests

No dedicated `scripts/test_export_content.py` exists. **`NOT VERIFIED`** by a Python unit test; the web side exercises the consuming code via `npm test` (Vitest filtering/sorting), per `README.md` §9. To verify the export shape directly, run it against a populated `reports/` + ledger and inspect `web/content/*.json`.
