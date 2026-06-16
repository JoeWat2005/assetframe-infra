# Track-record export — `export_content.py` → `track-record.json`

## Purpose

The web app and the MCP/REST API never read the raw `ledger/outcome_ledger.csv`.
`scripts/export_content.py` reads the ledger (plus the registered predictions and
the report catalog) and builds **`web/content/track-record.json`** — the
JSON shape the website serves on `/track-record` and the agents read via
`get_track_record`. This document owns that JSON's full shape: `stats`, `open[]`,
`scored[]`, `calibration`, and every derived analytics array, including the ≥10-row
gates and the open-vs-scored distinction.

- **Script:** `scripts/export_content.py`
- **Reads:** `ledger/outcome_ledger.csv`, `data/predictions/*_predictions.json`,
  `reports/*/*/metadata.json` (for the catalog and ticker/asset-class backfill).
- **Writes:** `web/content/catalog.json` and `web/content/track-record.json`.
- **Note:** report files (free *and* Pro) are **not** copied into the web app —
  they live in private R2 and are served via `/api/report` (see the module
  docstring); `export_content.py` only emits the catalog + track-record JSON.

```
ledger/outcome_ledger.csv ─┐
data/predictions/*.json     ├─► export_content.py ─► web/content/track-record.json ─► /track-record, /api/mcp get_track_record, /api/v1/track-record
reports/*/*/metadata.json  ─┘
```

---

## 1. Top-level shape

`main()` assembles the `track` dict written to `track-record.json`:

```json
{
  "stats": { "reportsScored": 0, "openCalls": 0, "predictionsGraded": 0, "hitRate": null },
  "open": [ ... ],
  "scored": [ ... ],
  "calibration": null,
  "byInstrument": [],
  "byAssetClass": [],
  "byPredictionType": [],
  "byRegime": [],
  "timeline": [],
  "calibrationCurve": [],
  "componentVsOutcome": []
}
```

The arrays are **additive** — readers tolerate their absence/emptiness. On the
current empty ledger every count is 0/`null`/`[]` (the example above is the day-one
output shape).

### `stats` (the public headline)

Computed in `main()` directly from the CSV (`hits`, `misses`, row count):

- `reportsScored` — total ledger rows (`total`).
- `openCalls` — number of registered predictions files surfaced as open calls.
- `predictionsGraded` — `hits + misses` across all rows (the resolved Y/N count).
- `hitRate` — `round(100*hits/graded, 1)` or `null` when nothing is graded.

This is the number signed-out/free visitors see (the public accuracy headline).

---

## 2. `open[]` — open calls (and scored ones too)

Built in `load_track_record()` by scanning `data/predictions/*_predictions.json`
(sorted, then sorted by `windowEnd`). Each entry:

```jsonc
{
  "reportId": "...", "instrument": "...", "symbol": "...", "view": "...",
  "confidence": "...", "windowEnd": "...",
  "n": <#predictions>, "nManual": <#manual predictions>,
  "hits": <from ledger, 0 until scored>,
  "scored": <bool: reportId in scored_ids>,
  "predictions": [
    { "id": "P1", "type": "close_above", "text": "...", "manual": false,
      "expect": true|false|null, "verdict": "Y|N|NT|''", "predType": "breakout" },
    ...
  ]
}
```

Key behaviours:

- **Open calls stay in the list after scoring.** The comment in the source: *"Keep
  scored reports in the list too — their tracker flips from 0/n to hits/n."* `hits`
  comes from `hits_by_id` (the ledger), so a freshly scored report shows `hits/n`
  instead of `0/n`, and `scored` flips to `true`.
- **Per-prediction `verdict`** is merged from the ledger's packed `results` string
  via `verdicts_by_id` (see §5) — `""` until the report is scored.
- **`expect`** is coerced to bool-or-null so the JSON fallback matches the DB
  sync's coercion.
- **`predType`** is the edition-level archetype from the predictions file's
  `taxonomy.prediction_type`.

---

## 3. `scored[]` — one entry per ledger row

Built in `load_track_record()` from `csv.DictReader(ledger)`. One entry per row,
re-keyed to camelCase:

