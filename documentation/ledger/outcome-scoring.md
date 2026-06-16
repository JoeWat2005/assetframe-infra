# Outcome scoring — the ledger row in full

## Purpose

This document owns the **ledger row schema**: every one of the 20 columns in
`ledger/outcome_ledger.csv`, what it means, and how `scripts/score_report.py` fills
it. It also documents the packed `results` format, the hits/misses/hit-rate
arithmetic, the partial flag, the V2 taxonomy/confidence columns, and the per-run
3-bucket `calibration()` summary printed by `score_report.py`.

It does **not** re-document the per-mechanic grading (how a `close_above` or a
`range_inside` prediction becomes Y / N / NT, or how the setup grader decides
`t1-first` vs `invalidation-first`). Those mechanics are owned by
**`../predictions/scoring.md`** — cross-linked throughout. Here we own the
**columns**.

- **Schema source of truth:** `LEDGER_COLS` in `scripts/score_report.py`.
- **Writer:** `score_report.py` `main()` (builds `row`, appends it).
- **Input file format:** the `predictions.json` registered in `data/predictions/`
  at report time (schema documented at the top of `score_report.py` and in
  `../predictions/`).

---

## 1. The 20 columns (exact order)

`LEDGER_COLS` — the first 13 are the original schema (never reordered); the
trailing 7 are additive V2 columns (legacy rows read these back as `""` via
`DictReader`). The `row` list in `main()` is built in this exact order.

| # | Column | Filled from (in `main()` / source) | Meaning |
|---|---|---|---|
| 1 | `scored_at_utc` | `now.strftime("%Y-%m-%d %H:%M")` | UTC timestamp the row was written (when scoring ran), `YYYY-MM-DD HH:MM`. |
| 2 | `report_id` | `p["report_id"]` | The edition's id, e.g. `AF-20260612-WTI-PRO`. Joins the row to its predictions file and to the catalog. |
| 3 | `instrument` | `p["instrument"]` | Display name, e.g. `GBP/JPY`, `WTI`. Used for per-instrument aggregation. |
| 4 | `view` | `p.get("view", "")` | The report's stated directional view, e.g. `Constructive`, `Neutral`. |
| 5 | `confidence` | `p.get("confidence", "")` | The **published** confidence number (post-calibration). Drives the 3-bucket calibration summary and the export's calibration analytics. |
| 6 | `window_end_utc` | `p["window_end_utc"]` | The prediction window's close, UTC `YYYY-MM-DD HH:MM`. **The no-look-ahead key** — readers filter strictly on this. |
| 7 | `results` | `" ".join(f"{k}={v}" …)` | The packed per-prediction verdict string, e.g. `P1=Y P2=N P3=NT`. See §2. |
| 8 | `hits` | `sum(1 for v in results.values() if v == "Y")` | Count of `Y` verdicts. |
| 9 | `misses` | `sum(1 for v in results.values() if v == "N")` | Count of `N` verdicts. |
| 10 | `hit_rate_pct` | `round(100*hits/(hits+misses), 1)` or `None` | Report-level hit rate = `100·hits/(hits+misses)`. Empty when nothing was gradeable (no Y/N). |
| 11 | `setup_filled` | `score_setup(...)[0]` → `"yes"`/`"no"` | Did the conditional entry zone fill within the window? |
| 12 | `setup_outcome` | `score_setup(...)[1]` | What happened after fill: `t1-first` / `invalidation-first` / `open-at-window-end` / `n/a`. See §3. |
| 13 | `partial` | `"yes" if partial else "no"` | Whether the window was scored before its nominal end (via `--force`: open window or genuine early close). |
| 14 | `conf_version` | `p.get("conf_version", "")` | The confidence-engine version that produced the score. `calibrate.py` filters on this so old-era scores don't contaminate the fit. |
| 15 | `conf_raw` | `p.get("conf_raw", "")` | The **capped pre-calibration** score (before any map was applied). **This is what `calibrate.py` fits on** — see `calibration.md`. |
| 16 | `asset_class` | `tax.get("asset_class", "")` | Taxonomy: `equity` / `crypto` / `fx` / `futures` / `index` / `commodity`. |
| 17 | `pred_type` | `tax.get("prediction_type", "")` | Taxonomy: the primary prediction archetype, e.g. `breakout` / `rejection` / `continuation` / `mean_reversion` / `range_hold` / `volatility_expansion`. |
| 18 | `direction` | `tax.get("direction", "")` | Taxonomy: e.g. `bullish` / `bearish` / `neutral`. |
| 19 | `horizon` | `tax.get("horizon", "")` | Taxonomy: e.g. `next_session`. |
| 20 | `market_regime` | `tax.get("market_regime", "")` | Taxonomy: e.g. `trend_up`, `range`, `high_volatility`. The `pred_type × market_regime` cross is the "learning" dimension in `research_memory.py`. |

