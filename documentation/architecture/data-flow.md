# Data flow — tracing a figure end-to-end

> Part of the AssetFrame `/documentation` vault → `architecture/`.
> See also: [system-overview.md](./system-overview.md) ·
> [generation-pipeline.md](./generation-pipeline.md) ·
> [distribution-pipeline.md](./distribution-pipeline.md) ·
> [trust-boundaries.md](./trust-boundaries.md) · [directory-map.md](./directory-map.md)

This doc follows individual numbers from the upstream data source all the way to the web app,
so you can answer "where did *this* figure come from?" for any value on a report. It also
shows where the ledger feeds **back** in (under no-look-ahead).

## The directories a figure passes through

```
Yahoo / EODHD
   │  intraday.py
   ▼
data/candles/<NAME>_hourly.csv        ← raw OHLC (gitignored)
data/candles/<NAME>_daily.csv         ← raw OHLC (gitignored)
data/analysis/<NAME>_analysis.json    ← indicators/pivots/bands/freshness (gitignored)
   │  scaffold_payload.py  (+ confidence.py, taxonomy.py, sessions.py)
   ▼
data/payloads/<NAME>_af_payload.json  ← canonical levels/setups/ladder/confidence (gitignored)
data/predictions/<NAME>_predictions.json ← registered P1..P6 + taxonomy (gitignored)
   │  mvp_report.py  (QA gate; + report_pdf.py charts)
   ▼
reports/<date>/<slug>/{free,pro}.{pdf,html} + metadata.json + preview.png   (gitignored)
   │  export_content.py
   ▼
web/content/catalog.json + web/content/track-record.json   (TRACKED in git)
   │  publish.py → R2 (files)      sync-db.mjs → Neon (data)
   ▼
Next.js app: /reports, /track-record, /api/report, /api/v1, /api/mcp
```