```jsonc
{
  "reportId": "...", "instrument": "...", "view": "...", "confidence": "...",
  "results": "P1=Y P2=N ...", "hits": "...", "misses": "...",
  "hitRate": "...",            // the ledger's hit_rate_pct
  "windowEnd": "...",
  "assetClass": "...",          // normalised via _norm_asset_class
  "predType": "..."
}
```

The raw packed `results` string is carried through so the UI can render per-call
verdicts (also pre-parsed into `open[].predictions[].verdict`). `assetClass` is
normalised by `_norm_asset_class` (maps free-text aliases like `equities→equity`,
`forex→fx`, `indices→index` onto the taxonomy keys; never raises).

---

## 4. `calibration` — the coarse 3-bucket view (≥10 rows)

The same 3 buckets as `score_report.py`'s summary, but computed here over the
ledger's own `hit_rate_pct` per row and **gated to `len(rows) >= 10`** (else
`null`):

```jsonc
{ "<=60": {"hitRate": <avg>, "n": <count>},
  "61-75": {...}, ">75": {...} }
```

For each row it reads `confidence` and `hit_rate_pct`, buckets by confidence
(`<=60` / `61-75` / `>75`), and reports the **mean per-report hit rate** in each
bucket plus `n`. (Note: this averages per-report hit rates, whereas the finer
`calibrationCurve` pools raw hits/misses — see §6.)

---

## 5. Per-call verdicts from `results` (no extra columns)

`_parse_results(packed)` turns `"P1=Y P2=N P3=NT"` into `{"P1":"Y","P2":"N","P3":"NT"}`,
tolerant of blanks. `load_track_record()` builds `verdicts_by_id[report_id]` from
each row's `results`, and `open[].predictions[].verdict` is looked up from it. This
is why per-call outcomes need **no migration and no extra ledger columns** — they
are decoded from the one packed string at export time. (The packed format itself is
owned by `outcome-scoring.md`.)

---

## 6. Derived analytics (`_build_aggregates`)

`_build_aggregates(rows)` produces the analytics arrays from the ledger rows. On an
empty ledger it returns all-empty (`{"byInstrument": [], …, "componentVsOutcome": []}`).
All counts come from the per-report `hits`/`misses` already in the ledger — **no new
scoring happens here.**

| Array | Grouping key | Each entry | Notes |
|---|---|---|---|
| `byInstrument` | `instrument` | `{instrument, ticker, assetClass, reportsScored, hits, misses, hitRate}` | Carries `ticker` + normalised `assetClass`. `ticker`/`assetClass` are **backfilled** in `main()` from the open calls' `symbol` and the catalog's asset class (the ledger stores neither the symbol nor a guaranteed class). Sorted by hitRate desc, then reportsScored desc. |
| `byAssetClass` | `_norm_asset_class(asset_class)` | `{assetClass, reportsScored, hits, misses, hitRate}` | Via the shared `_agg_rows` grouper + `_rename`. |
| `byPredictionType` | `pred_type` | `{predType, …}` | Empty `pred_type` rows skipped. |
| `byRegime` | `market_regime` | `{regime, …}` | Empty `market_regime` rows skipped. |
| `timeline` | chronological by `window_end_utc`, then `report_id` | `{reportId, instrument, windowEnd, perReportHitRate, cumulativeHitRate}` | The record as it grows: per-report hit rate **and** running cumulative hit rate. |
| `calibrationCurve` | 10-point confidence bins | `{bucket "lo-hi", confLo, confHi, reports, hits, misses, hitRate}` | **Gated to `len(rows) >= 10`** (else `[]`). Bins by `int(confidence//10)*10`, clamped to `0..90`. Pools raw `hits`/`misses` per bin → realised hit rate. Finer than the 3 display buckets. |
| `componentVsOutcome` | confidence **display band** | `{band, reports, avgConfidence, hitRate}` | Bands `Low` (<50) / `Moderate` (<65) / `Elevated` (<80) / `High` (≥80) via `_band`. Compares each band's **mean stated confidence** (`avgConfidence`) against its **realised hit rate** — surfaces over/under-confidence. Not gated to 10 rows (but only meaningful as rows accrue). |

`_agg_rows(rows, key_fn)` is the shared grouper: it sums `hits`/`misses` per key,
skips empty keys, computes `hitRate = round(100*hits/graded, 1)` (or `null`), and
sorts by hitRate desc → reportsScored desc → key.