`tax = p.get("taxonomy") or {}` in `main()`; the taxonomy block is written into the
predictions file by the engine (SKILL.md step 9 / `../predictions/`). The exact
enum values are owned by `taxonomy.py` and `../predictions/` — *the values above are
illustrative; mark any specific enum value `NOT VERIFIED` against `taxonomy.py`
before quoting it as exhaustive.*

---

## 2. The packed `results` string

Column 7 packs every prediction's verdict into one space-separated token list:

```
P1=Y P2=N P3=NT P5=MANUAL
```

- Built in `main()` as `" ".join(f"{k}={v}" for k, v in results.items())`, where
  `results = {q["id"]: score_prediction(q, bars) …}` then `results.update(opts["manual"])`.
- **Verdict vocabulary** (per `score_prediction` and the manual override):
  - `Y` — the prediction came true.
  - `N` — it did not.
  - `NT` — the condition never triggered (e.g. a touch-conditional whose touch
    never happened, or no bars in the window).
  - `MANUAL` — needs human input; left unresolved. Excluded from hits/misses.
  - `UNKNOWN(<type>)` — an unrecognised prediction type (defensive; should not
    occur for valid files).
- It is **parsed back** by `export_content.py` (`_parse_results`) to surface
  per-call verdicts on the track record without any extra ledger columns — see
  `track-record-export.md`.

The grading *mechanics* that decide each verdict (the eight prediction types, the
touch-after logic, etc.) live in `../predictions/scoring.md` and
`score_prediction()`; this doc only owns how the verdicts are packed into the row.

### hits / misses / hit_rate_pct

```
hits         = number of Y verdicts
misses       = number of N verdicts
hit_rate_pct = round(100 * hits / (hits + misses), 1)   # None if (hits+misses) == 0
```

`NT` and `MANUAL` are deliberately excluded from both the numerator and the
denominator — only resolved directional calls (Y/N) count. The same arithmetic is
re-applied downstream (cumulative in `score_report.py`'s summary; per-group in
`export_content.py`).

---

## 3. The setup outcome (columns 11–12)

`score_setup(s, bars)` grades the report's conditional setup (entry zone +
invalidation + T1) and returns `(setup_filled, setup_outcome)`:

- **`setup_filled`** = `"yes"` if the entry zone was touched within the window,
  else `"no"`. With no setup or no bars it returns `("no", "n/a")`.
- **`setup_outcome`** ∈
  - `t1-first` — after filling, T1 was reached before the invalidation level.
  - `invalidation-first` — the invalidation level was hit first.
  - `open-at-window-end` — filled but neither T1 nor invalidation reached by the
    window end.
  - `n/a` — never filled (or no setup/bars).

Direction matters: for a long, the entry triggers on `low ≤ entry_hi` and
invalidation on `low ≤ invalidation`; for a short the comparisons mirror. The
precise fill/first-touch logic is owned by `../predictions/scoring.md`; tested by
`TestScoreSetup` in `test_score_report.py` (`test_long_t1_first`,
`test_long_invalidation_first`, `test_never_fills`, `test_open_at_window_end`).

---

## 4. The per-run `calibration()` summary

After appending the row, `main()` recomputes a **cumulative** ledger summary and
prints it as JSON. The summary always includes `report_id`, `partial`, `dry_run`,
`results`, `hit_rate_pct`, `unresolved_manual`, `setup_filled`, `setup_outcome`,
`ledger_reports` (total rows), and `cumulative_hit_rate_pct`.

It gains a `calibration` block **only once the ledger holds ≥ 10 reports**
(`calibration(rows)` returns `None` below that — `len(rows) < 10`). The block is the
**coarse 3-bucket** view of stated-confidence vs realised hit rate:

