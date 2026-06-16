# Scoring workflow

AssetFrame's credibility rests on an **append-only, after-the-fact** track record. Every Pro edition registers falsifiable predictions before the session; after the window closes they are graded against the price tape and written, once, to the ledger. This doc covers the operational scoring step. The engine internals (the per-prediction graders, the confidence math) are tested in `../testing/unit-tests.md` and live in `../confidence/` / `../ledger/` (owned elsewhere).

## Order of operations (score FIRST, then generate)

Scoring runs **before** today's reports are generated, so today's confidence can use an up-to-date calibration map without ever seeing the future:

```
1. score_report.py     grade expired prediction windows -> APPEND rows to ledger/outcome_ledger.csv
2. calibrate.py        refit the per-confidence calibration map -> ledger/calibration_map.json
3. ...then generate today's editions (publication-workflow.md)
```

The `/mvp` skill does step 1+2 automatically as part of a run. They can also be run by hand.

## `score_report.py`

- Reads a predictions file (`data/predictions/<NAME>_predictions.json`) whose window has closed.
- Grades each prediction against the price tape. Verdicts: **Y** (true), **N** (false), **NT** (no-trigger — the condition never armed), **MANUAL** (needs a human verdict). Hit rate = Y / (Y + N); unresolved manuals are excluded.
- Prediction mechanics covered (see `test_score_report.py`): `close_above`/`close_below`, `range_inside`, `touches`, `no_close_above`/`no_close_below`, and the `*_after_touch` variants; plus the setup grader (fill -> t1-first / invalidation-first / open-at-window-end / never-fills).
- **Appends one row per scored report** to `ledger/outcome_ledger.csv`. Never rewrites or reorders existing rows.

### Flags

| Flag | Effect |
| --- | --- |
| `--dry-run` | Compute and print; write nothing to the ledger. |
| `--manual ID=V[,ID=V...]` | Resolve manual-type predictions (e.g. `--manual P5=Y,P6=NT`). Validated: an unknown id or a non-manual id exits 2; a bad verdict is rejected. |
| `--force` | Score an open/partial window or accept an hourly CSV that stops >75 min short (early close / holiday). Use deliberately. |

Example:
```bash
python scripts/score_report.py data/predictions/XAUUSD_predictions.json --dry-run
```

## The ledger — `ledger/outcome_ledger.csv`

- **Append-only. Hard rule.** Rows are never edited, reordered, or deleted; an incomplete window is never scored (except with `--force` for documented early-close cases). This is enforced socially (the rule) and verified by the test that two scoring runs only ever grow the file and the second read begins byte-for-byte with the first (`test_score_report.py::TestAppendOnlyLedger`).
- Columns (per README): the 13 original columns (`scored_at_utc`, `report_id`, `instrument`, `view`, `confidence`, `window_end_utc`, `results`, `hits`, `misses`, `hit_rate_pct`, `setup_filled`, `setup_outcome`, `partial`) plus additive V2 columns (`conf_version`, `conf_raw`, `asset_class`, `pred_type`, `direction`, `horizon`, `market_regime`); legacy rows read the new columns as empty.
- To **correct** a wrong score, append a correction / supply a manual verdict — do not edit history (see `../deployment/rollback.md`).

## `calibrate.py`

- Reads the ledger and fits an isotonic (PAVA) calibration map with shrinkage toward identity, written to `ledger/calibration_map.json`.
- Falls back to an **identity map** when the ledger is empty or below `min_rows` (5) — so confidence is never distorted by too-little data. Calibration buckets (`<=60`, `61-75`, `>75`) become meaningful at ~>=10 scored rows.
- `confidence.py` then applies this map to turn a `capped` score into the `published` score. Confidence is a calibrated 0-100 score graded after the fact — **not** a probability of profit or a trade signal.

```bash
python scripts/calibrate.py --dry-run
```

## How scored data reaches the website

The track record on `/track-record` and `/api/v1/track-record` is **not** read live from the CSV. After scoring, `export_content.py` writes `web/content/track-record.json` and `sync-db.mjs` loads it into Neon (`open_calls`, `open_call_predictions`, `scored_results`), replacing the prior snapshot. See `publication-workflow.md`.

## No-look-ahead guarantee

`ledger_context.py` / `research_memory.py` only aggregate rows whose window closed **strictly before** the `as_of` timestamp (`test_ledger_context.py`). This is what lets a fresh report use historical hit rates as a confidence input without leaking the outcome it is trying to predict.

## Related docs

- `publication-workflow.md`, `daily-operations.md`, `../deployment/rollback.md` (never edit the ledger).
- `../testing/unit-tests.md` (`test_score_report.py`, `test_calibrate.py`, `test_confidence.py`, `test_ledger_context.py`).
- `../confidence/`, `../ledger/`, `../predictions/` (engine internals — owned elsewhere).