### The ≥10-row gates

Two analytics are gated to `len(rows) >= 10`, matching the coarse summary's
threshold:

- `calibration` (the 3-bucket object) — `null` below 10 rows.
- `calibrationCurve` (the 10-point bins) — `[]` below 10 rows.

The other analytics (`byInstrument`, `byAssetClass`, `byPredictionType`,
`byRegime`, `timeline`, `componentVsOutcome`) appear as soon as there is at least
one row carrying the relevant key — they are not gated, since a per-group hit rate
is honest at any n (just noisy when small).

---

## 7. Open vs scored — the distinction

- **`open[]`** is sourced from the **predictions files** (`data/predictions/`), so it
  includes everything registered, scored or not. A scored report keeps its entry
  and flips `0/n → hits/n`, with `scored: true` and per-call verdicts filled in.
- **`scored[]`** is sourced from the **ledger**, so it is exactly the set of reports
  that have a row (i.e. whose window closed and was graded).
- `stats.openCalls` = number of predictions files; `stats.reportsScored` = ledger
  row count. On day one: predictions files exist (open calls > 0) but
  `reportsScored = 0`.

---

## 8. What serves this JSON, and the free/Pro split

`track-record.json` (not the CSV) is what the web app and MCP/REST serve:

- **Web:** `/track-record` renders it via `components/TrackRecordAnalytics.tsx`,
  fed through Neon (loaded by `web/scripts/sync-db.mjs`) with a JSON fallback
  (README §7).
- **MCP:** `get_track_record` (no auth) returns the public track record.
- **REST:** `GET /api/v1/track-record`.

**Free/Pro split** (README §7): signed-out and free visitors see the **public
accuracy headline** (and the homepage forecast-ledger strip); the full open-calls
list, scored results, and the analytics arrays are **Pro-only**. *NOT VERIFIED
here:* the exact server-side gating of which fields are withheld for free users
lives in the web layer (`components/TrackRecordAnalytics.tsx` / the page's data
loader) — verify there, not in `export_content.py`, which emits the full object.

---

## Command examples

```bash
# Build catalog + track-record JSON into web/content/ :
python scripts/export_content.py

# Point at a custom web dir / include dev (underscore-prefixed) editions:
python scripts/export_content.py --web web --include-dev
```

Output (printed): edition count, open-call count, scored-row count, and
`(calibration ready)` once ≥10 rows. It also reminds you that report files live in
private R2 (run `scripts/publish.py`).

---

## Edge cases

- **Empty / missing ledger:** `stats` counts are 0, `hitRate`/`calibration` are
  `null`, every analytics array is `[]`. `load_track_record` guards with
  `ledger_csv.exists() and ledger_csv.stat().st_size > 0` (a zero-byte file is
  treated as empty).
- **Predictions file unpar. seable:** skipped (`try/except` around `json.loads`).
- **Row missing taxonomy columns:** that row contributes nothing to the relevant
  grouping (empty keys are skipped) but still counts in `byInstrument`, `timeline`,
  and `stats`.
- **`confidence` not numeric:** skipped only for the calibration analytics
  (`calibration`, `calibrationCurve`, `componentVsOutcome`); the row still appears in
  `scored[]`.
- **Backfill misses:** if an instrument has no open call and no catalog entry, its
  `byInstrument` `ticker`/`assetClass` stay `""`.

---

## Related tests

- *NOT VERIFIED:* there is no `scripts/test_export_content.py` in the repo. The
  export's inputs are tested indirectly — `test_score_report.py` covers the packed
  `results` and hits/misses arithmetic that this script reshapes, and
  `test_ledger_context.py` covers the same taxonomy breakdowns. To add direct
  coverage, test `_parse_results`, `_agg_rows`, `_build_aggregates`, and the ≥10-row
  gates against a synthetic ledger.

## Related docs

- `outcome-scoring.md` — the source columns (`results`, `hits`, `confidence`,
  taxonomy) this export reshapes, and the packed-`results` format.
- `overview.md` — where this JSON sits in the ledger → web flow.
- `calibration.md` — distinguishes this 10-point `calibrationCurve` from
  `calibrate.py`'s fitted map and `score_report.py`'s 3-bucket summary.