- Buckets by stated `confidence`: **`<=60`**, **`61-75`**, **`>75`** (via
  `confidence_bucket`, shared with `taxonomy.py` and the web's `lib/content.ts`).
- For each non-empty bucket: `{reports, hits, misses, hit_rate_pct}`.
- Interpretation (from the module docstring): *stated confidence should track the
  realised hit rate; if it doesn't, the confidence rubric needs recalibrating.*

```python
# score_report.py
def calibration(rows):
    if len(rows) < 10:
        return None
    # buckets keyed by confidence_bucket(r["confidence"]) -> reports, hits, misses
    ...
```

Tested by `TestCalibrationSummary` in `test_score_report.py`
(`test_none_below_10_rows`, `test_buckets_at_10_rows`).

> **Three distinct calibration concepts — do not confuse them** (full treatment in
> `calibration.md`):
> 1. **This** `calibration()` summary — a coarse **3-bucket** *diagnostic* printed
>    per run at ≥10 rows. It changes nothing; it just tells you if the rubric drifts.
> 2. **`calibrate.py`** — fits the actual **calibration map** (`ledger/calibration_map.json`)
>    on `conf_raw`. This *adjusts future published confidence*.
> 3. **`export_content.py`** — builds a finer **10-point** `calibrationCurve` (and a
>    3-bucket `calibration`) for the web track record.

---

## 5. Day-one state

`ledger/outcome_ledger.csv` does not yet exist (nothing has been scored). The first
`score_report.py` run on a closed window will create it, write the header
(`LEDGER_COLS`), and append the first row. Until then:

- `calibration()` would return `None` regardless (0 < 10 rows).
- `cumulative_hit_rate_pct` is `None` (no Y/N anywhere).
- `research_memory.json` is the empty "no memory yet" object and
  `calibration_map.json` is the identity map (both verified present in `ledger/`).

`data/predictions/` already holds the registered open calls (AAPL, BTC, ES, GOLD,
WTI, …) that will produce the first rows once their windows close — including
non-clobbering pairs like `AAPL_predictions.json` + `AAPL_af_predictions.json` (the
"don't overwrite an unscored window" rule, SKILL.md step 10).

---

## Command examples

```bash
# Score a closed window and print the cumulative summary:
python scripts/score_report.py data/predictions/WTI_predictions.json

# Dry-run: see the would-be row's verdicts + summary without writing:
python scripts/score_report.py data/predictions/WTI_predictions.json --dry-run

# Resolve a manual prediction's verdict at scoring time:
python scripts/score_report.py data/predictions/GBPJPY_predictions.json --manual P5=Y
```

---

## Edge cases

- **All predictions `NT`/`MANUAL`:** `hits = misses = 0`, so `hit_rate_pct` is
  empty (`None`); the row is still recorded with its `results` string.
- **Legacy rows missing the V2 columns:** read back as `""` via `DictReader` — they
  still count toward instrument/overall hit rates but contribute nothing to
  taxonomy breakdowns (which skip empty keys).
- **PARTIAL rows:** `partial = "yes"`; they are counted like any other row in
  hit-rate aggregation — partiality is recorded, not excluded. (Downstream readers
  may surface the flag but do not currently drop partial rows — *verify against the
  specific reader if exclusion is ever required.*)
- **`UNKNOWN(<type>)` verdict:** counts as neither hit nor miss (only `Y`/`N` do);
  signals a malformed prediction type to fix upstream.

---

## Related tests

- `scripts/test_score_report.py` — `TestScoringMechanics` (every verdict type),
  `TestScoreSetup` (the four setup outcomes), `TestCalibrationSummary` (the 3-bucket
  summary gating), `TestAppendOnlyLedger` (the row is appended verbatim).

## Related docs

- `../predictions/scoring.md` — **owns** the per-mechanic grading (how each verdict
  and setup outcome is computed). Cross-link, do not duplicate.
- `append-only-design.md` — how the row is appended and why columns never reorder.
- `track-record-export.md` — how `results`/`hits`/`confidence` are reshaped for the
  web.
- `calibration.md` — the three calibration concepts and the map fit on `conf_raw`.