Everything under `data/` and `reports/` is **gitignored** (`mvp/.gitignore`). Only
`web/content/*.json` crosses into git/Neon, plus the tracked-but-not-yet-existing
`ledger/outcome_ledger.csv` (see [system-overview.md](./system-overview.md#current-state-day-one--empty-ledger)).

---

## Trace 1 — the last price (the strictest path)

The last price is the figure with the hardest integrity guarantee: it must be **identical**
in three places.

1. **Source → CSV.** `intraday.py` fetches OHLCV (`fetch_chart()` lines 185-210) and writes
   the hourly CSV row by row (`main()` lines 499-503). Column 0 is the UTC timestamp, column
   4 is the close.
2. **CSV → canonical.** `scaffold_payload.read_last_bar()` reads the *last* data row of the
   hourly CSV and rounds column 4 to a sensible precision (lines 71-81). That value becomes
   `payload.canonical.last_price.value` (assembled lines 293-303) and is also injected as the
   `anchor` canonical level (`build_levels()` line 151). The AI never types this number — the
   brief carries no prices.
3. **Canonical → header/metadata.** `assemble()` copies it into `meta.last_price`
   (line 328) and the report header. The Pro price ladder and the Free "Last price" card both
   render from the same canonical object (`mvp_report.price_ladder()`, `key_levels_strip()`).
4. **QA enforcement.** `mvp_report.run_qa()` re-reads the hourly CSV's last close and asserts
   `|csv_last − canonical_last| ≤ max(0.01, last·1e-5)`, and that `meta.last_price` is
   non-empty (lines 803-811). A mismatch aborts the build. This is the **price
   triple-equality** boundary
   ([trust-boundaries.md](./trust-boundaries.md#price-integrity--data-quality)).
5. **metadata → catalog → app.** `export_content.load_catalog()` reads `metadata.json` and
   sets `lastPrice` in `catalog.json` (line 105); `sync-db.mjs` would carry it via the
   editions upsert; the app shows it on the reports list and reader.

**Net effect:** the price the reader sees is provably the hourly CSV's last close, unaltered,
because the scaffold reads it from the CSV and the QA gate compares them.

---

## Trace 2 — a level (e.g. a pivot or ATR band)

1. **Engine computes it.** `intraday.compute_pivots_bands()` derives classic floor pivots
   (PP, R1–R3, S1–S3) from the prior session HLC and ATR day-bands from the anchor close +
   daily ATR (lines 398-426). With `--anchor != live`, these are recomputed on a chosen
   completed session and overwrite `pivots_classic` / `atr_day_bands` (lines 645-655). Output
   lands in `data/analysis/<NAME>_analysis.json` under `pivots_classic`, `atr_day_bands`, and
   `hourly.swing_highs/lows`.
2. **Scaffold canonicalises it.** `scaffold_payload.build_levels()` maps those into a fixed
   id+class catalog (`r2, tail_hi, swing_hi, r1, inner_hi, pp, anchor, s1, inner_lo, swing_lo,
   s2, tail_lo`), rounds, de-dupes by value, and sorts high→low (lines 128-169). **Every price
   that appears anywhere in the report lives once, here.**
3. **Setups/ladder/predictions reference it by value.** `build_setups()` picks
   entry/invalidation/T1/T2 as level *values* (lines 184-216); `build_ladder()` and
   `build_predictions_spec()` reference the same ids (lines 219-279). Nothing is free-typed,
   so a level can't drift between the body, the ladder, and the registered prediction.
4. **QA enforces identity.** `run_qa()` checks that every setup, ladder, and ledger price is a
   canonical level value (lines 817-845) — abort on any stray number.
5. **Render.** `report_pdf.py` draws the ladder/charts; the Free chart is limited to ≤3
   labelled levels with no pivots/bands (enforced both in the scaffold's `_assert_free_split`
   and the QA gate, see Trace 4).

---

## Trace 3 — a registered prediction (P1..P6) and its later verdict

1. **Compiled, not authored.** `scaffold_payload.build_predictions_spec()` emits P1..P6,
   each a falsifiable statement bound to a canonical level id, plus a `setup` block and the
   taxonomy block (lines 236-279). Written to
   `data/predictions/<NAME>_predictions.json` with `window_start_utc` / `window_end_utc` from
   the session profile and `payload.confidence == predictions.confidence`
   (`scaffold_payload.main()` lines 633-644).
2. **Surfaced as an open call.** `export_content.load_track_record()` reads the predictions
   files into `track-record.json`'s `open[]` (lines 287-318); `sync-db.mjs` loads them into
   the `open_calls` + `open_call_predictions` tables (lines 83-110). The app shows them on
   `/track-record` (Pro) and the homepage strip.
3. **Scored after the window closes.** On a later run, `score_report.py` grades each
   prediction against the hourly CSV bars inside the window (`score_prediction()` lines
   131-162) and appends one row to `ledger/outcome_ledger.csv` — verdicts Y / N / NT / MANUAL,
   hit rate = Y/(Y+N) (lines 252-275). The ledger is append-only.
4. **Verdict flows back to the app.** The next `export_content.py` parses the ledger's packed
   `results` string (`_parse_results()` lines 51-58) and merges each per-call verdict onto the
   open-call predictions (lines 298-309); the open call's `scored` flips true and its `hits`
   update. `sync-db.mjs` re-inserts the snapshot.

So a prediction is *registered before* its window and *graded after* it — the registration
and the grading touch different files, and the grading is append-only, which is what makes
the track record an audit rather than a claim.

---

## Trace 4 — the confidence number

The confidence figure is the most composite. It is **computed by `confidence.py`, explained
by the AI, and never set by the AI**.

1. **Inputs assembled by the scaffold.** `scaffold_payload.main()` calls
   `confidence.compute_confidence(analysis, primary_setup, brief, research, social,
   ledger_ctx, calib, …)` (lines 625-628), passing the engine analysis, the chosen primary
   setup, the brief's claims, the research pack, the optional social pack, the ledger context,
   and the calibration map.
2. **The blend.** `raw = 50·market + 30·ledger + 20·catalyst + social_adj`
   (`compute_confidence()` lines 355-356; `WEIGHTS` line 32):
   - **market** ← analysis + setup (trend, momentum, structure, R:R, volatility,
     `compute_dq`), `market_confidence()` lines 184-195;
   - **ledger** ← the ledger context's realised hit rates, Bayesian-shrunk,
     `ledger_confidence()` lines 200-226 — *this is the feedback path, see below*;
   - **catalyst** ← the brief's sourced claims traced against the research pack,
     `catalyst_confidence()` lines 231-257;
   - **social_adj** ← subtract-only penalty from the social pack, `social_adjustment()` lines
     274-291.
3. **Caps then calibration.** `capped = min(raw, hard_caps)` (lines 358-374), then
   `published = calibrate(capped)` via the isotonic knots from `calibration_map.json`
   (`_apply_calibration()` lines 323-341). The breakdown dict carries `components[]`,
   `caps_applied[]`, `raw`, `capped`, `published`, `band`, `conf_version`.
4. **Written to both files.** The published int goes into `payload.confidence` *and*
   `predictions.confidence`; `predictions.conf_raw` records the pre-calibration capped score
   (`scaffold_payload.main()` lines 636-637) — that `conf_raw` is exactly what `calibrate.py`
   later fits on, closing the loop without a feedback contamination.
5. **Rendered + QA'd.** The Pro scorecard renders the component table + caps + calibration
   note (`scaffold._scorecard_html()` lines 529-541); `mvp_report` mirrors confidence into
   `metadata.json` and the human checks "confidence explanation matches the computed score".
6. **Into the app.** `export_content.py` carries the `confidence` column into
   `track-record.json` and uses it for the calibration buckets / curve (lines 276-285,
   181-200); `sync-db.mjs` loads it into `scored_results` / `editions`. The track-record
   calibration compares **stated confidence vs realised hit rate** — the public proof that the
   number means something.

---

## The feedback loop (how the ledger feeds back in, under no-look-ahead)

The ledger is both the *output* of scoring and an *input* to the next report — but only ever
backward in time:

```
outcome_ledger.csv ──► ledger_context.py ──► data/ledger_context/<NAME>_ledger_context.json
                                                  │                         │
                                                  ▼                         ▼
                                      (handed to the AI before        confidence.ledger_confidence()
                                       it writes the brief)           (the 30% ledger block)
outcome_ledger.csv ──► research_memory.py ──► ledger/research_memory.json (cross-instrument)
outcome_ledger.csv ──► calibrate.py ──► ledger/calibration_map.json ──► confidence published score
```

The **no-look-ahead invariant** is enforced at the read: `ledger_context.load_rows()` and
`research_memory.load_rows()` skip any row whose `window_end_utc` is not strictly before
`--as-of` (default now) — `ledger_context.py` line 56, `research_memory.py` line 52. Because
scoring also only happens after a window closes (`score_report.py` lines 226-230), a report
can never be influenced by its own (or any future) outcome. `calibrate.py` additionally
filters to the current `conf_version` and fits on `conf_raw`, so the published score the AI
sees is never fed back into its own calibration input
([trust-boundaries.md](./trust-boundaries.md#no-look-ahead)).

**On day one** (no `outcome_ledger.csv`), every backward read returns empty/neutral: the
ledger block is a 0.5 prior (`confidence.ledger_confidence()` line 205), the context notes
"no scored history yet" (`ledger_context._patterns_and_notes()` lines 173-176), and the
calibration map is identity. The market and catalyst components carry the score until the
ledger fills.

---

## What is gitignored vs tracked (figure provenance)

| File | Holds the figure as… | Tracked? |
|---|---|---|
| `data/candles/*.csv` | raw OHLC (the source close) | gitignored |
| `data/analysis/*.json` | indicators, pivots, bands, freshness | gitignored |
| `data/payloads/*.json` | canonical levels, setups, ladder, confidence breakdown | gitignored |
| `data/predictions/*.json` | registered P1..P6 + taxonomy + confidence | gitignored |
| `reports/<date>/<slug>/metadata.json` | the published figures (last price, bands, confidence) | gitignored |
| `web/content/catalog.json` | per-edition figures for the app | **tracked** |
| `web/content/track-record.json` | scored stats, calibration, open calls | **tracked** |
| `ledger/outcome_ledger.csv` | the scored truth (does not exist yet) | tracked (when written) |
| `ledger/calibration_map.json` | the isotonic map | gitignored (derived) |
| `ledger/research_memory.json` | cross-instrument patterns | gitignored (derived) |

So the only figures that reach git/Neon are the ones the engine has already validated through
the QA gate and exported into `web/content/` — never the raw working data.
